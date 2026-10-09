import { describe, expect, mock, test } from 'claude-code/testing'

import { complete, HEALTH, SESSION, step, worldOf } from './fixtures/world'

describe('harness facts the other tests rest on', () => {
  test('the start registers /claim-ledger, logs its options and writes the health file under USERPROFILE', async ($, on) => {
    const world = worldOf(on)
    mock.clock(on, { now: 1_000 })
    mock.store(on)
    await $.session.start(SESSION)

    expect(world.commands).toEqual(['claim-ledger'])
    expect(world.writes.map(w => w.path)).toEqual([HEALTH])
    expect(JSON.parse(world.writes[0]?.text ?? '{}')).toEqual({ loadedAt: 1000, lastError: null })
    expect(world.logs.some(l => l.startsWith('claim-ledger: loaded, options '))).toBe(true)
  })

  // A multiple field arrives as an array.
  test('a list option arrives as an array', { options: { testCommands: ['make check', 'just test'] } }, async ($, on) => {
    const world = worldOf(on)
    mock.clock(on)
    mock.store(on)
    await $.session.start(SESSION)

    const line = world.logs.find(l => l.startsWith('claim-ledger: loaded')) ?? ''
    expect(line).toContain('"testCommands":["make check","just test"]')
  })

  test('turn.step and turn.complete can be driven from a test', async ($, on) => {
    const world = worldOf(on)
    mock.clock(on)
    mock.store(on)
    world.steps.push({ answer: 'hello', tools: 0 })
    await $.session.start(SESSION)
    await step($, 't1', 0)

    expect(await complete($, 'hello')).toEqual({ text: 'hello' })
  })
})
