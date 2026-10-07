import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderViewport } from 'claude-code'

import type { BridgeSession, DecideInput } from '../types'
import { addDecision, idForUse, pending } from './book'
import { denialFor, INPUT_SCHEMA, isSubagentCall, receipt, SUBAGENT_DENIAL, TOOL_DESCRIPTION, TOOL_NAME, validateDecide } from './decide'
import { freshSession, normalize } from './session'
import { bandTree, PANE_ID, PANE_TITLE } from './ui'

// A new decision opens the pane unasked only from this width, as the spec says; the engine's own
// floor is 110 for a pane id the person has opened before, so the mod checks 144 itself too.
const UNASKED_PANE_COLUMNS = 144

// The one state value. Defined here, beside every read/update of it: the 2.1.292 validator refuses a
// state library read of an atom imported from another file (00-shared, Validator rules).
const SESSION = atom({ plugin: 'bridge', key: 'session' } as const, freshSession())

// Module variables are lost on hot reload and refilled by the next start or draw. Nothing the
// pane depends on lives here; that is in $.state. lastViewport comes from the band's draws, since a
// tool.call hook has no viewport; unknown means "not fullscreen".
let lastViewport: RenderViewport | undefined
let loadedAt = 0
let heartbeatFor = ''

// Every get of one dispatch reads one moment (T:3361), so nothing reads SESSION after writing it in
// the same dispatch. A change computes its own result from the value update hands it, and that result
// is what the caller acts on. update retries on a version miss; the last run is the one written.
async function transact<T>($: EngineInterface, change: (s: BridgeSession) => { session: BridgeSession; out: T }): Promise<T> {
  const box: { out?: T; isRun: boolean } = { isRun: false }
  await update($, SESSION, value => {
    const r = change(normalize(value))
    box.out = r.out
    box.isRun = true
    return r.session
  })
  if (!box.isRun) throw new Error('bridge: the state update did not run')
  return box.out as T
}

async function readSession($: EngineInterface): Promise<BridgeSession> {
  return normalize(await read($, SESSION))
}

async function writeHealth($: EngineInterface, error?: string): Promise<void> {
  try {
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
    if (home === undefined || home === '') return
    const sessionId = await $.session.id()
    const now = await $.clock.now()
    if (loadedAt === 0) loadedAt = now
    const body = { loadedAt, lastError: error === undefined ? null : { ts: now, message: error } }
    await $.fs.write(`${home.replace(/\\/g, '/')}/.claude/state/mods/bridge/${sessionId}.json`, JSON.stringify(body))
    heartbeatFor = sessionId
  } catch {
    // Best effort by convention (00-shared, Health file): a failed write is ignored.
  }
}

async function fail($: EngineInterface, where: string, err: unknown): Promise<void> {
  const message = `${where}: ${err instanceof Error ? err.message : String(err)}`
  try {
    $.ui.log(`bridge: ${message}`, { to: 'debug' })
  } catch {
    // A .catch handler's own $ calls can reject (2.1.292 re-entry); the health write below is best effort too.
  }
  await writeHealth($, message)
}

// Runs work that nothing awaits, or that must not fail its caller, so a failure is logged and recorded.
async function guard($: EngineInterface, where: string, work: Promise<void>): Promise<void> {
  try {
    await work
  } catch (err) {
    await fail($, where, err)
  }
}

async function queueDecision($: EngineInterface, input: DecideInput, useId: string): Promise<number> {
  const now = await $.clock.now()
  const key = useId !== '' ? useId : `local-${now}-${Math.random()}`
  const id = await transact($, s => {
    const book = addDecision(s.book, input, key, now)
    return { session: { ...s, book }, out: idForUse(book, key) }
  })
  if (id === undefined) throw new Error('the queued decision is missing from the book')
  return id
}

// The engine's record, not the module's (T: ui.panes): a pane closed by an unload or a refused draw
// runs none of this plugin's hooks, so the stored isPaneUp can be stale.
async function isPaneOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(pane => pane.id === PANE_ID && pane.isPlaced)
}

async function surfaceDecision($: EngineInterface, id: number): Promise<void> {
  const isUp = await isPaneOpen($)
  await transact($, s => {
    if (s.view.isPaneUp === isUp) return { session: s, out: null }
    return { session: { ...s, view: { ...s.view, isPaneUp: isUp, otherFor: isUp ? s.view.otherFor : null } }, out: null }
  })
  if (isUp) return
  const canDock = lastViewport?.isFullscreen === true && lastViewport.columns >= UNASKED_PANE_COLUMNS
  if (canDock) {
    const opened = await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
    if (opened.isPlaced) {
      await transact($, s => ({ session: { ...s, view: { ...s.view, isPaneUp: true } }, out: null }))
      return
    }
    await $.ui.close({ id: PANE_ID })
  }
  $.ui.toast(`Bridge: decision #${id} queued · /bridge to answer`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.tool.register({ name: TOOL_NAME, description: TOOL_DESCRIPTION, inputSchema: INPUT_SCHEMA })
      await $.command.register({
        name: 'bridge',
        description: 'Open the Bridge pane of pending decisions',
        immediate: true,
      })
      // A hot reload keeps $.state but drops timers and may have lost the pane: clear a stranded key
      // pause, and re-sync isPaneUp from the engine's record before anything trusts it.
      const isUp = await isPaneOpen($)
      await transact($, s => ({
        session: { ...s, view: { ...s.view, isPaneUp: isUp, otherFor: isUp ? s.view.otherFor : null, keysPausedUntil: null } },
        out: null,
      }))
      loadedAt = await $.clock.now()
    } catch (err) {
      await fail($, 'session.start', err)
    }
    await writeHealth($)
    return next(e)
  })

  on('tool.call', { tool: 'mcp__bridge__decide' }, async ($, e) => {
    if (isSubagentCall(e)) return { deny: SUBAGENT_DENIAL }
    const checked = validateDecide(e as unknown as Record<string, unknown>)
    if (!checked.isValid) return { deny: denialFor(checked.problems) }
    const id = await queueDecision($, checked.input, e.tool_use_id ?? '')
    // Queued: from here the receipt always goes back, whatever surfacing does.
    await guard($, 'surface', surfaceDecision($, id))
    return { result: receipt(id) }
  }).catch(async ($, e, next) => {
    if (next.error.kind !== 're-entry') await fail($, 'tool.call', next.error.message ?? next.error.kind)
    return next.called
      ? next(e)
      : { deny: 'Bridge could not queue the decision (its hook failed). Ask with AskUserQuestion instead.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    try {
      if (e.viewport !== undefined) lastViewport = e.viewport
      const s = await readSession($)
      const count = pending(s.book).length
      if (count === 0 || e.props.hasSurvey) return next(e)
      // The engine's record, not the stored flag: an unload close runs none of our hooks, and a draw may
      // read the pane list though it may not write state.
      if (await isPaneOpen($)) return next(e)
      return bandTree($.ui.resolve(e), count)
    } catch (err) {
      // Not awaited: a draw must not wait on the health write (which may be refused mid-draw; it is
      // best effort). The engine's band draws instead.
      void fail($, 'band', err)
      return next(e)
    }
  })
}
