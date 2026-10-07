// Mirrors the strict grammar of a row consumer: the whole text is the prefix plus exactly one JSON object;
// a duplicate key or text after the object rejects it; id is an integer; choice is "label" or
// "other"; an "other" text must be non-blank by Python's str.strip(), which is what such a consumer runs
// (it differs from JS trim(): it strips U+0085 and U+001C-U+001F, and keeps U+FEFF). Tightened to
// canonical form: Bridge writes JSON.stringify output, so a body that is not byte-identical to the
// re-serialised object (whitespace, trailing text, a duplicate key that JSON.parse collapsed) is
// refused too. The key set per choice is exact. Written independently of hooks/row.ts on purpose.
export type ParsedRow =
  | { id: number; question: string; choice: 'label'; label: string }
  | { id: number; question: string; choice: 'other'; text: string }

const PREFIX = 'Bridge decision: '

// Python's str.isspace() set (checked with uv run python: 29 code points).
const PY_BLANK = /^[\t\n\v\f\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/

export function parseRowStrict(text: string): ParsedRow | null {
  if (!text.startsWith(PREFIX)) return null
  const body = text.slice(PREFIX.length)
  let value: unknown
  try {
    value = JSON.parse(body)
  } catch {
    return null
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  if (JSON.stringify(value) !== body) return null
  const row = value as Record<string, unknown>
  const keys = Object.keys(row).join(',')
  if (!Number.isInteger(row.id) || typeof row.question !== 'string') return null
  if (row.choice === 'label' && keys === 'id,question,choice,label' && typeof row.label === 'string') {
    return row as ParsedRow
  }
  if (row.choice === 'other' && keys === 'id,question,choice,text' && typeof row.text === 'string' && !PY_BLANK.test(row.text)) {
    return row as ParsedRow
  }
  return null
}
