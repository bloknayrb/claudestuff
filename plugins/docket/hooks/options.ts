// Pure: option replies ("1", "option 2", "b, with X") and the option lists they pick from. Code, not the
// judge, reads which option a reply picked: on 2026-11-05 the judge recorded a "1" as option 2.

import { normalise } from './text'

export type OptionPick = { key: string; tail: string }
export type OptionLabel = { key: string; label: string }

// Keys a reply may name: 1-20, or a single letter a-h.
const KEY = String.raw`(\d{1,2}|[a-h])`
// What may come before the key. Not '#': "#2" is a docket or GitHub number as often as an option.
const LEAD = String.raw`(?:(?:option|choice|number|go with|pick)\s+)?`
// After the key: nothing, a closing mark, or a tail introduced by punctuation or one of a few words.
const PICK = new RegExp(String.raw`^${LEAD}${KEY}\s*[.)]?\s*(?:$|[,;:-]\s*(.*)$|\s+((?:but|please|with|thanks|and keep)\b.*)$)`, 'i')

// A reply made of one option key, with an optional lead word and tail. Prose that only starts with a
// key ("a good idea", "1 more thing") and several keys ("1 and 3", "1, 3") are not picks.
export function optionPick(reply: string): OptionPick | undefined {
  const flat = normalise(reply)
  if (flat === '' || flat.length > 200) return undefined
  const m = PICK.exec(flat)
  if (m === null) return undefined
  const key = (m[1] as string).toLowerCase()
  const tail = (m[2] ?? m[3] ?? '').trim()
  if (/^(?:(?:and|or|&)\s*)?(?:\d{1,2}|[a-h])\b/i.test(tail)) return undefined
  if (/^\d+$/.test(key) && (Number(key) < 1 || Number(key) > 20)) return undefined
  return { key, tail }
}

// One option line: "1. text", "2) text", "a. text", a bullet or bold around the key; or an option
// heading or bold lead, "### Option A: text", "**Option 1:** text".
const ITEM = /^\s{0,3}(?:[-*]\s+)?(?:\*\*)?(\d{1,2}|[a-hA-H])[.)](?:\*\*)?\s+(.+)$/
const HEADED = /^\s{0,3}(?:#{1,4}\s+|\*\*)?Option\s+(\d{1,2}|[A-Ha-h])\s*[:.)—-]?\s*(?:\*\*)?\s*[:.—-]?\s*(.*)$/

// The label of a list item: its leading **bold** run, or its first sentence, clipped.
function labelOf(text: string): string {
  const t = text.trim()
  const bold = /^\*\*(.+?)\*\*/.exec(t)
  const raw = bold !== null ? (bold[1] as string) : (/^(.+?[.!?])(?:\s|$)/.exec(t)?.[1] ?? t)
  const clean = raw.replace(/[*_`#]/g, '').replace(/[\s.:;,—–-]+$/, '').trim()
  return clean.length > 80 ? `${clean.slice(0, 79)}…` : clean
}

const nextKey = (key: string): string => (/^\d+$/.test(key) ? String(Number(key) + 1) : String.fromCharCode(key.charCodeAt(0) + 1))

export type OptionList = { options: OptionLabel[]; isRepeated: boolean }

// Every option list in a message: runs of items keyed from 1 (or a) up by one. Fenced code, blockquotes
// and table rows are skipped; prose between items does not end a list. A key that comes back inside a
// run ("1. 1. 1.", a markdown habit) marks the list repeated: it can't be read by key.
export function optionLists(message: string): OptionList[] {
  const lists: OptionList[] = []
  // Whether the newest list in `lists` is still open to more items.
  let isOpen = false
  let inFence = false
  for (const line of message.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue }
    if (inFence || /^\s*>/.test(line) || /^\s*\|/.test(line)) continue
    const m = ITEM.exec(line) ?? HEADED.exec(line)
    if (m === null) continue
    const key = (m[1] as string).toLowerCase()
    const label = labelOf(m[2] as string)
    const cur = isOpen ? lists.at(-1) : undefined
    const last = cur?.options.at(-1)
    if (cur !== undefined && last !== undefined && key === nextKey(last.key)) {
      cur.options.push({ key, label })
    } else if (cur !== undefined && last !== undefined && (key === last.key || (cur.options.some(o => o.key === key) && key !== '1' && key !== 'a'))) {
      cur.isRepeated = true
    } else if (key === '1' || key === 'a') {
      lists.push({ options: [{ key, label }], isRepeated: false })
      isOpen = true
    } else {
      isOpen = false
    }
  }
  return lists.filter(l => l.options.length >= 2)
}

// The option a pick names in a message: its label when exactly one list has that key and that list
// isn't repeated. The caller decides whether the message is about the item (R2.3).
export function resolvePick(pick: OptionPick, message: string | undefined): OptionLabel | undefined {
  if (message === undefined || message === '') return undefined
  const hits = optionLists(message).filter(l => l.options.some(o => o.key === pick.key))
  if (hits.length !== 1 || (hits[0] as OptionList).isRepeated) return undefined
  return (hits[0] as OptionList).options.find(o => o.key === pick.key)
}
