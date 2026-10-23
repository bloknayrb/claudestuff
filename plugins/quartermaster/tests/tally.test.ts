import { describe, expect, test } from 'claude-code/testing'
import { agentsClause, familyOf } from '../hooks/pace'
import { fiveHourAt, spawn, turnEnd, world } from './harness'

const last = (xs: (string | undefined)[]) => xs[xs.length - 1]

describe('agent tally', () => {
  test('counts distinct subagents by agentId; a resumed one counts once', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(10)] })
    await $.agent.spawn(spawn({ model: 'sonnet' }))
    await $.agent.spawn(spawn({ prompt: 'other', model: 'opus' }))
    await $.turn.complete(turnEnd('agent-1'))
    await $.turn.complete(turnEnd('agent-1'))
    await $.turn.complete(turnEnd('agent-2'))
    expect(last(w.status)).toBe('QM agents 2 (1 opus, 1 sonnet)')
  })

  test('main-loop turns do not count, and with no agents the line stays hidden', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(10)] })
    await $.turn.complete(turnEnd())
    expect(w.status.filter(s => s !== undefined)).toHaveLength(0)
  })

  test('an agent this load never saw spawn falls back to the turn usage model', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(10)] })
    await $.turn.complete(turnEnd('agent-x', 'claude-opus-5-5'))
    expect(last(w.status)).toBe('QM agents 1 (1 opus)')
  })

  test('the split names every family, largest first, then by name', () => {
    expect(agentsClause({})).toBe('agents 0')
    expect(
      agentsClause({ a: 'claude-sonnet-5-5', b: 'haiku', c: 'claude-opus-5-5', d: 'Sonnet', e: 'gpt-x' }),
    ).toBe('agents 5 (2 sonnet, 1 gpt-x, 1 haiku, 1 opus)')
    expect(familyOf('claude-fable-5-1')).toBe('fable')
  })
})
