import { describe, expect, test } from 'claude-code/testing'
import { DEFAULTS, parseConfig, toList } from '../hooks/config'
import { START, world } from './harness'

describe('config', () => {
  test('toList reads an array or a comma string', () => {
    expect(toList(['opus', ' fable '], [])).toEqual(['opus', 'fable'])
    expect(toList('opus, fable,,', [])).toEqual(['opus', 'fable'])
    expect(toList([], ['x'])).toEqual([])
    expect(toList(undefined, ['x'])).toEqual(['x'])
  })

  test('parseConfig fills defaults, clamps warnAt and lower-cases heavy models', () => {
    expect(parseConfig({})).toEqual(DEFAULTS)
    expect(parseConfig({ warnAt: 120, heavyModels: 'Opus', requireModel: false })).toEqual({
      warnAt: 100,
      heavyModels: ['opus'],
      guardTypes: ['general-purpose', 'claude'],
      requireModel: false,
    })
    expect(parseConfig({ warnAt: '60' })).toMatchObject({ warnAt: 60 })
  })

  test('list options arrive in a shape parseConfig reads', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    const line = w.logs.find(l => l.text.startsWith('quartermaster: list options arrived as'))
    expect(line?.to).toBe('debug')
    expect(line?.text).toBe('quartermaster: list options arrived as heavyModels array, guardTypes array')
  })
})
