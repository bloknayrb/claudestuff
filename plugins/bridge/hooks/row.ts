import type { Answer, Decision } from '../types'

// The contract with Verbatim (05-verbatim.md, 04-bridge.md item 3). The whole row is this prefix
// plus one object written by JSON.stringify, keys in this order. Every field is encoded, so nothing
// in a question or label can stand outside its own field or pass for the user's words. Don't change
// it without updating 05.
export const ROW_PREFIX = 'Bridge decision: '

// The append seam's debug-log prefix: every row this mod appends is logged under it once it lands
// (00-shared: the test kit serves no plugin append, so this line is what tests read).
export const APPEND_MARK = 'bridge: append: '

// Python's str.isspace() set, which 05's parser strips with str.strip(); JS trim() differs (U+0085,
// U+001C-U+001F, U+FEFF), so Bridge uses this set to refuse an Other text Verbatim would discard.
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
