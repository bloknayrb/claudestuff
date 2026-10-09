import type { RenderViewport } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { MAIN_SCREEN, NARROW, SAMPLE, WIDE, decide, mountBand, pendingIds, start, world } from './world'

// Surfacing depends on the last band draw's viewport, not on the surface that drew it, so these tests
// mount the terminal band only; the band's drawing per surface is looped in surface.test.tsx.

test('the tool is registered at session.start', async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.tools).toEqual(['decide'])
})

test('a valid call answers at once with the receipt and queues a card', async ($, on) => {
  world(on)
  await start($)
  expect((await decide($)).result).toBe("Logged as decision #1. Keep going on what doesn't depend on it; the answer arrives as a message.")
  expect((await decide($, { ...SAMPLE, question: 'Two?' })).result).toContain('decision #2')
  expect(await pendingIds($)).toEqual([1, 2])
})

test('an invalid call is denied, names the field, and queues nothing', async ($, on) => {
  world(on)
  await start($)
  const { why_yours: _drop, ...noWhyYours } = SAMPLE
  const denied = await decide($, noWhyYours)
  expect(denied.deny).toContain('why_yours')
  expect((await decide($, { ...SAMPLE, recommend: 2 })).deny).toContain('recommend must be 0 to 1')
  expect(await pendingIds($)).toEqual([])
})

test('fullscreen and wide: the pane opens unasked, without focus, and no toast', async ($, on) => {
  const w = world(on)
  await start($)
  await mountBand($, 'terminal', WIDE)
  await decide($)
  expect(w.opens).toEqual([{ id: 'bridge' }])
  expect(w.toasts).toEqual([])
  // Re-synced from the engine's record before it was trusted.
  expect(w.paneQueries).toBeGreaterThan(0)
  await decide($, { ...SAMPLE, question: 'Again?' })
  expect(w.opens).toHaveLength(1)
})

// The band is the notice of a queued decision; no toast is raised for one.
async function hasBand($: Engine, viewport: RenderViewport): Promise<boolean> {
  const band = await mountBand($, 'terminal', viewport)
  const found = (await band.find({ key: 'bridge-band' })) !== undefined
  await band.unmount()
  return found
}

for (const [name, viewport] of [['narrow', NARROW], ['main screen', MAIN_SCREEN]] as const) {
  test(`${name}: no pane, no toast, and the band counts the decisions`, async ($, on) => {
    const w = world(on)
    await start($)
    await mountBand($, 'terminal', viewport)
    await decide($)
    await decide($, { ...SAMPLE, question: 'Again?' })
    expect(w.opens).toEqual([])
    expect(w.toasts).toEqual([])
    expect(await hasBand($, viewport)).toBe(true)
  })
}

test('fullscreen unknown (the surface did not say): the band, and no toast', async ($, on) => {
  const w = world(on)
  const viewport = { columns: 160, rows: 50 }
  await start($)
  await mountBand($, 'terminal', viewport)
  await decide($)
  expect(w.opens).toEqual([])
  expect(w.toasts).toEqual([])
  expect(await hasBand($, viewport)).toBe(true)
})

test('wide but the engine did not place it: closed again, the band, and no toast', async ($, on) => {
  const w = world(on, { placed: false })
  await start($)
  await mountBand($, 'terminal', WIDE)
  await decide($)
  expect(w.opens).toEqual([{ id: 'bridge' }])
  expect(w.closes).toEqual(['bridge'])
  expect(w.toasts).toEqual([])
  expect(await hasBand($, WIDE)).toBe(true)
})

test('once queued, the receipt comes back even if surfacing fails', async ($, on) => {
  const w = world(on)
  await start($)
  await mountBand($, 'terminal', WIDE)
  w.openRefusal = 'refused in test'
  const sent = await decide($)
  expect(sent.result).toContain('decision #1')
  expect(sent.deny).toBeUndefined()
  expect(await pendingIds($)).toEqual([1])
  expect(JSON.parse(w.writes.at(-1)?.text ?? '{}').lastError).not.toBeNull()
})
