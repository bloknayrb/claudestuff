import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DocketSession } from '../types'
import { bashInput, material, turnSlice } from './capture'
import { buildPrompt, parseVerdict, RULES } from './judge'
import type { Mode } from './judge'
import { addManual, addToolAsked, addTurn, addUser, applyVerdict, clearAll, closedForJudge, closeGroups, dismiss, freshSession, markDone, normalize, openItems, reopen } from './ledger'
import { clip } from './text'
import { ARM_DELAY_MS, indicatorText, indicatorTree, PANE_COLUMNS, PANE_ID, PANE_TITLE, paneTree } from './ui'
import type { Actions } from './ui'

const MODELS = ['haiku', 'sonnet', 'opus'] as const
const TIMEOUT_MS = 20000
const FAIL_TOAST = (reason: string) => `Docket: couldn't check the last turn (${reason}); it tries again next turn.`

// The one state value, defined beside every read and update of it (the validator refuses a state atom
// read from another file). A value an earlier build stored is filled out by normalize().
const SESSION = atom({ plugin: 'docket', key: 'session' } as const, freshSession())

// Module state: lost on a hot reload, which is the point for the runner's flags (a reload must not
// strand a check as running). Nothing a drawing needs to survive lives here.
let resolveDue = false
let fullDue = false
let inFlight = false
let isResolving = false
let controller: AbortController | undefined
// Bumped by /clear and /resume: a verdict for an earlier epoch is thrown away.
let epoch = 0
let droppedNotice: string | undefined
// The message count and the opening prompt's text at turn.start: how turn.complete finds the turn.
let turnStartLen: { turnId: string; len: number; opener: string } | undefined
// Prompts typed into the running turn: user rows that do not open a turn (see capture.ts).
let midTurn = new Set<string>()
let isUsageLogged = false
let loadedAt = 0
let heartbeatFor = ''

async function transact<T>($: EngineInterface, change: (s: DocketSession) => { session: DocketSession; out: T }): Promise<T> {
  const box: { out?: T; isRun: boolean } = { isRun: false }
  await update($, SESSION, value => {
    const r = change(normalize(value))
    box.out = r.out
    box.isRun = true
    return r.session
  })
  if (!box.isRun) throw new Error('docket: the state update did not run')
  return box.out as T
}

async function change($: EngineInterface, fn: (s: DocketSession) => DocketSession): Promise<DocketSession> {
  const next = await transact($, s => {
    const n = fn(s)
    return { session: n, out: n }
  })
  return next
}

async function readSession($: EngineInterface): Promise<DocketSession> {
  return normalize(await read($, SESSION))
}

// Counts and timestamps only: never item text or model output.
async function writeHealth($: EngineInterface, error?: string): Promise<void> {
  try {
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
    if (home === undefined || home === '') return
    const sessionId = await $.session.id()
    const now = await $.clock.now()
    if (loadedAt === 0) loadedAt = now
    const s = await readSession($)
    const body = {
      loadedAt,
      open: openItems(s).length,
      checkedTurns: s.lastCheck.checkedTurns,
      lastError: error === undefined ? null : { ts: now, message: clip(error, 200) },
    }
    await $.fs.write(`${home.replace(/\\/g, '/')}/.claude/state/mods/docket/${sessionId}.json`, JSON.stringify(body))
    heartbeatFor = sessionId
  } catch {
    // Best effort.
  }
}

async function fail($: EngineInterface, where: string, err: unknown): Promise<void> {
  const message = `${where}: ${err instanceof Error ? err.message : String(err)}`
  try {
    $.ui.log(`docket: ${message}`, { to: 'debug' })
  } catch {
    // A .catch handler's own $ calls can reject; the health write is best effort too.
  }
  await writeHealth($, message)
}

async function guard($: EngineInterface, where: string, work: Promise<void>): Promise<void> {
  try {
    await work
  } catch (err) {
    await fail($, where, err)
  }
}

function redraw($: EngineInterface): void {
  try {
    $.ui.invalidate('ui.render')
  } catch {
    // A redraw is a nicety; the next state write redraws anyway.
  }
}

// --- the key pause (a debounce, as Bridge's) ---

function startKeysPause($: EngineInterface, until: number): void {
  $.clock.after(ARM_DELAY_MS, () => void guard($, 'keys', resumeKeys($, until)))
}

async function resumeKeys($: EngineInterface, until: number): Promise<void> {
  await change($, s => (s.view.keysPausedUntil === until ? { ...s, view: { ...s.view, keysPausedUntil: null } } : s))
}

async function pauseKeys($: EngineInterface): Promise<void> {
  const until = (await $.clock.now()) + ARM_DELAY_MS
  await change($, s => ({ ...s, view: { ...s.view, keysPausedUntil: until } }))
  startKeysPause($, until)
}

// True when the press was swallowed (and the pause restarted).
async function isDebounced($: EngineInterface): Promise<boolean> {
  const until = (await $.clock.now()) + ARM_DELAY_MS
  const isPaused = await transact($, s =>
    s.view.keysPausedUntil === null ? { session: s, out: false } : { session: { ...s, view: { ...s.view, keysPausedUntil: until } }, out: true },
  )
  if (isPaused) startKeysPause($, until)
  return isPaused
}

// --- the judge runner ---

function modelFrom(options: Record<string, unknown>): string {
  const m = options.model
  return typeof m === 'string' && (MODELS as readonly string[]).includes(m) ? m : 'haiku'
}

function schedule($: EngineInterface, model: string): void {
  if (inFlight) return
  // Its own dispatch: a check started from a hook must not be abandoned with that hook's dispatch.
  $.clock.after(0, () => void guard($, 'judge', runNext($, model)))
}

async function runNext($: EngineInterface, model: string): Promise<void> {
  if (inFlight) return
  const mode: Mode | undefined = fullDue ? 'full' : resolveDue ? 'resolve' : undefined
  if (mode === undefined) return
  // A full check sends the user's pending words too, so it covers a due resolve.
  if (mode === 'full') {
    fullDue = false
    resolveDue = false
  } else {
    resolveDue = false
  }
  inFlight = true
  isResolving = mode === 'resolve'
  redraw($)
  try {
    await runCheck($, mode, model)
  } finally {
    inFlight = false
    isResolving = false
    redraw($)
  }
  if (fullDue || resolveDue) schedule($, model)
}

async function recordFailure($: EngineInterface, reason: string): Promise<void> {
  const now = await $.clock.now()
  const s = await change($, cur => ({ ...cur, lastCheck: { ...cur.lastCheck, ok: false, at: now, reason, streak: cur.lastCheck.streak + 1 } }))
  $.ui.log(`docket: check failed (${reason})`, { to: 'debug' })
  if (s.lastCheck.streak === 1) $.ui.toast(FAIL_TOAST(reason))
}

async function runCheck($: EngineInterface, mode: Mode, model: string): Promise<void> {
  const myEpoch = epoch
  const sid = await $.session.id()
  const s = await readSession($)
  const open = openItems(s)
  if (mode === 'resolve' && (open.length === 0 || s.pendingUser.length === 0)) return
  if (mode === 'full' && s.claude.length === 0 && s.tools.length === 0 && s.pendingUser.length === 0) return
  const built = buildPrompt({ mode, claude: s.claude, tools: s.tools, user: s.pendingUser, open, closed: closedForJudge(s), toolAsked: s.toolAsked, latest: s.lastFinal })
  const mine = new AbortController()
  controller = mine
  let r: Awaited<ReturnType<EngineInterface['model']['complete']>>
  try {
    r = await $.model.complete(
      { model, system: [{ text: RULES, cache: true }], prompt: built.prompt, maxTokens: 1024, effort: 'low', timeoutMs: TIMEOUT_MS },
      { signal: mine.signal },
    )
  } catch (err) {
    if (myEpoch !== epoch) return
    await recordFailure($, `rejected: ${err instanceof Error ? clip(err.message, 80) : 'unknown'}`)
    return
  } finally {
    if (controller === mine) controller = undefined
  }
  // A /clear or /resume while it ran: the verdict belongs to a conversation that is gone.
  if (myEpoch !== epoch || (await $.session.id()) !== sid) return
  if (!r.isAnswered) {
    if (r.reason === 'aborted' && mine.signal.aborted) return
    await recordFailure($, r.reason === 'api-error' ? `api-error ${r.status ?? ''}`.trim() : r.reason)
    return
  }
  if (!isUsageLogged) {
    isUsageLogged = true
    $.ui.log(`docket: first check usage ${JSON.stringify(r.usage)}`, { to: 'debug' })
  }
  const parsed = parseVerdict(r.text, built.snapshot)
  if (!parsed.ok) {
    await recordFailure($, parsed.reason)
    return
  }
  const now = await $.clock.now()
  const result = await transact($, cur => {
    // Checked again here, at the write: a /clear landing in the awaits above must not get the old
    // conversation's verdict written into the fresh session.
    if (myEpoch !== epoch) return { session: cur, out: undefined }
    const a = applyVerdict(cur, parsed.verdict, built.snapshot, now)
    const checkedTurns = cur.lastCheck.checkedTurns + (mode === 'full' ? 1 : 0)
    return { session: { ...a.session, lastCheck: { ok: true, at: now, reason: '', streak: 0, checkedTurns } }, out: a }
  })
  if (result === undefined) return
  // The user's words that answer an item this verdict added were kept: check them against it now.
  if (result.keptForNew) resolveDue = true
  if (parsed.dropped > 0 || result.refused.length > 0) {
    $.ui.log(`docket: verdict dropped ${parsed.dropped}, refused [${result.refused.join(', ')}]`, { to: 'debug' })
  }
  if (result.added > 0 || result.resolved > 0) await pauseKeys($)
}

// --- presses ---

// Puts "Re: <item> — " in the prompt box, after any draft already there, so the reply names the item.
async function replyTo($: EngineInterface, id: number): Promise<void> {
  const item = (await readSession($)).items.find(i => i.id === id && i.status === 'open')
  if (item === undefined) return
  const lead = `Re: ${item.text} — `
  const box = await $.prompt.read()
  const filled = box.text.trim() === '' ? await $.prompt.fill({ text: lead }) : await $.prompt.fill({ text: `\n${lead}`, mode: 'append' })
  if (!filled.isFilled) $.ui.toast('Docket: the prompt box is not taking text right now.')
}

function actions($: EngineInterface): Actions {
  return {
    reply: id => void guard($, 'reply', replyTo($, id)),
    done: id =>
      void guard(
        $,
        'done',
        (async () => {
          const now = await $.clock.now()
          await change($, s => markDone(s, id, now))
          await pauseKeys($)
        })(),
      ),
    dismiss: id =>
      void guard(
        $,
        'dismiss',
        (async () => {
          if (await isDebounced($)) return
          const now = await $.clock.now()
          await change($, s => dismiss(s, id, now))
          await pauseKeys($)
        })(),
      ),
    reopen: closeSeq =>
      void guard(
        $,
        'reopen',
        (async () => {
          await change($, s => reopen(s, closeSeq))
          await pauseKeys($)
        })(),
      ),
    toggleClosed: () => void guard($, 'toggle', change($, s => ({ ...s, view: { ...s.view, showAllClosed: !s.view.showAllClosed } })).then(() => undefined)),
  }
}

// The stored flag redraws the band's label; the engine's record (ui.panes) stays the authority for
// what to do on a click, and session.start re-syncs the flag from it.
async function setPaneUp($: EngineInterface, isPaneUp: boolean): Promise<void> {
  await change($, s => (s.view.isPaneUp === isPaneUp ? s : { ...s, view: { ...s.view, isPaneUp } }))
}

// Closes the pane when it is open, else opens it with the keys. Returns the line /docket prints.
async function togglePane($: EngineInterface): Promise<string> {
  if ((await $.ui.panes()).some(p => p.id === PANE_ID)) {
    await $.ui.close({ id: PANE_ID })
    await setPaneUp($, false)
    return 'Docket: pane closed; the ◇ button above the prompt shows the count.'
  }
  const opened = await $.ui.open({ id: PANE_ID, title: PANE_TITLE, focus: true, columns: PANE_COLUMNS })
  await setPaneUp($, opened.isPlaced)
  if (!opened.isPlaced) return `Docket: the pane could not be placed (${opened.reason}).`
  const count = openItems(await readSession($)).length
  return count === 0 ? 'Docket: nothing waiting on you.' : `Docket: ${count} open. Digits dismiss; Reopen undoes.`
}

export const register: Register = (on, options) => {
  const model = modelFrom(options as Record<string, unknown>)

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'docket', description: 'Docket: open or close the pane of what Claude left for you to decide or do (add <text>, clear)', immediate: true })
      loadedAt = await $.clock.now()
      // A hot reload keeps $.state but drops timers: clear a stranded key pause. The pane opens only
      // when the user asks (/docket toggles it); the band carries the count while it is closed.
      // An earlier build pinned a status line under the prompt; a pinned line outlives a reload, so clear
      // it. The indicator lives above the prompt now.
      $.ui.status(undefined)
      const isUp = (await $.ui.panes()).some(p => p.id === PANE_ID)
      await change($, cur => ({ ...cur, view: { ...cur.view, keysPausedUntil: null, isPaneUp: isUp } }))
    } catch (err) {
      await fail($, 'session.start', err)
    }
    await writeHealth($)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') {
      try {
        epoch += 1
        controller?.abort()
        resolveDue = false
        fullDue = false
        turnStartLen = undefined
        midTurn = new Set()
        const dropped = await transact($, s => ({ session: freshSession(), out: openItems(s).map(i => i.text) }))
        if (dropped.length > 0) {
          const word = e.reason === 'clear' ? '/clear' : '/resume'
          droppedNotice = clip(`Docket: dropped ${dropped.length} open item${dropped.length === 1 ? '' : 's'} from before ${word}: ${dropped.join('; ')}`, 260)
        }
      } catch (err) {
        await fail($, 'session.end', err)
      }
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    try {
      if (droppedNotice !== undefined && e.origin.kind === 'composer') {
        $.ui.log(droppedNotice)
        droppedNotice = undefined
      }
      const isUser = (e.origin.kind === 'composer' || e.origin.kind === 'bridge') && e.isMeta !== true && e.command === undefined
      if (isUser && e.text.trim() !== '') {
        if (e.turnId !== undefined) midTurn.add(e.text.trim())
        const s = await change($, cur => addUser(cur, e.text))
        if (openItems(s).length > 0) {
          resolveDue = true
          schedule($, model)
        }
      }
    } catch (err) {
      await fail($, 'prompt.submit', err)
    }
    return next(e)
  }).catch(async ($, e, next) => {
    // Docket never gates a prompt: whatever failed, the prompt goes on.
    await fail($, 'prompt.submit', next.error.message ?? next.error.kind)
    return next(e)
  })

  // The user's `!cmd` reaches no prompt.submit: it is a `command`-door row "<bash-input>…" (live probe).
  on('session.append', { door: 'command' }, async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined) return r
    try {
      const text = e.message.content.map(b => ((b as { type: string }).type === 'text' ? (b as unknown as { text: string }).text : '')).join('')
      const cmd = bashInput(text)
      if (cmd !== undefined) {
        const s = await change($, cur => addUser(cur, `!${cmd}`))
        if (openItems(s).length > 0) {
          resolveDue = true
          schedule($, model)
        }
      }
    } catch (err) {
      await fail($, 'session.append', err)
    }
    return r
  }).catch(async ($, e, next) => {
    await fail($, 'session.append', next.error.message ?? next.error.kind)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      try {
        midTurn = new Set()
        turnStartLen = { turnId: e.turnId, len: (await $.session.messages()).length, opener: e.text.trim() }
        if (heartbeatFor !== (await $.session.id())) void guard($, 'heartbeat', writeHealth($))
      } catch (err) {
        await fail($, 'turn.start', err)
      }
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done
    try {
      const mark = turnStartLen?.turnId === e.turnId ? turnStartLen : undefined
      turnStartLen = undefined
      const msgs = await $.session.messages()
      const s0 = await readSession($)
      const turn = s0.turn + 1
      const got = material(turnSlice(msgs, mark?.len, midTurn, mark?.opener), e.answer, turn)
      midTurn = new Set()
      const final = got.claude.at(-1)?.text
      await change($, s => addToolAsked(addTurn({ ...s, turn, lastFinal: final ?? s.lastFinal }, got.claude, got.tools), got.asked))
      // Only a turn that ended with an answer is judged; an aborted, refused or failed one leaves its
      // material for the next check.
      if (e.reason === 'answer') {
        fullDue = true
        schedule($, model)
      }
    } catch (err) {
      await fail($, 'turn.complete', err)
    }
    return done
  })

  on('ui.render', { component: 'Pane', requestId: 'docket' }, async ($, e, next) => {
    try {
      const s = await readSession($)
      const live = { isChecking: inFlight, isResolving, isFocused: e.props.isFocused }
      return paneTree($.ui.resolve(e), s, openItems(s), closeGroups(s), live, actions($))
    } catch (err) {
      void fail($, 'pane', err)
      return next(e)
    }
  })

  // The indicator: a button in the band above the prompt, after whatever draws beneath (another
  // plugin's band, the engine's), never instead of it. A click opens or closes the pane. It yields to a
  // survey and hides when nothing is open and the last check was fine.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    try {
      if (e.props.hasSurvey) return below
      const s = await readSession($)
      const label = indicatorText(openItems(s).length, s, s.view.isPaneUp)
      if (label === undefined) return below
      return indicatorTree($.ui.resolve(e), below, label, () => void guard($, 'indicator', togglePane($).then(() => undefined)))
    } catch (err) {
      void fail($, 'indicator', err)
      return below
    }
  })

  // Which item's buttons hold the focus ring: that item shows Claude's quote.
  on('ui.focus', async ($, e, next) => {
    const r = await next(e)
    if (e.component !== 'Pane' || e.requestId !== PANE_ID) return r
    try {
      const m = /^(?:reply|done|dismiss)-(\d+)$/.exec(e.element ?? '')
      const focusedId = m?.[1] === undefined ? null : Number(m[1])
      await change($, s => (s.view.focusedId === focusedId ? s : { ...s, view: { ...s.view, focusedId } }))
    } catch (err) {
      await fail($, 'ui.focus', err)
    }
    return r
  }).catch(async ($, e, next) => {
    await fail($, 'ui.focus', next.error.message ?? next.error.kind)
    return next(e)
  })

  // Any close (the person's mark or key, an unload) keeps the band's label right.
  on('ui.close', { id: 'docket' }, async ($, e, next) => {
    const r = await next(e)
    try {
      await setPaneUp($, false)
    } catch (err) {
      await fail($, 'ui.close', err)
    }
    return r
  }).catch(async ($, e, next) => {
    await fail($, 'ui.close', next.error.message ?? next.error.kind)
    return next(e)
  })

  on('command.run', { command: 'docket' }, async ($, e, next) => {
    try {
      const args = e.args.trim()
      if (args === 'add' || args.startsWith('add ')) {
        const text = args.slice(3).trim()
        if (text === '') return { text: 'Docket: /docket add <what you need to decide or do>' }
        await change($, s => addManual(s, text))
        return { text: 'Docket: added.' }
      }
      if (args === 'clear') {
        const now = await $.clock.now()
        const before = openItems(await readSession($)).length
        await change($, s => clearAll(s, now))
        return { text: before === 0 ? 'Docket: nothing open.' : `Docket: dismissed ${before}; Reopen all in the pane brings them back.` }
      }
      if (args !== '') return { text: 'Docket: /docket opens or closes the pane; /docket add <text>; /docket clear.' }
      return { text: await togglePane($) }
    } catch (err) {
      await fail($, 'command', err)
      return next(e)
    }
  }).catch(async ($, e, next) => {
    await fail($, 'command', next.error.message ?? next.error.kind)
    return { text: 'Docket: the command failed; the debug log has the reason.' }
  })
}
