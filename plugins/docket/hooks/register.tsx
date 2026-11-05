import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CarrySource, ClearCapture, DocketProc, DocketSession, DocketWriter, Item, PendingWrite, WriteKind } from '../types'
import { bashInput, material, turnSlice } from './capture'
import { CARRY_MAX_AGE_MS, carryEnvelope, carryText, claimers, claimText, folderName, MAX_HOPS, normRoot, parseCarry, pickCarry, rootKey, takeInto } from './carry'
import type { CarryFile } from './carry'
import { buildPrompt, parseVerdict, RULES } from './judge'
import type { Mode } from './judge'
import { addManual, addToolAsked, addTurn, addUser, applyVerdict, clearAll, closedForJudge, closeGroups, dismiss, freshSession, handOff, isWalking, markDone, normalize, openItems, present, reopen } from './ledger'
import { envelope, freshProc, freshWriter, isRealSid, isSafeSid, ledgerText, normProc, normWriter, parseSlot, pickSlot, restore, RETAIN_MS, slotName, tombstone, withKey, withoutKey, writeKey } from './persist'
import { blankText, btwQuestion, contextBlock, HANDOFF_MAX_AGE_MS, isNonce, isRootSafe, label, launchScript, leadHere, leadNew, newNonce, parseHandoff, parseNewArgs, replyRefusal, tailAfter, takenText, waitingText, wtArgv } from './spawn'
import { clip } from './text'
import { ARM_DELAY_MS, indicatorText, indicatorTree, listText, PANE_COLUMNS, PANE_ID, PANE_TITLE, paneTree } from './ui'
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
// Set for the whole of session.end: nothing lists files while it runs (a write timer queued by
// switchAway could otherwise fire before endBudget is set).
let isEnding = false
// The message count and the opening prompt's text at turn.start: how turn.complete finds the turn.
let turnStartLen: { turnId: string; len: number; opener: string } | undefined
// Prompts typed into the running turn: user rows that do not open a turn (see capture.ts).
let midTurn = new Set<string>()
let isUsageLogged = false
let loadedAt = 0
let heartbeatFor = ''
// Carry takes in flight (a reload clears these; a re-run take dedupes by origin and pendingClaim).
let isStartupTaking = false
// A Reply new pickup is running in this module (v0.4): a second session.start doesn't start another.
let isPickingUp = false
let captureTaking: number | null = null
// When each sid's claims were last listed for a source notice (throttled to once per 30 s).
const noticeCheckedAt = new Map<string, number>()
const NOTICE_EVERY_MS = 30000
// roots/<key> folders whose real path was checked to sit under the base.
const safeRoots = new Set<string>()
let baseRealCache: string | undefined

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

// Queues the session's snapshot and, while the switch has ever been on, its carry file. A final (the
// session is being left) is written even for a closed sid.
async function queueSave($: EngineInterface, s: DocketSession, isFinal: boolean): Promise<void> {
  if (!isRealSid(s.sid)) return
  const writes: { kind: WriteKind; text: string }[] = []
  // A session that ever touched the switch persists it, turning it off included.
  if (s.everHadItem || s.items.length > 0 || s.carry.gen > 0) writes.push({ kind: 'snap', text: ledgerText(s) })
  // The carry: only an interactive session's, only once the switch was ever on (an untouched session
  // writes no carry file, so it can't become a folder's newest), and not once a later session took it,
  // except the off record (switched off, or forgotten), which always lands: items must not stay on disk.
  const isOffRecord = !s.carry.on
  if (s.carry.gen > 0 && (!s.carryTaken || isOffRecord) && s.root !== '' && (await readProc($)).isInteractive === true) writes.push({ kind: 'carry', text: carryText(s) })
  if (writes.length === 0) return
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
    for (const { kind, text } of writes) {
      const k = writeKey(s.sid, kind)
      const p = next.pending[k]
      if (p === undefined && next.lastText[k] === text) continue
      if (p !== undefined && p.text === text && (p.isFinal || !isFinal)) continue
      isQueued = true
      const entry: PendingWrite = { sid: s.sid, root: s.root, kind, text, isFinal: isFinal || (p?.isFinal ?? false) }
      next = { ...next, pending: withKey(next.pending, k, entry) }
    }
    return next
  })
  if (isQueued) kickSave($)
}

// Runs the queue from its own dispatch: work that outlives a hook goes through $.clock.after.
function kickSave($: EngineInterface): void {
  $.clock.after(0, () => {
    saveChain = saveChain.then(() => drainSaves($, () => true)).catch(err => fail($, 'save', err))
  })
}

// Writes every pending entry once (a failed one waits for the next queue or session.start). Carry
// files first: when a tab closes, the handoff matters more than the snapshot.
async function drainSaves($: EngineInterface, mayStart: () => boolean): Promise<void> {
  const tried = new Set<string>()
  for (;;) {
    const w = await readWriter($)
    const keys = Object.keys(w.pending).filter(x => !tried.has(x))
    const k = keys.find(x => x.endsWith('|carry')) ?? keys[0]
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
  let path = `${base}/sessions/${p.sid}.${slotName(seq)}.json`
  let body = ''
  if (p.kind === 'carry') {
    const dir = await rootDir($, base, p.root)
    if (dir === undefined) return dropPending($, k, p)
    // A later session already took this gen: stop writing it (never in session.end, which lists nothing).
    const body0 = JSON.parse(p.text) as { gen: number; on: boolean }
    if (body0.on && !isEnding && endBudget === null && (await isOwnCarryTaken($, dir, p.sid, body0.gen))) return dropPending($, k, p)
    path = `${dir}/carry/${p.sid}.${slotName(seq)}.json`
    body = carryEnvelope(p.sid, p.root, seq, await $.clock.now(), p.text)
  } else {
    body = envelope(p.sid, p.root, seq, await $.clock.now(), p.text)
  }
  try {
    await $.fs.write(path, body)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    $.ui.log(`docket: save failed: ${reason}`, { to: 'debug' })
    await writeHealth($, `save: ${reason}`)
    if (p.kind === 'carry') await markSession($, p.sid, s => (s.carrySaveFailed ? s : { ...s, carrySaveFailed: true }))
    const proc = await readProc($)
    if (!proc.saveToastShown) {
      await changeProc($, x => ({ ...x, saveToastShown: true }))
      $.ui.toast(SAVE_TOAST(reason))
    }
    return
  }
  if (p.kind === 'carry') await markSession($, p.sid, s => (s.carrySaveFailed ? { ...s, carrySaveFailed: false } : s))
  await changeWriter($, cur => ({
    ...cur,
    seqBy: withKey(cur.seqBy, k, Math.max(seq, cur.seqBy[k] ?? 0)),
    // A forget that landed while this write was in flight keeps its tombstone as the last text.
    lastText: cur.forgotten[p.sid] !== undefined ? cur.lastText : withKey(cur.lastText, k, p.text),
    rootBy: withKey(cur.rootBy, p.sid, p.root),
    pending: cur.pending[k]?.text === p.text ? withoutKey(cur.pending, k) : cur.pending,
  }))
}

async function dropPending($: EngineInterface, k: string, p: PendingWrite): Promise<void> {
  await changeWriter($, cur => (cur.pending[k]?.text === p.text ? { ...cur, pending: withoutKey(cur.pending, k) } : cur))
}

// A change to the current session's non-saved flags, only if the docket is still on that sid. Not
// through transact: these flags never change what is saved, so no save is queued.
async function markSession($: EngineInterface, sid: string, fn: (s: DocketSession) => DocketSession): Promise<void> {
  await update($, SESSION, v => {
    const s = normalize(v)
    return s.sid === sid ? fn(s) : s
  })
}

// --- carry folders ---

// roots/<rootKey> for a root, once its real path is seen to sit under the base (a junction planted at
// a folder must not redirect a write). A folder not there yet is fine: the write creates a real one.
async function rootDir($: EngineInterface, base: string, root: string): Promise<string | undefined> {
  if (root === '') return undefined
  const key = rootKey(root)
  const dir = `${base}/roots/${key}`
  // Every folder level Docket writes through must, if it exists, be a plain folder that resolves to
  // exactly where it should: a junction at roots/, roots/<key>, carry/ or claims/ must not redirect.
  return (await safeUnder($, base, ['roots', `roots/${key}`, `roots/${key}/carry`, `roots/${key}/claims`])) ? dir : undefined
}

// True when each of `rels` under base is absent or a plain folder that resolves to exactly base/rel.
async function safeUnder($: EngineInterface, base: string, rels: readonly string[]): Promise<boolean> {
  const lower = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  let baseReal = baseRealCache ?? base
  if (baseRealCache === undefined) {
    try {
      baseReal = (await $.fs.stat(base, { resolve: true })).realPath ?? base
      baseRealCache = baseReal
    } catch {
      // Not there yet: nothing under it can be a planted link either.
    }
  }
  for (const rel of rels) {
    const p = `${base}/${rel}`
    if (safeRoots.has(p)) continue
    let st: Awaited<ReturnType<EngineInterface['fs']['stat']>>
    try {
      st = await $.fs.stat(p, { resolve: true })
    } catch {
      continue
    }
    if (st.isLink || st.kind !== 'dir' || st.realPath === undefined || lower(st.realPath) !== lower(`${baseReal}/${rel}`)) {
      $.ui.log(`docket: refused folder ${rel} (not a plain folder under the base)`, { to: 'debug' })
      return false
    }
    safeRoots.add(p)
  }
  return true
}

async function listClaims($: EngineInterface, dir: string, srcSid: string, gen: number): Promise<string[] | 'error'> {
  try {
    return claimers(await $.fs.list(`${dir}/claims/${srcSid}/${gen}`))
  } catch {
    // A folder that isn't there means nobody claimed it.
    return (await $.fs.exists(`${dir}/claims/${srcSid}/${gen}`).catch(() => true)) ? 'error' : []
  }
}

// Source notices: has another session claimed this session's carry gen? Throttled; sets carryTaken.
async function isOwnCarryTaken($: EngineInterface, dir: string, sid: string, gen: number, isForced = false): Promise<boolean> {
  const s = await readSession($)
  if (s.sid === sid && s.carryTaken) return true
  const now = await $.clock.now()
  const last = noticeCheckedAt.get(sid)
  if (!isForced && last !== undefined && now - last < NOTICE_EVERY_MS) return false
  noticeCheckedAt.set(sid, now)
  const who = await listClaims($, dir, sid, gen)
  if (who === 'error' || !who.some(x => x !== sid)) return false
  await markSession($, sid, cur => (cur.carry.gen === gen ? { ...cur, carryTaken: true } : cur))
  redraw($)
  return true
}

// --- taking a carry ---

// Writes this session's claim on a take that applied; cleared only if the docket still holds that take.
async function writeClaim($: EngineInterface, src: CarrySource, by: string): Promise<void> {
  const base = await baseDir($)
  if (base === undefined || !isSafeSid(src.srcSid) || !isSafeSid(by)) return
  const dir = await rootDir($, base, src.srcRoot)
  if (dir === undefined) return
  try {
    await $.fs.write(`${dir}/claims/${src.srcSid}/${src.gen}/${by}.json`, claimText(src.srcSid, src.gen, by, await $.clock.now()))
  } catch (err) {
    $.ui.log(`docket: claim write failed: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
    return
  }
  await transact($, cur => {
    const p = cur.pendingClaim
    const isSame = cur.sid === by && p !== null && p.srcSid === src.srcSid && p.gen === src.gen
    return isSame ? { session: { ...cur, pendingClaim: null }, out: undefined } : { session: cur, out: undefined }
  })
}

async function retryClaim($: EngineInterface): Promise<void> {
  const s = await readSession($)
  if (isRealSid(s.sid) && s.pendingClaim !== null) await writeClaim($, s.pendingClaim, s.sid)
}

// The take: refuse a claimed gen; apply only if the docket is still on `target`; then claim.
// Take-then-claim: a crash in between can duplicate later, never lose.
async function takeCarry($: EngineInterface, src: CarrySource, items: readonly Item[], target: string, isStartup = false): Promise<'taken' | 'claimed' | 'moved' | 'error'> {
  const base = await baseDir($)
  if (base === undefined) return 'error'
  const dir = await rootDir($, base, src.srcRoot)
  if (dir === undefined) return 'error'
  const who = await listClaims($, dir, src.srcSid, src.gen)
  if (who === 'error') return 'error'
  if (who.some(x => x !== target)) return 'claimed'
  const now = await $.clock.now()
  const folder = folderName(src.srcRoot)
  const applied = await transact($, cur => {
    if (cur.sid !== target) return { session: cur, out: false }
    // A startup take is for a fresh session only: re-checked here, at the write, in case an item or
    // the switch changed while the claims were listed.
    if (isStartup && (cur.everHadItem || cur.carry.gen !== 0 || cur.restored)) return { session: cur, out: false }
    const r = takeInto(cur, items, now, folder)
    return { session: { ...r.session, pendingClaim: src }, out: true }
  })
  if (!applied) return 'moved'
  await writeClaim($, src, target)
  redraw($)
  return 'taken'
}

// The carry a fresh process takes: the folder's newest carry, followed along its claims to where its
// items went (at most MAX_HOPS); never an unrelated older one.
async function findCarry($: EngineInterface, root: string, self: string): Promise<{ file: CarryFile } | { why: string } | null> {
  const base = await baseDir($)
  if (base === undefined) return null
  const dir = await rootDir($, base, root)
  if (dir === undefined) return null
  let entries: Awaited<ReturnType<EngineInterface['fs']['list']>> = []
  try {
    entries = await $.fs.list(`${dir}/carry`)
  } catch {
    return null
  }
  const newest = new Map<string, number>()
  for (const e of entries) {
    const m = /^(.+)\.(a|b)\.json$/.exec(e.name)
    if (m === null || e.kind !== 'file' || e.isLink || !isSafeSid(m[1])) continue
    newest.set(m[1] as string, Math.max(newest.get(m[1] as string) ?? 0, e.mtimeMs))
  }
  const readFile = async (sid: string) =>
    pickCarry(parseCarry(await readText($, `${dir}/carry/${sid}.a.json`), sid), parseCarry(await readText($, `${dir}/carry/${sid}.b.json`), sid))
  let sid = [...newest.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  for (let hop = 0; sid !== undefined && hop <= MAX_HOPS; hop += 1) {
    if (sid === self) return null
    const file = await readFile(sid)
    if (file === null) return { why: 'it could not be read' }
    // Claims first: a taken source that later switched off still leads to where its items went.
    const who = await listClaims($, dir, sid, file.gen)
    if (who === 'error') return null
    if (!file.on && !who.some(x => x !== self)) return null
    const others = who.filter(x => x !== self)
    if (others.length === 0) {
      const now = await $.clock.now()
      if (now - file.savedAt > CARRY_MAX_AGE_MS) return { why: 'it is more than 14 days old' }
      // Same folder key is not enough (a hash): the stored root must match exactly, normalised.
      if (normRoot(file.root) !== normRoot(root)) return null
      return { file }
    }
    // Follow the claimer whose own carry is newest.
    const next = others.filter(x => newest.has(x)).sort((a, b) => (newest.get(b) ?? 0) - (newest.get(a) ?? 0))[0]
    if (next === undefined) return { why: 'another session already took it' }
    sid = next
  }
  return null
}

const CARRIED_LINE = (n: number, folder: string) =>
  `Docket: carried in ${n} item${n === 1 ? '' : 's'} from your previous session in ${folder}. /docket carry off stops carrying; /docket clear empties the docket.`

// A fresh process takes the folder's carry once: evaluated after every landing, acting once.
async function maybeStartupTake($: EngineInterface): Promise<void> {
  if (isStartupTaking) return
  const proc = await readProc($)
  const s = await readSession($)
  if (proc.startupDecided || proc.isInteractive !== true || proc.startupSid === null || s.sid !== proc.startupSid) return
  // A window Reply new opened (v0.4) answers one item: it never takes the folder's carry, or every Reply
  // new with carry on would pull the whole docket across. Latched with isInteractive, so nothing gets here first.
  if (proc.handoffNonce !== null) return
  if (s.restored || s.everHadItem || s.carry.gen !== 0) return
  // Probe (g): mods are fed classic.SessionStart startup, before session.start. --continue/--resume
  // arrive as source resume, so they never take.
  if (proc.classicStartupSeenFor !== s.sid) return
  isStartupTaking = true
  $.clock.after(0, () =>
    void guard(
      $,
      'carry',
      (async () => {
        try {
          if ((await readProc($)).handoffNonce !== null) return
          const target = s.sid
          const found = await findCarry($, s.root, target)
          if (found !== null && 'why' in found) {
            $.ui.log(`Docket: found a carry from your previous session here but didn't use it (${found.why}).`)
          } else if (found !== null) {
            const r = await takeCarry($, { srcSid: found.file.sid, gen: found.file.gen, srcRoot: found.file.root }, found.file.items, target, true)
            if (r === 'claimed') $.ui.log("Docket: found a carry from your previous session here but didn't use it (another session already took it).")
          }
          await changeProc($, p => (p.startupSid === target ? { ...p, startupDecided: true } : p))
        } finally {
          isStartupTaking = false
        }
      })(),
    ),
  )
}

// The /clear carry: taken by the landing it was left for, decided at once (see the plan's v11 note).
async function decideCapture($: EngineInterface, sid: string, source: string | undefined, restored: boolean): Promise<void> {
  const proc = await readProc($)
  const cap = proc.clearCapture
  if (cap === null) return
  if (cap.target === null) {
    await changeProc($, p => (p.clearCapture?.id === cap.id ? { ...p, clearCapture: { ...cap, target: sid } } : p))
  } else if (cap.target !== sid) {
    return
  }
  if (captureTaking === cap.id) return
  const clearIt = () => changeProc($, p => (p.clearCapture?.id === cap.id ? { ...p, clearCapture: null } : p))
  const isKnownOther = source !== undefined && source !== 'clear'
  if (restored || !cap.on || cap.taken || proc.isInteractive !== true || isKnownOther) {
    await clearIt()
    return
  }
  captureTaking = cap.id
  try {
    await takeCarry($, { srcSid: cap.srcSid, gen: cap.gen, srcRoot: cap.srcRoot }, cap.items, sid)
  } catch (err) {
    await fail($, 'carry', err)
  } finally {
    // Cleared before the in-flight flag drops, so no gap lets a second call start another take.
    await clearIt()
    captureTaking = null
  }
}

// What every rehome ends with, no-op or not: the carry decisions, and a pending claim retried.
async function afterLanding($: EngineInterface, sid: string, source: string | undefined): Promise<void> {
  const s = await readSession($)
  if (s.sid !== sid) return
  await decideCapture($, sid, source, s.restored)
  await retryClaim($)
  await maybeStartupTake($)
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
async function rehome($: EngineInterface, sid: string, isClassic: boolean, source?: string): Promise<void> {
  if (!isSafeSid(sid)) {
    $.ui.log(`docket: refused an unsafe session id`, { to: 'debug' })
    return
  }
  const proc = await readProc($)
  if (!isClassic && proc.endingSid === sid && (await $.session.id()) === sid) return
  await rehomeCore($, sid)
  await afterLanding($, sid, source)
}

async function rehomeCore($: EngineInterface, sid: string): Promise<void> {
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
    // The carry slots' seq seeds the writer too, before the restore can queue a carry write: a resumed
    // session's next carry write must win over what an earlier process left in the other slot. Reads
    // only, so not gated on session.end.
    if (restored.ledger.carry.gen > 0) {
      const base = await baseDir($)
      const dir = base === undefined ? undefined : await rootDir($, base, restored.root || root)
      if (dir !== undefined) {
        const a = parseCarry(await readText($, `${dir}/carry/${sid}.a.json`), sid)
        const b = parseCarry(await readText($, `${dir}/carry/${sid}.b.json`), sid)
        const top = Math.max(a?.seq ?? 0, b?.seq ?? 0)
        const ck = writeKey(sid, 'carry')
        if (top > 0) await changeWriter($, w => ({ ...w, seqBy: withKey(w.seqBy, ck, Math.max(top, w.seqBy[ck] ?? 0)) }))
      }
    }
  }
  const old = await transact($, cur => {
    if (cur.sid === sid) return { session: cur, out: null }
    if (cur.sid === '') return { session: { ...cur, sid, root, restored: true }, out: null }
    const base = restored === null ? { ...freshSession(), sid, root } : restore(restored.ledger, sid, restored.root || root)
    return { session: { ...base, view: { ...freshSession().view, isPaneUp: isUp } }, out: cur }
  })
  if (old !== null && isRealSid(old.sid)) await switchAway($, old)
  const now = await readSession($)
  if (now.sid === sid && now.restored && now.carry.gen > 0 && !isEnding) {
    const base = await baseDir($)
    const dir = base === undefined ? undefined : await rootDir($, base, now.root)
    // Source notices on restore: a later session may have taken this carry while it was away.
    if (dir !== undefined) await isOwnCarryTaken($, dir, sid, now.carry.gen, true)
  }
  redraw($)
}

// The one place a session is left: its check is dropped, its finals are queued, and (for a /clear) its
// open items are left for the next landing to take.
async function switchAway($: EngineInterface, old: DocketSession): Promise<void> {
  const proc = await readProc($)
  await changeProc($, p => {
    const capture: ClearCapture = {
      id: p.captureSeq + 1,
      srcSid: old.sid,
      gen: old.carry.gen,
      srcRoot: old.root,
      on: old.carry.on,
      taken: old.carryTaken,
      // Live items carry no origin until saved; the take dedupes on it, so stamp it here.
      items: openItems(old).map(i => ({ ...i, origin: i.origin ?? `${old.sid}:${i.id}` })),
      target: null,
    }
    return { ...p, epoch: p.epoch + 1, captureSeq: p.captureSeq + 1, clearCapture: capture }
  })
  controller?.abort()
  resolveDue = false
  fullDue = false
  turnStartLen = undefined
  midTurn = new Set()
  await queueSave($, old, true)
  await changeWriter($, w => ({ ...w, closed: withKey(w.closed, old.sid, true as const) }))
  // A claim the old session still owed: written now if the bound allows (it is saved, so a restore
  // retries it otherwise).
  if (old.pendingClaim !== null && proc.endingSid !== old.sid) {
    const src = old.pendingClaim
    await writeClaimFor($, src, old)
  }
}

// switchAway's claim retry: written for the old session, then its snapshot re-queued without the claim.
async function writeClaimFor($: EngineInterface, src: CarrySource, old: DocketSession): Promise<void> {
  const base = await baseDir($)
  if (base === undefined) return
  const dir = await rootDir($, base, src.srcRoot)
  if (dir === undefined) return
  try {
    await $.fs.write(`${dir}/claims/${src.srcSid}/${src.gen}/${old.sid}.json`, claimText(src.srcSid, src.gen, old.sid, await $.clock.now()))
  } catch {
    return
  }
  await queueSave($, { ...old, pendingClaim: null }, true)
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

// The switch. On bumps gen (a fresh handoff, so a taken one can be re-carried) and clears carryTaken;
// off keeps gen, so the writer's off record replaces the file.
async function setCarry($: EngineInterface, on: boolean): Promise<DocketSession> {
  const s = await readSession($)
  if (on) await changeWriter($, w => ({ ...w, forgotten: withoutKey(w.forgotten, s.sid) }))
  return change($, cur => {
    if (on) return cur.carry.on && !cur.carryTaken ? cur : { ...cur, carry: { on: true, gen: cur.carry.gen + 1 }, carryTaken: false, carrySaveFailed: false }
    return cur.carry.on ? { ...cur, carry: { ...cur.carry, on: false } } : cur
  })
}

async function carryCommand($: EngineInterface, arg: string): Promise<string> {
  const s0 = await readSession($)
  if (!isRealSid(s0.sid)) return 'Docket: the session isn\'t known yet; try again in a moment.'
  if ((await readProc($)).isInteractive !== true) return 'Docket: carry works only in an interactive session.'
  if (arg === 'on') {
    const s = await setCarry($, true)
    return `Docket: carry is on. Whatever is open when you leave goes to the next session in ${folderName(s.root)}, and on from there. Running several Claude windows here? Keep carry on in only one: a new window takes these items.`
  }
  if (arg === 'off') {
    await setCarry($, false)
    return 'Docket: carry is off.'
  }
  if (arg !== '') return 'Docket: /docket carry on, /docket carry off, or /docket carry to see which.'
  if (!s0.carry.on) return 'Docket: carry is off.'
  return s0.carryTaken ? 'Docket: carry is on, but a later session already took these items. /docket carry off then on to carry again.' : 'Docket: carry is on.'
}

async function forget($: EngineInterface): Promise<string> {
  // The carry goes off first, and its off record is written, before saving stops for this session.
  const s0 = await readSession($)
  if (s0.carry.on) {
    await setCarry($, false)
    const drained = saveChain.then(() => drainSaves($, () => true))
    saveChain = drained.catch(() => undefined)
    await drained.catch(() => undefined)
  }
  // The off record lands in one A/B slot; the other still holds the last on-carry with its items. Put
  // the off record in both, so no item text survives the forget.
  if (s0.carry.gen > 0 && isRealSid(s0.sid)) {
    const b0 = await baseDir($)
    const dir = b0 === undefined ? undefined : await rootDir($, b0, s0.root)
    const seq = (await readWriter($)).seqBy[writeKey(s0.sid, 'carry')] ?? 0
    if (dir !== undefined && seq > 0) {
      const off = carryEnvelope(s0.sid, s0.root, seq, await $.clock.now(), JSON.stringify({ gen: s0.carry.gen, on: false, items: [] }))
      const erase = saveChain.then(async () => {
        for (const slot of ['a', 'b']) await $.fs.write(`${dir}/carry/${s0.sid}.${slot}.json`, off)
      })
      saveChain = erase.catch(err => fail($, 'forget', err))
      await erase.catch(() => undefined)
    }
  }
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
  // Reply new handoffs this session wrote (v0.4): their replies go too.
  await blankHandoffs($, h => h.fromSid === s.sid).catch(err => fail($, 'forget', err))
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
  // Reply new handoffs (v0.4) no window took within their age: the reply is blanked from disk. First,
  // so a folder with no sessions yet still gets it.
  await blankHandoffs($, h => now - h.mtimeMs > HANDOFF_MAX_AGE_MS)
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
  const built = buildPrompt({ mode, claude: s.claude, tools: s.tools, user: s.pendingUser, open, closed: closedForJudge(s), toolAsked: s.toolAsked, latest: s.lastFinal, walking: isWalking(s) })
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

// --- Reply new (v0.4) ---

const NOT_TAKING = 'Docket: the prompt box is not taking text right now.'
const NEEDS_WT = 'Docket: Reply new needs Windows Terminal and PowerShell 7 here.'
const STALE_LINE = "Docket: this window was opened for a reply, but the handoff was missing or stale; your reply is in the original window's history."
const LAUNCH_TIMEOUT_MS = 15000
const FILL_RETRY_MS = 1000
const FILL_FOR_MS = 120000

type LaunchTools = { wt: string; pwsh: string }

// Windows Terminal and PowerShell 7, found by listing WindowsApps (their entries there are
// app-execution aliases, which a stat may not follow). null where either is missing: not Windows, or
// not installed.
async function launchTools($: EngineInterface): Promise<LaunchTools | null> {
  const local = await $.env.get('LOCALAPPDATA')
  if (local === undefined || local === '') return null
  const apps = `${local.replace(/\\/g, '/').replace(/\/+$/, '')}/Microsoft/WindowsApps`
  let names: string[] = []
  try {
    names = (await $.fs.list(apps)).map(x => x.name.toLowerCase())
  } catch {
    return null
  }
  if (!names.includes('wt.exe')) return null
  const win = (p: string) => p.replace(/\//g, '\\')
  if (names.includes('pwsh.exe')) return { wt: win(`${apps}/wt.exe`), pwsh: win(`${apps}/pwsh.exe`) }
  const installed = 'C:/Program Files/PowerShell/7/pwsh.exe'
  try {
    if ((await $.fs.stat(installed)).kind === 'file') return { wt: win(`${apps}/wt.exe`), pwsh: win(installed) }
  } catch {
    // Not installed there either.
  }
  return null
}

// Whether this window draws Reply new: interactive, a root wt can take, and both programs present.
async function checkReplyNew($: EngineInterface): Promise<void> {
  const proc = await readProc($)
  const s = await readSession($)
  const root = s.root !== '' ? s.root : await $.session.root()
  const ok = proc.isInteractive === true && isRootSafe(root) && (await launchTools($)) !== null
  await changeProc($, p => (p.canReplyNew === ok ? p : { ...p, canReplyNew: ok }))
  redraw($)
}

// Reply new: "/docket new #<id> (<label>) — " in an empty box, or in place of this item's own Reply
// here lead (its typed tail kept). Anything else in the box stays: the command has to start it.
async function replyNewTo($: EngineInterface, id: number): Promise<void> {
  const item = (await readSession($)).items.find(i => i.id === id && i.status === 'open')
  if (item === undefined) return
  const lead = leadNew(item)
  const box = await $.prompt.read()
  const tail = box.text.trim() === '' ? '' : (tailAfter(box.text, leadHere(item)) ?? tailAfter(box.text, lead))
  // A tail holding another item's reply ("Re: A — yes\nRe: B — no") would carry B's answer away too.
  if (tail === undefined || tail.includes('\nRe: ')) {
    $.ui.toast('Docket: Reply new needs an empty box; send or clear your draft first.')
    return
  }
  const filled = await $.prompt.fill({ text: `${lead}${tail}` })
  if (!filled.isFilled) {
    $.ui.toast(NOT_TAKING)
    return
  }
  $.ui.toast('Docket: type your reply after the dash; Enter opens it in a new window.')
}

// /docket new: every check first, then the handoff file, then the close, then the launch.
async function newCommand($: EngineInterface, origin: string, rest: string): Promise<string> {
  // The model and other plugins can't open windows or close the user's items.
  if (origin !== 'composer') return 'Docket: Reply new only runs from your own prompt.'
  if ((await readProc($)).isInteractive !== true) return 'Docket: Reply new works only in an interactive session.'
  const parsed = parseNewArgs(rest)
  if (parsed === undefined) return 'Docket: use the Reply new button on an item in the pane.'
  const s = await readSession($)
  if (!isRealSid(s.sid)) return "Docket: the session isn't known yet; try again in a moment."
  const item = s.items.find(i => i.id === parsed.id && i.status === 'open')
  if (item === undefined) return `Docket: #${parsed.id} isn't open (it may have just closed).`
  // Prompt history is shared across sessions: a recalled line must not hand off another session's #4.
  if (parsed.label !== undefined && parsed.label !== label(item)) return `Docket: #${parsed.id} here is "${label(item)}", not the one you replied to.`
  const why = replyRefusal(parsed.reply)
  if (why !== '') return why
  // A Reply here line for another open item further down ("…\nRe: B — no") is an answer for this
  // session: it must not leave with the reply.
  const other = s.items.find(i => i.status === 'open' && i.id !== item.id && parsed.reply.includes(`\n${leadHere(i).trimEnd()}`))
  if (other !== undefined) return `Docket: your reply also answers "${clip(other.text, 50)}" here; send that part on its own first.`
  const root = s.root !== '' ? s.root : await $.session.root()
  const tools = await launchTools($)
  const base = await baseDir($)
  if (tools === null || !isRootSafe(root) || base === undefined) return NEEDS_WT
  if (!(await safeUnder($, base, ['handoff']))) return 'Docket: refused the handoff folder (it is not a plain folder); nothing changed.'
  const nonce = newNonce(Math.random)
  const path = `${base}/handoff/${nonce}.json`
  if (await $.fs.exists(path).catch(() => true)) return "Docket: couldn't write the handoff (the name is taken); nothing changed."
  // The launch is built before anything changes. (A save failing after the close, or a reload before
  // the launch timer, leaves the item closed with no window: Reopen recovers, and prune blanks the file.)
  const argv = wtArgv(tools.wt, tools.pwsh, root, item.text, launchScript(nonce, await $.env.get('CLAUDE_CONFIG_DIR')))
  const now = await $.clock.now()
  try {
    await $.fs.write(path, waitingText({ nonce, fromSid: s.sid, itemId: item.id, root, itemText: item.text, quote: item.quote, reply: parsed.reply, createdAt: now }))
  } catch (err) {
    return `Docket: couldn't write the handoff (${clip(err instanceof Error ? err.message : String(err), 80)}); nothing changed.`
  }
  // His Enter is the decision: the item closes now, in this session (Reopen undoes). Only if it is
  // still open here at the write: a check that closed it meanwhile, a switch, or a second Enter on the
  // same item opens no window.
  const isClosed = await transact($, cur => {
    const isOpen = cur.sid === s.sid && cur.items.some(i => i.id === item.id && i.status === 'open')
    return isOpen ? { session: handOff(cur, item.id, now), out: true } : { session: cur, out: false }
  })
  if (!isClosed) {
    await $.fs.write(path, blankText(nonce)).catch(err => fail($, 'handoff', err))
    return `Docket: #${item.id} closed, or the conversation changed, in the meantime; no window opened.`
  }
  await pauseKeys($)
  $.clock.after(0, () => void guard($, 'launch', launch($, argv, base)))
  return `Docket: opening a new window for "${clip(item.text, 50)}". Closed here; if no window appears, Reopen it under "closed · show".`
}

// The item is already closed: any sign the window didn't open is said, with the way back.
async function launch($: EngineInterface, argv: string[], cwd: string): Promise<void> {
  let why = ''
  try {
    const r = await $.process.run(argv, { cwd, timeoutMs: LAUNCH_TIMEOUT_MS })
    if (r.exitCode !== 0) why = `exit ${r.exitCode}`
  } catch (err) {
    why = err instanceof Error ? err.message : String(err)
  }
  if (why === '') return
  $.ui.log(`docket: launch: ${why}`, { to: 'debug' })
  $.ui.toast(
    /time/i.test(why)
      ? `Docket: Windows Terminal may not have started (${clip(why, 60)}); if no window opened, Reopen the item under "closed · show".`
      : `Docket: Windows Terminal didn't start (${clip(why, 60)}); Reopen the item under "closed · show".`,
  )
}

// In a window Reply new opened: put the reply in the box and hold the item's context for its first
// prompt. handoffPicked is set once the file is marked taken, so a hot reload that killed the retry
// timers picks it up again (the file still reads waiting), and never fills twice after that.
async function pickUp($: EngineInterface): Promise<void> {
  const proc = await readProc($)
  if (proc.handoffNonce === null || proc.handoffPicked || proc.isInteractive !== true || isPickingUp) return
  isPickingUp = true
  try {
    await pickUpFrom($, proc.handoffNonce)
  } catch (err) {
    // A later session.start (or a reload) may try again.
    isPickingUp = false
    throw err
  }
}

async function pickUpFrom($: EngineInterface, nonce: string): Promise<void> {
  const base = await baseDir($)
  // Nothing to fill: said once (or not at all, for one already taken), and never again on a reload.
  const settle = async (line?: string): Promise<void> => {
    if (line !== undefined) $.ui.log(line)
    await changeProc($, p => ({ ...p, handoffPicked: true }))
    isPickingUp = false
  }
  if (base === undefined || !(await safeUnder($, base, ['handoff']))) return settle(STALE_LINE)
  const path = `${base}/handoff/${nonce}.json`
  const h = parseHandoff(await readText($, path), nonce)
  if (h === null) return settle(STALE_LINE)
  // Already filled (a second claude started in the tab): nothing to say.
  if (h.state === 'taken') return settle()
  const s = await readSession($)
  const root = s.root !== '' ? s.root : await $.session.root()
  const now = await $.clock.now()
  if (normRoot(h.root) !== normRoot(root) || now - h.createdAt > HANDOFF_MAX_AGE_MS) return settle(STALE_LINE)
  await changeProc($, p => ({ ...p, handoffContext: { itemText: h.itemText, quote: h.quote } }))
  $.ui.log(`Docket: this window answers "${clip(h.itemText, 60)}".`)
  // Set once the reply is in the box or shown in the transcript: nothing after that shows it again.
  let isShown = false
  const done = async (): Promise<void> => {
    await $.fs.write(path, takenText(h.nonce, h.fromSid, h.itemId)).catch(err => fail($, 'handoff', err))
    await changeProc($, p => ({ ...p, handoffPicked: true })).catch(err => fail($, 'handoff', err))
    isPickingUp = false
  }
  // A dialog (trust, MCP approval) can hold the keys in a fresh window: retried until it lands. Stopped
  // the moment the box holds anything, so a late fill never wipes what was typed. A read or fill that
  // throws counts as refused, so the reply is never lost to the debug log.
  const until = now + FILL_FOR_MS
  const attempt = async (): Promise<void> => {
    let isEmpty = true
    let isFilled = false
    try {
      isEmpty = (await $.prompt.read()).text.trim() === ''
      if (isEmpty) isFilled = (await $.prompt.fill({ text: h.reply })).isFilled
    } catch (err) {
      $.ui.log(`docket: handoff fill: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
    }
    if (isFilled) {
      isShown = true
      $.ui.log('Docket: your reply is in the box; Docket attaches the item for Claude to see when you send it.')
      return done()
    }
    if (isEmpty && (await $.clock.now()) < until) {
      $.clock.after(FILL_RETRY_MS, () => void guard($, 'handoff', attemptSafely()))
      return
    }
    isShown = true
    $.ui.log(`Docket: couldn't put your reply in the box; here it is:\n${h.reply}`)
    await done()
  }
  // Whatever else throws, the reply is shown rather than lost (once).
  const attemptSafely = async (): Promise<void> => {
    try {
      await attempt()
    } catch (err) {
      isPickingUp = false
      if (!isShown) $.ui.log(`Docket: couldn't put your reply in the box; here it is:\n${h.reply}`)
      isShown = true
      throw err
    }
  }
  $.clock.after(0, () => void guard($, 'handoff', attemptSafely()))
}

// Blanks handoff files: a forget blanks this session's; prune those past their age. The mod can't
// delete, so a blanked file stays as a stub.
async function blankHandoffs($: EngineInterface, which: (h: { fromSid?: string; mtimeMs: number; nonce: string }) => boolean): Promise<void> {
  const base = await baseDir($)
  if (base === undefined || !(await safeUnder($, base, ['handoff']))) return
  let entries: Awaited<ReturnType<EngineInterface['fs']['list']>> = []
  try {
    entries = await $.fs.list(`${base}/handoff`)
  } catch {
    return
  }
  for (const e of entries) {
    const m = /^([0-9a-f]{32})\.json$/.exec(e.name)
    if (m === null || e.kind !== 'file' || e.isLink) continue
    const nonce = m[1] as string
    const path = `${base}/handoff/${e.name}`
    const h = parseHandoff(await readText($, path), nonce)
    if (h === null) continue
    if (!which({ fromSid: h.fromSid, mtimeMs: e.mtimeMs, nonce })) continue
    try {
      await $.fs.write(path, blankText(nonce))
    } catch (err) {
      $.ui.log(`docket: handoff blank failed: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
    }
  }
}

// --- the list tool and the walk (v0.4) ---

const LIST_TOOL = 'mcp__docket__list'
const LIST_DESCRIPTION =
  "The user's Docket: what Claude has said in this session (and carried-in sessions) is theirs to decide or do, still open. Call it when the user asks about their docket or wants to go through it. During a walk-through, call it in every turn where you ask about an item, with presenting set to that item's #id, then restate the item's text word for word in your reply. Read-only: items close from the user's own replies."
const LIST_SCHEMA = {
  type: 'object',
  properties: { presenting: { type: 'string', description: 'The #id of the one item you are about to ask the user about (walk-throughs), e.g. "#4".' } },
  additionalProperties: false,
}
const WALK_PROMPT =
  'Walk me through my Docket, one item at a time, in order. In every turn where you ask me about an item (a follow-up question too), first call mcp__docket__list with presenting set to that item\'s #id, then in your reply after the call restate the item\'s text word for word, say what you\'d recommend, and wait for my answer. Present only one item per turn. Keep track of which you\'ve covered; one I skip stays open and isn\'t asked again this walk. Refer to items by their text.'
const RESOLVE_WAIT_MS = 5000

async function walkCommand($: EngineInterface): Promise<string> {
  const s = await readSession($)
  if (openItems(s).length === 0) return 'Docket: nothing open.'
  if (isWalking(s)) return 'Docket: already walking; answer Claude, or tell it to stop.'
  $.clock.after(0, () => void guard($, 'walk', submitWalk($)))
  return 'Docket: asking Claude to walk you through the docket.'
}

// Never awaited inside a hook: a plugin's submit starts its turn once the session is idle.
async function submitWalk($: EngineInterface): Promise<void> {
  try {
    const sent = await $.prompt.submit({ text: WALK_PROMPT })
    if (sent.drop !== undefined) $.ui.toast('Docket: Claude is busy; try the walk again when the turn ends.')
  } catch (err) {
    $.ui.toast('Docket: Claude is busy; try the walk again when the turn ends.')
    await fail($, 'walk', err)
  }
}

// The list tool's answer. A resolve check that is due or running may close the item just answered:
// waited for (a bounded few seconds), so a walk doesn't present it again.
async function listAnswer($: EngineInterface, rawPresenting: unknown, isMain: boolean): Promise<string> {
  const start = await $.clock.now()
  while ((resolveDue || inFlight) && (await $.clock.now()) - start < RESOLVE_WAIT_MS) {
    await new Promise<void>(r => $.clock.after(200, () => r()))
  }
  let presenting: number | 'bad' | undefined
  if (typeof rawPresenting === 'string' && rawPresenting.trim() !== '') {
    const m = /^#?(\d+)$/.exec(rawPresenting.trim())
    presenting = m === null ? 'bad' : Number(m[1])
  }
  // A subagent's call reads the list but never moves the walk.
  if (isMain && typeof presenting === 'number') {
    const id = presenting
    await change($, s => (s.items.some(i => i.id === id && i.status === 'open') ? present(s, id) : s))
  }
  const s = await readSession($)
  return listText(s, openItems(s), closeGroups(s), await $.clock.now(), presenting, resolveDue || inFlight)
}

// --- presses ---

// Puts "Re: <item> — " in the prompt box, after any draft already there, so the reply names the item.
// The box holding this item's Reply new lead instead: swapped, the typed tail kept.
async function replyTo($: EngineInterface, id: number): Promise<void> {
  const item = (await readSession($)).items.find(i => i.id === id && i.status === 'open')
  if (item === undefined) return
  // The new conversation knows nothing of a carried item: the reply brings Claude's words with it.
  const lead = leadHere(item)
  const box = await $.prompt.read()
  const swapped = tailAfter(box.text, leadNew(item))
  const filled =
    swapped !== undefined
      ? await $.prompt.fill({ text: `${lead}${swapped}` })
      : box.text.trim() === ''
        ? await $.prompt.fill({ text: lead })
        : await $.prompt.fill({ text: `\n${lead}`, mode: 'append' })
  if (!filled.isFilled) $.ui.toast(NOT_TAKING)
}

// Puts "/btw <what is this item?>" in the prompt box; he presses Enter. A plugin can't run the command
// itself: a plugin's prompt is never a slash command, and it waits for the turn to end, which /btw exists
// not to do. /btw has to start the box, so only an empty box, this item's own lead with nothing typed
// after it, or this item's question already is replaced; any other draft stays and the press toasts.
async function btwTo($: EngineInterface, id: number): Promise<void> {
  const item = (await readSession($)).items.find(i => i.id === id && i.status === 'open')
  if (item === undefined) return
  const question = btwQuestion(item)
  const box = (await $.prompt.read()).text
  const isOurs = (lead: string) => tailAfter(box, lead)?.trim() === ''
  if (box.trim() !== '' && box !== question && !isOurs(leadHere(item)) && !isOurs(leadNew(item))) {
    $.ui.toast('Docket: /btw needs an empty box; send or clear your draft first.')
    return
  }
  const filled = await $.prompt.fill({ text: question })
  if (!filled.isFilled) {
    $.ui.toast(NOT_TAKING)
    return
  }
  $.ui.toast('Docket: press Enter to ask; the answer leaves the item open.')
}

function actions($: EngineInterface): Actions {
  return {
    reply: id => void guard($, 'reply', replyTo($, id)),
    replyNew: id => void guard($, 'reply', replyNewTo($, id)),
    btw: id => void guard($, 'btw', btwTo($, id)),
    walk: () =>
      void guard(
        $,
        'walk',
        walkCommand($).then(line => {
          if (line.includes('nothing open') || line.includes('already walking')) $.ui.toast(line)
        }),
      ),
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
    toggleCarry: () =>
      void guard(
        $,
        'carry',
        (async () => {
          const s = await readSession($)
          const reply = await carryCommand($, s.carry.on && !s.carryTaken ? 'off' : 'on')
          $.ui.toast(reply)
        })(),
      ),
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
  // The pane shows where carried items came from: the band's banner has done its job (the transcript
  // line still comes at the next prompt).
  const shown = await readSession($)
  if (shown.carriedNotice !== null && !shown.carriedNotice.isSeen) {
    await markSession($, shown.sid, x => (x.carriedNotice === null ? x : { ...x, carriedNotice: { ...x.carriedNotice, isSeen: true } }))
  }
  await setPaneUp($, opened.isPlaced)
  if (!opened.isPlaced) return `Docket: the pane could not be placed (${opened.reason}).`
  const count = openItems(await readSession($)).length
  return count === 0 ? 'Docket: nothing waiting on you.' : `Docket: ${count} open. Digits dismiss; Reopen undoes.`
}

export const register: Register = (on, options) => {
  const model = modelFrom(options as Record<string, unknown>)

  on('session.start', async ($, e, next) => {
    // A window Reply new opened (v0.4): named by DOCKET_HANDOFF. Read first, in its own try, and latched
    // with isInteractive below, so no path reaches the startup carry take before it is known.
    let handoffNonce: string | null = null
    try {
      const v = await $.env.get('DOCKET_HANDOFF')
      handoffNonce = isNonce(v) ? v : null
    } catch (err) {
      await fail($, 'handoff env', err)
    }
    try {
      await $.command.register({ name: 'docket', description: 'Docket: open or close the pane of what Claude left for you to decide or do (add <text>, clear, walk, carry on|off, forget)', immediate: true })
      loadedAt = await $.clock.now()
      const sid = await $.session.id()
      // A reload: any check the old module started is now stale.
      await changeProc($, p => ({ ...p, isInteractive: e.isInteractive, epoch: p.epoch + 1, startupSid: p.startupSid ?? (isSafeSid(sid) ? sid : null), handoffNonce: p.handoffNonce ?? handoffNonce }))
      // Not inherited by the Bash tool's children (or read again by a reload).
      if (handoffNonce !== null) {
        try {
          const unset = await $.env.set('DOCKET_HANDOFF', undefined)
          if ('deny' in unset && unset.deny !== undefined) $.ui.log(`docket: couldn't unset DOCKET_HANDOFF: ${unset.deny}`, { to: 'debug' })
        } catch (err) {
          // A refusal must not skip the landing below; pickUp is gated on isInteractive anyway.
          $.ui.log(`docket: couldn't unset DOCKET_HANDOFF: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
        }
      }
      await rehome($, sid, false)
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
    // v0.4, each in its own try so one failing leaves the rest (and the block above) standing.
    try {
      await $.tool.register({ name: 'list', description: LIST_DESCRIPTION, inputSchema: LIST_SCHEMA, isDeferred: false })
    } catch (err) {
      await fail($, 'tool.register', err)
    }
    try {
      await checkReplyNew($)
    } catch (err) {
      await fail($, 'reply-new check', err)
    }
    try {
      await pickUp($)
    } catch (err) {
      await fail($, 'handoff', err)
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
          // A startup for a sid other than the one this process already started on is stale bookkeeping.
          const p0 = await readProc($)
          const isStartup = e.source === 'startup' && isSafeSid(sid) && (p0.startupSid === null || p0.startupSid === sid)
          await changeProc($, p => ({
            ...p,
            classicSid: sid,
            classicFrom: from === sid ? null : from,
            // Probe (g): a fresh process's classic startup comes first; it names the startup session.
            ...(isStartup ? { startupSid: p.startupSid ?? sid, classicStartupSeenFor: sid } : {}),
          }))
          await rehome($, sid, true, e.source)
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
    isEnding = true
    try {
      await changeProc($, p => ({ ...p, endingSid: e.sessionId }))
      if (e.reason === 'clear' || e.reason === 'resume') {
        // A Reply new window's item context belongs to the conversation it opened with.
        await changeProc($, p => (p.handoffContext === null ? p : { ...p, handoffContext: null }))
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
      isEnding = false
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
      // Items carried in: said once, at the first prompt after the take (or this one, if its own
      // landing just took them).
      const n0 = (await readSession($)).carriedNotice
      if (n0 !== null && e.origin.kind === 'composer') {
        $.ui.log(CARRIED_LINE(n0.count, n0.folder))
        const sid0 = (await readSession($)).sid
        await markSession($, sid0, s => ({ ...s, carriedNotice: null }))
      }
      // A /btw side question is never an answer, even if a build hands it here without `command` set.
      const isUser =
        (e.origin.kind === 'composer' || e.origin.kind === 'bridge') && e.isMeta !== true && e.command === undefined && !/^\/btw\b/.test(e.text.trimStart())
      if (isUser && e.text.trim() !== '') {
        if (e.turnId !== undefined) midTurn.add(e.text.trim())
        const s = await change($, cur => addUser(cur, e.text, e.turnId !== undefined))
        if (openItems(s).length > 0) {
          resolveDue = true
          schedule($, model)
        }
      }
      // A Reply new window (v0.4): the item and Claude's words ride with the first real prompt as context
      // the model reads. Never through addUser above, so this window's judge never takes them as the user's.
      const ctx = (await readProc($)).handoffContext
      if (ctx !== null && e.origin.kind === 'composer' && e.isMeta !== true && e.command === undefined && e.text.trim() !== '') {
        await changeProc($, p => ({ ...p, handoffContext: null }))
        return next({ ...e, context: [...(e.context ?? []), contextBlock(ctx)] })
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
      const live = { isChecking: inFlight, isResolving, isFocused: e.props.isFocused, now: await $.clock.now(), canReplyNew: (await readProc($)).canReplyNew }
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
      const m = /^(?:reply|replynew|btw|done|dismiss)-(\d+)$/.exec(e.element ?? '')
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
      if (args === 'new' || /^new\s/.test(args)) return { text: await newCommand($, e.origin.kind, args.slice(3)) }
      if (args === 'walk') return { text: await walkCommand($) }
      if (args === 'forget') return { text: await forget($) }
      if (args === 'carry' || args.startsWith('carry ')) return { text: await carryCommand($, args.slice(5).trim()) }
      if (args === 'clear') {
        const now = await $.clock.now()
        const before = openItems(await readSession($)).length
        await change($, s => clearAll(s, now))
        return { text: before === 0 ? 'Docket: nothing open.' : `Docket: dismissed ${before}; Reopen all in the pane brings them back.` }
      }
      if (args !== '') return { text: "Docket: /docket opens or closes the pane; /docket add <text>; /docket walk (Claude takes you through what's open); /docket clear; /docket carry on|off (send what is open to the next session here); /docket forget (erase the saved copy). Reply new on an item in the pane opens a new window." }
      return { text: await togglePane($) }
    } catch (err) {
      await fail($, 'command', err)
      return next(e)
    }
  }).catch(async ($, e, next) => {
    await fail($, 'command', next.error.message ?? next.error.kind)
    return { text: 'Docket: the command failed; the debug log has the reason.' }
  })

  // The list, for the session's own model (v0.4). Read-only: items close from the user's replies.
  on('tool.call', { tool: LIST_TOOL }, async ($, e) => {
    const input = e as unknown as { presenting?: unknown; agentId?: string }
    return { result: await listAnswer($, input.presenting, input.agentId === undefined) }
  }).catch(async ($, e, next) => {
    await fail($, 'tool.call', next.error.message ?? next.error.kind)
    return next.called ? next(e) : { deny: 'Docket could not read its list (its hook failed).' }
  })
}
