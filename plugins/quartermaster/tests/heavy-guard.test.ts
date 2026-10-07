import { describe, expect, test } from 'claude-code/testing'
import { clockText } from '../hooks/pace'
import { MODEL_TEXT } from '../hooks/rules'
import { MIN, SPAWNER_OPUS, START, T0, WORKFLOW, fiveHourAt, measure, spawn, world } from './harness'

const RESET = T0 + 180 * MIN
const heavyText = (pct: number, pace = 'pace unknown') =>
  `Quartermaster: five-hour window at ${pct}%, resets ${clockText(RESET)}; ${pace}. Re-issue unchanged to spend it anyway.`

describe('heavy-model guard', () => {
  test('passes below warnAt', async ($, on) => {
    world(on, { limits: [fiveHourAt(74)] })
    expect((await $.agent.spawn(spawn({ model: 'opus' }))).deny).toBeUndefined()
  })

  test('denies at warnAt with the reading, then passes the re-issue', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(75)] })
    expect((await $.agent.spawn(spawn({ model: 'opus' }))).deny).toBe(heavyText(75))
    expect((await $.agent.spawn(spawn({ model: 'opus' }))).deny).toBeUndefined()
    expect((w.store.get('counters') as { heavy: unknown }).heavy).toEqual({ fires: 1, reissued: 1, changed: 0 })
  })

  test('gives the pace when the window has three readings', async ($, on) => {
    const w = world(on)
    for (const pct of [10, 30, 50]) {
      await $.session.measure(measure([fiveHourAt(pct)]))
      if (pct !== 50) await w.clock.advance(30 * MIN)
    }
    w.setLimits([fiveHourAt(80)])
    expect((await $.agent.spawn(spawn({ model: 'opus' }))).deny).toBe(
      heavyText(80, `on pace to cap at ${clockText(T0 + 135 * MIN)}`),
    )
  })

  test('a light model passes past warnAt; no rate limits keeps the guard quiet', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(95)] })
    expect((await $.agent.spawn(spawn({ model: 'sonnet' }))).deny).toBeUndefined()
    w.setLimits([])
    expect((await $.agent.spawn(spawn({ prompt: 'other', model: 'opus' }))).deny).toBeUndefined()
  })

  test('matches a full model id by substring, any case', async ($, on) => {
    world(on, { limits: [fiveHourAt(80)] })
    expect((await $.agent.spawn(spawn({ model: 'Claude-Fable-1' }))).deny).toBe(heavyText(80))
  })

  test('a bare general-purpose spawn inherits the parent: both guards, one deny, one re-issue', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(90)] })
    expect((await $.agent.spawn(spawn())).deny).toBe(`${MODEL_TEXT}\n${heavyText(90)}`)
    expect((await $.agent.spawn(spawn())).deny).toBeUndefined()
    expect(w.store.get('counters')).toEqual({
      model: { fires: 1, reissued: 1, changed: 0 },
      heavy: { fires: 1, reissued: 1, changed: 0 },
    })
  })

  // Credit is per guard; naming a heavy model after seeing the reading passes
  test('after both guards deny, naming opus passes as an informed override: both changed', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(90)] })
    await $.agent.spawn(spawn())
    expect((await $.agent.spawn(spawn({ model: 'opus' }))).deny).toBeUndefined()
    expect(w.store.get('counters')).toEqual({
      model: { fires: 1, reissued: 0, changed: 1 },
      heavy: { fires: 1, reissued: 0, changed: 1 },
    })
  })

  test('a heavy model chosen after a model-only deny gets the reading first', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(10)] })
    expect((await $.agent.spawn(spawn())).deny).toBe(MODEL_TEXT)
    w.setLimits([fiveHourAt(90)])
    expect((await $.agent.spawn(spawn({ model: 'opus' }))).deny).toBe(heavyText(90))
    expect(w.store.get('counters')).toEqual({
      model: { fires: 1, reissued: 0, changed: 1 },
      heavy: { fires: 1, reissued: 0, changed: 0 },
    })
  })

  test('a fork runs on the parent model', async ($, on) => {
    world(on, { limits: [fiveHourAt(90)] })
    expect((await $.agent.spawn(spawn({ fork: true, subagentType: 'fork' }))).deny).toBe(heavyText(90))
  })

  test('an agent type with its own model is not judged on the parent model', async ($, on) => {
    world(on, { limits: [fiveHourAt(95)] })
    expect((await $.agent.spawn(spawn({ subagentType: 'Explore' }))).deny).toBeUndefined()
  })

  test('switching to a lighter model after the deny counts as changed', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(80)] })
    await $.agent.spawn(spawn({ model: 'opus' }))
    expect((await $.agent.spawn(spawn({ model: 'sonnet' }))).deny).toBeUndefined()
    expect((w.store.get('counters') as { heavy: unknown }).heavy).toEqual({ fires: 1, reissued: 0, changed: 1 })
  })

  test('warnAt comes from options', { options: { warnAt: 50 } }, async ($, on) => {
    world(on, { limits: [fiveHourAt(60)] })
    expect((await $.agent.spawn(spawn({ model: 'opus' }))).deny).toBe(heavyText(60))
  })

  test('parallel workflow spawns on a heavy model start and toast once per window', async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(80)] })
    const calls = [1, 2, 3].map(i =>
      spawn({ prompt: `step ${i}`, subagentType: 'workflow-subagent', model: 'opus', workflow: { ...WORKFLOW, agentIndex: i } }),
    )
    const started = await Promise.all(calls.map(c => $.agent.spawn(c)))
    expect(started.every(r => r.deny === undefined)).toBe(true)
    expect(w.toasts).toEqual([
      `Quartermaster: a workflow spawned an agent on opus; five-hour window at 80%, resets ${clockText(RESET)}; pace unknown.`,
    ])
    expect(w.store.get('counters')).toBeUndefined()
  })

  test('a plugin spawn of a heavy model starts and only toasts', { plugins: [SPAWNER_OPUS] }, async ($, on) => {
    const w = world(on, { limits: [fiveHourAt(80)] })
    await $.session.start(START)
    expect(w.spawned).toHaveLength(1)
    // Filtered: session.start's 80% reading also raises a threshold toast.
    expect(w.toasts.filter(t => t.includes('spawner-opus'))).toEqual([
      `Quartermaster: spawner-opus spawned an agent on opus; five-hour window at 80%, resets ${clockText(RESET)}; pace unknown.`,
    ])
    expect(w.store.get('counters')).toBeUndefined()
  })
})
