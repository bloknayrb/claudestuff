import type { EngineInterface, Register } from 'claude-code'

import type { Claim, Ledger } from '../types'
import { findClaims } from './claims'
import {
  asOfNow,
  classify,
  closeTurn,
  configOf,
  DEFAULT_BUILD_COMMANDS,
  DEFAULT_TEST_COMMANDS,
  emptyLedger,
  factsOf,
  hhmm,
  listOption,
  markBacked,
  noteClaims,
  noteText,
  readBack,
  record,
  restoreLedger,
} from './evidence'
import type { Config, Fired, Ran } from './evidence'
import { applyFlush, countersOf, reportText, ringOf } from './stats'

const LEDGER = { plugin: 'claim-ledger', key: 'ledger' } as const
const REPORT_FAILED = 'Claim Ledger: the report failed; see the health file.'
const TRAIL_CAP = 200

// The module holds the authoritative ledger; $.state mirrors it so a hot reload can restore it.
let ledger: Ledger = emptyLedger()
let home: string | null = null
// %TEMP%: writes under it are not code edits.
let temp: string | null = null
let loadedAt = 0
let lastError: { ts: number; message: string } | null = null
// The session id the health file was last written under: /clear changes it with no session.start.
let healthId: string | null = null
// This session's runs, edits, verdicts and append attempts, one JSON object per line. Starts over at a reload.
let trail: string[] = []
let trailDirty = false

function trace(event: Record<string, unknown>): void {
  trail.push(JSON.stringify(event))
  if (trail.length > TRAIL_CAP) trail.splice(0, trail.length - TRAIL_CAP)
  trailDirty = true
}

const errText = (err: unknown): string => (err instanceof Error ? err.message : String(err))
const stateDir = (): string | null => (home === null ? null : `${home}/.claude/state/mods/claim-ledger`)

async function homeOf($: EngineInterface): Promise<string | null> {
  const profile = await $.env.get('USERPROFILE')
  if (profile !== undefined && profile !== '') return profile.replace(/\\/g, '/')
  const posix = await $.env.get('HOME')
  return posix !== undefined && posix !== '' ? posix.replace(/\\/g, '/') : null
}

async function writeHealth($: EngineInterface): Promise<void> {
  try {
    const dir = stateDir()
    if (dir === null) return
    const id = await $.session.id()
    healthId = id
    await $.fs.write(`${dir}/${id}.json`, `${JSON.stringify({ loadedAt, lastError })}\n`)
  } catch {
    // Best effort: a missing heartbeat reads as unknown, never as ok.
  }
}

/** The heartbeat under a new session id, at the first main-loop event after /clear. */
async function followSession($: EngineInterface): Promise<void> {
  try {
    if ((await $.session.id()) !== healthId) await writeHealth($)
  } catch {
    // Best effort, as writeHealth.
  }
}

async function noteFailure($: EngineInterface, where: string, err: unknown): Promise<void> {
  const message = `${where}: ${errText(err)}`
  try {
    $.ui.log(`claim-ledger: ${message}`, { to: 'debug' })
    lastError = { ts: await $.clock.now(), message }
  } catch {
    lastError = { ts: 0, message }
  }
  await writeHealth($)
}

async function writeTrail($: EngineInterface): Promise<void> {
  if (!trailDirty) return
  trailDirty = false
  try {
    const dir = stateDir()
    if (dir === null) return
    await $.fs.write(`${dir}/trail/${await $.session.id()}.jsonl`, `${trail.join('\n')}\n`)
  } catch (err) {
    await noteFailure($, 'trail', err)
  }
}

async function mirror($: EngineInterface): Promise<void> {
  try {
    await $.state.set(LEDGER, ledger)
  } catch (err) {
    await noteFailure($, 'state.set', err)
  }
}

async function start($: EngineInterface, optionsText: string): Promise<void> {
  home = await homeOf($)
  const tempDir = await $.env.get('TEMP')
  temp = tempDir !== undefined && tempDir !== '' ? tempDir.replace(/\\/g, '/') : null
  loadedAt = await $.clock.now()
  ledger = restoreLedger(ledger, (await $.state.get(LEDGER)).value)
  await $.command.register({ name: 'claim-ledger', description: 'Claim Ledger: how often a flagged claim was later backed by a run' })
  $.ui.log(`claim-ledger: loaded, options ${optionsText}`, { to: 'debug' })
  await writeHealth($)
}

async function flush($: EngineInterface, fired: readonly Fired[], repeated: readonly Claim[], now: number): Promise<void> {
  const backed = ledger.backed
  if (fired.length === 0 && repeated.length === 0 && backed.length === 0) return
  ledger.backed = []
  try {
    const updated = applyFlush(countersOf(await $.store.get('counters')), ringOf(await $.store.get('ring')), fired, repeated, backed, now)
    await $.store.set('counters', updated.counters)
    await $.store.set('ring', updated.ring)
  } catch (err) {
    await noteFailure($, 'store', err)
  }
}

async function track($: EngineInterface, input: Readonly<Record<string, unknown>>, ran: Ran, seq: number, ts: number, config: Config): Promise<void> {
  const facts = factsOf(input, ran)
  const agentId = typeof input.agentId === 'string' ? input.agentId : null
  const places = { home, root: await $.session.root(), temp }
  const classified = classify(facts, config, places)
  const added = record(ledger, facts, classified, seq, ts, agentId)
  for (const path of classified.mutations) trace({ ts, ev: 'edit', seq, path })
  // For a background run, ok is the launch status; a later read-back row carries the run's result.
  for (const e of added) trace({ ts, ev: 'run', seq, kind: e.kind, ok: e.ok, masked: e.masked, background: e.background, basis: e.basis, agentId, short: e.short })
  // A background run whose result this call read back is judged now.
  for (const e of readBack(ledger, facts, config, places)) trace({ ts, ev: 'read-back', seq: e.seq, by: seq, kind: e.kind, ok: e.ok, basis: e.basis, short: e.short })
  markBacked(ledger)
  await mirror($)
}

/** The seam around $.session.append: the trail records each attempt, which a test can read whether or not the kit serves the append. */
async function deliver($: EngineInterface, text: string, now: number): Promise<void> {
  trace({ ts: now, ev: 'append', text })
  try {
    const appended = await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
    if (appended.deny !== undefined) throw new Error(appended.deny)
  } catch (err) {
    trace({ ts: now, ev: 'append-failed', message: errText(err) })
    await noteFailure($, 'session.append', err)
  }
}

async function check($: EngineInterface, turnId: string, answer: string, tellModel: boolean): Promise<string[]> {
  // The final text again, judged now: a fallback for a step the turn.step hook missed. Deduplicated by hash.
  noteClaims(ledger, turnId, findClaims(answer), asOfNow(ledger))
  const now = await $.clock.now()
  const out = closeTurn(ledger, turnId, now, hhmm)
  for (const c of out.backed) trace({ ts: now, ev: 'claim', turnId, hash: c.hash, phrase: c.phrase, outcome: 'backed' })
  for (const f of out.fired) trace({ ts: now, ev: 'claim', turnId, hash: f.claim.hash, phrase: f.claim.phrase, outcome: 'fired', status: f.status })
  for (const c of out.repeated) trace({ ts: now, ev: 'claim', turnId, hash: c.hash, phrase: c.phrase, outcome: 'repeated' })
  await mirror($)
  await flush($, out.fired, out.repeated, now)
  if (tellModel && out.lines.length > 0) await deliver($, noteText(out.lines), now)
  await writeTrail($)
  return out.lines
}

async function clear($: EngineInterface): Promise<void> {
  await flush($, [], [], await $.clock.now())
  ledger = emptyLedger()
  trail = []
  trailDirty = false
  // The next session's health file starts clean: an error belongs to the session it happened in.
  lastError = null
  await mirror($)
}

async function reportFor($: EngineInterface): Promise<string> {
  await flush($, [], [], await $.clock.now())
  return reportText(countersOf(await $.store.get('counters')), ringOf(await $.store.get('ring')), ledger, hhmm)
}

export const register: Register = (on, options) => {
  const tellModel = options.tellModel !== false
  const config = configOf(listOption(options.testCommands, DEFAULT_TEST_COMMANDS), listOption(options.buildCommands, DEFAULT_BUILD_COMMANDS))
  const optionsText = JSON.stringify({ tellModel: options.tellModel, testCommands: options.testCommands, buildCommands: options.buildCommands })

  on('session.start', async ($, e, next) => {
    try {
      await start($, optionsText)
    } catch (err) {
      await noteFailure($, 'session.start', err)
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    try {
      // /clear and /resume both carry on under another conversation: every session value goes.
      // The ending session's trail is written before clear() empties it.
      await writeTrail($)
      if (e.reason === 'clear' || e.reason === 'resume') await clear($)
      else await flush($, [], [], await $.clock.now())
    } catch (err) {
      await noteFailure($, 'session.end', err)
    }
    return next(e)
  })

  // All loops. Order is assigned at entry, before any await; the call itself is never changed.
  on('tool.call', async ($, e, next) => {
    ledger.seq += 1
    const seq = ledger.seq
    const ts = await $.clock.now()
    const ran = await next(e)
    try {
      const input = e as unknown as Readonly<Record<string, unknown>>
      if (input.agentId === undefined) await followSession($)
      await track($, input, ran, seq, ts, config)
    } catch (err) {
      await noteFailure($, 'tool.call', err)
    }
    return ran
  }).catch(($, e, next) => next(e))

  // Main loop: claims in each response's text, judged against what the ledger knew when the response began.
  on('turn.step', async function* ($, e, next) {
    const asOf = asOfNow(ledger)
    const response = yield* next(e)
    if (e.agentId === undefined) {
      try {
        await followSession($)
        noteClaims(ledger, e.turnId, findClaims(response.answer), asOf)
      } catch (err) {
        await noteFailure($, 'turn.step', err)
      }
    }
    return response
  })

  // Main loop, answered turns only: flag what is still unbacked, beneath the answer.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') return done
    try {
      await followSession($)
      const lines = await check($, e.turnId, e.answer, tellModel)
      if (lines.length === 0) return done
      const above = done.text === e.answer ? '' : `${done.text}\n`
      return { ...done, text: `${above}${lines.join('\n')}` }
    } catch (err) {
      await noteFailure($, 'turn.complete', err)
      return done
    }
  })

  on('command.run', { command: 'claim-ledger' }, async $ => {
    try {
      return { text: await reportFor($) }
    } catch (err) {
      await noteFailure($, 'command.run', err)
      return { text: REPORT_FAILED }
    }
  }).catch(() => ({ text: REPORT_FAILED }))
}
