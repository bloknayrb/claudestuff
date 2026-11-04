import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DocketProc, DocketSession, DocketWriter, PendingWrite } from '../types'
import { bashInput, material, turnSlice } from './capture'
import { buildPrompt, parseVerdict, RULES } from './judge'
import type { Mode } from './judge'
import { addManual, addToolAsked, addTurn, addUser, applyVerdict, clearAll, closedForJudge, closeGroups, dismiss, freshSession, markDone, normalize, openItems, reopen } from './ledger'
import { envelope, freshProc, freshWriter, isRealSid, isSafeSid, ledgerText, normProc, normWriter, parseSlot, pickSlot, restore, RETAIN_MS, slotName, tombstone, withKey, withoutKey, writeKey } from './persist'
import { clip } from './text'
import { ARM_DELAY_MS, indicatorText, indicatorTree, PANE_COLUMNS, PANE_ID, PANE_TITLE, paneTree } from './ui'
import type { Actions } from './ui'

const MODELS = ['haiku', 'sonnet', 'opus'] as const
const TIMEOUT_MS = 20000
const FAIL_TOAST = (reason: string) => `Docket: couldn't check the last turn (${reason}); it tries again next turn.`

// The one state value, defined beside every read and update of it (the validator refuses a state atom
// read from another file). A value an earlier build stored is filled out by normalize().
const SESSION = atom({ plugin: 'docket', key: 'session' } as const, freshSession())
// Process-scoped bookkeeping and the save queue: a /clear or /resume replaces SESSION, never these.
const PROC = atom({ plugin: 'docket', key: 'proc' } as const, freshProc())
const WRITER = atom({ plugin: 'docket', key: 'writer' } as const, freshWriter())

const SAVE_TOAST = (reason: string) => `Docket: couldn't save the docket (${clip(reason, 80)}).`
// A session.end drain stops starting writes when less than this is left of its shared bound.
const END_MARGIN_MS = 250
const END_BOUND_MS = 1500
const RETENTION_DELAY_MS = 60000

// Module state: lost on a hot reload, which is the point for the runner's flags (a reload must not
// strand a check as running; the epoch in PROC, bumped by session.start, discards the old one's verdict).
// Nothing a drawing needs to survive lives here.
let resolveDue = false
let fullDue = false
let inFlight = false
let isResolving = false
let controller: AbortController | undefined
// Writes run one after another on this chain, so no two share a slot.
let saveChain: Promise<void> = Promise.resolve()
// Set while session.end drains: every drain, including one already running, stops starting writes once
// the hook's shared bound runs low.
let endBudget: (() => boolean) | null = null
// The message count and the opening prompt's text at turn.start: how turn.complete finds the turn.
let turnStartLen: { turnId: string; len: number; opener: string } | undefined
// Prompts typed into the running turn: user rows that do not open a turn (see capture.ts).
let midTurn = new Set<string>()
let isUsageLogged = false
let loadedAt = 0
let heartbeatFor = ''

// Every session change goes through here, and queues a save of what it wrote.
async function transact<T>($: EngineInterface, change: (s: DocketSession) => { session: DocketSession; out: T }): Promise<T> {
  const box: { out?: T; isRun: boolean; after?: DocketSession; before?: DocketSession } = { isRun: false }
  await update($, SESSION, value => {
    const before = normalize(value)
    const r = change(before)
    box.out = r.out
    box.isRun = true
    box.before = before
    box.after = r.session
    return r.session
  })
  if (!box.isRun) throw new Error('docket: the state update did not run')
  if (box.after !== undefined && box.after !== box.before) await queueSave($, box.after, false)
  return box.out as T
}

async function readProc($: EngineInterface): Promise<DocketProc> {
  return normProc(await read($, PROC))
}

async function changeProc($: EngineInterface, fn: (p: DocketProc) => DocketProc): Promise<DocketProc> {
  let out = freshProc()
  await update($, PROC, v => {
    out = fn(normProc(v))
    return out
  })
  return out
}

async function readWriter($: EngineInterface): Promise<DocketWriter> {
  return normWriter(await read($, WRITER))
}

async function changeWriter($: EngineInterface, fn: (w: DocketWriter) => DocketWriter): Promise<void> {
  await update($, WRITER, v => fn(normWriter(v)))
}

// --- files ---

async function baseDir($: EngineInterface): Promise<string | undefined> {
  const config = await $.env.get('CLAUDE_CONFIG_DIR')
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  const dir = config !== undefined && config !== '' ? config : home === undefined || home === '' ? undefined : `${home}/.claude`
  return dir === undefined ? undefined : `${dir.replace(/\\/g, '/').replace(/\/+$/, '')}/state/mods/docket`
}

async function readText($: EngineInterface, path: string): Promise<string | undefined> {
  try {
    return await $.fs.read(path)
  } catch {
    return undefined
  }
}

// --- the writer ---

// Queues the session's snapshot. A final (the session is being left) is written even for a closed sid.
async function queueSave($: EngineInterface, s: DocketSession, isFinal: boolean): Promise<void> {
  if (!isRealSid(s.sid)) return
  if (!(s.everHadItem || s.items.length > 0 || s.carry.gen > 0)) return
  const text = ledgerText(s)
  const k = writeKey(s.sid, 'snap')
  let isQueued = false
  await changeWriter($, w => {
    let next = w
    const forgotAt = w.forgotten[s.sid]
    if (forgotAt !== undefined) {
      // Forgotten until an item first seen after the forget arrives.
      if (!s.items.some(i => (i.firstSeenAt ?? 0) > forgotAt)) return w
      next = { ...next, forgotten: withoutKey(next.forgotten, s.sid) }
    }
    if (next.closed[s.sid] === true && !isFinal) return w
    const p = next.pending[k]
    if (p === undefined && next.lastText[k] === text) return next
    if (p !== undefined && p.text === text && (p.isFinal || !isFinal)) return next
    isQueued = true
    const entry: PendingWrite = { sid: s.sid, root: s.root, kind: 'snap', text, isFinal: isFinal || (p?.isFinal ?? false) }
    return { ...next, pending: withKey(next.pending, k, entry) }
  })
  if (isQueued) kickSave($)
}

// Runs the queue from its own dispatch: work that outlives a hook goes through $.clock.after.
function kickSave($: EngineInterface): void {
  $.clock.after(0, () => {
    saveChain = saveChain.then(() => drainSaves($, () => true)).catch(err => fail($, 'save', err))
  })
}

// Writes every pending entry once (a failed one waits for the next queue or session.start).
async function drainSaves($: EngineInterface, mayStart: () => boolean): Promise<void> {
  const tried = new Set<string>()
  for (;;) {
    const w = await readWriter($)
    const k = Object.keys(w.pending).find(x => !tried.has(x))
    if (k === undefined || !mayStart() || (endBudget !== null && !endBudget())) return
    tried.add(k)
    const p = w.pending[k]
    if (p !== undefined) await writeOne($, k, p, w)
  }
}

async function writeOne($: EngineInterface, k: string, p: PendingWrite, w: DocketWriter): Promise<void> {
  const base = await baseDir($)
  if (base === undefined || !isSafeSid(p.sid)) return
  const seq = (w.seqBy[k] ?? 0) + 1
  try {
    await $.fs.write(`${base}/sessions/${p.sid}.${slotName(seq)}.json`, envelope(p.sid, p.root, seq, await $.clock.now(), p.text))
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    $.ui.log(`docket: save failed: ${reason}`, { to: 'debug' })
    await writeHealth($, `save: ${reason}`)
    const proc = await readProc($)
    if (!proc.saveToastShown) {
      await changeProc($, x => ({ ...x, saveToastShown: true }))
      $.ui.toast(SAVE_TOAST(reason))
    }
    return
  }
  await changeWriter($, cur => ({
    ...cur,
    seqBy: withKey(cur.seqBy, k, Math.max(seq, cur.seqBy[k] ?? 0)),
    // A forget that landed while this write was in flight keeps its tombstone as the last text.
    lastText: cur.forgotten[p.sid] !== undefined ? cur.lastText : withKey(cur.lastText, k, p.text),
    rootBy: withKey(cur.rootBy, p.sid, p.root),
    pending: cur.pending[k]?.text === p.text ? withoutKey(cur.pending, k) : cur.pending,
  }))
}

// The latest saved ledger for a sid: the writer's own text first (a final may still be queued), else
// the newer valid slot on disk, whose seq seeds the writer's counter.
async function latestFor($: EngineInterface, sid: string): Promise<{ text: string; root: string } | null | 'forgotten'> {
  const k = writeKey(sid, 'snap')
  const w = await readWriter($)
  if (w.forgotten[sid] !== undefined) return 'forgotten'
  const mine = w.pending[k]?.text ?? w.lastText[k]
  if (mine !== undefined) return { text: mine, root: w.pending[k]?.root ?? w.rootBy[sid] ?? '' }
  const base = await baseDir($)
  if (base === undefined) return null
  const a = parseSlot(await readText($, `${base}/sessions/${sid}.a.json`), sid)
  const b = parseSlot(await readText($, `${base}/sessions/${sid}.b.json`), sid)
  const top = Math.max(a?.seq ?? 0, b?.seq ?? 0)
  if (top > 0) await changeWriter($, cur => ({ ...cur, seqBy: withKey(cur.seqBy, k, Math.max(top, cur.seqBy[k] ?? 0)) }))
  const best = pickSlot(a, b)
  return best === null ? null : { text: JSON.stringify(best.ledger), root: best.root }
}

// --- the owning session ---

async function isPaneShown($: EngineInterface): Promise<boolean> {
  try {
    return (await $.ui.panes()).some(p => p.id === PANE_ID)
  } catch {
    return false
  }
}

// Points the docket at session `sid`: nothing if it already is; adopts a live v0.1 value; otherwise
// saves the session being left and loads sid's snapshot (or starts fresh).
async function rehome($: EngineInterface, sid: string, isClassic: boolean): Promise<void> {
  if (!isSafeSid(sid)) {
    $.ui.log(`docket: refused an unsafe session id`, { to: 'debug' })
    return
  }
  const proc = await readProc($)
  if (!isClassic && proc.endingSid === sid && (await $.session.id()) === sid) return
  if ((await readSession($)).sid === sid) return
  await changeWriter($, w => (w.closed[sid] === true ? { ...w, closed: withoutKey(w.closed, sid) } : w))
  const latest = await latestFor($, sid)
  const restored = latest === null || latest === 'forgotten' ? null : parseSlot(envelope(sid, latest.root, 1, await $.clock.now(), latest.text), sid)
  const root = restored?.root || (await $.session.root())
  const isUp = await isPaneShown($)
  // What is on disk is what the restore will hold: seed the dedupe, so landing writes nothing new.
  if (restored !== null) {
    const k = writeKey(sid, 'snap')
    const text = ledgerText(restore(restored.ledger, sid, restored.root || root))
    await changeWriter($, w => (w.pending[k] === undefined ? { ...w, lastText: withKey(w.lastText, k, text), rootBy: withKey(w.rootBy, sid, restored.root || root) } : w))
  }
  const old = await transact($, cur => {
    if (cur.sid === sid) return { session: cur, out: null }
    if (cur.sid === '') return { session: { ...cur, sid, root, restored: true }, out: null }
    const base = restored === null ? { ...freshSession(), sid, root } : restore(restored.ledger, sid, restored.root || root)
    return { session: { ...base, view: { ...freshSession().view, isPaneUp: isUp } }, out: cur }
  })
  if (old !== null && isRealSid(old.sid)) await switchAway($, old)
  redraw($)
}

// The one place a session is left: its check is dropped, and its final snapshot is queued.
async function switchAway($: EngineInterface, old: DocketSession): Promise<void> {
  await changeProc($, p => ({ ...p, epoch: p.epoch + 1 }))
  controller?.abort()
  resolveDue = false
  fullDue = false
  turnStartLen = undefined
  midTurn = new Set()
  await queueSave($, old, true)
  await changeWriter($, w => ({ ...w, closed: withKey(w.closed, old.sid, true as const) }))
}

// Prompts, turns and commands land on the right session even when nothing told Docket of a switch.
// Not before session.start: until then $.session.id() can be a provisional id (probe, --continue).
async function lazyRehome($: EngineInterface): Promise<void> {
  const proc = await readProc($)
  if (proc.isInteractive === null) return
  const sid = await $.session.id()
  const cur = (await readSession($)).sid
  if (cur === sid) {
    // $.session.id() has caught up with a classic landing: the guard has done its job.
    if (proc.classicSid !== null) await changeProc($, p => ({ ...p, classicSid: null, classicFrom: null }))
    return
  }
  // The classic hook landed the docket on its session first, and $.session.id() still reads the
  // session it came from: wait. An id that has moved to a third session is followed.
  if (cur === proc.classicSid && sid === proc.classicFrom) return
  await rehome($, sid, false)
}

async function forget($: EngineInterface): Promise<string> {
  const s = await readSession($)
  if (!isRealSid(s.sid)) return 'Docket: nothing saved for this session yet.'
  const base = await baseDir($)
  if (base === undefined) return 'Docket: no folder to forget from.'
  const k = writeKey(s.sid, 'snap')
  const now = await $.clock.now()
  await changeWriter($, w => ({ ...w, pending: withoutKey(w.pending, k), forgotten: withKey(w.forgotten, s.sid, now), lastText: withKey(w.lastText, k, tombstone(s.sid)) }))
  const erase = saveChain.then(async () => {
    for (const slot of ['a', 'b']) await $.fs.write(`${base}/sessions/${s.sid}.${slot}.json`, tombstone(s.sid))
  })
  // The chain must never stay rejected: later saves (and session.end's finals) run after it.
  saveChain = erase.catch(err => fail($, 'forget', err))
  try {
    await erase
  } catch (err) {
    return `Docket: couldn't erase the saved copy (${clip(err instanceof Error ? err.message : String(err), 80)}); saving stays off for this session until a new item.`
  }
  return 'Docket: forgot the saved copy of this session\'s docket. The pane is unchanged; a new item starts saving again.'
}

// Best effort: snapshots untouched for 30 days become tombstones (nothing can be deleted).
async function prune($: EngineInterface): Promise<void> {
  const base = await baseDir($)
  if (base === undefined) return
  const keep = new Set([await $.session.id(), (await readSession($)).sid])
  const now = await $.clock.now()
  let entries: Awaited<ReturnType<EngineInterface['fs']['list']>> = []
  try {
    entries = await $.fs.list(`${base}/sessions`)
  } catch {
    return
  }
  for (const e of entries) {
    const m = /^(.+)\.(a|b)\.json$/.exec(e.name)
    if (m === null || e.kind !== 'file' || e.isLink || !isSafeSid(m[1]) || keep.has(m[1] as string)) continue
    if (now - e.mtimeMs < RETAIN_MS) continue
    const text = await readText($, `${base}/sessions/${e.name}`)
    if (text !== undefined && text.includes('"gone":true')) continue
    // Accepted: a second window resuming this sid between the mtime check and this write would lose
    // that one save (a 30-day-idle session reopened in the same second).
    saveChain = saveChain
      .then(() => $.fs.write(`${base}/sessions/${e.name}`, tombstone(m[1] as string)))
      .catch(err => $.ui.log(`docket: prune write failed: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' }))
  }
  await saveChain.catch(() => undefined)
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
    const base = await baseDir($)
    if (base === undefined) return
    const sessionId = await $.session.id()
    if (!isSafeSid(sessionId)) return
    const now = await $.clock.now()
    if (loadedAt === 0) loadedAt = now
    const s = await readSession($)
    const body = {
      loadedAt,
      open: openItems(s).length,
      checkedTurns: s.lastCheck.checkedTurns,
      lastError: error === undefined ? null : { ts: now, message: clip(error, 200) },
    }
    await $.fs.write(`${base}/${sessionId}.json`, JSON.stringify(body))
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
  const myEpoch = (await readProc($)).epoch
  const s = await readSession($)
  const sid = s.sid
  if (!isRealSid(sid) && sid !== '') return
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
    if (myEpoch !== (await readProc($)).epoch) return
    await recordFailure($, `rejected: ${err instanceof Error ? clip(err.message, 80) : 'unknown'}`)
    return
  } finally {
    if (controller === mine) controller = undefined
  }
  // A /clear, /resume or reload while it ran: the verdict belongs to a conversation that is gone.
  if (myEpoch !== (await readProc($)).epoch || (await readSession($)).sid !== sid) return
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
    if (cur.sid !== sid) return { session: cur, out: undefined }
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
      await $.command.register({ name: 'docket', description: 'Docket: open or close the pane of what Claude left for you to decide or do (add <text>, clear, forget)', immediate: true })
      loadedAt = await $.clock.now()
      // A reload: any check the old module started is now stale.
      await changeProc($, p => ({ ...p, isInteractive: e.isInteractive, epoch: p.epoch + 1 }))
      await rehome($, await $.session.id(), false)
      // Timers died with the old module: re-run the queue, and re-queue the current state (free when
      // nothing was lost, by the dedupe).
      await queueSave($, await readSession($), false)
      kickSave($)
      $.clock.after(RETENTION_DELAY_MS, () => void guard($, 'prune', prune($)))
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

  // The settings hook's session start: it knows the source and the real id first (before session.start,
  // and on an in-process /clear or /resume). Observe only; the rehome runs in its own dispatch.
  on('classic.SessionStart', async ($, e, next) => {
    const sid = e.session_id
    // What the docket was on when this call fired. If, by the deferred run, it has landed on some
    // other real session, a later switch overtook this call: it is stale and changes nothing. Never
    // compared with $.session.id(), which can be provisional here (probe results, --continue).
    const at = (await readSession($)).sid
    $.clock.after(0, () =>
      void guard(
        $,
        'classic',
        (async () => {
          const cur = (await readSession($)).sid
          if (cur !== at && isRealSid(cur) && cur !== sid) return
          const from = await $.session.id()
          await changeProc($, p => ({ ...p, classicSid: sid, classicFrom: from === sid ? null : from }))
          await rehome($, sid, true)
        })(),
      ),
    )
    return next(e)
  }).catch(async ($, e, next) => {
    await fail($, 'classic.SessionStart', next.error.message ?? next.error.kind)
    return next(e)
  })

  // The conversation ends: on /clear or /resume its docket is saved and the state starts over for the
  // next; on exit its final snapshot is written. Both drain the queue inside the hook's short bound.
  on('session.end', async ($, e, next) => {
    try {
      await changeProc($, p => ({ ...p, endingSid: e.sessionId }))
      if (e.reason === 'clear' || e.reason === 'resume') {
        const old = await transact($, cur => (cur.sid === e.sessionId ? { session: freshSession(), out: cur } : { session: cur, out: null }))
        if (old !== null) await switchAway($, old)
      } else {
        const s = await readSession($)
        if (s.sid === e.sessionId) await queueSave($, s, true)
      }
      // Every drain on the chain (one already running too) stops starting writes near the bound, and the
      // hook stops waiting there: a write still in flight costs only that save (the A/B slots).
      endBudget = () => next.budget.remainingMs > END_MARGIN_MS
      const drained = saveChain.then(() => drainSaves($, () => true))
      saveChain = drained.catch(() => undefined)
      // The documented bound is 1.5 s; never wait longer, whatever remainingMs reads.
      const wait = Math.max(0, Math.min(END_BOUND_MS, next.budget.remainingMs) - END_MARGIN_MS)
      await Promise.race([drained, new Promise<void>(r => $.clock.after(wait, () => r()))])
    } catch (err) {
      await fail($, 'session.end', err)
    } finally {
      endBudget = null
    }
    try {
      return await next(e)
    } finally {
      // Cleared only once the id has moved on; until then rehome's own check holds the old id off.
      try {
        if ((await $.session.id()) !== e.sessionId) await changeProc($, p => (p.endingSid === e.sessionId ? { ...p, endingSid: null } : p))
      } catch {
        // Best effort: the block lifts by itself once the id changes.
      }
    }
  })

  on('prompt.submit', async ($, e, next) => {
    try {
      await lazyRehome($)
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
      await lazyRehome($)
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
        await lazyRehome($)
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
      // The session isn't known yet (a new process, between a /clear and its landing): draw nothing.
      if (s.sid === 'pending') return below
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
      await lazyRehome($)
      const args = e.args.trim()
      if (args === 'add' || args.startsWith('add ')) {
        const text = args.slice(3).trim()
        if (text === '') return { text: 'Docket: /docket add <what you need to decide or do>' }
        const now = await $.clock.now()
        await change($, s => addManual(s, text, now))
        return { text: 'Docket: added.' }
      }
      if (args === 'forget') return { text: await forget($) }
      if (args === 'clear') {
        const now = await $.clock.now()
        const before = openItems(await readSession($)).length
        await change($, s => clearAll(s, now))
        return { text: before === 0 ? 'Docket: nothing open.' : `Docket: dismissed ${before}; Reopen all in the pane brings them back.` }
      }
      if (args !== '') return { text: 'Docket: /docket opens or closes the pane; /docket add <text>; /docket clear; /docket forget (erase the saved copy).' }
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
