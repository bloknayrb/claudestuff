import { describe, expect, test } from 'claude-code/testing'

import { emptyLedger } from '../hooks/evidence'
import { applyFlush, countersOf, reportText, ringOf } from '../hooks/stats'
import type { Claim } from '../types'

const claim = (hash: string): Claim => ({ family: 'tests', op: null, phrase: 'tests pass', hash })
const clock = (ms: number) => `t${ms}`

describe('store shaping', () => {
  test('garbage reads as zeros and an empty ring', () => {
    expect(countersOf({ tests: { fires: 'x' } })).toEqual({
      tests: { fires: 0, laterBacked: 0, repeated: 0 },
      build: { fires: 0, laterBacked: 0, repeated: 0 },
      shipped: { fires: 0, laterBacked: 0, repeated: 0 },
    })
    expect(ringOf({ not: 'an array' })).toEqual([])
    expect(ringOf([{ ts: 1, guard: 'tests', input_hash: 'a', outcome: 'none' }, { junk: true }])).toHaveLength(1)
  })

  test('a flush counts fires, repeats and later-backed, marking the ring entry', () => {
    const first = applyFlush(countersOf(undefined), [], [{ claim: claim('h1'), status: 'none' }], [], [], 10)
    expect(first.counters.tests.fires).toBe(1)
    expect(first.ring).toEqual([{ ts: 10, guard: 'tests', input_hash: 'h1', outcome: 'none' }])

    const second = applyFlush(first.counters, first.ring, [], [claim('h1')], [{ hash: 'h1', family: 'tests', op: null, ts: 10, edit: 0 }], 20)
    expect(second.counters.tests).toEqual({ fires: 1, laterBacked: 1, repeated: 1 })
    expect(second.ring[0]?.laterBacked).toBe(true)
  })

  test('the ring keeps the last 200', () => {
    const fired = Array.from({ length: 250 }, (_, i) => ({ claim: claim(`h${i}`), status: 'none' as const }))
    const out = applyFlush(countersOf(undefined), [], fired, [], [], 1)
    expect(out.ring).toHaveLength(200)
    expect(out.ring[0]?.input_hash).toBe('h50')
  })

  test('the report gives counts, rates and this session', () => {
    const counters = countersOf({ tests: { fires: 4, laterBacked: 1, repeated: 2 } })
    const text = reportText(counters, [{ ts: 5, guard: 'tests', input_hash: 'h', outcome: 'none', laterBacked: true }], emptyLedger(), clock)
    expect(text).toContain('tests   4 flagged, 1 later backed (25%), 2 repeated unbacked')
    expect(text).toContain('build   0 flagged, 0 later backed (-), 0 repeated unbacked')
    expect(text).toContain('This session: 0 tool calls; last code edit none.')
    expect(text).toContain('Last flags: t5 tests none, later backed')
  })
})
