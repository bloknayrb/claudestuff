import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { ITEM_41, ITEM_42, MSG_41, MSG_42 } from './fixtures'
import { command, openIds, say, start, turn, verdict, world } from './world'
import type { World } from './world'

// The 2026-11-05 mislabel, replayed with scripted verdicts shaped like the judge's answers then (the
// messages are synthetic): "option 2", typed for #28, was read by the full check of the next turn
// against #41's options and closed #41 as "Chose option 2"; "1", typed for #41, then closed #42 the
// same way. Items 1, 2, 3 here stand for #28, #41, #42.

const ITEM_28 = 'Decide whether the export menu shows a file-size estimate'
const MSG_28 = `Recorded: the export defaults stay as they are.

---

**#28: "${ITEM_28}"**

1. **No estimate.** The menu stays as it is.
2. **Show the estimate.** A size hint beside each format in the menu.`

async function list($: Engine, presenting?: string): Promise<string> {
  const call = $.tool.call as unknown as (e: Record<string, unknown>) => Promise<{ result?: unknown }>
  const r = await call({ tool: 'mcp__docket__list', ...(presenting === undefined ? {} : { presenting }) })
  return typeof r.result === 'string' ? r.result : ''
}

async function setUp($: Engine, w: World) {
  await start($)
  await command($, `add ${ITEM_28}`)
  await command($, `add ${ITEM_41}`)
  await command($, `add ${ITEM_42}`)
  // Claude presents #28; the user answers "option 2"; the judge closes #28 from it.
  await list($, '#1')
  await turn($, w, 't1', [MSG_28])
  w.replies.push(verdict({ resolve: [{ id: 1, by: 'you', note: 'Add the count', evidence: 'option 2' }] }))
  await say($, w, 'option 2')
}

test('the exact case: an earlier reply is never read against the next item\'s options', async ($, on) => {
  const w = world(on)
  await setUp($, w)
  expect(await openIds($)).toEqual([2, 3])
  // Claude presents #41. The full check of that turn is handed the verdict the judge gave then.
  await list($, '#2')
  const before = w.calls.length
  w.replies.push(verdict({ resolve: [{ id: 2, by: 'you', note: 'Chose option 2: switch to dark mode when asked', evidence: 'option 2' }] }))
  await turn($, w, 't2', [MSG_41])
  const full = w.calls[before]?.prompt ?? ''
  expect(full.includes('Keep the default')).toBe(true)
  expect(full.includes('option 2')).toBe(false)
  expect(w.calls.length).toBe(before + 1)
  expect(await openIds($)).toEqual([2, 3])
})

test('a reply typed while its turn\'s full check runs is judged once, after it, alone; two replies, two checks', async ($, on) => {
  const w = world(on)
  await setUp($, w)
  await list($, '#2')
  let release: () => void = () => {}
  w.gate = new Promise<void>(r => { release = r })
  w.replies.push(verdict({}))
  const ending = turn($, w, 't2', [MSG_41])
  await w.clock.settle()
  const before = w.calls.length
  await say($, w, '1')
  await say($, w, 'and keep the banner off')
  // Both wait on the full check in flight; nothing else has run.
  expect(w.calls.length).toBe(before)
  w.replies.push(verdict({ resolve: [{ id: 2, by: 'you', note: 'x', evidence: '1' }] }), verdict({}))
  release()
  w.gate = null
  await ending
  await w.clock.settle()
  const checks = w.calls.slice(before)
  expect(checks.length).toBe(2)
  expect(checks.every(c => c.prompt.includes('resolve-only'))).toBe(true)
  expect(checks[0]?.prompt.includes('and keep the banner off')).toBe(false)
  expect(checks[1]?.prompt.includes('and keep the banner off')).toBe(true)
  expect(await openIds($)).toEqual([3])
})

test('the exact case: "1" closes #41 as option 1, its own label, whatever the judge wrote', async ($, on) => {
  const w = world(on)
  await setUp($, w)
  await list($, '#2')
  w.replies.push(verdict({}))
  await turn($, w, 't2', [MSG_41])
  const before = w.calls.length
  w.replies.push(verdict({ resolve: [{ id: 2, by: 'you', note: 'Chose option 2: switch to dark mode when asked', evidence: '1' }] }))
  await say($, w, '1')
  const check = w.calls[before]?.prompt ?? ''
  expect(check.includes('resolve-only')).toBe(true)
  expect(check.includes('1. **Keep the default (recommended).**')).toBe(true)
  expect(await openIds($)).toEqual([3])
  const shown = await list($, '#2')
  expect(shown.includes('you chose option 1, "Keep the default (recommended)"')).toBe(true)
  expect(shown.includes('Chose option 2')).toBe(false)

  // Claude presents #42; the full check of that turn tries to close it from the "1" as well.
  await list($, '#3')
  const atNext = w.calls.length
  w.replies.push(verdict({ resolve: [{ id: 3, by: 'you', note: 'Chose option 1: keep the cache', evidence: '1' }] }))
  await turn($, w, 't3', [MSG_42])
  expect(await openIds($)).toEqual([3])
  // One full check, and no check carried the "1" again.
  expect(w.calls.length).toBe(atNext + 1)
  expect(w.calls.slice(atNext).some(c => c.prompt.includes('<user_text>'))).toBe(false)
})
