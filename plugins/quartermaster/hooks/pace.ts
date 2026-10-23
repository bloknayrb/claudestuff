import type { SessionRateLimit } from 'claude-code'

export type Reading = [ts: number, pct: number]
export type Window = { pct: number; resetsAt: number | null }

/** A window from rateLimits, an array by kind (`five_hour`, `seven_day`); resetsAt may be missing. */
function windowOf(limits: readonly SessionRateLimit[], kind: string): Window | null {
  const window = limits.find(limit => limit.kind === kind)
  if (window === undefined) return null
  const resetsAt = window.resetsAt === undefined ? NaN : Date.parse(window.resetsAt)
  return { pct: window.percentUsed, resetsAt: Number.isFinite(resetsAt) ? resetsAt : null }
}

export function fiveHour(limits: readonly SessionRateLimit[]): Window | null {
  return windowOf(limits, 'five_hour')
}

export function sevenDay(limits: readonly SessionRateLimit[]): Window | null {
  return windowOf(limits, 'seven_day')
}

/** A new window's store key: resetsAt to the nearest minute. Rounding alone splits jitter across hh:mm:30. */
export function windowKey(resetsAt: number): string {
  return String(Math.round(resetsAt / 60_000) * 60_000)
}

export const WINDOW_SLACK_MS = 60_000

/**
 * The store key for resetsAt: the nearest existing key within a minute of it, else a new windowKey.
 * Sub-minute jitter stays one window on either side of hh:mm:30.
 */
export function matchWindow(keys: readonly string[], resetsAt: number): string {
  let best: string | null = null
  for (const key of keys) {
    const gap = Math.abs(Number(key) - resetsAt)
    if (gap <= WINDOW_SLACK_MS && (best === null || gap < Math.abs(Number(best) - resetsAt))) best = key
  }
  return best ?? windowKey(resetsAt)
}

/** Least-squares line of percent over time, slope in percent per minute; null under 3 readings or one instant. */
export function fitLine(readings: readonly Reading[]): { t0: number; slope: number; intercept: number } | null {
  if (readings.length < 3) return null
  const t0 = readings[0]![0]
  const xs = readings.map(r => (r[0] - t0) / 60_000)
  const ys = readings.map(r => r[1])
  const n = readings.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my)
    sxx += (xs[i]! - mx) ** 2
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  return { t0, slope, intercept: my - slope * mx }
}

/** When the fitted line reaches 100, or null under 3 readings or no growth. */
export function fitCap(readings: readonly Reading[]): number | null {
  const line = fitLine(readings)
  if (line === null || line.slope <= 0) return null
  return line.t0 + Math.round(((100 - line.intercept) / line.slope) * 60_000)
}

/** The fitted rate in percent per hour, or null with no fit. */
export function fitRate(readings: readonly Reading[]): number | null {
  const line = fitLine(readings)
  return line === null ? null : line.slope * 60
}

/**
 * The weekly fit needs this much history: a burst's first half hour, projected across a week, would call a
 * cap days early.
 */
export const WEEK_MIN_SPAN_MS = 12 * 60 * 60_000

/** The weekly readings a fit may use: all of them once they span WEEK_MIN_SPAN_MS, else none. */
export function weekFitReadings(readings: readonly Reading[]): readonly Reading[] {
  const first = readings[0]
  const last = readings[readings.length - 1]
  return first !== undefined && last !== undefined && last[0] - first[0] >= WEEK_MIN_SPAN_MS ? readings : []
}

/** `3:40pm` in the hooks environment's local time (not UTC), as the user's own statusline prints it. */
export function clockText(ms: number): string {
  const d = new Date(ms)
  const h = d.getHours()
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `Oct 25, 9:00am`: for the weekly window, where a bare clock or weekday could mean the next week. */
export function dateClockText(ms: number): string {
  const d = new Date(ms)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${clockText(ms)}`
}

/** `2d 4h`, `2h 10m`, `25m`, rounded down; `0m` for anything not ahead. */
export function durationText(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export type Forecast =
  | { kind: 'capped' }
  | { kind: 'soon' }
  | { kind: 'cap'; at: number }
  | { kind: 'safe' }
  | { kind: 'unknown' }

/**
 * Where the window is headed. A reset already past (the session sat idle across it) knows nothing, so a
 * stale `capped` never outlives its window. A fit that puts the cap before now (a steep rise that then
 * flattened) reads `soon`, never a past time.
 */
export function forecast(cap: number | null, resetsAt: number | null, pct: number, now: number): Forecast {
  if (resetsAt !== null && now >= resetsAt) return { kind: 'unknown' }
  if (pct >= 100) return { kind: 'capped' }
  if (cap !== null && cap <= now) return { kind: 'soon' }
  if (cap === null) return { kind: 'unknown' }
  if (resetsAt !== null && cap >= resetsAt) return { kind: 'safe' }
  return { kind: 'cap', at: cap }
}

/** The status line's clause for a window: only a forecast worth acting on, else null. */
export function alertClause(label: string, f: Forecast, time: (ms: number) => string): string | null {
  if (f.kind === 'capped') return `${label} capped`
  if (f.kind === 'soon') return `${label} capped soon`
  if (f.kind === 'cap') return `${label} cap ~${time(f.at)}`
  return null
}

function forecastText(f: Forecast, time: (ms: number) => string): string {
  if (f.kind === 'capped') return 'capped'
  if (f.kind === 'soon') return 'capped soon'
  if (f.kind === 'cap') return `cap ~${time(f.at)}`
  if (f.kind === 'safe') return 'no cap before reset'
  return 'pace unknown'
}

function rateText(rate: number): string {
  return `~${Math.abs(rate) < 10 ? rate.toFixed(1) : Math.round(rate)}%/h`
}

/** `42%, resets 5:00pm (in 2h 10m) · ~12%/h · cap ~3:40pm`: one window's line in /quartermaster. */
export function usageLine(
  window: Window,
  f: Forecast,
  rate: number | null,
  now: number,
  time: (ms: number) => string,
): string {
  const { pct, resetsAt } = window
  const due = resetsAt !== null && now >= resetsAt
  const resets =
    resetsAt === null ? '' : due ? ', reset due' : `, resets ${time(resetsAt)} (in ${durationText(resetsAt - now)})`
  const parts = [`${pct}%${resets}`]
  // A rate fitted to a window that has reset describes nothing now.
  if (rate !== null && f.kind !== 'capped' && !due) parts.push(rateText(rate))
  parts.push(forecastText(f, time))
  return parts.join(' · ')
}

/** `five-hour window at 82%, resets 5:00pm; on pace to cap at 3:40pm`: the reading the heavy guard and toasts give. */
export function windowText(pct: number, resetsAt: number | null, cap: number | null, now = 0): string {
  const resets = resetsAt === null ? '' : `, resets ${clockText(resetsAt)}`
  const pace =
    pct >= 100
      ? 'already capped'
      : cap !== null && now > 0 && cap <= now
      ? 'about to cap'
      : cap === null
      ? 'pace unknown'
      : resetsAt !== null && cap >= resetsAt
        ? 'not on pace to cap before the reset'
        : `on pace to cap at ${clockText(cap)}`
  return `five-hour window at ${pct}%${resets}; ${pace}`
}

const FAMILIES = ['fable', 'opus', 'sonnet', 'haiku']

/** A model id's family (`claude-opus-5-5` → `opus`), else the id itself. */
export function familyOf(model: string): string {
  const id = model.toLowerCase()
  return FAMILIES.find(f => id.includes(f)) ?? id
}

/** `agents 4 (2 opus, 2 sonnet)`: distinct subagents and the split by model family, largest first. */
export function agentsClause(tally: Readonly<Record<string, string>>): string {
  const counts = new Map<string, number>()
  for (const model of Object.values(tally)) {
    const family = familyOf(model)
    counts.set(family, (counts.get(family) ?? 0) + 1)
  }
  const split = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([family, n]) => `${n} ${family}`)
  const total = Object.keys(tally).length
  return `agents ${total}${split.length > 0 ? ` (${split.join(', ')})` : ''}`
}

/** `QM 5h cap ~3:40pm · agents 4 (2 opus, 2 sonnet)`, or undefined when no clause has anything to say. */
export function statusText(clauses: readonly (string | null)[]): string | undefined {
  const shown = clauses.filter((c): c is string => c !== null)
  return shown.length === 0 ? undefined : `QM ${shown.join(' · ')}`
}
