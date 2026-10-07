import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderViewport } from 'claude-code'

import type { BridgeSession, DecideInput } from '../types'
import { addDecision, idForUse, pending } from './book'
import { denialFor, INPUT_SCHEMA, isSubagentCall, receipt, SUBAGENT_DENIAL, TOOL_DESCRIPTION, TOOL_NAME, validateDecide } from './decide'
import { freshSession, normalize } from './session'
import { ARM_DELAY_MS, bandTree, PANE_ID, paneTree, PANE_TITLE } from './ui'
import type { CardActions } from './ui'

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
  $.ui.toast(`Bridge: decision #${id} queued \u00b7 /bridge to answer`)
}

// The key pause after an answer is a debounce. A press that lands while it runs is taken for a held
// key's repeat: it does nothing but push the end of the pause out, so a held key never answers the next
// card until it has been let go for ARM_DELAY_MS. Each pause has its own deadline and its timer clears
// only that one, so an earlier answer's timer cannot lift a later pause early.
function startKeysPause($: EngineInterface, until: number): void {
  $.clock.after(ARM_DELAY_MS, () => void guard($, 'keys', resumeKeys($, until)))
}

async function resumeKeys($: EngineInterface, until: number): Promise<void> {
  await transact($, s => (s.view.keysPausedUntil === until ? { session: { ...s, view: { ...s.view, keysPausedUntil: null } }, out: null } : { session: s, out: null }))
}

// True when the press was swallowed (and the pause restarted).
async function isDebounced($: EngineInterface): Promise<boolean> {
  const until = (await $.clock.now()) + ARM_DELAY_MS
  const isPaused = await transact($, s => (s.view.keysPausedUntil === null ? { session: s, out: false } : { session: { ...s, view: { ...s.view, keysPausedUntil: until } }, out: true }))
  if (isPaused) startKeysPause($, until)
  return isPaused
}

// Takes the session a transact just wrote (never a re-read in the same dispatch). The plugin's own close
// runs none of its own ui.close hook, so the flag is cleared here, before the close.
async function closePaneIfDone($: EngineInterface, s: BridgeSession): Promise<void> {
  if (pending(s.book).length > 0 || !s.view.isPaneUp) return
  await transact($, cur => ({ session: { ...cur, view: { ...cur.view, isPaneUp: false, otherFor: null } }, out: null }))
  await $.ui.close({ id: PANE_ID })
}

async function toggleOther($: EngineInterface, id: number): Promise<void> {
  const isOpening = await transact($, s => {
    const otherFor = s.view.otherFor === id ? null : id
    return { session: { ...s, view: { ...s.view, otherFor } }, out: otherFor === id }
  })
  if (!isOpening) return
  // autoFocus only applies when the site takes the keyboard; a pane already holding it keeps its ring
  // on the Other button, so move it. A deny (the pane does not hold the keys) is fine: then the user
  // clicks or tabs into the field, and the hotkeys are off meanwhile anyway.
  const moved = await $.ui.focus({ requestId: PANE_ID, key: `other-text-${id}` })
  if (moved.deny !== undefined) $.ui.log(`bridge: focus not moved: ${moved.deny}`, { to: 'debug' })
}

// Task 9 replaces these three with the delivering versions.
async function pickOption(_$: EngineInterface, _id: number, _index: number): Promise<void> {}
async function makeItSo(_$: EngineInterface, _id: number): Promise<void> {}
async function sendOther(_$: EngineInterface, _id: number, _text: string): Promise<void> {}

// Runs a card press unless the key pause swallows it. sendOther is not gated: it comes from the field's
// Enter, which is not a hotkey, and only one card has a field.
async function pressed($: EngineInterface, work: () => Promise<void>): Promise<void> {
  if (await isDebounced($)) return
  await work()
}

function cardActions($: EngineInterface): CardActions {
  return {
    pick: (id, index) => void guard($, 'pick', pressed($, () => pickOption($, id, index))),
    makeItSo: id => void guard($, 'make it so', pressed($, () => makeItSo($, id))),
    toggleOther: id => void guard($, 'other', pressed($, () => toggleOther($, id))),
    sendOther: (id, text) => void guard($, 'other', sendOther($, id, text)),
  }
}

export const register: Register = on => {
  on('ui.render', { component: 'Pane', requestId: 'bridge' }, async ($, e, next) => {
    try {
      const s = await readSession($)
      return paneTree($.ui.resolve(e), pending(s.book), s.view, e.surface !== 'mobile', cardActions($))
    } catch (err) {
      void fail($, 'pane', err)
      return next(e)
    }
  })

  on('command.run', { command: 'bridge' }, async ($, e, next) => {
    try {
      const count = pending((await readSession($)).book).length
      if (count === 0) return { text: 'Bridge: no decisions pending.' }
      const opened = await $.ui.open({ id: PANE_ID, title: PANE_TITLE, focus: true })
      if (!opened.isPlaced) {
        await $.ui.close({ id: PANE_ID })
        return { text: `Bridge: the pane could not be placed (${opened.reason}).` }
      }
      // An explicit open: the keys are live at once.
      await transact($, s => ({ session: { ...s, view: { ...s.view, isPaneUp: true, keysPausedUntil: null } }, out: null }))
      return { text: `Bridge: ${count} pending. Keys answer the first card; ctrl+x tab gives the pane the keys if it lacks them.` }
    } catch (err) {
      await fail($, 'command', err)
      return next(e)
    }
  }).catch(async ($, e, next) => {
    if (next.error.kind !== 're-entry') await fail($, 'command', next.error.message ?? next.error.kind)
    return { text: 'Bridge: the command failed; the debug log has the reason.' }
  })

  // A close by the person (the plugin's own closes set the flag themselves; see closePaneIfDone).
  on('ui.close', { id: 'bridge' }, async ($, e, next) => {
    try {
      await transact($, s => ({ session: { ...s, view: { ...s.view, isPaneUp: false, otherFor: null } }, out: null }))
    } catch (err) {
      await fail($, 'ui.close', err)
    }
    return next(e)
  }).catch(async ($, e, next) => {
    if (next.error.kind !== 're-entry') await fail($, 'ui.close', next.error.message ?? next.error.kind)
    return next(e)
  })

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
