import { expect, test } from 'claude-code/testing'

import { sanitise } from '../hooks/text'

// Built from code points so this file holds no raw control or invisible characters.
const ch = (...codes: number[]) => String.fromCodePoint(...codes)

test('sanitise strips ANSI, OSC links, controls, bidi and zero-width characters, and newlines', async () => {
  const esc = ch(0x1b)
  const dirty = `${esc}[31mRed${esc}[0m ${esc}]8;;https://x.example${ch(0x07)}link${esc}]8;;${ch(0x07)} a${ch(0x202e)}b${ch(0x200b)}c\nnext${ch(0x00)}`
  expect(sanitise(dirty, 200)).toBe('Red link abc next')
})

test('sanitise clips without splitting a surrogate pair', async () => {
  const out = sanitise(`ab${ch(0x1f600)}cd`, 4)
  expect(out.endsWith('…')).toBe(true)
  expect(out.includes(ch(0xd83d))).toBe(false)
})
