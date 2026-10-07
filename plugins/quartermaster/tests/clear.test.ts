import { describe, expect, test } from 'claude-code/testing'
import { MODEL_TEXT } from '../hooks/rules'
import { clockText } from '../hooks/pace'
import { END_CLEAR, MIN, START, T0, fiveHourAt, measure, spawn, turnEnd, world } from './harness'

const RESET = T0 + 180 * MIN
const last = (xs: (string | undefined)[]) => xs[xs.length - 1]

describe('/clear and fail-open', () => {
  test('/clear resets denials and the tally, and re-arms the heartbeat under the new id', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(10)] })
    await $.session.start(START)
    expect((await $.agent.spawn(spawn())).deny).toBe(MODEL_TEXT)
    await $.agent.spawn(spawn({ prompt: 'p2', model: 'sonnet' }))
    await $.turn.complete(turnEnd('agent-1'))
    expect(last(w.status)).toContain('agents 1')

    await $.session.end(END_CLEAR)
    expect(last(w.status)).toBe(`QM pace: — (resets ${clockText(RESET)}) · agents 0`)

    w.setSessionId('S2')
    expect((await $.agent.spawn(spawn())).deny).toBe(MODEL_TEXT)
    await $.session.measure(measure([fiveHourAt(11)]))
    expect(w.writes.some(x => x.path.endsWith('/mods/quartermaster/S2.json'))).toBe(true)
  })

  test('a resume resets session state too (D17)', async ($, on) => {
    world(on)
    await $.agent.spawn(spawn())
    await $.session.end({ ...END_CLEAR, reason: 'resume' })
    expect((await $.agent.spawn(spawn())).deny).toBe(MODEL_TEXT)
  })

  test('other session ends keep session state', async ($, on) => {
    world(on)
    await $.agent.spawn(spawn())
    await $.session.end({ ...END_CLEAR, reason: 'prompt_input_exit' })
    expect((await $.agent.spawn(spawn())).deny).toBeUndefined()
  })

  test('a guard that throws lets the spawn through and records the failure', async ($, on) => {
    const w = world(on, { failUsage: true })
    const started = await $.agent.spawn(spawn({ model: 'opus' }))
    expect(started.deny).toBeUndefined()
    expect(started.agentId).toBe('agent-1')
    expect(w.logs.some(l => l.to === 'debug' && l.text.startsWith('quartermaster: agent.spawn'))).toBe(true)
    expect(JSON.parse(w.writes[w.writes.length - 1]!.text).lastError.message).toContain('agent.spawn')
  })
})
