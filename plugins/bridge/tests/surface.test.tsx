import { expect, test } from 'claude-code/testing'

import { BAND_PROPS, SAMPLE, SURFACES, WIDE, NARROW, decide, mountBand, mountPane, openWithCommand, start, world } from './world'

test('only the first card arms hotkeys; every card shows its parts', async ($, on) => {
  world(on)
  await start($)
  await decide($)
  await decide($, { ...SAMPLE, question: 'Second?', options: [{ label: 'X' }, { label: 'Y' }, { label: 'Z' }], recommend: 2 })
  for (const surface of SURFACES) {
    const ui = await mountPane($, surface)
    expect((await ui.find({ key: 'pick-1-0' }))?.props.hotkey).toBe('1')
    expect((await ui.find({ key: 'pick-1-1' }))?.props.hotkey).toBe('2')
    expect((await ui.find({ key: 'make-1' }))?.props.hotkey).toBe('m')
    expect((await ui.find({ key: 'make-1' }))?.props.variant).toBe('primary')
    expect((await ui.find({ key: 'other-1' }))?.props.hotkey).toBe('o')
    expect((await ui.find({ key: 'pick-2-0' }))?.props.hotkey).toBeUndefined()
    expect((await ui.find({ key: 'make-2' }))?.props.hotkey).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '#1 Which database?' })).toBeDefined()
    expect((await ui.find({ key: 'context-1' }))?.props.text).toBe(SAMPLE.context)
    expect(await ui.find({ type: 'Text', text: 'Has pgvector' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Why 1: pgvector does the search for us.' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Why it is yours: It changes the hosting bill/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '2 pending' })).toBeDefined()
    expect(await ui.find({ key: 'other-text-1' })).toBeUndefined()
    await ui.unmount()
  }
})

test('Other opens the field and turns the keys off; pressing it again closes it', async ($, on) => {
  world(on)
  await start($)
  await decide($)
  for (const surface of SURFACES) {
    const ui = await mountPane($, surface)
    await ui.press({ key: 'other-1' })
    expect((await ui.find({ key: 'other-text-1' }))?.type).toBe('Input')
    expect((await ui.find({ key: 'make-1' }))?.props.hotkey).toBeUndefined()
    expect((await ui.find({ key: 'pick-1-0' }))?.props.hotkey).toBeUndefined()
    expect((await ui.find({ key: 'other-1' }))?.props.hotkey).toBeUndefined()
    await ui.press({ key: 'other-1' })
    expect(await ui.find({ key: 'other-text-1' })).toBeUndefined()
    expect((await ui.find({ key: 'make-1' }))?.props.hotkey).toBe('m')
    await ui.unmount()
  }
})

test('on mobile there is no Other button, though the table hands out an Input; picks still draw', async ($, on) => {
  world(on)
  await start($)
  await decide($)
  const ui = await mountPane($, 'mobile')
  expect(await ui.find({ key: 'other-1' })).toBeUndefined()
  expect(await ui.find({ key: 'pick-1-0' })).toBeDefined()
  expect(await ui.find({ key: 'make-1' })).toBeDefined()
  await ui.unmount()
})

test('an empty pane says so', async ($, on) => {
  world(on)
  await start($)
  for (const surface of SURFACES) {
    const ui = await mountPane($, surface)
    expect(await ui.find({ key: 'bridge-empty' })).toBeDefined()
    await ui.unmount()
  }
})

test('the band: hidden at zero, counts with the right noun, yields to a survey', async ($, on) => {
  world(on)
  await start($)
  for (const surface of SURFACES) {
    const quiet = await mountBand($, surface, NARROW)
    expect(await quiet.find({ key: 'engine-band' })).toBeDefined()
    await quiet.unmount()
  }
  await decide($)
  for (const surface of SURFACES) {
    const one = await mountBand($, surface, NARROW)
    expect(await one.find({ type: 'Text', text: '\u2691 1 decision pending \u00b7 /bridge' })).toBeDefined()
    await one.unmount()
  }
  await decide($, { ...SAMPLE, question: 'Two?' })
  for (const surface of SURFACES) {
    const two = await mountBand($, surface, NARROW)
    expect(await two.find({ type: 'Text', text: '\u2691 2 decisions pending \u00b7 /bridge' })).toBeDefined()
    await two.unmount()
    const survey = await mountBand($, surface, NARROW, { ...BAND_PROPS, hasSurvey: true })
    expect(await survey.find({ key: 'engine-band' })).toBeDefined()
    await survey.unmount()
  }
})

test('/bridge with nothing pending opens nothing', async ($, on) => {
  const w = world(on)
  await start($)
  expect((await openWithCommand($)).text).toBe('Bridge: no decisions pending.')
  expect(w.opens).toEqual([])
})

test('/bridge opens the pane with focus, and the band then hides', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  const ran = await openWithCommand($)
  expect(w.opens.at(-1)).toEqual({ id: 'bridge', focus: true })
  expect(ran.text).toContain('1 pending')
  for (const surface of SURFACES) {
    const band = await mountBand($, surface, WIDE)
    expect(await band.find({ key: 'engine-band' })).toBeDefined()
    await band.unmount()
  }
})

test('/bridge says why when the pane is not placed, and does not leave it waiting', async ($, on) => {
  const w = world(on, { placed: false })
  await start($)
  await decide($)
  expect((await openWithCommand($)).text).toBe('Bridge: the pane could not be placed (narrow terminal).')
  expect(w.opens).toHaveLength(1)
  expect(w.closes).toEqual(['bridge'])
})

// The engine's $ in tests has no ui.close noun, so a close by the person cannot be raised here
// ("$.ui.close is not a function"); a live session has to check it. This test covers the
// other way the stored flag goes stale: the pane vanishes with no hook of ours running (an unload).
test('a pane gone without any hook running is found again by the band, and by the next decision', async ($, on) => {
  const w = world(on)
  await start($)
  await decide($)
  await openWithCommand($)
  w.openPanes.delete('bridge')
  // The band reads the engine's pane list, not the stored flag, so the pending decision shows at once.
  const stale = await mountBand($, 'terminal', NARROW)
  expect(await stale.find({ key: 'bridge-band' })).toBeDefined()
  await stale.unmount()
  await decide($, { ...SAMPLE, question: 'Two?' })
  // The band is the notice; a queued decision raises no toast.
  expect(w.toasts).toEqual([])
  for (const surface of SURFACES) {
    const band = await mountBand($, surface, NARROW)
    expect(await band.find({ key: 'bridge-band' })).toBeDefined()
    await band.unmount()
  }
})

// A placed pane can be a background tab behind another plugin's pane: neither it nor a hidden band
// would then tell the user a decision arrived, so the band draws, and is the only notice.
test('a pane placed behind another pane: the next decision is not reopened and the band still draws', async ($, on) => {
  const w = world(on)
  await start($)
  await mountBand($, 'terminal', WIDE)
  await decide($)
  expect(w.opens).toEqual([{ id: 'bridge' }])
  expect(w.toasts).toEqual([])
  w.isShown = false
  await decide($, { ...SAMPLE, question: 'Two?' })
  expect(w.opens).toHaveLength(1)
  expect(w.toasts).toEqual([])
  for (const surface of SURFACES) {
    const band = await mountBand($, surface, NARROW)
    expect(await band.find({ key: 'bridge-band' })).toBeDefined()
    await band.unmount()
  }
})
