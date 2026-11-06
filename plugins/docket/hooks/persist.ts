// Pure: what a snapshot holds, how it is written and how a file read back is checked. Nothing here
// takes $. A file on disk is untrusted: every field is rebuilt by hand, and any failure rejects it.

import type { Answer, CarrySource, CarryState, CloseKind, ClosedBy, DocketProc, DocketSession, DocketWriter, Item, ItemKind, ItemStatus, LastCheck, WriteKind } from '../types'
import { freshSession, KEEP_TOOL_ASKED } from './ledger'
import { clip, redact, sanitise } from './text'

export const SNAPSHOT_V = 1
// Load caps, against a planted file only. The live ledger has no open cap (Docket never hides an
// item), so these sit far above anything a real session reaches: a cap a real session could pass
// would save a file that can never load.
export const MAX_OPEN = 2000
export const MAX_ITEMS = 10000
export const LAST_FINAL_CHARS = 6000
export const RETAIN_MS = 30 * 24 * 60 * 60 * 1000

// Session ids go into file names: anything else is never read or written.
export const isSafeSid = (sid: unknown): sid is string => typeof sid === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(sid)

// A real session's id: not the v0.1 marker '' or the not-yet-known 'pending'.
export const isRealSid = (sid: string): boolean => sid !== '' && sid !== 'pending' && isSafeSid(sid)

export const freshProc = (): DocketProc => ({
  isInteractive: null,
  endingSid: null,
  epoch: 0,
  saveToastShown: false,
  classicSid: null,
  classicFrom: null,
  startupSid: null,
  startupDecided: false,
  classicStartupSeenFor: null,
  clearCapture: null,
  captureSeq: 0,
  handoffNonce: null,
  handoffPicked: false,
  handoffContext: null,
  canReplyNew: false,
})
export const freshWriter = (): DocketWriter => ({ seqBy: {}, lastText: {}, pending: {}, rootBy: {}, closed: {}, forgotten: {} })
export const normProc = (v: Partial<DocketProc> | undefined): DocketProc => ({ ...freshProc(), ...(v ?? {}) })
export const normWriter = (v: Partial<DocketWriter> | undefined): DocketWriter => ({ ...freshWriter(), ...(v ?? {}) })

export const writeKey = (sid: string, kind: WriteKind): string => `${sid}|${kind}`

// Copies of a record with one key set or removed (state values are never mutated in place).
export const withKey = <T>(rec: Record<string, T>, k: string, v: T): Record<string, T> => ({ ...rec, [k]: v })
export function withoutKey<T>(rec: Record<string, T>, k: string): Record<string, T> {
  if (!(k in rec)) return rec
  const { [k]: _gone, ...rest } = rec
  return rest
}

export type Ledger = {
  items: Item[]
  nextId: number
  turn: number
  nextSeq: number
  nextCloseSeq: number
  nextBatch: number
  toolAsked: string[]
  lastCheck: LastCheck
  everHadItem: boolean
  carry: CarryState
  pendingClaim: CarrySource | null
  lastFinal: string
}

export type Slot = { seq: number; root: string; savedAt: number; ledger: Ledger }

const r = (t: string): string => redact(t)

const rAnswer = (a: Answer): Answer => ({ ...a, words: r(a.words), ...(a.option === undefined ? {} : { option: { key: a.option.key, label: r(a.option.label) } }) })

// v0.6: the user's words and Claude's notes, closures and corrections, redacted for the disk.
export function redactRecords(i: Item): Item {
  return {
    ...i,
    ...(i.answer === undefined ? {} : { answer: rAnswer(i.answer) }),
    ...(i.notes === undefined ? {} : { notes: i.notes.map(n => ({ ...n, text: r(n.text) })) }),
    ...(i.closure === undefined ? {} : { closure: { ...i.closure, reason: r(i.closure.reason), ...(i.closure.cite === undefined ? {} : { cite: r(i.closure.cite) }) } }),
    ...(i.superseded === undefined ? {} : { superseded: { ...i.superseded, correction: r(i.superseded.correction), ...(i.superseded.note === undefined ? {} : { note: r(i.superseded.note) }), ...(i.superseded.answer === undefined ? {} : { answer: rAnswer(i.superseded.answer) }) } }),
  }
}

// The persisted part of a session. Buffers (pendingUser, claude, tools, userLog) and the view stay out;
// every string is redacted again as a backstop to redaction at entry. v0.6 keeps a closed item's note
// (it was dropped before): an amend's superseded reading has to survive a resume.
export function toLedger(s: DocketSession): Ledger {
  return {
    items: s.items.map(i => {
      const kept: Item = { ...i, text: r(i.text), quote: r(i.quote), origin: i.origin ?? `${s.sid}:${i.id}` }
      return redactRecords(i.note === undefined ? kept : { ...kept, note: r(i.note) })
    }),
    nextId: s.nextId,
    turn: s.turn,
    nextSeq: s.nextSeq,
    nextCloseSeq: s.nextCloseSeq,
    nextBatch: s.nextBatch,
    toolAsked: s.toolAsked.map(r),
    lastCheck: { ...s.lastCheck, reason: r(s.lastCheck.reason) },
    everHadItem: s.everHadItem || s.items.length > 0,
    carry: s.carry,
    pendingClaim: s.pendingClaim,
    lastFinal: r(s.lastFinal).slice(-LAST_FINAL_CHARS),
  }
}

// The text the writer dedupes on and writes inside the envelope.
export const ledgerText = (s: DocketSession): string => JSON.stringify(toLedger(s))

export function envelope(sid: string, root: string, seq: number, savedAt: number, text: string): string {
  return `{"v":${SNAPSHOT_V},"sid":${JSON.stringify(sid)},"root":${JSON.stringify(root)},"seq":${seq},"savedAt":${savedAt},"ledger":${text}}`
}

export const tombstone = (sid: string): string => JSON.stringify({ v: SNAPSHOT_V, sid, gone: true })

// Slot a for odd seq, b for even: consecutive writes alternate, so a torn write costs one save.
export const slotName = (seq: number): 'a' | 'b' => (seq % 2 === 1 ? 'a' : 'b')

// --- validation ---

class Bad extends Error {}
const fail = (why: string): never => {
  throw new Bad(why)
}
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const int = (v: unknown, min = 0): number => (Number.isInteger(v) && (v as number) >= min ? (v as number) : fail('int'))
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : fail('num'))
const bool = (v: unknown): boolean => (typeof v === 'boolean' ? v : fail('bool'))
const str = (v: unknown, max: number): string => (typeof v === 'string' ? sanitise(v, max) : fail('str'))
const oneOf = <T extends string>(v: unknown, all: readonly T[]): T => (typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : fail('enum'))
const opt = <T>(o: Record<string, unknown>, k: string, f: (v: unknown) => T): T | undefined => (o[k] === undefined ? undefined : f(o[k]))

const KINDS: readonly ItemKind[] = ['decide', 'do']
const STATUSES: readonly ItemStatus[] = ['open', 'resolved', 'dismissed']
const BYS: readonly ClosedBy[] = ['you', 'claude', 'dismiss', 'clear', 'claude-tool']
const KINDS_CLOSE: readonly CloseKind[] = ['duplicate', 'settled-earlier', 'user-asked', 'done-by-claude', 'stale']
const VIAS = ['done', 'reply-new'] as const
export const MAX_NOTES = 5
const SOURCES = ['judge', 'manual'] as const

function readAnswer(x: unknown): Answer {
  if (!isObj(x)) return fail('answer')
  const option = opt(x, 'option', o => (isObj(o) ? { key: str(o.key, 2), label: str(o.label, 80) } : fail('option')))
  const linked = opt(x, 'linked', bool)
  return { words: str(x.words, 2000), ...(option === undefined ? {} : { option }), ...(linked === true ? { linked: true as const } : {}) }
}

export function readItem(v: unknown, sid: string, savedAt: number): Item {
  if (!isObj(v)) return fail('item')
  const id = int(v.id, 1)
  const item: Item = {
    id,
    kind: oneOf(v.kind, KINDS),
    text: str(v.text, 120),
    quote: str(v.quote, 200),
    singleRec: bool(v.singleRec),
    source: oneOf(v.source, SOURCES),
    openedTurn: int(v.openedTurn),
    status: oneOf(v.status, STATUSES),
    origin: opt(v, 'origin', x => str(x, 80)) ?? `${sid}:${id}`,
    firstSeenAt: opt(v, 'firstSeenAt', num) ?? savedAt,
  }
  const by = opt(v, 'by', x => oneOf(x, BYS))
  const note = opt(v, 'note', x => str(x, 80))
  const closedAt = opt(v, 'closedAt', num)
  const closeSeq = opt(v, 'closeSeq', x => int(x, 1))
  const batch = opt(v, 'batch', x => int(x, 1))
  const reopenedAtSeq = opt(v, 'reopenedAtSeq', x => int(x))
  const reopenedAtTurn = opt(v, 'reopenedAtTurn', x => int(x))
  const carriedAt = opt(v, 'carriedAt', num)
  // v0.6 records, each optional so a v0.5 file loads.
  const answer = opt(v, 'answer', readAnswer)
  const via = opt(v, 'via', x => oneOf(x, VIAS))
  const notes = opt(v, 'notes', x => (Array.isArray(x) && x.length <= MAX_NOTES ? x.map(n => (isObj(n) ? { text: str(n.text, 200), at: num(n.at) } : fail('note'))) : fail('notes')))
  const closure = opt(v, 'closure', x => {
    if (!isObj(x)) return fail('closure')
    const dupOf = opt(x, 'dupOf', d => int(d, 1))
    const cite = opt(x, 'cite', c => str(c, 2000))
    return { kind: oneOf(x.kind, KINDS_CLOSE), reason: str(x.reason, 200), ...(dupOf === undefined ? {} : { dupOf }), ...(cite === undefined ? {} : { cite }) }
  })
  const superseded = opt(v, 'superseded', x => {
    if (!isObj(x)) return fail('superseded')
    const n = opt(x, 'note', y => str(y, 80))
    const a = opt(x, 'answer', readAnswer)
    return { at: num(x.at), correction: str(x.correction, 200), ...(n === undefined ? {} : { note: n }), ...(a === undefined ? {} : { answer: a }) }
  })
  return {
    ...(answer === undefined ? {} : { answer }),
    ...(via === undefined ? {} : { via }),
    ...(notes === undefined ? {} : { notes }),
    ...(closure === undefined ? {} : { closure }),
    ...(superseded === undefined ? {} : { superseded }),
    ...item,
    ...(by === undefined ? {} : { by }),
    ...(note === undefined ? {} : { note }),
    ...(closedAt === undefined ? {} : { closedAt }),
    ...(closeSeq === undefined ? {} : { closeSeq }),
    ...(batch === undefined ? {} : { batch }),
    ...(reopenedAtSeq === undefined ? {} : { reopenedAtSeq }),
    ...(reopenedAtTurn === undefined ? {} : { reopenedAtTurn }),
    ...(carriedAt === undefined ? {} : { carriedAt }),
  }
}

// A claim still owed. Malformed becomes null rather than rejecting the file: losing a retry costs at
// most a duplicate later, never the docket. Its root decides where a claim is written, so it is held
// to the same shape as a carry root.
export function readClaim(v: unknown): CarrySource | null {
  if (!isObj(v)) return null
  const { srcSid, gen, srcRoot } = v
  if (!isSafeSid(srcSid) || !Number.isInteger(gen) || (gen as number) < 1) return null
  if (typeof srcRoot !== 'string' || srcRoot === '' || srcRoot.length > 1024) return null
  return { srcSid, gen: gen as number, srcRoot }
}

function readLedger(v: unknown, sid: string, savedAt: number): Ledger {
  if (!isObj(v)) return fail('ledger')
  if (!Array.isArray(v.items)) return fail('items')
  if (v.items.length > MAX_ITEMS) fail('too-many-items')
  const items = v.items.map(i => readItem(i, sid, savedAt))
  if (items.filter(i => i.status === 'open').length > MAX_OPEN) fail('too-many-open')
  const ids = items.map(i => i.id)
  if (new Set(ids).size !== ids.length) fail('dup-id')
  const nextId = int(v.nextId, 1)
  const top = (xs: (number | undefined)[]) => xs.reduce<number>((m, x) => (x !== undefined && x > m ? x : m), 0)
  if (nextId <= top(ids)) fail('nextId')
  // Counters must stay ahead of what they number, or a Reopen could merge two closes.
  if (int(v.nextCloseSeq, 1) <= top(items.map(i => i.closeSeq))) fail('nextCloseSeq')
  if (int(v.nextBatch, 1) <= top(items.map(i => i.batch))) fail('nextBatch')
  if (!Array.isArray(v.toolAsked)) return fail('toolAsked')
  const lc = isObj(v.lastCheck) ? v.lastCheck : fail('lastCheck')
  const carry = v.carry === undefined ? { on: false, gen: 0 } : isObj(v.carry) ? { on: bool(v.carry.on), gen: int(v.carry.gen) } : fail('carry')
  return {
    items,
    nextId,
    turn: int(v.turn),
    nextSeq: int(v.nextSeq, 1),
    nextCloseSeq: int(v.nextCloseSeq, 1),
    nextBatch: int(v.nextBatch, 1),
    toolAsked: v.toolAsked.map(q => str(q, 200)).slice(-KEEP_TOOL_ASKED),
    lastCheck: { ok: bool(lc.ok), at: num(lc.at), reason: str(lc.reason, 200), streak: int(lc.streak), checkedTurns: int(lc.checkedTurns) },
    everHadItem: (opt(v, 'everHadItem', bool) ?? false) || items.length > 0,
    carry,
    pendingClaim: readClaim(v.pendingClaim),
    lastFinal: typeof v.lastFinal === 'string' ? clip(v.lastFinal, LAST_FINAL_CHARS + 1).slice(-LAST_FINAL_CHARS) : fail('lastFinal'),
  }
}

// One slot file's text, checked against the sid its name says. null for anything not a valid
// snapshot of that sid: garbled, another sid's, another version, a tombstone.
export function parseSlot(text: string | undefined, sid: string): Slot | null {
  if (text === undefined) return null
  try {
    const v: unknown = JSON.parse(text)
    if (!isObj(v)) return null
    if (v.v !== SNAPSHOT_V || v.sid !== sid || v.gone === true) return null
    const savedAt = num(v.savedAt)
    return { seq: int(v.seq, 1), root: typeof v.root === 'string' ? clip(v.root, 1024) : fail('root'), savedAt, ledger: readLedger(v.ledger, sid, savedAt) }
  } catch {
    return null
  }
}

// The newer of the two slots that are valid.
export function pickSlot(a: Slot | null, b: Slot | null): Slot | null {
  if (a === null) return b
  if (b === null) return a
  return a.seq >= b.seq ? a : b
}

// A session rebuilt from a snapshot: the ledger's fields over a fresh session, buffers and view empty.
export function restore(ledger: Ledger, sid: string, root: string): DocketSession {
  // lastFinal comes back cut to the saved length: a reply to it can't read its option lists whole.
  return { ...freshSession(), ...ledger, sid, root, restored: true, lastFinalClipped: ledger.lastFinal.length >= LAST_FINAL_CHARS }
}
