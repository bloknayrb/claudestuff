import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { SAMPLE, decide, endTurn, pendingIds, runTurn, start, step, wakes, world } from './world'
import type { World } from './world'

const RESOLVED = 'Bridge decision: {"id":1,"question":"Which database?","choice":"label","label":"Postgres"}'
const STILL = 'Bridge: decision #1 is still pending; that prompt did not resolve it.'

type Submit = Parameters<Engine['prompt']['submit']>[0]

function submit($: Engine, text: string, origin: Record<string, unknown>, turnId?: string) {
  return $.prompt.submit({ text, origin, wait: false, ...(turnId === undefined ? {} : { turnId }) } as Submit)
}

// Models the engine's order. Typed while idle, the prompt starts a turn, and next() resolves only once
// that turn has started: the stub holds the submit open while turn.start runs. Typed mid-turn, the prompt
// is queued behind the running turn and no new turn starts. A prompt a hook drops starts no turn.
async function say($: Engine, w: World, text: string, origin: Record<string, unknown> = { kind: 'composer' }, turnId?: string) {
  if (turnId !== undefined) {
    const queued = await submit($, text, origin, turnId)
    await w.clock.settle()
    return queued
  }
  w.submitHoldMs = 100
  const sending = submit($, text, origin)
  await w.clock.settle()
  if (!w.dropTyped) await $.turn.start({ text, turnId: 'u-turn' })
  await w.clock.settle()
  await w.clock.advance(100)
  const r = await sending
  await w.clock.settle()
  w.submitHoldMs = 0
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

test('typed while a turn runs: only the still-pending note, appended at once', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w)
  await $.turn.start({ text: 'more', turnId: 't1' })
  await say($, w, 'make it so', { kind: 'composer' }, 't1')
  expect(typed(w).at(-1)?.context).toEqual([])
  expect(w.appends).toEqual([STILL])
  expect(await pendingIds($)).toEqual([1])
  // The note is never a wake: the typed prompt is itself the turn that reads it.
  await endTurn($, w, 't1', 'answer')
  expect(wakes(w)).toBe(0)
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

// The documented order: next() resolves after the prompt's turn started, so the turn's turn.start runs
// while the hook still waits on it. The row must already be queued then, and land before the first step.
test('turn.start runs while next() is held: the row is appended before the first step, with no wake', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w)
  w.submitHoldMs = 100
  const sending = submit($, 'make it so', { kind: 'composer' })
  await w.clock.settle()
  await $.turn.start({ text: 'make it so', turnId: 'u-turn' })
  await w.clock.settle()
  expect(w.appends).toEqual([RESOLVED])
  await w.clock.advance(100)
  await sending
  await w.clock.settle()
  w.stepAnswers.push('ok')
  await step($, 'u-turn')
  await endTurn($, w, 'u-turn', 'answer', 'ok')
  expect(w.appends).toEqual([RESOLVED])
  expect(await pendingIds($)).toEqual([])
  expect(wakes(w)).toBe(0)
})

test('a dropped prompt: the claim is undone, no row ever lands, and a later go-ahead still works', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w)
  w.dropTyped = true
  await say($, w, 'make it so')
  expect(w.appends).toEqual([])
  expect(await pendingIds($)).toEqual([1])
  await runTurn($, w, 't9')
  expect(w.appends).toEqual([])
  w.dropTyped = false
  await say($, w, 'make it so')
  expect(w.appends).toEqual([RESOLVED])
  expect(await pendingIds($)).toEqual([])
})

test('two go-aheads before a turn starts: both rows are kept and land in order', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w)
  w.submitHoldMs = 100
  const first = submit($, 'make it so', { kind: 'composer' })
  await w.clock.settle()
  await decide($)
  const second = submit($, 'engage', { kind: 'composer' })
  await w.clock.settle()
  await $.turn.start({ text: 'make it so', turnId: 'u-turn' })
  await w.clock.settle()
  await w.clock.advance(100)
  await Promise.all([first, second])
  await w.clock.settle()
  expect(w.appends).toEqual([
    RESOLVED,
    'Bridge decision: {"id":2,"question":"Which database?","choice":"label","label":"Postgres"}',
  ])
  expect(await pendingIds($)).toEqual([])
  expect(wakes(w)).toBe(0)
})

// A drop that arrives after another turn already delivered the row must not reopen the decision: the
// claim stands once its row has been flushed, or a later press would append a second, contradictory answer.
test('a drop after another turn flushed the row leaves the decision answered, with one row', async ($, on) => {
  const w = world(on)
  await oneDecisionThenAnswer($, w)
  w.submitHoldMs = 100
  const sending = submit($, 'make it so', { kind: 'composer' })
  await w.clock.settle()
  await $.turn.start({ text: 'something else', turnId: 'other-turn' })
  await w.clock.settle()
  expect(w.appends).toEqual([RESOLVED])
  w.dropTyped = true
  await w.clock.advance(100)
  await sending
  await w.clock.settle()
  expect(w.appends).toEqual([RESOLVED])
  expect(await pendingIds($)).toEqual([])
})
