import { describe, expect, test } from 'claude-code/testing'
import {
  clockText,
  dateClockText,
  durationText,
  fitCap,
  forecast,
  matchWindow,
  weekFitReadings,
  windowKey,
  windowText,
} from '../hooks/pace'
import { DAY, MIN, START, T0, command, fiveHourAt, measure, sevenDayAt, world } from './harness'

const RESET = T0 + 180 * MIN
const HOUR = 60 * MIN
const last = (xs: (string | undefined)[]) => xs[xs.length - 1]

describe('pace (pure)', () => {
  test('fitCap needs three readings and growth', () => {
    expect(fitCap([[T0, 10], [T0 + 30 * MIN, 30]])).toBeNull()
    expect(fitCap([[T0, 40], [T0 + 30 * MIN, 40], [T0 + 60 * MIN, 40]])).toBeNull()
    expect(fitCap([[T0, 50], [T0 + 30 * MIN, 30], [T0 + 60 * MIN, 10]])).toBeNull()
    expect(fitCap([[T0, 10], [T0, 20], [T0, 30]])).toBeNull()
    expect(fitCap([[T0, 10], [T0 + 30 * MIN, 30], [T0 + 60 * MIN, 50]])).toBe(T0 + 135 * MIN)
  })

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

  test('times read as the user statusline prints them', () => {
    const at = new Date(2026, 9, 25, 9, 5).getTime()
    expect(clockText(at)).toBe('9:05am')
    expect(clockText(new Date(2026, 9, 25, 0, 0).getTime())).toBe('12:00am')
    expect(clockText(new Date(2026, 9, 25, 12, 30).getTime())).toBe('12:30pm')
    expect(clockText(new Date(2026, 9, 25, 15, 40).getTime())).toBe('3:40pm')
    expect(dateClockText(at)).toBe('Oct 25, 9:05am')
  })

  test('durations round down to two units', () => {
    expect(durationText(25 * MIN + 59_000)).toBe('25m')
    expect(durationText(2 * HOUR + 10 * MIN)).toBe('2h 10m')
    expect(durationText(2 * DAY + 4 * HOUR + 59 * MIN)).toBe('2d 4h')
    expect(durationText(-MIN)).toBe('0m')
  })

  test('the forecast: capped, soon, a time, safe, unknown, and nothing once the reset has passed', () => {
    expect(forecast(null, RESET, 100, T0)).toEqual({ kind: 'capped' })
    expect(forecast(T0 - MIN, RESET, 98, T0)).toEqual({ kind: 'soon' })
    expect(forecast(T0 + MIN, RESET, 98, T0)).toEqual({ kind: 'cap', at: T0 + MIN })
    expect(forecast(RESET + MIN, RESET, 50, T0)).toEqual({ kind: 'safe' })
    expect(forecast(null, RESET, 50, T0)).toEqual({ kind: 'unknown' })
    expect(forecast(null, RESET, 100, RESET)).toEqual({ kind: 'unknown' })
  })

  test('a weekly fit waits for twelve hours of readings', () => {
    const short: [number, number][] = [[T0, 10], [T0 + 6 * HOUR, 20], [T0 + 11 * HOUR, 30]]
    expect(weekFitReadings(short)).toEqual([])
    const long: [number, number][] = [...short, [T0 + 12 * HOUR, 31]]
    expect(weekFitReadings(long)).toEqual(long)
  })
})

describe('pace line', () => {
  test('hidden while rateLimits is empty', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    expect(w.status.length).toBeGreaterThan(0)
    expect(last(w.status)).toBeUndefined()
  })

  test('hidden with fewer than three readings', async ($, on) => {
    const w = world(on)
    await $.session.measure(measure([fiveHourAt(10)]))
    await w.clock.advance(30 * MIN)
    await $.session.measure(measure([fiveHourAt(30)]))
    expect(w.status.filter(s => s !== undefined)).toEqual([])
  })

  test('hidden when usage is flat', async ($, on) => {
    const w = world(on)
    for (let i = 0; i < 3; i++) {
      await $.session.measure(measure([fiveHourAt(40)]))
      await w.clock.advance(30 * MIN)
    }
    expect(w.status.filter(s => s !== undefined)).toEqual([])
  })

  test('projects the cap from a rising line', async ($, on) => {
    const w = world(on)
    for (const pct of [10, 30, 50]) {
      await $.session.measure(measure([fiveHourAt(pct)]))
      if (pct !== 50) await w.clock.advance(30 * MIN)
    }
    expect(last(w.status)).toBe(`QM 5h cap ~${clockText(T0 + 135 * MIN)}`)
  })

  test('hidden when the line reaches 100 only after the reset', async ($, on) => {
    const w = world(on)
    for (const pct of [10, 20, 30]) {
      await $.session.measure(measure([fiveHourAt(pct)]))
      if (pct !== 30) await w.clock.advance(30 * MIN)
    }
    expect(w.status.filter(s => s !== undefined)).toEqual([])
  })

  test('an unchanged line is drawn once, hidden or shown', async ($, on) => {
    const w = world(on)
    for (let i = 0; i < 4; i++) await $.session.measure(measure([fiveHourAt(10 + i)]))
    expect(w.status).toEqual([undefined])
    for (let i = 0; i < 3; i++) await $.session.measure(measure([fiveHourAt(100)]))
    expect(w.status).toEqual([undefined, 'QM 5h capped'])
  })

  test('session start takes a reading', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(12)] })
    await $.session.start(START)
    expect(last(w.status)).toBeUndefined()
    expect((w.store.get('readings') as Record<string, unknown[]>)[windowKey(RESET)]).toEqual([[T0, 12]])
  })

  test('a reading from each hot reload within a minute is kept once', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(12)] })
    await $.session.start(START)
    await w.clock.advance(20_000)
    await $.session.start(START)
    expect((w.store.get('readings') as Record<string, unknown[]>)[windowKey(RESET)]).toHaveLength(1)
  })

  test('readings either side of hh:mm:30 land in one window', async ($, on) => {
    const w = world(on)
    await $.session.measure(measure([fiveHourAt(10, RESET - 30_100)]))
    await $.session.measure(measure([fiveHourAt(11, RESET - 29_900)]))
    const readings = w.store.get('readings') as Record<string, unknown[]>
    expect(Object.keys(readings)).toEqual([windowKey(RESET - 30_100)])
    expect(Object.values(readings)[0]).toHaveLength(2)
  })

  test('a new window starts its pace afresh and the store keeps two windows', async ($, on) => {
    const w = world(on)
    for (const pct of [10, 30, 50]) {
      await $.session.measure(measure([fiveHourAt(pct)]))
      await w.clock.advance(30 * MIN)
    }
    expect(last(w.status)).toContain('QM 5h cap ~')
    const nextReset = RESET + 300 * MIN
    await $.session.measure(measure([fiveHourAt(1, nextReset)]))
    expect(last(w.status)).toBeUndefined()
    await $.session.measure(measure([fiveHourAt(1, nextReset + 300 * MIN)]))
    const keys = Object.keys(w.store.get('readings') as object)
    expect(keys.sort()).toEqual([windowKey(nextReset), windowKey(nextReset + 300 * MIN)].sort())
  })
})

describe('the idle line', () => {
  test('a timer redraws it: flat idle usage pushes the cap past the reset, never "capped soon"', async ($, on) => {
    const w = world(on, {
      limits: [fiveHourAt(50)],
      store: { readings: { [windowKey(RESET)]: [[T0 - 60 * MIN, 10], [T0 - 30 * MIN, 30]] } },
    })
    await $.session.start(START)
    expect(last(w.status)).toBe(`QM 5h cap ~${clockText(T0 + 75 * MIN)}`)
    // Idle at 50% past the frozen fit's cap time: the fit, with now at 50%, puts the cap after the reset.
    await w.clock.advance(80 * MIN)
    expect(w.status.filter(s => s === 'QM 5h capped soon')).toEqual([])
    expect(last(w.status)).toBeUndefined()
  })

  test('a passed reset hides a capped line', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(100)] })
    await $.session.start(START)
    expect(last(w.status)).toBe('QM 5h capped')
    await w.clock.advance(181 * MIN)
    expect(last(w.status)).toBeUndefined()
  })

  test('the timer runs even when session start fails after it', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(100)], failStoreSet: true })
    await $.session.start(START)
    w.setLimits([fiveHourAt(100)])
    await w.clock.advance(2 * MIN)
    expect(last(w.status)).toBe('QM 5h capped')
  })
})

describe('weekly window', () => {
  test('forecasts a weekly cap once twelve hours of readings agree, with the date', async ($, on) => {
    const w = world(on)
    const shown: (string | undefined)[] = []
    for (let h = 0; h <= 12; h++) {
      await $.session.measure(measure([sevenDayAt(32 + 2 * h)]))
      shown.push(last(w.status))
      if (h !== 12) await w.clock.advance(HOUR)
    }
    // Hidden until the twelfth hour; then 56% rising 2%/h caps 22 hours on.
    expect(shown.slice(0, 12).every(s => s === undefined)).toBe(true)
    expect(last(w.status)).toBe(`QM week cap ~${dateClockText(T0 + 34 * HOUR)}`)
    w.setLimits([sevenDayAt(56)])
    const { text } = await $.command.run(command('quartermaster'))
    expect(text).toContain(`weekly: 56%, resets ${dateClockText(T0 + 3 * DAY)} (in 2d 12h) · ~2.0%/h · cap ~${dateClockText(T0 + 34 * HOUR)}`)
  })

  test('keeps one weekly reading per quarter hour', async ($, on) => {
    const w = world(on)
    for (let i = 0; i < 6; i++) {
      await $.session.measure(measure([sevenDayAt(10 + i)]))
      await w.clock.advance(5 * MIN)
    }
    const week = w.store.get('weekReadings') as Record<string, [number, number][]>
    expect(Object.values(week)[0]).toEqual([[T0, 10], [T0 + 15 * MIN, 13]])
  })

  test('both windows alert together, five-hour first', async ($, on) => {
    const weekly: [number, number][] = [[T0 - 24 * HOUR, 40], [T0 - 12 * HOUR, 60], [T0 - 15 * MIN, 79]]
    const w = world(on, {
      limits: [fiveHourAt(50), sevenDayAt(80)],
      store: {
        readings: { [windowKey(RESET)]: [[T0 - 60 * MIN, 10], [T0 - 30 * MIN, 30]] },
        weekReadings: { [windowKey(T0 + 3 * DAY)]: weekly },
      },
    })
    await $.session.start(START)
    expect(last(w.status)).toMatch(/^QM 5h cap ~\S+ · week cap ~/)
  })
})

describe('capped window', () => {
  test('at 100% the line says capped instead of a past cap time', async ($, on) => {
    const w = world(on)
    for (const pct of [60, 80, 100, 100]) {
      await $.session.measure(measure([fiveHourAt(pct)]))
      await w.clock.advance(30 * MIN)
    }
    expect(last(w.status)).toBe('QM 5h capped')
  })
})

describe('pace text edges', () => {
  test('the reading at 100% says already capped', () => {
    expect(windowText(100, RESET, T0 - MIN)).toBe(`five-hour window at 100%, resets ${clockText(RESET)}; already capped`)
  })
})

describe('a stale fit through the hooks', () => {
  test('status and report say capped soon, never a past cap time', async ($, on) => {
    const w = world(on)
    const steps: [number, number][] = [[0, 10], [30, 50], [60, 90], [90, 91], [120, 92]]
    for (const [at, pct] of steps) {
      await w.clock.set(T0 + at * MIN)
      await $.session.measure(measure([fiveHourAt(pct)]))
    }
    expect(last(w.status)).toBe('QM 5h capped soon')
    expect(windowText(92, RESET, T0 + 109 * MIN, T0 + 120 * MIN)).toBe(
      `five-hour window at 92%, resets ${clockText(RESET)}; about to cap`,
    )
    w.setLimits([fiveHourAt(92)])
    const { text } = await $.command.run(command('quartermaster'))
    expect(text).toMatch(/five-hour: 92%, resets .+ \(in 1h 0m\) · ~\S+%\/h · capped soon/)
  })
})
