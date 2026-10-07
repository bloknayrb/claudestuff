import type { SessionRateLimit } from 'claude-code'

export type Reading = [ts: number, pct: number]
export type FiveHour = { pct: number; resetsAt: number | null }

/** The five-hour window from rateLimits, an array by kind; resetsAt may be missing. */
export function fiveHour(limits: readonly SessionRateLimit[]): FiveHour | null {
  const window = limits.find(limit => limit.kind === 'five_hour')
  if (window === undefined) return null
  const resetsAt = window.resetsAt === undefined ? NaN : Date.parse(window.resetsAt)
  return { pct: window.percentUsed, resetsAt: Number.isFinite(resetsAt) ? resetsAt : null }
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

/** Least-squares line of percent over time; when it reaches 100, or null under 3 readings or no growth. */
export function fitCap(readings: readonly Reading[]): number | null {
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
  if (slope <= 0) return null
  const intercept = my - slope * mx
  return t0 + Math.round(((100 - intercept) / slope) * 60_000)
}

/** HH:MM in the hooks environment's local time (not UTC). */
export function clockText(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** `cap ~15:40 (resets 17:00)`, `no cap before reset (resets 17:00)`, or `— (resets 17:00)`. */
export function paceClause(cap: number | null, resetsAt: number | null): string {
  const resets = resetsAt === null ? '' : ` (resets ${clockText(resetsAt)})`
  if (cap === null) return `—${resets}`
  if (resetsAt !== null && cap >= resetsAt) return `no cap before reset${resets}`
  return `cap ~${clockText(cap)}${resets}`
}

/** `five-hour window at 82%, resets 17:00; on pace to cap at 15:40`: the reading the heavy guard and toasts give. */
export function windowText(pct: number, resetsAt: number | null, cap: number | null): string {
  const resets = resetsAt === null ? '' : `, resets ${clockText(resetsAt)}`
  const pace =
    cap === null
      ? 'pace unknown'
      : resetsAt !== null && cap >= resetsAt
        ? 'not on pace to cap before the reset'
        : `on pace to cap at ${clockText(cap)}`
  return `five-hour window at ${pct}%${resets}; ${pace}`
}

/** `agents 4 (2 opus)`: distinct subagents, and how many ran on each heavy model (zeros left out). */
export function agentsClause(tally: Readonly<Record<string, string>>, heavyModels: readonly string[]): string {
  const models = Object.values(tally).map(m => m.toLowerCase())
  const heavy = heavyModels
    .map(token => [token, models.filter(m => m.includes(token)).length] as const)
    .filter(([, count]) => count > 0)
    .map(([token, count]) => `${count} ${token}`)
  return `agents ${models.length}${heavy.length > 0 ? ` (${heavy.join(', ')})` : ''}`
}

export function statusText(pace: string, agentsText: string): string {
  return `QM pace: ${pace} · ${agentsText}`
}
