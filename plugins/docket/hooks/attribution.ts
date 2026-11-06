// Pure: how a closed item says who closed it (v0.6). The list tool and the pane both read it from here.
//
// The rule (Bryan's brief, 2026-11-05): nothing Claude writes appears as the user's. After "you" comes
// only the user's own stored words, quoted; an option label code read from the message they answered,
// by their key; or a fixed string for a button they pressed. What the judge model read into a reply is
// "Docket's reading"; what Claude did with its tools is "closed by Claude" or "Claude's …".

import type { Item } from '../types'
import { optionPick } from './options'
import { sanitise } from './text'

const q = (t: string, max = 200): string => `"${sanitise(t, max)}"`

// The fixed notes v0.5 wrote for the two buttons, which mark a close by a press rather than a reply.
const DONE_NOTE = 'marked done'
const REPLY_NEW_NOTE = 'sent to a new window'

// The user's part of a close by them, or undefined.
export function youPart(i: Item): string | undefined {
  if (i.by !== 'you') return undefined
  if (i.via === 'done' || (i.answer === undefined && i.note === DONE_NOTE)) return 'you marked it done'
  if (i.via === 'reply-new' || (i.answer === undefined && i.note === REPLY_NEW_NOTE)) return 'you sent it to a new window'
  const a = i.answer
  if (a === undefined) return 'closed by you'
  const linked = a.linked === true ? ' (linked by Claude)' : ''
  if (a.option !== undefined) {
    const option = `option ${a.option.key}, ${q(a.option.label, 80)}`
    const isBareKey = (optionPick(a.words)?.tail ?? 'x') === ''
    return isBareKey ? `you chose ${option}${linked}` : `you said: ${q(a.words)} (${option})${linked}`
  }
  return `you said: ${q(a.words)}${linked}`
}

// What the judge read into the user's reply: shown beside it, never as theirs.
export function readingPart(i: Item): string | undefined {
  if (i.by !== 'you' || i.note === undefined || i.note === '' || i.note === DONE_NOTE || i.note === REPLY_NEW_NOTE) return undefined
  if (i.answer?.option !== undefined) return undefined
  return `Docket's reading: ${sanitise(i.note, 80)}`
}

function closurePart(i: Item): string {
  const c = i.closure
  if (c === undefined) return 'closed by Claude'
  const reason = c.reason === '' ? '' : `: ${sanitise(c.reason, 120)}`
  switch (c.kind) {
    case 'duplicate':
      return `closed by Claude: duplicate of #${c.dupOf ?? '?'}${reason}`
    case 'settled-earlier':
      return `closed by Claude: settled earlier, see ${sanitise(c.cite ?? '', 12)}${reason}`
    case 'user-asked':
      return `closed by Claude, citing your reply ${q(c.cite ?? '')}${reason}`
    case 'done-by-claude':
      return `closed by Claude: done${reason}`
    case 'stale':
      return `closed by Claude: stale${reason}`
  }
}

// The close itself, one phrase: whose it was and, for the user's, what they said.
export function closedHead(i: Item): string {
  if (i.by === 'you') return youPart(i) as string
  if (i.by === 'claude') return `per Claude's report: ${sanitise(i.note ?? '', 80)}`
  if (i.by === 'claude-tool') return closurePart(i)
  if (i.by === 'clear') return 'cleared'
  if (i.by === 'dismiss') return 'dismissed'
  return 'closed'
}

// Everything else a closed item carries, each its own line: Docket's reading, what Claude's amend
// replaced and its correction, Claude's notes.
export function closedDetails(i: Item): string[] {
  const out: string[] = []
  const reading = readingPart(i)
  if (reading !== undefined) out.push(reading)
  const sup = i.superseded
  if (sup !== undefined) {
    const words = sup.answer === undefined ? '' : `from ${q(sup.answer.words, 80)}`
    const read = sup.answer?.option !== undefined ? `option ${sup.answer.option.key}, ${q(sup.answer.option.label, 60)}` : sup.note !== undefined && sup.note !== '' ? `read as: ${sanitise(sup.note, 80)}` : ''
    out.push(`Docket's earlier reading (replaced): ${[words, read].filter(x => x !== '').join(', ') || 'none recorded'}`)
    out.push(`Claude's correction: ${sanitise(sup.correction, 200)}`)
  }
  for (const n of i.notes ?? []) out.push(`Claude's note: ${sanitise(n.text, 200)}`)
  return out
}

// One line for the list tool: the head, then the details, separated.
export const closedLine = (i: Item): string => [closedHead(i), ...closedDetails(i)].join(' · ')
