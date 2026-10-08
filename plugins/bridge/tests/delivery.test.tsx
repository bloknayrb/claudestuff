import { expect, test } from 'claude-code/testing'

import { ARM_DELAY_MS } from '../hooks/ui'
import { parseRowStrict } from './strict-row'
import {
  NARROW, SAMPLE, SURFACES, WAKE, decide, endTurn, mountBand, mountPane, openWithCommand, pendingIds, press, runTurn,
  start, step, wakes, world,
} from './world'

const row = (id: number, label: string) =>
  `Bridge decision: {"id":${id},"question":"Which database?","choice":"label","label":"${label}"}`

test('idle: a pick appends the row and submits one plugin-framed wake', async ($, on) => {
  const w = world(on)
  await start($)
  let id = 0
  for (const surface of SURFACES) {
    await decide($)
    id += 1
    // The previous surface's answer paused the keys; a press inside the pause is swallowed.
    await w.clock.advance(ARM_DELAY_MS)
    const ui = await mountPane($, surface)
    await press(ui, w, `pick-${id}-1`)
    await ui.unmount()
    expect(w.appends.at(-1)).toBe(row(id, 'SQLite'))
    expect(wakes(w)).toBe(id)
    expect(w.prompts.at(-1)?.origin).toBe('plugin')
    await runTurn($, w, `wake-${id}`)
    expect(wakes(w)).toBe(id)
  }
})

test('Make it so (button) delivers the recommended label', async ($, on) => {
  const w = world(on)
  await start($)
  let id = 0
  for (const surface of SURFACES) {
    await decide($, { ...SAMPLE, recommend: 1 })
    id += 1
    await w.clock.advance(ARM_DELAY_MS)
    const ui = await mountPane($, surface)
    await press(ui, w, `make-${id}`)
    await ui.unmount()
    expect(w.appends.at(-1)).toBe(row(id, 'SQLite'))
    await runTurn($, w, `wake-${id}`)
  }
})

test('Other round-trips the exact text; blank text (by Python whitespace) sends nothing and keeps the field', async ($, on) => {
  const w = world(on)
  await start($)
  let id = 0
  for (const surface of SURFACES) {
    await decide($)
    id += 1
    await w.clock.advance(ARM_DELAY_MS)
    const ui = await mountPane($, surface)
    await press(ui, w, `other-${id}`)
    for (const blank of ['   ', '\u0085', '\u001c\t']) {
      await ui.input({ key: `other-text-${id}`, text: blank })
      await w.clock.settle()
      expect(w.appends).toHaveLength(id - 1)
      expect(await ui.find({ key: `other-text-${id}` })).toBeDefined()
    }
    const text = 'She said "go" \u00bb now\nand "choice":"label" too'
    await ui.input({ key: `other-text-${id}`, text })
    await w.clock.settle()
    await ui.unmount()
    expect(parseRowStrict(w.appends.at(-1) ?? '')).toEqual({ id, question: 'Which database?', choice: 'other', text })
    await runTurn($, w, `wake-${id}`)
  }
})

// Concurrency, not drawing: one surface is enough for the next three tests.
test('a double press delivers once', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  const ui = await mountPane($, 'terminal')
  await Promise.all([ui.press({ key: 'pick-1-0' }), ui.press({ key: 'make-1' })])
  await w.clock.settle()
  await ui.unmount()
  expect(w.appends).toHaveLength(1)
  expect(wakes(w)).toBe(1)
})

test('two answers while idle share one wake', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  await decide($, { ...SAMPLE, question: 'Which database?' })
  const ui = await mountPane($, 'terminal')
  await press(ui, w, 'pick-1-0')
  await w.clock.advance(ARM_DELAY_MS)
  await press(ui, w, 'pick-2-0')
  await ui.unmount()
  expect(w.appends).toHaveLength(2)
  expect(wakes(w)).toBe(1)
})

const PAUSED_LINE = 'Keys paused a moment: let go of the key.'

async function isPaused(ui: { find: (q: { type: string; text: string }) => Promise<unknown> }): Promise<boolean> {
  return (await ui.find({ type: 'Text', text: PAUSED_LINE })) !== undefined
}

// The pause is a debounce: the next card's keys stay bound, but a press during the pause answers
// nothing and restarts it, so a held key (which keeps repeating) never lands on the card. One surface is
// enough: the pause is state and a press, and the line it draws is the same on every surface.
test('a press during the key pause answers nothing and restarts the pause; an earlier timer does not lift it', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  await decide($, { ...SAMPLE, question: 'Second?' })
  const ui = await mountPane($, 'terminal')
  await press(ui, w, 'make-1')
  expect(w.appends).toHaveLength(1)
  expect((await ui.find({ key: 'make-2' }))?.props.hotkey).toBe('m')
  expect(await isPaused(ui)).toBe(true)
  // A press 100 ms before the answer's pause would end.
  const early = ARM_DELAY_MS - 100
  await w.clock.advance(early)
  await press(ui, w, 'make-2')
  expect(w.appends).toHaveLength(1)
  // ARM_DELAY_MS after the answer: its own timer has fired, but the press at `early` pushed the end to
  // early + ARM_DELAY_MS.
  await w.clock.advance(100)
  expect(await isPaused(ui)).toBe(true)
  await press(ui, w, 'pick-2-0')
  expect(w.appends).toHaveLength(1)
  // That press at ARM_DELAY_MS moved the end to 2 * ARM_DELAY_MS; a held key keeps the pause alive
  // indefinitely.
  await w.clock.advance(ARM_DELAY_MS - 1)
  expect(await isPaused(ui)).toBe(true)
  await w.clock.advance(1)
  expect(await isPaused(ui)).toBe(false)
  await press(ui, w, 'make-2')
  await ui.unmount()
  expect(w.appends).toHaveLength(2)
  expect(await pendingIds($)).toEqual([])
})

// A held key, as the dogfood saw it (D9): the first auto-repeat comes 500 ms after the press (Windows
// KeyboardDelay 1), then one every ~33 ms. The kit presses by Button key, so each repeat presses the
// next card's button: the answered card's own button returns early and would pass at any pause.
test('a held key does not answer the next card: its repeats only extend the pause', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  await decide($, { ...SAMPLE, question: 'Second?' })
  const ui = await mountPane($, 'terminal')
  await press(ui, w, 'make-1')
  expect(w.appends).toHaveLength(1)
  await w.clock.advance(500)
  await press(ui, w, 'make-2')
  // Checked here too: once #2 is answered its button is gone, and a later repeat could not be pressed.
  expect(w.appends).toHaveLength(1)
  for (let held = 33; held <= 1000; held += 33) {
    await w.clock.advance(33)
    await press(ui, w, 'make-2')
  }
  expect(w.appends).toHaveLength(1)
  // Let go: the pause ends ARM_DELAY_MS after the last repeat, not a moment before.
  await w.clock.advance(ARM_DELAY_MS - 1)
  expect(await isPaused(ui)).toBe(true)
  await w.clock.advance(1)
  expect(await isPaused(ui)).toBe(false)
  await ui.unmount()
  expect(await pendingIds($)).toEqual([2])
})

test('during a turn: append only; a later main step reads it, so no wake', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  await $.turn.start({ text: 'work', turnId: 't1' })
  const ui = await mountPane($, 'terminal')
  await press(ui, w, 'pick-1-0')
  await ui.unmount()
  expect(wakes(w)).toBe(0)
  await step($, 't1')
  await endTurn($, w, 't1', 'answer')
  expect(wakes(w)).toBe(0)
})

// The race guard's defining case: the row lands while the final step's request is in flight.
// That request was built without it, so the step must not mark it read, and the answered end wakes once.
test('a press during the final step wakes once when the turn answers', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  await $.turn.start({ text: 'work', turnId: 't1' })
  w.stepHoldMs = 100
  const stepping = step($, 't1')
  await w.clock.settle()
  const ui = await mountPane($, 'terminal')
  await press(ui, w, 'pick-1-0')
  await ui.unmount()
  expect(wakes(w)).toBe(0)
  await w.clock.advance(100)
  await stepping
  await endTurn($, w, 't1', 'answer')
  expect(wakes(w)).toBe(1)
})

test('during a turn with no later step: the answer-complete wakes once, and only once', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  await $.turn.start({ text: 'work', turnId: 't1' })
  await step($, 't1')
  const ui = await mountPane($, 'terminal')
  await press(ui, w, 'pick-1-0')
  await ui.unmount()
  await endTurn($, w, 't1', 'answer')
  expect(wakes(w)).toBe(1)
  // The wake's turn ends without a step that read the row (say it was cut short): no second wake.
  await $.turn.start({ text: WAKE, turnId: 't2' })
  await endTurn($, w, 't2', 'answer')
  expect(wakes(w)).toBe(1)
})

test('a subagent step does not mark the row read', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  await $.turn.start({ text: 'work', turnId: 't1' })
  const ui = await mountPane($, 'terminal')
  await press(ui, w, 'pick-1-0')
  await ui.unmount()
  await step($, 'sub-turn', 'agent-1')
  await endTurn($, w, 'sub-turn', 'answer', 'report', 'agent-1')
  expect(wakes(w)).toBe(0)
  await endTurn($, w, 't1', 'answer')
  expect(wakes(w)).toBe(1)
})

for (const reason of ['aborted', 'error', 'refusal'] as const) {
  test(`after ${reason}: no wake, not even for an answer given later while idle`, async ($, on) => {
    const w = world(on)
    await start($)
    await decide($)
    await decide($, { ...SAMPLE, question: 'Two?' })
    await $.turn.start({ text: 'work', turnId: 't1' })
    const ui = await mountPane($, 'terminal')
    await press(ui, w, 'pick-1-0')
    await endTurn($, w, 't1', reason)
    expect(wakes(w)).toBe(0)
    await w.clock.advance(ARM_DELAY_MS)
    await press(ui, w, 'pick-2-0')
    await ui.unmount()
    expect(w.appends).toHaveLength(2)
    expect(wakes(w)).toBe(0)
    // The user's next prompt starts a turn; its first step reads both rows, and nothing wakes after.
    await runTurn($, w, 't2')
    expect(wakes(w)).toBe(0)
  })
}

test('a refused wake retries once from a timer, then toasts', async ($, on) => {
  const w = world(on)
  w.dropWakes = true
  await start($)
  await decide($)
  const ui = await mountPane($, 'terminal')
  await press(ui, w, 'pick-1-0')
  await ui.unmount()
  expect(w.appends).toHaveLength(1)
  expect(w.toasts.filter(t => t.includes('next prompt'))).toHaveLength(0)
  await w.clock.advance(500)
  expect(w.toasts.filter(t => t.includes('next prompt'))).toHaveLength(1)
})

// Regression guard. The plugin's own close runs none of its ui.close hook, so a stale
// isPaneUp would hide the band and every later toast.
test('answering the last card by key closes the pane, and the next decision is surfaced again', async ($, on) => {
  const w = world(on)
  await start($)
  const narrow = await mountBand($, 'terminal', NARROW)
  await narrow.unmount()
  await decide($)
  await openWithCommand($)
  const ui = await mountPane($, 'terminal')
  await press(ui, w, 'pick-1-0')
  await ui.unmount()
  expect(w.closes).toEqual(['bridge'])
  await runTurn($, w, 'wake-1')
  await decide($, { ...SAMPLE, question: 'Two?' })
  expect(w.toasts.at(-1)).toBe('Bridge: decision #2 queued \u00b7 /bridge to answer')
  for (const surface of SURFACES) {
    const band = await mountBand($, surface, NARROW)
    expect(await band.find({ key: 'bridge-band' })).toBeDefined()
    await band.unmount()
  }
  expect(await pendingIds($)).toEqual([2])
})
