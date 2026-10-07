import { describe, expect, test } from 'claude-code/testing'
import { clockText } from '../hooks/pace'
import { MIN, T0, fiveHourAt, spawn, turnEnd, world } from './harness'

const RESET = T0 + 180 * MIN
const last = (xs: (string | undefined)[]) => xs[xs.length - 1]

describe('agent tally', () => {
  test('counts distinct subagents by agentId; a resumed one counts once', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(10)] })
    await $.agent.spawn(spawn({ model: 'sonnet' }))
    await $.agent.spawn(spawn({ prompt: 'other', model: 'opus' }))
    await $.turn.complete(turnEnd('agent-1'))
    await $.turn.complete(turnEnd('agent-1'))
    await $.turn.complete(turnEnd('agent-2'))
    expect(last(w.status)).toBe(`QM pace: — (resets ${clockText(RESET)}) · agents 2 (1 opus)`)
  })

  test('main-loop turns do not count', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(10)] })
    await $.turn.complete(turnEnd())
    expect(w.status.filter(s => s?.includes('agents 1'))).toHaveLength(0)
  })

  test('an agent this load never saw spawn falls back to the turn usage model (D11)', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(10)] })
    await $.turn.complete(turnEnd('agent-x', 'claude-opus-5-5'))
    expect(last(w.status)).toBe(`QM pace: — (resets ${clockText(RESET)}) · agents 1 (1 opus)`)
  })
})
