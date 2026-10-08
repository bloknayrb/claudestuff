import { describe, expect, test } from 'claude-code/testing'
import { MIN, START, T0, world } from './harness'

describe('health file', () => {
  test('session start writes the heartbeat under the home folder', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    expect(w.writes).toHaveLength(1)
    expect(w.writes[0]?.path).toBe('C:/Users/tester/.claude/state/mods/quartermaster/S1.json')
    expect(JSON.parse(w.writes[0]!.text)).toEqual({ loadedAt: T0, lastError: null })
  })

  test('HOME is used when USERPROFILE is unset', async ($, on) => {
    const w = world(on, { env: { HOME: '/home/tester' } })
    await $.session.start(START)
    // On Windows /home/tester resolves to C:/home/tester: compare the tail.
    expect(w.writes[0]?.path.endsWith('/home/tester/.claude/state/mods/quartermaster/S1.json')).toBe(true)
  })

  test('with no home there is no heartbeat, and the session still starts', async ($, on) => {
    const w = world(on, { env: {} })
    await expect($.session.start(START)).resolves.toEqual({ cwd: 'C:/work' })
    expect(w.writes).toHaveLength(0)
  })

  test('a hot reload writes a fresh heartbeat', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    await w.clock.advance(5 * MIN)
    await $.session.start(START)
    expect(w.writes).toHaveLength(2)
    expect(JSON.parse(w.writes[1]!.text).loadedAt).toBe(T0 + 5 * MIN)
  })
})
