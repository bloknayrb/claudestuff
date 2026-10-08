import { describe, expect, test } from 'claude-code/testing'
import { clockText } from '../hooks/pace'
import { REPORT_FAILED } from '../hooks/register'
import { MIN, START, T0, WORKFLOW, command, fiveHourAt, spawn, world } from './harness'

describe('/quartermaster', () => {
  test('is registered at session start', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    expect(w.registered).toContain('quartermaster')
  })

  test('reports fires, re-issues, changes, pace, the session tally and config', async ($, on) => {
    world(on, { limits: [fiveHourAt(40)] })
    await $.session.start(START)
    await $.agent.spawn(spawn())
    await $.agent.spawn(spawn())
    await $.agent.spawn(spawn({ prompt: 'two' }))
    await $.agent.spawn(spawn({ prompt: 'two', model: 'haiku' }))
    await $.agent.spawn(spawn({ prompt: 'step', model: 'haiku', workflow: WORKFLOW }))
    const { text } = await $.command.run(command('quartermaster'))
    expect(text).toContain('model guard: 2 fires · 1 re-issued (50%) · 1 changed (50%)')
    expect(text).toContain('heavy guard: 0 fires · 0 re-issued (—) · 0 changed (—)')
    expect(text).toContain(`pace: — (resets ${clockText(T0 + 180 * MIN)}), window at 40%`)
    expect(text).toContain('this session: agents 0')
    expect(text).toContain('toast-only spawns this session: workflow 1')
    // denied(H1), reissued(H1), denied(H2), changed(H2): four ring entries.
    expect(text).toContain('ring: 4 of the last 200 outcomes kept')
    expect(text).toContain('config: warnAt 75% · heavy opus, fable · guard types general-purpose, claude · requireModel on')
  })

  test('with no rate limits it says so', async ($, on) => {
    world(on)
    await $.session.start(START)
    const { text } = await $.command.run(command('quartermaster'))
    expect(text).toContain('pace: no five-hour reading (rate limits come with a subscription)')
  })

  test('a failing report says so instead of failing silently', async ($, on) => {
    world(on, { failUsage: true })
    await $.session.start(START)
    expect((await $.command.run(command('quartermaster'))).text).toBe(REPORT_FAILED)
  })
})
