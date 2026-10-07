import type { Answer, Decision } from '../types'

// The row format is a contract: a strict consumer parses this row and counts only `text` under
// "other" as the user's words; change both together. The whole row is this prefix plus one object
// written by JSON.stringify, keys in this order. Every field is encoded, so nothing in a question or
// label can stand outside its own field or pass for the user's words.
export const ROW_PREFIX = 'Bridge decision: '

// The append seam's debug-log prefix: every row this mod appends is logged under it once it lands
// (the test kit serves no plugin append, so this line is what tests read).
export const APPEND_MARK = 'bridge: append: '

// Python's str.isspace() set, which a strict consumer strips with str.strip(); JS trim() differs (U+0085,
// U+001C-U+001F, U+FEFF), so Bridge uses this set to refuse an Other text a strict consumer would discard.
const PY_BLANK = /^[\t\n\v\f\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/

export function isBlankText(text: string): boolean {
  return PY_BLANK.test(text)
}

export function formatRow(decision: Pick<Decision, 'id' | 'question'>, answer: Answer): string {
  const object =
    answer.choice === 'label'
      ? { id: decision.id, question: decision.question, choice: 'label', label: answer.label }
      : { id: decision.id, question: decision.question, choice: 'other', text: answer.text }
  return ROW_PREFIX + JSON.stringify(object)
}
