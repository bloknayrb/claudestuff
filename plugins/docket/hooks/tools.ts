// Pure: what Claude's own Docket tools do (v0.6), annotate, amend and close. Nothing here takes $.
//
// Each one keeps Bryan's rule from the 2026-11-05 brief: a user decision is never fabricated. A note or
// a close is shown as Claude's. An amend may only point the item at words the user really typed, as
// Docket recorded them at the prompt (userLog), never at text Claude supplies; the display then shows
// those words in full, not the span Claude quoted.

import type { CloseKind, DocketSession, Item, LoggedReply, UserEntry } from '../types'
import { MAX_NOTES } from './persist'
import { answerFor, names, tiedTo } from './ledger'
import { optionPick } from './options'
import { isBare, normalise, redact, sanitise } from './text'

export type ToolOut = { session: DocketSession; text: string }

const MIN_SPAN = 8

export const parseId = (raw: unknown): number | undefined => {
  const m = typeof raw === 'string' ? /^#?(\d+)$/.exec(raw.trim()) : typeof raw === 'number' && Number.isInteger(raw) ? [String(raw), String(raw)] : null
  return m === null ? undefined : Number(m[1])
}

const flat = (t: string): string => normalise(redact(t)).toLowerCase()

// The user's typed reply that evidence quotes: the whole reply, or at least 8 characters of one, typed
// after `afterTurn`. The newest match wins.
export function findReply(s: DocketSession, evidence: string, afterTurn: number, prefer?: number): LoggedReply | undefined {
  const ev = flat(evidence)
  if (ev === '') return undefined
  const hits = [...s.userLog].reverse().filter(l => l.afterTurn >= afterTurn && (flat(l.words) === ev || (ev.length >= MIN_SPAN && flat(l.words).includes(ev))))
  // Two replies with the same words ("1", "yes"): the one that closed the item, when it is among them.
  return hits.find(l => l.seq === prefer) ?? hits[0]
}

const asEntry = (l: LoggedReply): UserEntry => ({ seq: l.seq, text: l.words, afterTurn: l.afterTurn, words: l.words, ...(l.focusId === undefined ? {} : { focusId: l.focusId }), ...(l.namedId === undefined ? {} : { namedId: l.namedId }), ...(l.answered === undefined ? {} : { answered: l.answered }), ...(l.aboutIds === undefined ? {} : { aboutIds: l.aboutIds }) })

function state(i: Item): string {
  return i.status === 'open' ? `#${i.id} is open` : `#${i.id} is already closed`
}

function put(s: DocketSession, item: Item): DocketSession {
  return { ...s, items: s.items.map(i => (i.id === item.id ? item : i)) }
}

export function annotate(s: DocketSession, id: number | undefined, note: unknown, now: number): ToolOut {
  const item = s.items.find(i => i.id === id)
  if (item === undefined) return { session: s, text: `#${id ?? '?'} isn't on the Docket.` }
  const text = typeof note === 'string' ? sanitise(redact(note), 200) : ''
  if (text === '') return { session: s, text: 'annotate needs a note.' }
  const notes = [...(item.notes ?? []), { text, at: now }].slice(-MAX_NOTES)
  return { session: put(s, { ...item, notes }), text: `Noted on #${item.id}, shown as Claude's note.` }
}

export function amend(s: DocketSession, id: number | undefined, correction: unknown, evidence: unknown, now: number): ToolOut {
  const item = s.items.find(i => i.id === id)
  if (item === undefined) return { session: s, text: `#${id ?? '?'} isn't on the Docket.` }
  if (item.status === 'open') return { session: s, text: `${state(item)}; amend is for a resolution Docket recorded.` }
  if (item.by !== 'you' || item.answer === undefined || item.via !== undefined) {
    return { session: s, text: `#${item.id} wasn't closed by a reply Docket recorded, so it can't be amended. Annotate it, or ask the user to Reopen it in the pane.` }
  }
  const text = typeof correction === 'string' ? sanitise(redact(correction), 200) : ''
  if (text === '') return { session: s, text: 'amend needs the corrected resolution as text.' }
  const reply = typeof evidence === 'string' ? findReply(s, evidence, item.openedTurn, item.answer.seq) : undefined
  if (reply === undefined) {
    return { session: s, text: `That evidence isn't the user's own reply, typed after #${item.id} opened: quote the whole reply, or at least ${MIN_SPAN} characters of it, exactly.` }
  }
  // The same reply by its seq; by its words only for a close recorded without one.
  const isSame = item.answer.seq !== undefined ? reply.seq === item.answer.seq : flat(reply.words) === flat(item.answer.words)
  if (!isSame && !tiedTo(s, asEntry(reply), item)) {
    return { session: s, text: `That reply isn't about #${item.id}: it wasn't presented, replied to, or named in the message the user answered. Annotate instead.` }
  }
  const answer = { ...answerFor(s, asEntry(reply), item), ...(isSame ? {} : { linked: true as const }) }
  const superseded = item.superseded !== undefined
    ? { ...item.superseded, correction: text, at: now }
    : { at: now, correction: text, answer: item.answer, ...(item.note === undefined || item.note === '' ? {} : { note: item.note }) }
  return { session: put(s, { ...item, answer, note: '', superseded }), text: `Amended #${item.id}: the user's words now shown are "${sanitise(reply.words, 120)}"${isSame ? '' : ' (linked by Claude)'}; your correction and the replaced reading are shown beside them.` }
}

type Kind = { kind: CloseKind; dupOf?: number }

function parseKind(raw: unknown): Kind | undefined {
  if (typeof raw !== 'string') return undefined
  const k = raw.trim()
  const dup = /^duplicate-of:#?(\d+)$/.exec(k)
  if (dup !== null) return { kind: 'duplicate', dupOf: Number(dup[1]) }
  return k === 'settled-earlier' || k === 'user-asked' || k === 'done-by-claude' || k === 'stale' ? { kind: k } : undefined
}

export function closeByClaude(s: DocketSession, id: number | undefined, rawKind: unknown, rawReason: unknown, rawCite: unknown, now: number, close: (s: DocketSession, id: number, extra: Partial<Item>) => DocketSession): ToolOut {
  const item = s.items.find(i => i.id === id)
  if (item === undefined) return { session: s, text: `#${id ?? '?'} isn't on the Docket.` }
  if (item.status !== 'open') return { session: s, text: `${state(item)}; nothing to do.` }
  const k = parseKind(rawKind)
  if (k === undefined) return { session: s, text: 'kind must be duplicate-of:#N, settled-earlier, user-asked, done-by-claude or stale.' }
  const reason = typeof rawReason === 'string' ? sanitise(redact(rawReason), 200) : ''
  if (reason === '') return { session: s, text: 'close needs a reason.' }
  let cite: string | undefined
  if (k.kind === 'duplicate') {
    if (k.dupOf === item.id || !s.items.some(i => i.id === k.dupOf)) return { session: s, text: `duplicate-of needs another item's #id on the Docket.` }
  } else if (k.kind === 'settled-earlier') {
    const n = parseId(rawCite)
    const earlier = s.items.find(i => i.id === n)
    if (earlier === undefined || earlier.by !== 'you' || earlier.answer === undefined || earlier.via !== undefined) {
      return { session: s, text: 'settled-earlier must cite #N, an item the user closed with a reply Docket recorded.' }
    }
    cite = `#${earlier.id}`
  } else if (k.kind === 'user-asked') {
    const reply = typeof rawCite === 'string' ? findReply(s, rawCite, item.openedTurn) : undefined
    if (reply === undefined) return { session: s, text: `user-asked must cite the user's own reply, typed after #${item.id} opened, exactly.` }
    if (isBare(reply.words) || optionPick(reply.words) !== undefined) return { session: s, text: 'A bare reply ("yes", "1") names no item; it can\'t be cited for user-asked.' }
    const isLeft = reply.overCap?.includes(item.id) === true
    const isNamed = reply.namedId === item.id || names(reply.words, item)
    if (!isLeft && !isNamed) return { session: s, text: `That reply doesn't name #${item.id}, and its check didn't leave #${item.id} over the limit. Ask the user.` }
    cite = reply.words
  }
  const closure = { kind: k.kind, reason, ...(k.dupOf === undefined ? {} : { dupOf: k.dupOf }), ...(cite === undefined ? {} : { cite }) }
  return { session: close(s, item.id, { closure }), text: `Closed #${item.id}, shown as closed by Claude. The user can Reopen it in the pane.` }
}
