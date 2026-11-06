import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { ITEM_41, ITEM_42, MSG_41, MSG_42 } from './fixtures'
import { command, openIds, say, start, turn, verdict, world } from './world'
import type { World } from './world'

// The tandem session of 2026-11-05, replayed with scripted verdicts (the judge's own answers then):
// "option 2", typed for #28, was read by the full check of the next turn against #41's options and
// closed #41 as "Chose option 2"; "1", typed for #41, then closed #42 the same way. Items 1, 2, 3 here
// stand for #28, #41, #42.

const ITEM_28 = 'Decide whether to add an unseen-reply count on the Annotations tab before PR 4'
const MSG_28 = `Recorded: Claude will be told when you accept its reply rewrite.

---

**#28: "${ITEM_28}"**

1. **No count.** The tab stays as it is.
2. **Add the count.** A badge on the Annotations tab and a dot on the document tab.`

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
  w.replies.push(verdict({ resolve: [{ id: 2, by: 'you', note: 'Chose option 2: reopen the comment when an answer arrives', evidence: 'option 2' }] }))
  await turn($, w, 't2', [MSG_41])
  const full = w.calls[before]?.prompt ?? ''
  expect(full.includes('Stay silent')).toBe(true)
  expect(full.includes('option 2')).toBe(false)
  expect(w.calls.length).toBe(before + 1)
  expect(await openIds($)).toEqual([2, 3])
})

test('the exact case: "1" closes #41 as option 1, its own label, whatever the judge wrote', async ($, on) => {
  const w = world(on)
  await setUp($, w)
  await list($, '#2')
  w.replies.push(verdict({}))
  await turn($, w, 't2', [MSG_41])
  const before = w.calls.length
  w.replies.push(verdict({ resolve: [{ id: 2, by: 'you', note: 'Chose option 2: reopen the comment when an answer arrives', evidence: '1' }] }))
  await say($, w, '1')
  const check = w.calls[before]?.prompt ?? ''
  expect(check.includes('resolve-only')).toBe(true)
  expect(check.includes('1. **Stay silent (recommended).**')).toBe(true)
  expect(await openIds($)).toEqual([3])
  const shown = await list($, '#2')
  expect(shown.includes('you chose option 1, "Stay silent (recommended)"')).toBe(true)
  expect(shown.includes('Chose option 2')).toBe(false)

  // Claude presents #42; the full check of that turn tries to close it from the "1" as well.
  await list($, '#3')
  const atNext = w.calls.length
  w.replies.push(verdict({ resolve: [{ id: 3, by: 'you', note: 'Chose option 1: keep the storage', evidence: '1' }] }))
  await turn($, w, 't3', [MSG_42])
  expect(await openIds($)).toEqual([3])
  // One full check, and no check carried the "1" again.
  expect(w.calls.length).toBe(atNext + 1)
  expect(w.calls.slice(atNext).some(c => c.prompt.includes('<user_text>'))).toBe(false)
})
