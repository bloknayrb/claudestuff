import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { command, mountPane, openIds, say, start, turn, verdict, world } from './world'

async function call($: Engine, tool: string, input: Record<string, unknown>): Promise<string> {
  const run = $.tool.call as unknown as (e: Record<string, unknown>) => Promise<{ result?: unknown; deny?: string }>
  const r = await run({ tool: `mcp__docket__${tool}`, ...input })
  return typeof r.result === 'string' ? r.result : `DENY ${r.deny ?? ''}`
}

test('Claude closes a duplicate through the tool: shown as Claude\'s in the list and the pane, and reopenable', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Merge the docs PR')
  await command($, 'add Merge the docs PR today')
  const out = await call($, 'close', { id: '#2', kind: 'duplicate-of:#1', reason: 'same ask' })
  expect(out.startsWith('Docket: Closed #2')).toBe(true)
  expect(await openIds($)).toEqual([1])
  const list = await call($, 'list', { presenting: '#2' })
  expect(list.includes('closed by Claude: duplicate of #1: same ask')).toBe(true)
  expect(/\(you[ :]/.test(list)).toBe(false)
  const ui = await mountPane($, 'terminal')
  expect((await ui.find({ key: 'docket-show-closed' }))?.props.label).toBe('1 closed (1 by Claude) · show')
  await ui.press({ key: 'docket-show-closed' })
  expect(await ui.find({ type: 'Text', text: '↳ closed by Claude: duplicate of #1: same ask' })).toBeDefined()
  await ui.unmount()
  void w
})

test('a subagent can read the list but never change it', async ($, on) => {
  world(on)
  await start($)
  await command($, 'add Renew the domain')
  expect((await call($, 'close', { id: '#1', kind: 'stale', reason: 'x', agentId: 'a1' })).includes('subagent cannot change')).toBe(true)
  expect((await call($, 'annotate', { id: '#1', note: 'x', agentId: 'a1' })).includes('subagent cannot change')).toBe(true)
  expect(await openIds($)).toEqual([1])
})

test('the batch over the limit: the next list says what was left; it stays until seen and a newer reply is judged', async ($, on) => {
  const w = world(on)
  await start($)
  for (const n of [1, 2, 3, 4, 5]) await command($, `add Settled thing ${n}`)
  await turn($, w, 't1', ['Settled: Settled thing 1, Settled thing 2, Settled thing 3, Settled thing 4, Settled thing 5. Reply "close the settled ones".'])
  w.replies.push(verdict({ resolve: [1, 2, 3, 4, 5].map(id => ({ id, by: 'you', note: 'settled', evidence: 'close the settled ones' })) }))
  await say($, w, 'close the settled ones')
  expect(await openIds($)).toEqual([4, 5])
  const list = await call($, 'list', {})
  expect(list.includes('The user\'s last reply ("close the settled ones") closed #1, #2, #3. Left open by the 3-per-reply limit: #4, #5.')).toBe(true)
  const ui = await mountPane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: 'Your last reply closed 3; Docket left #4, #5 open (it closes at most 3 per reply).' })).toBeDefined()
  await ui.unmount()
  // Claude finishes the batch, citing the reply.
  expect((await call($, 'close', { id: '#4', kind: 'user-asked', reason: 'left by the limit', cite: 'close the settled ones' })).startsWith('Docket: Closed #4')).toBe(true)
  // A newer reply clears the line, now that Claude has seen it.
  w.replies.push(verdict({}))
  await say($, w, 'and the last one too, Settled thing 5')
  expect((await call($, 'list', {})).includes('Left open by the 3-per-reply limit')).toBe(false)
})
