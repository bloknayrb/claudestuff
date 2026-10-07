import { expect, test } from 'claude-code/testing'

import { SURFACES, mountBand, norm, start, world } from './world'

test('session.start registers the command and writes the health file', async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.commands).toContain('bridge')
  expect(norm(w.writes.at(-1)?.path ?? '').endsWith('Users/tester/.claude/state/mods/bridge/sess-1.json')).toBe(true)
  expect(JSON.parse(w.writes.at(-1)?.text ?? '{}')).toEqual({ loadedAt: 1000, lastError: null })
})

test('a band mount draws the harness engine stub when the plugin passes', async ($, on) => {
  world(on)
  await start($)
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)
    expect(await ui.find({ key: 'engine-band' })).toBeDefined()
    await ui.unmount()
  }
})
