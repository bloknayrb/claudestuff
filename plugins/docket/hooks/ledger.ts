// Pure: the item list and every change to it. Nothing here takes $.

import type { Answer, ClaudeEntry, DocketSession, Item, ToolLine, UserEntry } from '../types'
import type { CheckedResolve, Snapshot, Verdict } from './judge'
import { optionPick, resolvePick } from './options'
import { leadHere } from './spawn'
import { clip, isBare, isSkip, normalise, occursIn, redact, sanitise } from './text'

// --- v0.6: what a reply answered ---

// The answered message a reply keeps, whole up to this.
export const ANSWERED_CHARS = 16000
export const KEEP_USER_LOG = 50
// Failed checks of (or full checks waited on by) one reply before it is judged anyway or let go.
export const MAX_REPLY_FAILS = 3

// Whether a message is about an item: its text, or the start of its quote, appears in it. Not its #id:
// "#12" in Claude's prose is as often a PR or an issue. One definition for every rule that asks.
// namer flattens the message once, for a caller testing it against every item.
export function namer(message: string): (item: Item) => boolean {
  const msg = normalise(redact(message)).toLowerCase()
  const has = (t: string) => t !== '' && msg.includes(normalise(redact(t)).toLowerCase())
  return item => {
    const quote = item.quote.replace(/…$/, '').slice(0, 120)
    return has(item.text) || (quote.length >= 12 && has(quote))
  }
}

export const names = (message: string, item: Item): boolean => namer(message)(item)

// Whether a closed item still counts as asked, for which items a message is about and whether a bare
// reply is ambiguous: not one the user dismissed or cleared, nor a duplicate Claude closed. Claude's
// other closes count: one Claude closed wrongly must not let a bare "yes" tie to the item beside it.
export const stillAsked = (i: Item): boolean => i.status === 'open' || i.status === 'resolved' || (i.closure !== undefined && i.closure.kind !== 'duplicate')

// The user's typed words: the text with a Reply lead stripped (entries from before v0.6 have none).
export const wordsOf = (e: UserEntry): string => e.words ?? e.text

// The last turn a full check has applied: one before the oldest turn still holding Claude's text or
// tool lines, or every ended turn when none is held. Derived, never stored.
export function judgedTurn(s: DocketSession): number {
  const held = [...s.claude.map(c => c.turn), ...s.tools.map(t => t.turn)]
  return held.length === 0 ? s.turn : Math.min(...held) - 1
}

// The oldest reply that can be judged now: the full check of the turn it answered has applied (or it
// has waited through MAX_REPLY_FAILS failed ones).
export function judgeable(s: DocketSession): UserEntry | undefined {
  const done = judgedTurn(s)
  return s.pendingUser.find(e => e.afterTurn <= done || (e.fails ?? 0) >= MAX_REPLY_FAILS)
}

// A failed full check: every reply waiting on it counts one.
export function failWaiting(s: DocketSession): DocketSession {
  const done = judgedTurn(s)
  return { ...s, pendingUser: s.pendingUser.map(u => (u.afterTurn > done ? { ...u, fails: (u.fails ?? 0) + 1 } : u)) }
}

// Replies are waiting on a full check that nothing has scheduled.
export const isBlocked = (s: DocketSession): boolean => s.pendingUser.length > 0 && judgeable(s) === undefined

// Drops one reply from the queue (judged, let go, or with nothing it could close).
export const consumeReply = (s: DocketSession, seq: number): DocketSession => ({ ...s, pendingUser: s.pendingUser.filter(u => u.seq !== seq) })

// A failed check of a reply: counted; past the limit the reply is let go.
export function failReply(s: DocketSession, seq: number): DocketSession {
  const e = s.pendingUser.find(u => u.seq === seq)
  if (e === undefined) return s
  const fails = (e.fails ?? 0) + 1
  return fails >= MAX_REPLY_FAILS ? consumeReply(s, seq) : { ...s, pendingUser: s.pendingUser.map(u => (u.seq === seq ? { ...u, fails } : u)) }
}

// The open items a reply could close: those raised by the turn it answered, or before.
export const closableBy = (s: DocketSession, e: UserEntry): Item[] => openItems(s).filter(i => i.openedTurn <= e.afterTurn)

// Entry redaction: the pane, the judge and the disk all see the same text.
const clean = (text: string, max: number): string => sanitise(redact(text), max)

// Closes kept for "Recently closed" and for the judge's do-not-re-add list. A clear batch counts once.
export const KEEP_CLOSES = 15
export const KEEP_TOOL_ASKED = 10
// While checks keep failing nothing is consumed; these caps keep the backlog (and $.state) bounded.
export const KEEP_USER = 30
export const KEEP_CLAUDE = 120
export const KEEP_TOOLS = 200

export function freshSession(): DocketSession {
  return {
    items: [],
    nextId: 1,
    turn: 0,
    nextSeq: 1,
    nextCloseSeq: 1,
    nextBatch: 1,
    pendingUser: [],
    claude: [],
    tools: [],
    toolAsked: [],
    lastFinal: '',
    lastCheck: { ok: true, at: 0, reason: '', streak: 0, checkedTurns: 0 },
    view: { isPaneUp: false, keysPausedUntil: null, showAllClosed: false, focusedId: null },
    sid: 'pending',
    root: '',
    everHadItem: false,
    carry: { on: false, gen: 0 },
    restored: false,
    carryTaken: false,
    carrySaveFailed: false,
    carriedNotice: null,
    pendingClaim: null,
    walkFocus: null,
    userLog: [],
    lastFinalClipped: false,
    lastReply: null,
  }
}

// Fills what a value written by an older build lacks (a hot reload keeps $.state). A value with no
// sid key is a live v0.1 docket from before the upgrade: marked '' so the first landing adopts it.
export function normalize(value: Partial<DocketSession> | undefined): DocketSession {
  const fresh = freshSession()
  if (value === undefined) return fresh
  return {
    ...fresh,
    ...value,
    sid: value.sid ?? '',
    carry: { ...fresh.carry, ...(value.carry ?? {}) },
    everHadItem: (value.everHadItem ?? false) || (value.items?.length ?? 0) > 0,
    lastCheck: { ...fresh.lastCheck, ...(value.lastCheck ?? {}) },
    view: { ...fresh.view, ...(value.view ?? {}) },
    // v0.6 fields a live v0.5 value lacks. Its pending replies answered the last final; marked clipped,
    // since which part of it they saw is unknown, so they tie by message but are never labelled. Only a
    // v0.5 value (no userLog): a v0.6 reply typed before any final has no answered on purpose, and must
    // not later be stamped with the reply Claude gave it.
    pendingUser: (value.pendingUser ?? []).map(u => (value.userLog !== undefined || u.answered !== undefined || (value.lastFinal ?? '') === '' ? u : { ...u, answered: { text: redact(value.lastFinal ?? '').slice(-ANSWERED_CHARS), clipped: true } })),
    lastFinalClipped: value.lastFinalClipped ?? false,
    userLog: value.userLog ?? [],
    lastReply: value.lastReply ?? null,
  }
}

export const openItems = (s: DocketSession): Item[] => s.items.filter(i => i.status === 'open').sort((a, b) => a.id - b.id)

// One entry per close event, newest first: a single item, or a whole clear batch.
export type CloseGroup = { closeSeq: number; items: Item[] }

export function closeGroups(s: DocketSession): CloseGroup[] {
  const groups = new Map<number, Item[]>()
  for (const i of s.items) {
    if (i.status === 'open' || i.closeSeq === undefined) continue
    groups.set(i.closeSeq, [...(groups.get(i.closeSeq) ?? []), i])
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([closeSeq, items]) => ({ closeSeq, items }))
}

// Every item of the kept closes: the judge's "do not re-add" list.
export const closedForJudge = (s: DocketSession): Item[] => closeGroups(s).flatMap(g => g.items)

// Drops closed items beyond the kept closes.
function prune(s: DocketSession): DocketSession {
  const kept = new Set(closeGroups(s).slice(0, KEEP_CLOSES).map(g => g.closeSeq))
  return { ...s, items: s.items.filter(i => i.status === 'open' || (i.closeSeq !== undefined && kept.has(i.closeSeq))) }
}

// extra: fields a close records beside its note (v0.6: answer, via, closure).
function close(s: DocketSession, ids: readonly number[], by: Item['by'], notes: Map<number, string>, now: number, batch?: number, extra: Partial<Item> = {}): DocketSession {
  if (ids.length === 0) return s
  const closeSeq = s.nextCloseSeq
  const items = s.items.map(i =>
    ids.includes(i.id) && i.status === 'open'
      ? { ...i, ...extra, status: (by === 'you' || by === 'claude' ? 'resolved' : 'dismissed') as Item['status'], by, note: notes.get(i.id) ?? '', closedAt: now, closeSeq, ...(batch === undefined ? {} : { batch }) }
      : i,
  )
  return prune({ ...s, items, nextCloseSeq: closeSeq + 1 })
}

// v0.6: whether a reply is tied to an item: Claude presented it in a walk (focus), the Reply button
// named it (lead), or the message the reply answered is about it and about no other open item.
type Tie = { focusId?: number; namedId?: number; answered?: { text: string }; aboutIds?: number[] }

// The items the message a reply answered is about: recorded when it was typed, against the items open
// then (a sibling closed since must still count), or worked out now for an entry from before v0.6.
const aboutOf = (s: DocketSession, e: Tie): number[] => e.aboutIds ?? (e.answered === undefined ? [] : openItems(s).filter(namer(e.answered.text)).map(i => i.id))

// The message a reply answered is about this item and about no other.
export const isAboutOnly = (s: DocketSession, e: Tie, item: Item): boolean => {
  const about = aboutOf(s, e)
  return about.length === 1 && about[0] === item.id
}

export function tiedTo(s: DocketSession, e: Tie, item: Item): boolean {
  return e.focusId === item.id || e.namedId === item.id || isAboutOnly(s, e, item)
}

// What a judged reply records on the item it closes (v0.6): the user's words, and for an option pick
// whose message is about this item alone, the option code read by their key. A tie by focus or lead
// says which item, not which list: a message about two items may hold the other one's options.
export function answerFor(s: DocketSession, e: UserEntry, item: Item): Answer {
  const words = clean(wordsOf(e), 200)
  const pick = optionPick(wordsOf(e))
  const msg = e.answered
  const base = { words, seq: e.seq }
  if (pick === undefined || msg === undefined || msg.clipped || e.midTurn === true || !isAboutOnly(s, e, item)) return base
  const option = resolvePick(pick, msg.text)
  return option === undefined ? base : { ...base, option: { key: option.key, label: clean(option.label, 80) } }
}

// Code's own guards on a resolve, whatever the model said. Returns why it is refused, or ''.
export function refusal(s: DocketSession, item: Item, r: CheckedResolve): string {
  if (r.by === 'you') {
    const e: UserEntry = r.entry
    if (e.afterTurn < item.openedTurn) return 'evidence-before-item'
    if (item.reopenedAtSeq !== undefined && e.seq <= item.reopenedAtSeq) return 'evidence-before-reopen'
    // A bare go-ahead or refusal names no item, whether the whole reply is one ("yes") or only the span
    // the judge quoted ("ok" from "ok thanks"). The exception is a reply that names the item itself, as
    // the Reply button's "Re: <item> — yes" does.
    const namesItem = normalise(e.text).toLowerCase().includes(normalise(`Re: ${item.text} —`).toLowerCase())
    // A walk (v0.4): "skip", "later" and the like leave items open, whatever the judge read.
    if (e.inWalk === true && isSkip(wordsOf(e))) return 'skip-in-walk'
    // The item Claude presented, alone and restated, in the turn this reply answers (stamped at addUser).
    const isFocused = e.focusId === item.id
    // A lead stripLead stamped wins over a text match: "Re: Ship it — now — yes" names "Ship it — now",
    // not "Ship it", though both leads occur in it. The text match is for entries with no stamp.
    const isNamed = e.namedId !== undefined ? e.namedId === item.id : namesItem
    // v0.6, option picks ("1", "option 2") and bare replies ("yes", or a bare span the judge quoted): one
    // stamped for another item (walk focus or Reply lead) never closes this one; a pick closes only an
    // item it is tied to; typed mid-turn, only one its lead or focus names.
    const words = wordsOf(e)
    const isPick = optionPick(words) !== undefined
    // A bare quoted span from words that name this item ("yes, and rotate the key too: ok") is not a
    // bare reply to it.
    const isBareReply = isBare(words) || (isBare(r.evidence) && !names(words, item))
    const isForOther = (e.focusId !== undefined && !isFocused) || (e.namedId !== undefined && e.namedId !== item.id)
    if ((isPick || isBareReply) && isForOther && !isNamed) return isPick ? 'option-other-item' : 'bare-other-item'
    if ((isPick || isBare(words)) && e.midTurn === true && !isNamed && !isFocused) return 'mid-turn-unnamed'
    if (isPick && !tiedTo(s, e, item)) return 'pick-not-tied'
    if ((isBare(r.evidence) || isBare(words)) && !isNamed && !isFocused) {
      // A sibling the user dismissed, or a duplicate Claude closed, no longer makes the reply ambiguous;
      // one Claude closed for another reason still does (the same rule as addUser's aboutIds).
      const openedThen = s.items.filter(i => i.source === 'judge' && i.openedTurn === e.afterTurn && stillAsked(i))
      const isOnly = openedThen.length === 1 && openedThen[0]?.id === item.id
      if (!item.singleRec || item.openedTurn !== e.afterTurn || !isOnly) return 'bare-reply-ambiguous'
    }
    return ''
  }
  if (r.turn < item.openedTurn) return 'evidence-before-item'
  if (item.reopenedAtTurn !== undefined && r.turn <= item.reopenedAtTurn) return 'evidence-before-reopen'
  // The sentence that raised the item is not proof it is done. Only in the turn that raised it: a later
  // short report ("merged") may share words with the ask.
  if (r.turn === item.openedTurn && item.quote !== '' && occursIn(r.evidence, item.quote)) return 'evidence-is-the-ask'
  return ''
}

// overCap: resolves that passed every check past the per-verdict limit, left open (v0.6).
export type Applied = { session: DocketSession; added: number; resolved: number; refused: string[]; overCap: number[] }

// Resolves one verdict may apply: a bound on what one misread can close. Applied after code's own
// refusals, so a refused resolve doesn't take a slot.
export const MAX_RESOLVES = 3

// Applies a checked verdict: resolves first (against the items the judge saw), then adds. A full check
// consumes Claude's text and tool lines it was handed; a resolve check consumes the one reply it judged.
export function applyVerdict(s: DocketSession, v: Verdict, snap: Snapshot, now: number): Applied {
  const refused: string[] = []
  const ok: CheckedResolve[] = []
  const overCap: number[] = []
  for (const r of v.resolves) {
    const item = s.items.find(i => i.id === r.id && i.status === 'open')
    if (item === undefined) { refused.push('not-open'); continue }
    const why = refusal(s, item, r)
    if (why !== '') { refused.push(why); continue }
    if (ok.length >= MAX_RESOLVES) { overCap.push(r.id); continue }
    ok.push(r)
  }
  let next = s
  for (const r of ok) {
    const item = s.items.find(i => i.id === r.id) as Item
    if (r.by === 'you') {
      // v0.6: the user's words go with the close; for an option pick the judge's paraphrase is dropped,
      // since code read the option from their key.
      const answer = answerFor(s, r.entry, item)
      const isPick = optionPick(wordsOf(r.entry)) !== undefined
      next = close(next, [r.id], 'you', new Map([[r.id, isPick ? '' : clean(r.note, 80)]]), now, undefined, { answer })
    } else {
      next = close(next, [r.id], r.by, new Map([[r.id, clean(r.note, 80)]]), now)
    }
  }
  // Adds: never a duplicate of an item the session still holds, open or closed.
  const known = next.items.map(i => normalise(i.text).toLowerCase())
  let added = 0
  const items = [...next.items]
  let nextId = next.nextId
  for (const a of v.adds) {
    const text = clean(a.text, 120)
    if (text === '' || known.includes(normalise(text).toLowerCase())) continue
    known.push(normalise(text).toLowerCase())
    items.push({ id: nextId, kind: a.kind, text, quote: clean(a.quote, 200), singleRec: a.singleRec, source: 'judge', openedTurn: a.turn, status: 'open', firstSeenAt: now })
    nextId += 1
    added += 1
  }
  next = { ...next, items, nextId, everHadItem: next.everHadItem || added > 0 }
  if (snap.mode === 'full') {
    // v0.6: a full check carries no user words, so it consumes none. The replies waiting on this turn
    // are judged next, each alone, now that its items exist (this replaces v0.5's keptForNew).
    next = { ...next, claude: next.claude.filter(c => c.turn > snap.consumedTurn), tools: next.tools.filter(t => t.turn > snap.consumedTurn) }
  } else {
    // The reply this check judged is spent, whatever it closed: on 2026-11-05 a judged reply left
    // pending was read against the next item's options and closed it.
    const e = snap.user[0]
    if (e !== undefined) {
      next = consumeReply(next, e.seq)
      const closed = ok.map(r => r.id)
      const words = clean(wordsOf(e), 200)
      if (overCap.length > 0) {
        next = { ...next, lastReply: { seq: e.seq, words, closed, overCap, shown: false }, userLog: next.userLog.map(l => (l.seq === e.seq ? { ...l, overCap } : l)) }
      } else if (next.lastReply !== null && next.lastReply.shown) {
        next = { ...next, lastReply: null }
      }
    }
  }
  return { session: next, added, resolved: ok.length, refused, overCap }
}

export function dismiss(s: DocketSession, id: number, now: number): DocketSession {
  return close(s, [id], 'dismiss', new Map(), now)
}

// The user marked it done themselves (perhaps outside the chat): recorded as theirs, unlike a dismiss.
export function markDone(s: DocketSession, id: number, now: number): DocketSession {
  return close(s, [id], 'you', new Map([[id, 'marked done']]), now, undefined, { via: 'done' })
}

// Reply new (v0.4): the user sent this item to a new window. Theirs, as Done is.
export function handOff(s: DocketSession, id: number, now: number): DocketSession {
  return close(s, [id], 'you', new Map([[id, 'sent to a new window']]), now, undefined, { via: 'reply-new' })
}

// Claude's close tool (v0.6): its own close, with a kind and a reason, never the user's.
export function closeByTool(s: DocketSession, id: number, extra: Partial<Item>, now: number): DocketSession {
  return close(s, [id], 'claude-tool', new Map(), now, undefined, extra)
}

export function clearAll(s: DocketSession, now: number): DocketSession {
  const ids = openItems(s).map(i => i.id)
  if (ids.length === 0) return s
  return { ...close(s, ids, 'clear', new Map(), now, s.nextBatch), nextBatch: s.nextBatch + 1 }
}

const lastSeq = (s: DocketSession): number => s.nextSeq - 1

// Reopens every item of one close (a single item or a clear batch), stamped so the evidence that
// closed it cannot close it again.
export function reopen(s: DocketSession, closeSeq: number): DocketSession {
  const items = s.items.map(i => {
    if (i.status === 'open' || i.closeSeq !== closeSeq) return i
    // v0.6: the close's record goes with it; Claude's notes stay.
    const { by: _by, note: _note, closedAt: _at, closeSeq: _seq, batch: _batch, answer: _answer, via: _via, closure: _closure, superseded: _sup, ...rest } = i
    return { ...rest, status: 'open' as const, reopenedAtSeq: lastSeq(s), reopenedAtTurn: s.turn }
  })
  return { ...s, items }
}

export function addManual(s: DocketSession, text: string, now = 0): DocketSession {
  const t = clean(text, 120)
  if (t === '') return s
  const item: Item = { id: s.nextId, kind: 'do', text: t, quote: '', singleRec: false, source: 'manual', openedTurn: s.turn, status: 'open', firstSeenAt: now }
  return { ...s, items: [...s.items, item], nextId: s.nextId + 1, everHadItem: true }
}

// The walk item a reply typed now answers: the one item Claude presented (through the list tool) in the
// turn that just ended, and restated in that turn's final message. A reply typed while that turn still
// ran has afterTurn from the turn before, so it gets none.
export function walkFocusFor(s: DocketSession): number | undefined {
  const f = s.walkFocus
  if (f === null || f.turn !== s.turn || f.ids.length !== 1) return undefined
  const item = s.items.find(i => i.id === f.id && i.status === 'open')
  if (item === undefined) return undefined
  return normalise(s.lastFinal).toLowerCase().includes(normalise(item.text).toLowerCase()) ? item.id : undefined
}

// A walk is going on: Claude presented an item this turn or the one before.
export const isWalking = (s: DocketSession): boolean => s.walkFocus !== null && s.turn - s.walkFocus.turn <= 1

// Records a presenting call (v0.4) for the turn in progress, s.turn + 1 (turn counts ended turns).
export function present(s: DocketSession, id: number): DocketSession {
  const turn = s.turn + 1
  const prior = s.walkFocus !== null && s.walkFocus.turn === turn ? s.walkFocus.ids : []
  const ids = prior.includes(id) ? prior : [...prior, id]
  return { ...s, walkFocus: { id, turn, ids } }
}

// The Reply button's lead (v0.6): the item whose "Re: <item> — " the text starts with, and what the user
// typed after it. Matched against the items' own leads, since an item's text may hold a dash; against
// closed items too, since an earlier reply may close the item before this one is sent.
export function stripLead(s: DocketSession, text: string): { words: string; namedId?: number } {
  const t = text.trimStart()
  // The longest lead first, so an item "X" never takes a reply to "X - or Y?"; open first among equals.
  const byLead = [...s.items].sort((a, b) => leadHere(b).length - leadHere(a).length || Number(b.status === 'open') - Number(a.status === 'open'))
  const hit = byLead.find(item => t.startsWith(leadHere(item).trimEnd()))
  return hit === undefined ? { words: text.trim() } : { words: t.slice(leadHere(hit).trimEnd().length).trim(), namedId: hit.id }
}

// isMidTurn: typed while a turn ran. Such a reply answers whatever that turn is saying, which the
// last presented item may no longer be: it gets no focus stamp.
export function addUser(s: DocketSession, text: string, isMidTurn = false): DocketSession {
  const focusId = isMidTurn ? undefined : walkFocusFor(s)
  const { words, namedId } = stripLead(s, text)
  // v0.6: the message the reply answers is the one on screen now, kept with it.
  const final = redact(s.lastFinal)
  const answered = final === '' ? undefined : { text: final.slice(-ANSWERED_CHARS), clipped: s.lastFinalClipped || final.length > ANSWERED_CHARS }
  // Which items that message is about, open or closed, as of now: a later close must not make it look
  // about one item only, and an item closed wrongly before this reply must still be one it is about
  // (the case amend corrects). Only items stillAsked count: a near-duplicate dropped earlier must not
  // make a message about one open item look like a message about two.
  const isNamed = answered === undefined ? undefined : namer(answered.text)
  const aboutIds = isNamed === undefined ? [] : s.items.filter(i => stillAsked(i) && isNamed(i)).map(i => i.id)
  const stamps = {
    ...(focusId === undefined ? {} : { focusId }),
    ...(namedId === undefined ? {} : { namedId }),
    ...(answered === undefined ? {} : { answered }),
    aboutIds,
  }
  const entry: UserEntry = {
    seq: s.nextSeq,
    text: clip(text, 20000),
    afterTurn: s.turn,
    words: clip(words, 20000),
    ...stamps,
    ...(isMidTurn ? { midTurn: true as const } : {}),
    ...(isWalking(s) ? { inWalk: true as const } : {}),
  }
  const logged = { seq: entry.seq, words: clean(words, 2000), afterTurn: s.turn, ...stamps }
  return {
    ...s,
    pendingUser: [...s.pendingUser, entry].slice(-KEEP_USER),
    userLog: [...s.userLog, logged].slice(-KEEP_USER_LOG),
    nextSeq: s.nextSeq + 1,
  }
}

// Appends one turn's material, oldest dropped past the caps.
export function addTurn(s: DocketSession, claude: readonly ClaudeEntry[], tools: readonly ToolLine[]): DocketSession {
  return { ...s, claude: [...s.claude, ...claude].slice(-KEEP_CLAUDE), tools: [...s.tools, ...tools].slice(-KEEP_TOOLS) }
}

export function addToolAsked(s: DocketSession, questions: readonly string[]): DocketSession {
  if (questions.length === 0) return s
  return { ...s, toolAsked: [...s.toolAsked, ...questions.map(q => clip(redact(q), 200))].slice(-KEEP_TOOL_ASKED) }
}
