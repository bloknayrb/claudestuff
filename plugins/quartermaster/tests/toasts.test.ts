import { describe, expect, test } from 'claude-code/testing'
import { clockText, windowKey } from '../hooks/pace'
import { MIN, T0, fiveHourAt, measure, world } from './harness'

const RESET = T0 + 180 * MIN
const toast = (pct: number, reset = RESET) =>
  `Quartermaster: five-hour window at ${pct}%, resets ${clockText(reset)}; pace unknown.`

describe('threshold toasts', () => {
  test('50, 75 and 90, once each per window', async ($, on) => {
    const w = world(on)
    for (const pct of [49, 51, 52, 76, 77, 95, 96]) await $.session.measure(measure([fiveHourAt(pct)]))
    expect(w.toasts).toEqual([toast(51), toast(76), toast(95)])
  })

  test('a jump across thresholds toasts once and marks them all', async ($, on) => {
    const w = world(on)
    await $.session.measure(measure([fiveHourAt(80)]))
    await $.session.measure(measure([fiveHourAt(85)]))
    expect(w.toasts).toEqual([toast(80)])
    expect((w.store.get('toasts') as Record<string, number[]>)[windowKey(RESET)]).toEqual([50, 75])
  })

  test('a new window re-arms the thresholds', async ($, on) => {
    const w = world(on)
    await $.session.measure(measure([fiveHourAt(60)]))
    const nextReset = RESET + 300 * MIN
    await $.session.measure(measure([fiveHourAt(55, nextReset)]))
    expect(w.toasts).toEqual([toast(60), toast(55, nextReset)])
  })

  test('a threshold another session already toasted stays quiet', async ($, on) => {
    const w = world(on, { store: { toasts: { [windowKey(RESET)]: [50] } } })
    await $.session.measure(measure([fiveHourAt(55)]))
    expect(w.toasts).toEqual([])
  })
})
