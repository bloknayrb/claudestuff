import { describe, expect, test } from 'claude-code/testing'
import { clockText, dateClockText } from '../hooks/pace'
import { REPORT_FAILED } from '../hooks/register'
import { DAY, MIN, START, T0, WORKFLOW, command, fiveHourAt, sevenDayAt, spawn, world } from './harness'

describe('/quartermaster', () => {
  test('is registered at session start', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    expect(w.registered).toContain('quartermaster')
  })

  test('reports usage first, then the session, the guards and config', async ($, on) => {
    world(on, { limits: [fiveHourAt(40), sevenDayAt(63)] })
    await $.session.start(START)
    await $.agent.spawn(spawn())
    await $.agent.spawn(spawn())
    await $.agent.spawn(spawn({ prompt: 'two' }))
    await $.agent.spawn(spawn({ prompt: 'two', model: 'haiku' }))
    await $.agent.spawn(spawn({ prompt: 'step', model: 'haiku', workflow: WORKFLOW }))
    const { text } = await $.command.run(command('quartermaster'))
    const lines = (text ?? '').split('\n')
    expect(lines[1]).toBe(`five-hour: 40%, resets ${clockText(T0 + 180 * MIN)} (in 3h 0m) · pace unknown`)
    expect(lines[2]).toBe(`weekly: 63%, resets ${dateClockText(T0 + 3 * DAY)} (in 3d 0h) · pace unknown`)
    expect(lines[3]).toBe('this session: agents 0 · toast-only spawns: workflow 1')
    expect(text).toContain('model guard: 2 fires · 1 re-issued (50%) · 1 changed (50%)')
    expect(text).toContain('heavy guard: 0 fires · 0 re-issued (—) · 0 changed (—)')
    // denied(H1), reissued(H1), denied(H2), changed(H2): four ring entries.
    expect(text).toContain('debug: ring 4 of the last 200 outcomes')
    expect(text).toContain('config: warnAt 75% · heavy opus, fable · guard types general-purpose, claude · requireModel on')
  })

  test('a rising window shows its rate and cap', async ($, on) => {
    const w = world(on)
    w.store.set('readings', {
      [String(T0 + 180 * MIN)]: [[T0 - 60 * MIN, 10], [T0 - 30 * MIN, 30], [T0, 50]],
    })
    w.setLimits([fiveHourAt(50)])
    const { text } = await $.command.run(command('quartermaster'))
    expect(text).toContain(`five-hour: 50%, resets ${clockText(T0 + 180 * MIN)} (in 3h 0m) · ~40%/h · cap ~${clockText(T0 + 75 * MIN)}`)
    expect(text).toContain('weekly: no reading')
  })

  test('with no rate limits it says so', async ($, on) => {
    world(on)
    await $.session.start(START)
    const { text } = await $.command.run(command('quartermaster'))
    expect(text).toContain('usage: no rate-limit reading (rate limits come with a subscription)')
  })

  test('a failing report says so instead of failing silently', async ($, on) => {
    world(on, { failUsage: true })
    await $.session.start(START)
    expect((await $.command.run(command('quartermaster'))).text).toBe(REPORT_FAILED)
  })
})
