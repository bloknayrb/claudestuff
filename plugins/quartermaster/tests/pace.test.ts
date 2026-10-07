import { describe, expect, test } from 'claude-code/testing'
import { clockText, fitCap, matchWindow, windowKey } from '../hooks/pace'
import { MIN, START, T0, fiveHourAt, measure, world } from './harness'

const RESET = T0 + 180 * MIN
const last = (xs: (string | undefined)[]) => xs[xs.length - 1]

describe('pace (pure)', () => {
  test('fitCap needs three readings and growth', () => {
    expect(fitCap([[T0, 10], [T0 + 30 * MIN, 30]])).toBeNull()
    expect(fitCap([[T0, 40], [T0 + 30 * MIN, 40], [T0 + 60 * MIN, 40]])).toBeNull()
    expect(fitCap([[T0, 50], [T0 + 30 * MIN, 30], [T0 + 60 * MIN, 10]])).toBeNull()
    expect(fitCap([[T0, 10], [T0, 20], [T0, 30]])).toBeNull()
    expect(fitCap([[T0, 10], [T0 + 30 * MIN, 30], [T0 + 60 * MIN, 50]])).toBe(T0 + 135 * MIN)
  })

  // Review Focus 4
  test('resetsAt jitter under a minute stays one window, on either side of hh:mm:30', () => {
    const k = windowKey(RESET)
    expect(matchWindow([k], RESET - 300)).toBe(k)
    expect(matchWindow([k], RESET + 400)).toBe(k)
    // Rounding alone splits these two; matching an existing key does not.
    const before = RESET - 30_100
    const after = RESET - 29_900
    expect(windowKey(before)).not.toBe(windowKey(after))
    expect(matchWindow([windowKey(before)], after)).toBe(windowKey(before))
    expect(matchWindow([k], RESET + 300 * MIN)).toBe(windowKey(RESET + 300 * MIN))
  })
})

describe('pace line', () => {
  test('hidden while rateLimits is empty', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    expect(w.status.length).toBeGreaterThan(0)
    expect(last(w.status)).toBeUndefined()
  })

  test('shows — with fewer than three readings', async ($, on) => {
    const w = world(on)
    await $.session.measure(measure([fiveHourAt(10)]))
    await w.clock.advance(30 * MIN)
    await $.session.measure(measure([fiveHourAt(30)]))
    expect(last(w.status)).toBe(`QM pace: — (resets ${clockText(RESET)}) · agents 0`)
  })

  test('shows — when usage is flat', async ($, on) => {
    const w = world(on)
    for (let i = 0; i < 3; i++) {
      await $.session.measure(measure([fiveHourAt(40)]))
      await w.clock.advance(30 * MIN)
    }
    expect(last(w.status)).toBe(`QM pace: — (resets ${clockText(RESET)}) · agents 0`)
  })

  test('projects the cap from a rising line', async ($, on) => {
    const w = world(on)
    for (const pct of [10, 30, 50]) {
      await $.session.measure(measure([fiveHourAt(pct)]))
      if (pct !== 50) await w.clock.advance(30 * MIN)
    }
    expect(last(w.status)).toBe(`QM pace: cap ~${clockText(T0 + 135 * MIN)} (resets ${clockText(RESET)}) · agents 0`)
  })

  test('says no cap before reset when the line reaches 100 after it', async ($, on) => {
    const w = world(on)
    for (const pct of [10, 20, 30]) {
      await $.session.measure(measure([fiveHourAt(pct)]))
      if (pct !== 30) await w.clock.advance(30 * MIN)
    }
    expect(last(w.status)).toBe(`QM pace: no cap before reset (resets ${clockText(RESET)}) · agents 0`)
  })

  test('session start takes a reading and shows the line', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(12)] })
    await $.session.start(START)
    expect(last(w.status)).toBe(`QM pace: — (resets ${clockText(RESET)}) · agents 0`)
    expect((w.store.get('readings') as Record<string, unknown[]>)[windowKey(RESET)]).toEqual([[T0, 12]])
  })

  // Review Focus 5
  test('a reading from each hot reload within a minute is kept once', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(12)] })
    await $.session.start(START)
    await w.clock.advance(20_000)
    await $.session.start(START)
    expect((w.store.get('readings') as Record<string, unknown[]>)[windowKey(RESET)]).toHaveLength(1)
  })

  // Review Focus 4
  test('readings either side of hh:mm:30 land in one window', async ($, on) => {
    const w = world(on)
    await $.session.measure(measure([fiveHourAt(10, RESET - 30_100)]))
    await $.session.measure(measure([fiveHourAt(11, RESET - 29_900)]))
    const readings = w.store.get('readings') as Record<string, unknown[]>
    expect(Object.keys(readings)).toEqual([windowKey(RESET - 30_100)])
    expect(Object.values(readings)[0]).toHaveLength(2)
  })

  // Review Focus 4
  test('a new window starts its pace afresh and the store keeps two windows', async ($, on) => {
    const w = world(on)
    for (const pct of [10, 30, 50]) {
      await $.session.measure(measure([fiveHourAt(pct)]))
      await w.clock.advance(30 * MIN)
    }
    const nextReset = RESET + 300 * MIN
    await $.session.measure(measure([fiveHourAt(1, nextReset)]))
    expect(last(w.status)).toBe(`QM pace: — (resets ${clockText(nextReset)}) · agents 0`)
    await $.session.measure(measure([fiveHourAt(1, nextReset + 300 * MIN)]))
    const keys = Object.keys(w.store.get('readings') as object)
    expect(keys.sort()).toEqual([windowKey(nextReset), windowKey(nextReset + 300 * MIN)].sort())
  })
})
