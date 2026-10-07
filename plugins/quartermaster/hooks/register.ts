import type { AgentSpawnResult, EngineInterface, Hook, Register, SessionRateLimit } from 'claude-code'
import { atom, read, update } from 'claude-code'
import type { QmDenial, QmGuard, QmHealth } from '../types'
import { current, parseConfig, shapeOf } from './config'
import { spawnHash, taskHash } from './hash'
import type { Reading } from './pace'
import { agentsClause, fitCap, fiveHour, matchWindow, paceClause, statusText, windowText } from './pace'
import type { Fired, SpawnView } from './rules'
import {
  DENIAL_TTL_MS,
  MODEL_TEXT,
  effectiveModel,
  isHeavy,
  isLive,
  modelGuardFires,
  settle,
  sourceLabel,
  sourceOf,
  takeOne,
  toastKey,
  viewOf,
} from './rules'

// Every function that takes `$` lives in this file: the validator refuses `$` passed across an import
// (00-shared, "Validator rules"). So do the atoms: read/update accept only an atom the scan can see made
// in this file. config.ts, hash.ts, pace.ts and rules.ts take no `$`.

// ==== state ====

// Session-scoped values ($.state): kept across hot reloads, reset on /clear and resume (Task 8).
const denied = atom({ plugin: 'quartermaster', key: 'denied' } as const, [] as QmDenial[])
const agents = atom({ plugin: 'quartermaster', key: 'agents' } as const, {} as Record<string, string>)
const spawnModels = atom({ plugin: 'quartermaster', key: 'spawnModels' } as const, {} as Record<string, string>)
const sourceToasts = atom({ plugin: 'quartermaster', key: 'sourceToasts' } as const, [] as string[])
const sourceSpawns = atom({ plugin: 'quartermaster', key: 'sourceSpawns' } as const, {} as Record<string, number>)
const health = atom({ plugin: 'quartermaster', key: 'health' } as const, null as QmHealth | null)

// ==== health ====

export const MOD = 'quartermaster'

/** USERPROFILE, then HOME (HOME is unset on Bryan's Windows machine, Q10); forward slashes. */
async function homeDir($: EngineInterface): Promise<string | null> {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  return home === undefined || home === '' ? null : home.split('\\').join('/')
}

async function writeHealth($: EngineInterface): Promise<void> {
  try {
    const held = await read($, health)
    const home = await homeDir($)
    if (held === null || home === null) return
    const body = JSON.stringify({ loadedAt: held.loadedAt, lastError: held.lastError })
    await $.fs.write(`${home}/.claude/state/mods/${MOD}/${held.sessionId}.json`, `${body}\n`)
  } catch {
    // Best-effort (00-shared): a missing heartbeat reads as unknown, never as ok.
  }
}

/** Writes the heartbeat when it is missing or belongs to another session id; `fresh` forces a new loadedAt. */
async function ensureHeartbeat($: EngineInterface, fresh = false): Promise<void> {
  const sessionId = await $.session.id()
  const held = await read($, health)
  if (!fresh && held !== null && held.sessionId === sessionId) return
  const loadedAt = await $.clock.now()
  await update($, health, () => ({ sessionId, loadedAt, lastError: null }))
  await writeHealth($)
}

export function describeError(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const { message, kind } = error as { message?: unknown; kind?: unknown }
    if (typeof message === 'string' && message !== '') return message
    if (typeof kind === 'string') return kind
  }
  return String(error)
}

/** Fail-open bookkeeping: the debug log and the heartbeat's lastError. Never throws. */
async function noteFailure($: EngineInterface, where: string, error: unknown): Promise<void> {
  const message = `${where}: ${describeError(error)}`
  try {
    $.ui.log(`quartermaster: ${message}`, { to: 'debug' })
  } catch {
    // The debug log is best-effort too.
  }
  try {
    await ensureHeartbeat($)
    const ts = await $.clock.now()
    await update($, health, held => (held === null ? held : { ...held, lastError: { ts, message } }))
    await writeHealth($)
  } catch {
    // Nothing left to tell: the hook still fails open.
  }
}

// ==== ledger ====

export type Counter = { fires: number; reissued: number; changed: number }
export type Counters = Record<QmGuard, Counter>
export type Outcome = 'denied' | 'reissued' | 'changed' | 'toast'
export type Fire = { ts: number; guard: QmGuard; input_hash: string; outcome: Outcome }

export const RING_MAX = 200

let chain: Promise<unknown> = Promise.resolve()

/**
 * Runs $.store read-modify-writes one at a time. $.store has no append or compare-and-set, and
 * parallel Agent calls run their spawn hooks concurrently, so unserialized writes lose increments.
 * Never call serial() from inside work passed to serial(): it would wait on itself.
 */
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = chain.then(work, work)
  chain = run.catch(() => undefined)
  return run
}

function counter(raw: Partial<Counter> | undefined): Counter {
  return { fires: raw?.fires ?? 0, reissued: raw?.reissued ?? 0, changed: raw?.changed ?? 0 }
}

async function readCounters($: EngineInterface): Promise<Counters> {
  const raw = (await $.store.get('counters')) as Partial<Record<QmGuard, Partial<Counter>>> | undefined
  return { model: counter(raw?.model), heavy: counter(raw?.heavy) }
}

async function readRing($: EngineInterface): Promise<Fire[]> {
  const raw = await $.store.get('ring')
  return Array.isArray(raw) ? (raw as Fire[]) : []
}

/** Bumps each guard's counter for the outcome (a toast bumps none, D4) and appends to the 200-entry ring. */
function recordFires($: EngineInterface, guards: readonly QmGuard[], hash: string, outcome: Outcome): Promise<void> {
  return serial(async () => {
    const ts = await $.clock.now()
    const counters = await readCounters($)
    const ring = await readRing($)
    for (const guard of guards) {
      if (outcome === 'denied') counters[guard].fires += 1
      if (outcome === 'reissued') counters[guard].reissued += 1
      if (outcome === 'changed') counters[guard].changed += 1
      ring.push({ ts, guard, input_hash: hash, outcome })
    }
    if (outcome !== 'toast') await $.store.set('counters', counters)
    await $.store.set('ring', ring.slice(-RING_MAX))
  })
}

export const READINGS_MAX = 300
export const DUPLICATE_MS = 60_000

/** Keeps the current window and the one before it (the two latest resets). */
export function keepTwoWindows<T>(byWindow: Record<string, T>): Record<string, T> {
  const keys = Object.keys(byWindow)
    .sort((a, b) => Number(a) - Number(b))
    .slice(-2)
  return Object.fromEntries(keys.map(key => [key, byWindow[key] as T]))
}

type WindowReadings = { key: string; readings: Reading[] }

async function allReadings($: EngineInterface): Promise<Record<string, Reading[]>> {
  return ((await $.store.get('readings')) ?? {}) as Record<string, Reading[]>
}

/** The readings of the window that resets at resetsAt, under the key matchWindow picks. */
async function windowReadings($: EngineInterface, resetsAt: number): Promise<WindowReadings> {
  const all = await allReadings($)
  const key = matchWindow(Object.keys(all), resetsAt)
  return { key, readings: all[key] ?? [] }
}

/** Adds a reading to its window and returns the window; a repeat within a minute is skipped (D10). */
function addReading($: EngineInterface, resetsAt: number, reading: Reading): Promise<WindowReadings> {
  return serial(async () => {
    const all = await allReadings($)
    const key = matchWindow(Object.keys(all), resetsAt)
    const list = all[key] ?? []
    const prior = list[list.length - 1]
    if (prior !== undefined && prior[1] === reading[1] && reading[0] - prior[0] < DUPLICATE_MS) {
      return { key, readings: list }
    }
    const kept = [...list, reading].slice(-READINGS_MAX)
    await $.store.set('readings', keepTwoWindows({ ...all, [key]: kept }))
    return { key, readings: kept }
  })
}

// ==== pacing ====

/** Stores a five-hour reading under its window; readings reset with the window (keyed by resetsAt). */
async function recordReading($: EngineInterface, limits: readonly SessionRateLimit[]): Promise<void> {
  const window = fiveHour(limits)
  if (window === null || window.resetsAt === null) return
  await addReading($, window.resetsAt, [await $.clock.now(), window.pct])
}

/** The one status line; hidden with no five-hour reading (D9). */
async function refreshStatus($: EngineInterface, limits?: readonly SessionRateLimit[]): Promise<void> {
  const window = fiveHour(limits ?? (await $.session.usage()).rateLimits)
  if (window === null) {
    $.ui.status(undefined)
    return
  }
  const cap = window.resetsAt === null ? null : fitCap((await windowReadings($, window.resetsAt)).readings)
  const tally = agentsClause(await read($, agents), current.cfg.heavyModels)
  $.ui.status(statusText(paceClause(cap, window.resetsAt), tally))
}

// ==== guards ====

type SpawnEvent = Parameters<Hook<'agent.spawn'>>[1]
type SpawnNext = Parameters<Hook<'agent.spawn'>>[2]

export const DENIALS_MAX = 50
export const SPAWN_MODELS_MAX = 200
export const SOURCE_TOASTS_MAX = 200

async function judge($: EngineInterface, view: SpawnView, label: string): Promise<Fired> {
  const cfg = current.cfg
  const fired: Fired = { guards: [], denyTexts: [], toastTexts: [], windowKey: null }
  if (modelGuardFires(view, cfg)) {
    fired.guards.push('model')
    fired.denyTexts.push(MODEL_TEXT)
    fired.toastTexts.push(`Quartermaster: ${label} spawned ${view.subagentType} with no model set.`)
  }
  const model = effectiveModel(view, cfg)
  if (isHeavy(model, cfg.heavyModels)) {
    const window = fiveHour((await $.session.usage()).rateLimits)
    if (window !== null && window.pct >= cfg.warnAt) {
      const held = window.resetsAt === null ? null : await windowReadings($, window.resetsAt)
      const reading = windowText(window.pct, window.resetsAt, held === null ? null : fitCap(held.readings))
      fired.windowKey = held === null ? null : held.key
      fired.guards.push('heavy')
      fired.denyTexts.push(`Quartermaster: ${reading}. Re-issue unchanged to spend it anyway.`)
      fired.toastTexts.push(`Quartermaster: ${label} spawned an agent on ${model}; ${reading}.`)
    }
  }
  return fired
}

async function safeRecord($: EngineInterface, guards: readonly QmGuard[], hash: string, outcome: Outcome): Promise<void> {
  if (guards.length === 0) return
  try {
    await recordFires($, guards, hash, outcome)
  } catch (error) {
    // The verdict stands whatever the ledger does (Review Focus 2).
    await noteFailure($, 'fire ledger', error)
  }
}

function trimRecord(map: Record<string, string>, max: number): Record<string, string> {
  const entries = Object.entries(map)
  return entries.length <= max ? map : Object.fromEntries(entries.slice(-max))
}

/** Lets the spawn start and remembers which model it got, for the tally (D11). */
async function admit($: EngineInterface, e: SpawnEvent, next: SpawnNext): Promise<AgentSpawnResult> {
  const started = await next(e)
  const { agentId, model } = started
  if (agentId !== undefined && model !== undefined) {
    await update($, spawnModels, map => trimRecord({ ...map, [agentId]: model }, SPAWN_MODELS_MAX))
  }
  return started
}

/**
 * Toast keys this module instance has claimed. A key is checked and added with no await between, so
 * parallel spawns can't both claim it (Review Focus 6). Module memory is lost on a hot reload, so the
 * claim is then persisted to $.state, which a reloaded module checks.
 */
const claimed = new Set<string>()

async function claimToast($: EngineInterface, key: string): Promise<boolean> {
  if (claimed.has(key)) return false
  claimed.add(key)
  let fresh = false
  await update($, sourceToasts, list => {
    fresh = !list.includes(key)
    return fresh ? [...list, key].slice(-SOURCE_TOASTS_MAX) : list
  })
  return fresh
}

/** A workflow's or another plugin's spawn can't re-issue: it always starts, and its guards toast instead (D4). */
async function toastOnly(
  $: EngineInterface,
  e: SpawnEvent,
  next: SpawnNext,
  view: SpawnView,
  source: string,
  fired: Fired,
  hash: string,
): Promise<AgentSpawnResult> {
  await update($, sourceSpawns, map => ({ ...map, [source]: (map[source] ?? 0) + 1 }))
  const shown: QmGuard[] = []
  const texts: string[] = []
  for (const [i, guard] of fired.guards.entries()) {
    if (await claimToast($, toastKey(guard, source, view.subagentType, fired.windowKey))) {
      shown.push(guard)
      texts.push(fired.toastTexts[i] ?? '')
    }
  }
  if (texts.length > 0) {
    $.ui.toast(texts.join(' '))
    // Only a toast actually shown takes a ring row, so suppressed repeats can't push real denials out.
    await safeRecord($, shown, hash, 'toast')
  }
  return admit($, e, next)
}

/** Removes and returns one live pending denial that `match` picks; decided inside update, so parallel calls can't share one. */
async function takeDenial($: EngineInterface, match: (d: QmDenial) => boolean): Promise<QmDenial | undefined> {
  let taken: QmDenial | undefined
  await update($, denied, list => {
    const result = takeOne(list, match)
    taken = result.taken
    return result.rest
  })
  return taken
}

export const onSpawn: Hook<'agent.spawn'> = async ($, e, next) => {
  const view = viewOf(e)
  const hash = spawnHash(view)
  const source = sourceOf(e.workflow !== undefined, next.origin.plugin)
  const fired = await judge($, view, source === null ? 'the model' : sourceLabel(source))
  if (source !== null) return toastOnly($, e, next, view, source, fired, hash)

  const now = await $.clock.now()
  // The soft-deny contract: an unchanged re-issue runs, whatever the guards say now. One denial, one re-issue.
  const same = await takeDenial($, d => d.hash === hash && isLive(d, view.loop, now))
  if (same !== undefined) {
    await safeRecord($, same.guards, hash, 'reissued')
    return admit($, e, next)
  }

  const task = taskHash(view)
  const earlier = await takeDenial($, d => d.task === task && isLive(d, view.loop, now))
  const { changed, deny } =
    earlier === undefined ? { changed: [] as QmGuard[], deny: fired.guards } : settle(earlier.guards, fired.guards, view)
  if (earlier !== undefined) await safeRecord($, changed, earlier.hash, 'changed')
  if (deny.length === 0) return admit($, e, next)

  const entry: QmDenial = { hash, task, loop: view.loop, guards: deny, ts: now }
  await update($, denied, list => [...list.filter(d => now - d.ts <= DENIAL_TTL_MS), entry].slice(-DENIALS_MAX))
  await safeRecord($, deny, hash, 'denied')
  return { deny: deny.map(g => fired.denyTexts[fired.guards.indexOf(g)] ?? '').join('\n') }
}

// ==== lifecycle ====

export const onSessionStart: Hook<'session.start'> = async ($, e, next) => {
  $.ui.log(`quartermaster: list options arrived as ${current.shapes}`, { to: 'debug' })
  // session.start fires on every hot reload too: each load gets a fresh heartbeat (00-shared).
  await ensureHeartbeat($, true)
  const { rateLimits } = await $.session.usage()
  await recordReading($, rateLimits)
  await refreshStatus($, rateLimits)
  return next(e)
}

export const onMeasure: Hook<'session.measure'> = async ($, e, next) => {
  // Re-arms the heartbeat under a new session id after /clear (D5).
  await ensureHeartbeat($)
  await recordReading($, e.rateLimits)
  await refreshStatus($, e.rateLimits)
  return next(e)
}

// ==== register ====

export const register: Register = (on, options) => {
  current.cfg = parseConfig(options)
  current.shapes = `heavyModels ${shapeOf(options['heavyModels'])}, guardTypes ${shapeOf(options['guardTypes'])}`

  on('session.start', onSessionStart).catch(async ($, e, next) => {
    await noteFailure($, 'session.start', next.error)
    return next(e)
  })
  // Fail open: a broken guard lets the spawn through (next.called replays, never re-runs).
  on('agent.spawn', onSpawn).catch(async ($, e, next) => {
    await noteFailure($, 'agent.spawn', next.error)
    return next(e)
  })
  on('session.measure', onMeasure).catch(async ($, e, next) => {
    await noteFailure($, 'session.measure', next.error)
    return next(e)
  })
}
