import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { command, mountPane, start, world } from './world'

// v0.9: vim keys in the pane (Bryan: "use vim keybindings in the docket panel to move the selection
// around"; dismiss by "dd or moving the selection over the the delete button and hitting o twice or enter
// twice"). Keys are hotkey Buttons in the key row; the selection is Docket's own (› on its row).

type Ui = Awaited<ReturnType<typeof mountPane>>

function focusLog(on: Parameters<typeof world>[0]): string[] {
  const keys: string[] = []
  on('ui.focus', (_$, e) => {
    keys.push(String((e as { key?: unknown }).key ?? (e as { element?: unknown }).element))
    return {} as never
  })
  return keys
}

async function setUp($: Engine, n = 3): Promise<Ui> {
  await start($)
  const names = ['Renew the domain', 'Rotate the key', 'Merge the docs PR', 'Ship the release']
  for (const t of names.slice(0, n)) await command($, `add ${t}`)
  // /docket opens the pane, which selects the first row.
  await command($, '')
  return mountPane($, 'terminal')
}

const open = async (ui: Ui) => (await ui.findAll({ type: 'Box' })).map(b => b.key ?? '').filter(k => k.startsWith('item-')).map(k => Number(k.slice(5)))
const marked = async (ui: Ui) => (await ui.findAll({ type: 'Text' })).map(t => t.text.trim()).filter(x => x.startsWith('›'))
const vim = (ui: Ui, k: string) => ui.press({ key: `vim-${k}` })

test('rows lead with their #id; the key row shows the vim keys only while the pane has the keys', async ($, on) => {
  world(on)
  focusLog(on)
  const ui = await setUp($, 2)
  expect(await marked(ui)).toEqual(['›#1'])
  for (const k of ['j', 'k', 'h', 'l', 'g', 'o', 'd']) expect((await ui.find({ key: `vim-${k}` }))?.props.hotkey).toBe(k)
  expect((await ui.find({ key: 'dismiss-1' }))?.props.hotkey).toBeUndefined()
  await ui.unmount()
  const away = await mountPane($, 'terminal', false)
  expect(await away.find({ key: 'vim-j' })).toBeUndefined()
  expect(await away.find({ type: 'Text', text: 'ctrl+x tab for keys: j/k move, dd dismiss' })).toBeDefined()
  await away.unmount()
})

test("j/k move down and up, clamped; h/l walk the row's buttons; o presses where it landed", async ($, on) => {
  const w = world(on)
  const ui = await setUp($)
  await vim(ui, 'j')
  await vim(ui, 'j')
  await vim(ui, 'j')
  expect(await marked(ui)).toEqual(['›#3'])
  await vim(ui, 'k')
  expect(await marked(ui)).toEqual(['›#2'])
  // Reply here, Reply new, /btw, Done, ✕: three to the right is Done; h past the left edge stays.
  await vim(ui, 'h')
  await vim(ui, 'l')
  await vim(ui, 'l')
  await vim(ui, 'l')
  // The column is kept moving down: o on #3's Done closes #3.
  await vim(ui, 'j')
  await vim(ui, 'o')
  expect(await open(ui)).toEqual([1, 2])
  // #3 closed, so the selection restarts on Reply; four to the right is ✕, and o arms it as a press does.
  await w.clock.advance(1200)
  await vim(ui, 'k')
  for (let t = 0; t < 4; t++) await vim(ui, 'l')
  await vim(ui, 'o')
  expect((await ui.find({ key: 'dismiss-1' }))?.props.label).toBe('✕ wait…')
  await ui.unmount()
})

test('g goes to the top; gg stays there; a lone g on the top row goes to the end', async ($, on) => {
  const w = world(on)
  focusLog(on)
  const ui = await setUp($)
  await vim(ui, 'j')
  await vim(ui, 'j')
  await vim(ui, 'g')
  await vim(ui, 'g')
  expect(await marked(ui)).toEqual(['›#1'])
  await w.clock.advance(600)
  await vim(ui, 'g')
  expect(await marked(ui)).toEqual(['›#3'])
  await ui.unmount()
})

test('dd at vim speed dismisses the selected row after the hold check; a held d never does', async ($, on) => {
  const w = world(on)
  focusLog(on)
  const ui = await setUp($, 4)
  await vim(ui, 'j')
  // A held d: the first repeat 250 ms on, then every 33 ms for a second.
  await vim(ui, 'd')
  await w.clock.advance(250)
  await vim(ui, 'd')
  for (let t = 0; t < 30; t++) {
    await w.clock.advance(33)
    await vim(ui, 'd')
  }
  await w.clock.advance(300)
  expect(await open(ui)).toEqual([1, 2, 3, 4])
  // Released, then a fresh dd 120 ms apart.
  await vim(ui, 'd')
  expect((await ui.find({ key: 'dismiss-2' }))?.props.label).toBe('✕ again?')
  await w.clock.advance(120)
  await vim(ui, 'd')
  await w.clock.advance(100)
  expect(await open(ui)).toEqual([1, 2, 3, 4])
  await w.clock.advance(100)
  expect(await open(ui)).toEqual([1, 3, 4])
  // The marker moves to the row that took its place, and j goes on from there.
  expect(await marked(ui)).toEqual(['›#3'])
  await w.clock.advance(1200)
  await vim(ui, 'j')
  expect(await marked(ui)).toEqual(['›#4'])
  await ui.unmount()
})

test('vim keys run in order: a j then o press on the row j moved to', async ($, on) => {
  world(on)
  const ui = await setUp($)
  // Not awaited one by one: both queue at once, as fast typing does.
  await Promise.all([vim(ui, 'j'), vim(ui, 'l'), vim(ui, 'l'), vim(ui, 'l'), vim(ui, 'o')])
  expect(await open(ui)).toEqual([1, 3])
  await ui.unmount()
})

test('a fresh selection: the first key only lands on the top row', async ($, on) => {
  world(on)
  await start($)
  await command($, 'add Renew the domain')
  await command($, 'add Rotate the key')
  const ui = await mountPane($, 'terminal')
  expect(await marked(ui)).toEqual([])
  await vim(ui, 'j')
  expect(await marked(ui)).toEqual(['›#1'])
  await ui.unmount()
})

test('o presses the selected button; o or d after the selection was lost only lands it', async ($, on) => {
  const w = world(on)
  const ui = await setUp($)
  await vim(ui, 'l')
  await vim(ui, 'l')
  await vim(ui, 'l')
  await vim(ui, 'o')
  expect(await open(ui)).toEqual([2, 3])
  await w.clock.advance(1200)
  // #1 closed: the selection was lost; o only lands it on the row now at its index.
  await vim(ui, 'o')
  expect(await marked(ui)).toEqual(['›#2'])
  expect(await open(ui)).toEqual([2, 3])
  await ui.unmount()
})

test('after Reply here fills the box the letter keys are off until the next prompt or the keys button', async ($, on) => {
  world(on)
  focusLog(on)
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } as never }))
  on('prompt.fill', () => ({ isFilled: true, cursor: 0 }) as never)
  const ui = await setUp($, 1)
  await ui.press({ key: 'reply-1' })
  expect(await ui.find({ key: 'vim-o' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Esc to type your reply' })).toBeDefined()
  await ui.press({ key: 'docket-keys-on' })
  expect(await ui.find({ key: 'vim-o' })).toBeDefined()
  // Off again after another fill; the next prompt brings them back.
  await ui.press({ key: 'reply-1' })
  expect(await ui.find({ key: 'vim-o' })).toBeUndefined()
  await ui.unmount()
  await $.prompt.submit({ text: 'Re: Renew the domain — yes' })
  const again = await mountPane($, 'terminal')
  expect(await again.find({ key: 'vim-o' })).toBeDefined()
  await again.unmount()
})
