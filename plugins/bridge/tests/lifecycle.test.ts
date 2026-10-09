import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { SAMPLE, decide, norm, openWithCommand, pendingIds, start, world } from './world'

async function end($: Engine, reason: 'clear' | 'resume' | 'other', sessionId = 'sess-1') {
  await $.session.end({ reason, sessionId, resume: { id: sessionId } } as Parameters<Engine['session']['end']>[0])
}

for (const reason of ['clear', 'resume'] as const) {
  test(`${reason} empties the queue, restarts ids at 1 and closes an open pane`, async ($, on) => {
    const w = world(on)
    await start($)
    await decide($)
    await decide($, { ...SAMPLE, question: 'B?' })
    await openWithCommand($)
    await end($, reason)
    expect(await pendingIds($)).toEqual([])
    expect(w.closes).toContain('bridge')
    // The tool needs no session.start to keep working (none fires after /clear).
    expect((await decide($)).result).toContain('decision #1')
  })
}

test('a session end that exits keeps the queue', async ($, on) => {
  world(on)
  await start($)
  await decide($)
  await end($, 'other')
  expect(await pendingIds($)).toEqual([1])
})

test('after /clear the first main turn writes the new session heartbeat', async ($, on) => {
  const w = world(on)
  await start($)
  await end($, 'clear')
  w.sessionId = 'sess-2'
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await w.clock.settle()
  expect(norm(w.writes.at(-1)?.path ?? '').endsWith('/.claude/state/mods/bridge/sess-2.json')).toBe(true)
})

// fs.* hooks see a native path: '/home/tester/...' arrives with a drive letter and backslashes.
test('HOME is the fallback', async ($, on) => {
  const w = world(on, { env: { HOME: '/home/tester' } })
  await start($)
  expect(norm(w.writes.at(-1)?.path ?? '').endsWith('home/tester/.claude/state/mods/bridge/sess-1.json')).toBe(true)
})

test('with no home at all the start still succeeds and writes nothing', async ($, on) => {
  const w = world(on, { env: {} })
  await start($)
  expect(w.writes).toEqual([])
  expect(w.tools).toEqual(['decide'])
})
