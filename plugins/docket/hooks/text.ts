// Pure text helpers: display sanitising, and the normalising the verbatim checks match under.

// ESC-introduced sequences (CSI, OSC to BEL or ST, and two-byte escapes), then any C0/C1 control,
// bidi controls and zero-width characters. A model string can carry any of them; the pane draws
// plain text only.
const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g
const CONTROLS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g

export function sanitise(text: string, max: number): string {
  const flat = text.replace(ANSI, '').replace(CONTROLS, ' ').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim()
  return clip(flat, max)
}

export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  // Never cut through a surrogate pair.
  let end = max - 1
  const code = text.charCodeAt(end - 1)
  if (code >= 0xd800 && code <= 0xdbff) end -= 1
  return `${text.slice(0, end)}…`
}

// What the verbatim checks compare: whitespace collapsed, curly quotes and dashes straightened,
// invisible characters dropped. Case is kept.
export function normalise(text: string): string {
  return text
    .replace(INVISIBLE, '')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
}

// True when `needle` (normalised, non-empty) occurs in `hay` (normalised).
export function occursIn(needle: string, hay: string): boolean {
  const n = normalise(needle)
  return n.length > 0 && normalise(hay).includes(n)
}

// The go-ahead and refusal words a bare reply is made of. A reply made only of these (and "please",
// punctuation) is bare: it names no item, so code decides which item it can close.
const BARE_PHRASES = [
  'make it so', 'engage', 'yes', 'yep', 'yeah', 'ok', 'okay', 'do it', 'go ahead', 'sounds good',
  'approved', 'ship it', 'lgtm', 'sure', 'no', 'nope', "don't", 'dont', 'skip it', 'not now', 'please',
]
// Longest first, so "do it" is not read as "do" plus a stray "it".
const PHRASES_BY_LENGTH = [...BARE_PHRASES].sort((a, b) => b.length - a.length)

export function isBare(text: string): boolean {
  const flat = normalise(text).toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim()
  if (flat === '' || flat.length > 40) return false
  let rest = flat
  while (rest !== '') {
    const hit = PHRASES_BY_LENGTH.find(p => rest === p || rest.startsWith(`${p} `))
    if (hit === undefined) return false
    rest = rest.slice(hit.length).trim()
  }
  return true
}
