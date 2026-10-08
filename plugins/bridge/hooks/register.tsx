import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderViewport } from 'claude-code'

import type { Answer, BridgeSession, DecideInput } from '../types'
import { addDecision, idForUse, isAnsweredBy, markAnswered, pending, recommendedAnswer, reopen } from './book'
import { mainTurnEnded, mainTurnStarted, rowAppended, stepBegan } from './delivery'
import { APPEND_MARK, formatRow, isBlankText } from './row'
import { denialFor, INPUT_SCHEMA, isSubagentCall, receipt, SUBAGENT_DENIAL, TOOL_DESCRIPTION, TOOL_NAME, validateDecide } from './decide'
import { freshSession, normalize, resetSession } from './session'
import { ARM_DELAY_MS, bandTree, PANE_ID, paneTree, PANE_TITLE } from './ui'
import type { CardActions } from './ui'

// A new decision opens the pane unasked only from this width (a fixed rule); the engine's own
// floor is 110 for a pane id the person has opened before, so the mod checks 144 itself too.
const UNASKED_PANE_COLUMNS = 144

// A minimal wake starting with '<'. It is stored plugin-framed; never submit it asUser, or it would
// pass for typed text.
const WAKE_TEXT = '<bridge-wake/>'
const WAKE_RETRY_MS = 500
const WAKE_FAIL_TOAST = 'Bridge: answer saved; it reaches Claude with your next prompt.'

// The delivery module's row tag for an answer row.
const ROW_TAG = 'decision'

// The test kit's refusal of a plugin append; a live engine always serves one.
const KIT_NO_APPEND = 'no implementation for session.append'

// The one state value. Defined here, beside every read/update of it: the 2.1.292 validator refuses a
// state library read of an atom imported from another file.
const SESSION = atom({ plugin: 'bridge', key: 'session' } as const, freshSession())

// Module variables are lost on hot reload and refilled by the next start or draw. Nothing the
// pane depends on lives here; that is in $.state. lastViewport comes from the band's draws, since a
// tool.call hook has no viewport; unknown means "not fullscreen".
let lastViewport: RenderViewport | undefined
let loadedAt = 0
let heartbeatFor = ''

// Every get of one dispatch reads one moment, so nothing reads SESSION after writing it in
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
    // Best effort: a failed health write is ignored.
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

async function refreshHeartbeat($: EngineInterface): Promise<void> {
  // After /clear or /resume the session id changes and no session.start fires; write the new id's
  // heartbeat once.
  if (heartbeatFor !== (await $.session.id())) await writeHealth($)
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

// The engine's record, not the module's (ui.panes): a pane closed by an unload or a refused draw
// runs none of this plugin's hooks, so the stored isPaneUp can be stale.
async function isPaneOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(pane => pane.id === PANE_ID && pane.isPlaced)
}

// Open and also the pane the surface shows: a placed pane can sit as a background tab behind another
// plugin's pane, where the user would see neither it nor, if the band hid, any sign of a decision.
async function isPaneVisible($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(pane => pane.id === PANE_ID && pane.isPlaced && pane.isShown)
}

// The band is the notice of a queued decision (it draws whenever the pane is not visible); this only
// opens the pane unasked when the screen is wide enough. No toast: none was ever seen from this
// tool.call path in the dogfood (D2, D4) while the band showed every time, so the band alone is kept.
async function surfaceDecision($: EngineInterface): Promise<void> {
  const isUp = await isPaneOpen($)
  await transact($, s => {
    if (s.view.isPaneUp === isUp) return { session: s, out: null }
    return { session: { ...s, view: { ...s.view, isPaneUp: isUp, otherFor: isUp ? s.view.otherFor : null } }, out: null }
  })
  // Already open, shown or behind another pane: no reopen. When it is behind, the band shows the count.
  if (isUp) return
  const canDock = lastViewport?.isFullscreen === true && lastViewport.columns >= UNASKED_PANE_COLUMNS
  if (!canDock) return
  const opened = await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
  if (opened.isPlaced) {
    await transact($, s => ({ session: { ...s, view: { ...s.view, isPaneUp: true } }, out: null }))
    return
  }
  await $.ui.close({ id: PANE_ID })
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

// The one place this mod appends a row. A row that landed is also logged under APPEND_MARK, which is
// what the tests read (the kit serves no plugin append). Only the kit's exact refusal counts as landed;
// a real deny or any other throw is a failed delivery, which must never wake Claude.
async function appendRow($: EngineInterface, text: string): Promise<{ isAppended: boolean; why: string }> {
  let result: { isAppended: boolean; why: string }
  try {
    const r = await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
    result = r.deny === undefined ? { isAppended: true, why: '' } : { isAppended: false, why: r.deny }
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err)
    result = { isAppended: why.includes(KIT_NO_APPEND), why }
  }
  if (result.isAppended) $.ui.log(`${APPEND_MARK}${text}`, { to: 'debug' })
  return result
}

// '' when the wake entered, else why not.
async function submitWake($: EngineInterface): Promise<string> {
  try {
    const sent = await $.prompt.submit({ text: WAKE_TEXT })
    return sent.drop !== undefined ? `dropped: ${sent.drop}` : ''
  } catch (err) {
    return `refused: ${err instanceof Error ? err.message : String(err)}`
  }
}

// Fire and forget, from whatever dispatch decided to wake. If an engine refuses a direct submit from a
// press, this could be routed through a timer instead.
function startWake($: EngineInterface): void {
  void guard($, 'wake', wakeOnce($))
}

async function wakeOnce($: EngineInterface): Promise<void> {
  const why = await submitWake($)
  if (why === '') return
  $.ui.log(`bridge: wake not submitted (${why}); retrying once`, { to: 'debug' })
  $.clock.after(WAKE_RETRY_MS, () => void guard($, 'wake retry', retryWake($)))
}

// A timer is a dispatch of its own, so this read is fresh. The row's one wake is already spent in the
// shared module either way; if this fails too, the rows wait for the user's next prompt.
async function retryWake($: EngineInterface): Promise<void> {
  const s = await readSession($)
  // A turn that started meanwhile reads the rows at its first step.
  if (s.delivery.isMainTurnRunning || !s.isWakeQueued) return
  const why = await submitWake($)
  if (why === '') return
  await transact($, cur => ({ session: { ...cur, isWakeQueued: false }, out: null }))
  $.ui.log(`bridge: wake not submitted (${why})`, { to: 'debug' })
  $.ui.toast(WAKE_FAIL_TOAST)
}

// A press answers while Claude may be idle, so the row may need a wake.
async function answerWith($: EngineInterface, id: number, answer: Answer): Promise<boolean> {
  const now = await $.clock.now()
  const nonce = `${now}-${Math.random()}`
  const until = now + ARM_DELAY_MS
  // Claim it. Only the press whose nonce lands owns the delivery; a second press finds it answered.
  // The same write starts the key pause (a debounce: see isDebounced), under this answer's own deadline.
  const claimed = await transact($, s => {
    const book = markAnswered(s.book, id, answer, nonce)
    if (!isAnsweredBy(book, id, nonce)) return { session: s, out: undefined }
    return { session: { ...s, book, view: { ...s.view, keysPausedUntil: until } }, out: book.decisions.find(d => d.id === id) }
  })
  if (claimed === undefined) return false
  startKeysPause($, until)
  const appended = await appendRow($, formatRow(claimed, answer))
  if (!appended.isAppended) {
    await transact($, s => ({ session: { ...s, book: reopen(s.book, id, nonce) }, out: null }))
    $.ui.toast(`Bridge: decision #${id} could not be delivered (${appended.why}); it is pending again.`)
    await fail($, 'append', appended.why)
    return false
  }
  // Recorded after the append lands, so a step that begins between the two can only cause an extra
  // wake, never a missed one. The shared module decides whether this row wakes; Bridge only declines
  // a second submit while one is already queued (its turn then reads this row too).
  const done = await transact($, s => {
    const r = rowAppended(s.delivery, ROW_TAG)
    const isWake = r.isWake && !s.isWakeQueued
    const view = s.view.otherFor === id ? { ...s.view, otherFor: null } : s.view
    const after: BridgeSession = { ...s, delivery: r.delivery, isWakeQueued: s.isWakeQueued || isWake, view }
    return { session: after, out: { isWake, session: after } }
  })
  if (done.isWake) startWake($)
  await closePaneIfDone($, done.session)
  return true
}

async function pickOption($: EngineInterface, id: number, index: number): Promise<void> {
  const decision = (await readSession($)).book.decisions.find(d => d.id === id)
  const option = decision?.options[index]
  if (option === undefined) return
  await answerWith($, id, { choice: 'label', label: option.label })
}

async function makeItSo($: EngineInterface, id: number): Promise<void> {
  const decision = (await readSession($)).book.decisions.find(d => d.id === id)
  if (decision === undefined || decision.status !== 'pending') return
  await answerWith($, id, recommendedAnswer(decision))
}

// Blank by Python's str.strip(), which a strict consumer applies: such a row would carry no words of the user's.
async function sendOther($: EngineInterface, id: number, text: string): Promise<void> {
  if (isBlankText(text)) return
  await answerWith($, id, { choice: 'other', text })
}

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
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') {
      try {
        const wasUp = await transact($, s => ({ session: resetSession(), out: s.view.isPaneUp }))
        if (wasUp || (await isPaneOpen($))) await $.ui.close({ id: PANE_ID })
      } catch (err) {
        await fail($, 'session.end', err)
      }
    }
    return next(e)
  })

  // turn.start fires for the main loop only (a subagent's run raises none).
  on('turn.start', async ($, e, next) => {
    try {
      await transact($, s => ({
        session: { ...s, delivery: mainTurnStarted(s.delivery), isWakeQueued: false },
        out: null,
      }))
      void guard($, 'heartbeat', refreshHeartbeat($))
    } catch (err) {
      await fail($, 'turn.start', err)
    }
    return next(e)
  })

  // The shared race guard: "a main step began" before next, so rows appended from here on are not
  // marked read by this step.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      try {
        await transact($, s => ({ session: { ...s, delivery: stepBegan(s.delivery) }, out: null }))
      } catch (err) {
        await fail($, 'turn.step', err)
      }
    }
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done
    try {
      const isWake = await transact($, s => {
        const r = mainTurnEnded(s.delivery, e.reason)
        const wake = r.isWake && !s.isWakeQueued
        return {
          session: { ...s, delivery: r.delivery, isWakeQueued: s.isWakeQueued || wake },
          out: wake,
        }
      })
      // Not awaited: a submit from here may wait on this very turn ending.
      if (isWake) startWake($)
    } catch (err) {
      await fail($, 'turn.complete', err)
    }
    return done
  })

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
    await guard($, 'surface', surfaceDecision($))
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
      if (await isPaneVisible($)) return next(e)
      return bandTree($.ui.resolve(e), count)
    } catch (err) {
      // Not awaited: a draw must not wait on the health write (which may be refused mid-draw; it is
      // best effort). The engine's band draws instead.
      void fail($, 'band', err)
      return next(e)
    }
  })
}
