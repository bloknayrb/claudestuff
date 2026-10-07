import type { EngineInterface, Hook, Register } from 'claude-code'
import { atom, read, update } from 'claude-code'
import type { QmDenial, QmHealth } from '../types'
import { current, parseConfig, shapeOf } from './config'

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

// ==== lifecycle ====

export const onSessionStart: Hook<'session.start'> = async ($, e, next) => {
  $.ui.log(`quartermaster: list options arrived as ${current.shapes}`, { to: 'debug' })
  // session.start fires on every hot reload too: each load gets a fresh heartbeat (00-shared).
  await ensureHeartbeat($, true)
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
}
