import { expect, test } from 'claude-code/testing'

import { optionLists, optionPick, resolvePick } from '../hooks/options'
import { MSG_41, MSG_42 } from './fixtures'

const pick = (key: string) => ({ key, tail: '' })
const labels = (message: string) => optionLists(message).map(l => l.options.map(o => `${o.key}=${o.label}`))

test('option picks: keys with lead words and tails', async () => {
  const yes: [string, string, string][] = [
    ['1', '1', ''], ['2.', '2', ''], ['option 2', '2', ''], ['Option 2', '2', ''], ['choice b', 'b', ''],
    ['a', 'a', ''], ['B)', 'b', ''], ['1, with X', '1', 'with X'], ['2 — but keep Y', '2', 'but keep Y'], ['1 please', '1', 'please'],
    ['go with 1', '1', ''], ['  3  ', '3', ''], ['2 but keep the banner', '2', 'but keep the banner'], ['1: fine', '1', 'fine'],
  ]
  for (const [reply, key, tail] of yes) expect(optionPick(reply)).toEqual({ key, tail })
  const no = ['a good idea', '1 more thing', '1 and 3', '1, 3', '1, and 3', 'both', 'the first one', '#2', '#41: 1', 'yes', '0', '21', 'i', '', 'option 2 and 3']
  for (const reply of no) expect(optionPick(reply)).toBe(undefined)
})

test('the #41 message: "1" is Keep the default, "2" is Switch to dark mode', async () => {
  expect(labels(MSG_41)).toEqual([['1=Keep the default (recommended)', '2=Switch to dark mode']])
  expect(resolvePick(pick('1'), MSG_41)).toEqual({ key: '1', label: 'Keep the default (recommended)' })
  expect(resolvePick(pick('2'), MSG_41)).toEqual({ key: '2', label: 'Switch to dark mode' })
  expect(resolvePick(pick('3'), MSG_41)).toBe(undefined)
  expect(resolvePick(pick('3'), MSG_42)?.label).toBe('Leave it')
})

test('ambiguous: two lists with the key, a repeated key, no message', async () => {
  const two = '1. **Alpha.** x\n2. **Beta.** y\n\nAnd separately:\n\n1. Gamma first.\n2. Delta second.'
  expect(resolvePick(pick('1'), two)).toBe(undefined)
  expect(resolvePick(pick('1'), '1. One thing.\n1. Another thing.\n1. A third.')).toBe(undefined)
  expect(resolvePick(pick('1'), undefined)).toBe(undefined)
})

test('fences, blockquotes and tables are not lists; a lone numbered line is not a list', async () => {
  expect(labels('Step 1. do a thing')).toEqual([])
  expect(labels('```\n1. code\n2. code\n```\n> 1. quoted\n> 2. quoted\n| 1. | cell |\n| 2. | cell |')).toEqual([])
  expect(labels('a) First thing. More.\nb) Second thing')).toEqual([['a=First thing', 'b=Second thing']])
})

test('option headings and bold leads are lists', async () => {
  expect(labels('### Option A: Keep it\nwords\n### Option B: Drop it\nwords')).toEqual([['a=Keep it', 'b=Drop it']])
  expect(labels('**Option 1:** Ship now. Then wait.\n\n**Option 2:** Hold for review.')).toEqual([['1=Ship now', '2=Hold for review']])
})

test('a broken sequence ends a list; a long label is clipped', async () => {
  const lists = optionLists(`1. One.\n3. Three.\n1. ${'x'.repeat(100)}\n2. Two.`)
  expect(lists.length).toBe(1)
  expect((lists[0]?.options[0]?.label ?? '').length).toBe(80)
})
