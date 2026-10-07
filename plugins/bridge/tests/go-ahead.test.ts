import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { SAMPLE, decide, endTurn, pendingIds, runTurn, start, step, wakes, world } from './world'
import type { World } from './world'

const RESOLVED = 'Bridge decision: {"id":1,"question":"Which database?","choice":"label","label":"Postgres"}'
const STILL = 'Bridge: decision #1 is still pending; that prompt did not resolve it.'

async function say($: Engine, w: World, text: string, origin: Record<string, unknown> = { kind: 'composer' }, turnId?: string) {
  const r = await $.prompt.submit({ text, origin, wait: false, ...(turnId === undefined ? {} : { turnId }) } as Parameters<Engine['prompt']['submit']>[0])
  await w.clock.settle()
  return r
}

function typed(w: World) {
  return w.prompts.filter(p => p.origin !== 'plugin')
}

async function oneDecisionThenAnswer($: Engine, w: World, answer = 'Done. Tests pass.') {
  await start($)
  await decide($)
  await runTurn($, w, 't0', answer)
}

test('typed "Make it so!" with one pending and no question: resolves by an appended row, prompt untouched', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w)
  await say($, w, 'Make it so!')
  expect(typed(w).at(-1)).toEqual({ text: 'Make it so!', origin: 'composer', context: [] })
  expect(w.appends).toEqual([RESOLVED])
  expect(await pendingIds($)).toEqual([])
  // The prompt is the turn that reads the row: no wake of Bridge's own.
  expect(wakes(w)).toBe(0)
})

test('Remote Control "engage" resolves too', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w)
  await say($, w, 'engage', { kind: 'bridge' })
  expect(typed(w).at(-1)?.context).toEqual([])
  expect(w.appends).toEqual([RESOLVED])
})

for (const origin of [{ kind: 'plugin', name: 'bridge' }, { kind: 'channel', server: 'discord' }, { kind: 'unclassified' }, { kind: 'sdk' }]) {
  test(`origin ${JSON.stringify(origin)} is ignored`, async ($, on) => {
    const w = world(on)
    await oneDecisionThenAnswer($, w)
    await say($, w, 'make it so', origin)
    expect(w.prompts.at(-1)?.context).toEqual([])
    expect(w.appends).toEqual([])
    expect(await pendingIds($)).toEqual([1])
  })
}

test('two pending: nothing appended, nothing resolved', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  await decide($, { ...SAMPLE, question: 'B?' })
  await runTurn($, w, 't0')
  await say($, w, 'make it so')
  expect(typed(w).at(-1)?.context).toEqual([])
  expect(w.appends).toEqual([])
  expect(await pendingIds($)).toEqual([1, 2])
})

test('none pending: nothing appended', async ($, on) => {
  const w = world(on)
  await start($)
  await runTurn($, w, 't0')
  await say($, w, 'make it so')
  expect(w.appends).toEqual([])
})

test('my last answer asked a question: only the still-pending note row', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w, 'Tests pass. Shall I push?')
  await say($, w, 'make it so')
  expect(typed(w).at(-1)?.context).toEqual([])
  expect(w.appends).toEqual([STILL])
  expect(await pendingIds($)).toEqual([1])
  expect(wakes(w)).toBe(0)
})

test('a question in an earlier text block of the same turn still counts', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  await $.turn.start({ text: 'x', turnId: 't0' })
  w.stepAnswers.push('Shall I push?', 'Done. Tests pass.')
  await step($, 't0')
  await step($, 't0')
  await endTurn($, w, 't0', 'answer', 'Done. Tests pass.')
  await say($, w, 'make it so')
  expect(w.appends).toEqual([STILL])
  expect(await pendingIds($)).toEqual([1])
})

test('a ? only in code or inside a URL still resolves', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w, 'Ran `a?.b`; see https://x.test/p?q=1.\n```\nx ? y : z\n```')
  await say($, w, 'make it so')
  expect(w.appends).toEqual([RESOLVED])
})

test('a ? right after a URL is a question', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w, 'Shall I merge https://github.com/o/r/pull/7?')
  await say($, w, 'make it so')
  expect(w.appends).toEqual([STILL])
  expect(await pendingIds($)).toEqual([1])
})

test('typed while a turn runs: only the still-pending note', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w)
  await $.turn.start({ text: 'more', turnId: 't1' })
  await say($, w, 'make it so', { kind: 'composer' }, 't1')
  expect(typed(w).at(-1)?.context).toEqual([])
  expect(w.appends).toEqual([STILL])
  expect(await pendingIds($)).toEqual([1])
})

test('a longer prompt is not a go-ahead', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w)
  await say($, w, 'make it so, but use SQLite')
  expect(w.appends).toEqual([])
  expect(await pendingIds($)).toEqual([1])
})

test('a prompt a settings hook drops resolves nothing and appends nothing', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w)
  w.dropTyped = true
  await say($, w, 'make it so')
  expect(w.appends).toEqual([])
  expect(await pendingIds($)).toEqual([1])
})
