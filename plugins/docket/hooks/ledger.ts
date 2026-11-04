// Pure: the item list and every change to it. Nothing here takes $.

import type { ClaudeEntry, DocketSession, Item, ToolLine, UserEntry } from '../types'
import type { CheckedResolve, Snapshot, Verdict } from './judge'
import { clip, isBare, normalise, occursIn, redact, sanitise } from './text'

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

function close(s: DocketSession, ids: readonly number[], by: Item['by'], notes: Map<number, string>, now: number, batch?: number): DocketSession {
  if (ids.length === 0) return s
  const closeSeq = s.nextCloseSeq
  const items = s.items.map(i =>
    ids.includes(i.id) && i.status === 'open'
      ? { ...i, status: (by === 'you' || by === 'claude' ? 'resolved' : 'dismissed') as Item['status'], by, note: notes.get(i.id) ?? '', closedAt: now, closeSeq, ...(batch === undefined ? {} : { batch }) }
      : i,
  )
  return prune({ ...s, items, nextCloseSeq: closeSeq + 1 })
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
    if ((isBare(r.evidence) || isBare(e.text)) && !namesItem) {
      // A dismissed sibling no longer makes the reply ambiguous.
      const openedThen = s.items.filter(i => i.source === 'judge' && i.openedTurn === e.afterTurn && i.status !== 'dismissed')
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

// keptForNew: some of the user's words were kept for a resolve check on items this verdict added.
export type Applied = { session: DocketSession; added: number; resolved: number; refused: string[]; keptForNew: boolean }

// Applies a checked verdict: resolves first (against the items the judge saw), then adds. A full
// check's verdict also consumes what it was handed.
export function applyVerdict(s: DocketSession, v: Verdict, snap: Snapshot, now: number): Applied {
  const refused: string[] = []
  const ok: CheckedResolve[] = []
  let keptForNew = false
  for (const r of v.resolves) {
    const item = s.items.find(i => i.id === r.id && i.status === 'open')
    if (item === undefined) { refused.push('not-open'); continue }
    const why = refusal(s, item, r)
    if (why !== '') { refused.push(why); continue }
    ok.push(r)
  }
  let next = s
  for (const r of ok) {
    next = close(next, [r.id], r.by, new Map([[r.id, clean(r.note, 80)]]), now)
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
    // An item cannot be resolved in the verdict that adds it, so the user's words written after its
    // turn ended are kept for the resolve check that follows (applied.keptForNew); else an answer that
    // arrived in the same check (a failed check retried, a reply typed while a check ran) would be
    // consumed and the item left open for good.
    const newTurns = items.slice(items.length - added).map(i => i.openedTurn)
    const firstNew = newTurns.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...newTurns)
    const isKept = (u: UserEntry) => u.seq > snap.consumedSeq || u.afterTurn >= firstNew
    keptForNew = next.pendingUser.some(u => u.seq <= snap.consumedSeq && u.afterTurn >= firstNew)
    next = {
      ...next,
      pendingUser: next.pendingUser.filter(isKept),
      claude: next.claude.filter(c => c.turn > snap.consumedTurn),
      tools: next.tools.filter(t => t.turn > snap.consumedTurn),
    }
  }
  return { session: next, added, resolved: ok.length, refused, keptForNew }
}

export function dismiss(s: DocketSession, id: number, now: number): DocketSession {
  return close(s, [id], 'dismiss', new Map(), now)
}

// The user marked it done themselves (perhaps outside the chat): recorded as theirs, unlike a dismiss.
export function markDone(s: DocketSession, id: number, now: number): DocketSession {
  return close(s, [id], 'you', new Map([[id, 'marked done']]), now)
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
    const { by: _by, note: _note, closedAt: _at, closeSeq: _seq, batch: _batch, ...rest } = i
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

export function addUser(s: DocketSession, text: string): DocketSession {
  const entry: UserEntry = { seq: s.nextSeq, text: clip(text, 20000), afterTurn: s.turn }
  return { ...s, pendingUser: [...s.pendingUser, entry].slice(-KEEP_USER), nextSeq: s.nextSeq + 1 }
}

// Appends one turn's material, oldest dropped past the caps.
export function addTurn(s: DocketSession, claude: readonly ClaudeEntry[], tools: readonly ToolLine[]): DocketSession {
  return { ...s, claude: [...s.claude, ...claude].slice(-KEEP_CLAUDE), tools: [...s.tools, ...tools].slice(-KEEP_TOOLS) }
}

export function addToolAsked(s: DocketSession, questions: readonly string[]): DocketSession {
  if (questions.length === 0) return s
  return { ...s, toolAsked: [...s.toolAsked, ...questions.map(q => clip(redact(q), 200))].slice(-KEEP_TOOL_ASKED) }
}
