import type { Claim, Counter, Counters, Family, Fire, Ledger, Pending } from '../types'
import { judge } from './evidence'
import type { Fired } from './evidence'

export const RING_CAP = 200

const FAMILIES: readonly Family[] = ['tests', 'build', 'shipped']
const num = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0)
const pct = (part: number, whole: number): string => (whole === 0 ? '-' : `${Math.round((100 * part) / whole)}%`)
const tail = (path: string): string => path.replace(/\\/g, '/').split('/').pop() ?? path

export function countersOf(value: unknown): Counters {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, Record<string, unknown> | undefined>
  const one = (c: Record<string, unknown> | undefined): Counter => ({ fires: num(c?.fires), laterBacked: num(c?.laterBacked), repeated: num(c?.repeated) })
  return { tests: one(v.tests), build: one(v.build), shipped: one(v.shipped) }
}

export function ringOf(value: unknown): Fire[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (f): f is Fire => typeof f === 'object' && f !== null && typeof (f as Fire).input_hash === 'string' && FAMILIES.includes((f as Fire).guard),
  )
}

export function applyFlush(
  counters: Counters,
  ring: readonly Fire[],
  fired: readonly Fired[],
  repeated: readonly Claim[],
  backed: readonly Pending[],
  now: number,
): { counters: Counters; ring: Fire[] } {
  const c: Counters = { tests: { ...counters.tests }, build: { ...counters.build }, shipped: { ...counters.shipped } }
  const r: Fire[] = ring.map(f => ({ ...f }))
  for (const f of fired) {
    c[f.claim.family].fires += 1
    r.push({ ts: now, guard: f.claim.family, input_hash: f.claim.hash, outcome: f.status })
  }
  for (const claim of repeated) c[claim.family].repeated += 1
  for (const p of backed) {
    c[p.family].laterBacked += 1
    for (let i = r.length - 1; i >= 0; i -= 1) {
      const f = r[i]
      if (f !== undefined && f.input_hash === p.hash && f.laterBacked !== true) {
        f.laterBacked = true
        break
      }
    }
  }
  return { counters: c, ring: r.slice(-RING_CAP) }
}

export function reportText(counters: Counters, ring: readonly Fire[], ledger: Ledger, clock: (ms: number) => string): string {
  const lines = ['Claim Ledger, all sessions:']
  for (const family of FAMILIES) {
    const c = counters[family]
    lines.push(`  ${family.padEnd(8)}${c.fires} flagged, ${c.laterBacked} later backed (${pct(c.laterBacked, c.fires)}), ${c.repeated} repeated unbacked`)
  }
  lines.push('A tests or build flag later backed by a run, with no edit between, may have been true when made: a high rate means the check is noisy. Shipped flags are never later backed.')
  const edit = ledger.lastMutation
  lines.push(`This session: ${ledger.calls} tool calls; last code edit ${edit === null ? 'none' : `${clock(edit.ts)} (${tail(edit.path)})`}.`)
  for (const kind of ['tests', 'build'] as const) {
    const v = judge(kind, ledger)
    lines.push(`  ${kind}: ${v.status}${v.entry === null ? '' : ` (${clock(v.entry.ts)}, ${v.entry.short})`}`)
  }
  const recent = ring.slice(-5)
  if (recent.length > 0) {
    lines.push(`Last flags: ${recent.map(f => `${clock(f.ts)} ${f.guard} ${f.outcome}${f.laterBacked === true ? ', later backed' : ''}`).join('; ')}`)
  }
  return lines.join('\n')
}
