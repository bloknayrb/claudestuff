import { describe, expect, test } from 'claude-code/testing'
import { spawnHash } from '../hooks/hash'
import { MODEL_TEXT } from '../hooks/rules'
import { MIN, SPAWNER_BARE, START, WORKFLOW, spawn, world } from './harness'

const ZERO = { fires: 0, reissued: 0, changed: 0 }

describe('model guard', () => {
  test('denies a bare general-purpose spawn once; a re-issue with only a new tool_use_id passes', async ($, on) => {
    const w = world(on)
    const first = spawn()
    const again = spawn()
    expect(again.tool_use_id).not.toBe(first.tool_use_id)
    expect((await $.agent.spawn(first)).deny).toBe(MODEL_TEXT)
    expect(w.spawned).toHaveLength(0)
    const passed = await $.agent.spawn(again)
    expect(passed.deny).toBeUndefined()
    expect(passed.agentId).toBe('agent-1')
    expect(w.store.get('counters')).toEqual({ model: { fires: 1, reissued: 1, changed: 0 }, heavy: ZERO })
  })

  test('typed agents and spawns that set a model pass untouched', async ($, on) => {
    const w = world(on)
    for (const over of [{ subagentType: 'Explore' }, { model: 'haiku' }]) {
      expect((await $.agent.spawn(spawn(over))).deny).toBeUndefined()
    }
    expect(w.spawned).toHaveLength(2)
    expect(w.store.get('counters')).toBeUndefined()
  })

  test('a fork passes even when its type is guarded', { options: { guardTypes: ['general-purpose', 'fork'] } }, async ($, on) => {
    const w = world(on)
    expect((await $.agent.spawn(spawn({ fork: true, subagentType: 'fork' }))).deny).toBeUndefined()
    expect(w.spawned).toHaveLength(1)
  })

  test('a blank model counts as unset', async ($, on) => {
    world(on)
    expect((await $.agent.spawn(spawn({ model: '  ' }))).deny).toBe(MODEL_TEXT)
  })

  test('requireModel off disables the guard', { options: { requireModel: false } }, async ($, on) => {
    world(on)
    expect((await $.agent.spawn(spawn())).deny).toBeUndefined()
  })

  test('guardTypes narrows the guarded types', { options: { guardTypes: ['claude'] } }, async ($, on) => {
    world(on)
    expect((await $.agent.spawn(spawn())).deny).toBeUndefined()
    expect((await $.agent.spawn(spawn({ subagentType: 'claude' }))).deny).toBe(MODEL_TEXT)
  })

  test('acting on a deny (same task, a model set) counts as changed', async ($, on) => {
    const w = world(on)
    await $.agent.spawn(spawn())
    expect((await $.agent.spawn(spawn({ model: 'haiku' }))).deny).toBeUndefined()
    expect(w.store.get('counters')).toEqual({ model: { fires: 1, reissued: 0, changed: 1 }, heavy: ZERO })
    const ring = w.store.get('ring') as { outcome: string }[]
    expect(ring.map(f => f.outcome)).toEqual(['denied', 'changed'])
  })

  test('switching to a typed agent after the deny counts as changed', async ($, on) => {
    const w = world(on)
    await $.agent.spawn(spawn())
    expect((await $.agent.spawn(spawn({ subagentType: 'Explore' }))).deny).toBeUndefined()
    expect(w.store.get('counters')).toEqual({ model: { fires: 1, reissued: 0, changed: 1 }, heavy: ZERO })
  })

  test('the same task on another guarded type, still bare, is denied afresh', async ($, on) => {
    const w = world(on)
    await $.agent.spawn(spawn())
    expect((await $.agent.spawn(spawn({ subagentType: 'claude' }))).deny).toBe(MODEL_TEXT)
    expect(w.store.get('counters')).toEqual({ model: { fires: 2, reissued: 0, changed: 0 }, heavy: ZERO })
  })

  test('the fire ring keeps the last 200', { timeoutMs: 60_000 }, async ($, on) => {
    const w = world(on)
    for (let i = 0; i < 201; i++) await $.agent.spawn(spawn({ prompt: `task ${i}` }))
    const ring = w.store.get('ring') as { input_hash: string }[]
    expect(ring).toHaveLength(200)
    const second = spawnHash({ prompt: 'task 1', description: 'summarise readme', subagentType: 'general-purpose', model: undefined })
    expect(ring[0]?.input_hash).toBe(second)
  })

  test('parallel spawns are judged independently and counted exactly', async ($, on) => {
    const w = world(on)
    const calls = ['a', 'b', 'c'].map(prompt => spawn({ prompt }))
    const first = await Promise.all(calls.map(c => $.agent.spawn(c)))
    expect(first.every(r => r.deny === MODEL_TEXT)).toBe(true)
    const again = await Promise.all(calls.map(c => $.agent.spawn({ ...c, tool_use_id: `${c.tool_use_id}-again` })))
    expect(again.every(r => r.deny === undefined)).toBe(true)
    expect(w.spawned).toHaveLength(3)
    expect(w.store.get('counters')).toEqual({ model: { fires: 3, reissued: 3, changed: 0 }, heavy: ZERO })
  })

  test('three identical denials answer three re-issues, one each', async ($, on) => {
    const w = world(on)
    const denies = await Promise.all([spawn(), spawn(), spawn()].map(c => $.agent.spawn(c)))
    expect(denies.every(r => r.deny === MODEL_TEXT)).toBe(true)
    expect((await $.agent.spawn(spawn())).deny).toBeUndefined()
    const rest = await Promise.all([spawn(), spawn()].map(c => $.agent.spawn(c)))
    expect(rest.every(r => r.deny === undefined)).toBe(true)
    expect(w.store.get('counters')).toEqual({ model: { fires: 3, reissued: 3, changed: 0 }, heavy: ZERO })
  })

  test('a denial expires after ten minutes', async ($, on) => {
    const w = world(on)
    await $.agent.spawn(spawn())
    await w.clock.advance(11 * MIN)
    expect((await $.agent.spawn(spawn())).deny).toBe(MODEL_TEXT)
    expect(w.store.get('counters')).toEqual({ model: { fires: 2, reissued: 0, changed: 0 }, heavy: ZERO })
  })

  test('a denial in one loop does not pass an identical call in another', async ($, on) => {
    world(on)
    await $.agent.spawn(spawn())
    expect((await $.agent.spawn(spawn({ parentAgentId: 'agent-9' }))).deny).toBe(MODEL_TEXT)
    expect((await $.agent.spawn(spawn({ parentAgentId: 'agent-9' }))).deny).toBeUndefined()
    expect((await $.agent.spawn(spawn())).deny).toBeUndefined()
  })

  test('a store that refuses writes still denies, and the failure reaches the health file', async ($, on) => {
    const w = world(on, { failStoreSet: true })
    expect((await $.agent.spawn(spawn())).deny).toBe(MODEL_TEXT)
    const last = w.writes[w.writes.length - 1]
    expect(last?.path).toBe('C:/Users/tester/.claude/state/mods/quartermaster/S1.json')
    expect(JSON.parse(last!.text).lastError.message).toContain('fire ledger')
    expect(w.logs.some(l => l.to === 'debug' && l.text.startsWith('quartermaster: fire ledger'))).toBe(true)
  })

  test('parallel workflow spawns with no model start and toast once', async ($, on) => {
    const w = world(on)
    const started = await Promise.all([1, 2, 3, 4, 5].map(i => $.agent.spawn(spawn({ prompt: `step ${i}`, workflow: { ...WORKFLOW, agentIndex: i } }))))
    expect(started.every(r => r.deny === undefined)).toBe(true)
    expect(w.spawned).toHaveLength(5)
    expect(w.toasts).toEqual(['Quartermaster: a workflow spawned general-purpose with no model set.'])
    expect(w.store.get('counters')).toBeUndefined()
    expect((w.store.get('ring') as { outcome: string }[]).map(f => f.outcome)).toEqual(['toast'])
  })

  // The kit gives this spawn the Agent tool's input shape
  test('a plugin spawn with no model is never denied and toasts once per plugin and type', { plugins: [SPAWNER_BARE] }, async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    await $.session.start(START)
    expect(w.spawned).toHaveLength(2)
    expect(w.toasts).toEqual(['Quartermaster: spawner-bare spawned general-purpose with no model set.'])
    expect(w.store.get('counters')).toBeUndefined()
    expect((w.store.get('ring') as { outcome: string }[]).map(f => f.outcome)).toEqual(['toast'])
  })
})

describe('re-issue edges', () => {
  test('after a fresh deny on the same task, an unchanged re-issue of the first call still passes', async ($, on) => {
    const w = world(on)
    expect((await $.agent.spawn(spawn())).deny).toBe(MODEL_TEXT)
    expect((await $.agent.spawn(spawn({ subagentType: 'claude' }))).deny).toBe(MODEL_TEXT)
    expect((await $.agent.spawn(spawn())).deny).toBeUndefined()
    expect(w.store.get('counters')).toEqual({ model: { fires: 2, reissued: 1, changed: 0 }, heavy: ZERO })
  })

  test('a toast already claimed in session state stays quiet, as after a hot reload', { plugins: [SPAWNER_BARE] }, async ($, on) => {
    const w = world(on)
    // Module memory is empty on the first spawn; only the claim persisted in $.state can silence it.
    on('state.get', async (_$, e, next) => {
      const read = await next(e)
      if (e.key !== 'sourceToasts') return read
      return { value: { value: ['model/spawner-bare/general-purpose'], version: read.value?.version ?? 0 } }
    })
    await $.session.start(START)
    expect(w.spawned).toHaveLength(1)
    expect(w.toasts).toEqual([])
  })

  test('a failure after the spawn started still returns the started agent', async ($, on) => {
    const w = world(on)
    on('state.set', (_$, e, next) => {
      // A deny rejects the plugin's $.state.set; a throw would only skip this test hook.
      if (e.key === 'spawnModels') return { deny: 'state refused' }
      return next(e)
    })
    const started = await $.agent.spawn(spawn({ model: 'haiku' }))
    expect(started.deny).toBeUndefined()
    expect(started.agentId).toBe('agent-1')
    expect(w.spawned).toHaveLength(1)
    expect(w.logs.some(l => l.text.startsWith('quartermaster: agent.spawn'))).toBe(true)
  })
})
