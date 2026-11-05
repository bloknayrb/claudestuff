import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { b64Utf16, launchScript, leadHere, leadNew, waitingText, takenText } from '../hooks/spawn'
import { APPS, BASE, command, mountPane, openIds, start, world } from './world'
import type { World } from './world'

type Fill = { text: string; mode?: string }

// The prompt box: what it holds, and every fill.
function box(on: Parameters<typeof world>[0], w: World, refuse = 0) {
  const b = { draft: '', fills: [] as Fill[], refuse }
  on('prompt.read', () => ({ value: { text: b.draft, cursor: b.draft.length } as never }))
  on('prompt.fill', (_$, e) => {
    if (b.refuse > 0) {
      b.refuse -= 1
      return { isFilled: false, refusal: 'dialog', text: b.draft, cursor: 0 } as never
    }
    b.fills.push({ text: e.text, ...(e.mode === undefined ? {} : { mode: e.mode }) })
    b.draft = e.mode === 'append' ? `${b.draft}${e.text}` : e.text
    return { isFilled: true, text: b.draft, cursor: 0 } as never
  })
  void w
  return b
}

const handoffFiles = (w: World) => [...w.files.entries()].filter(([p]) => p.startsWith(`${BASE}/handoff/`))

async function newRun($: Engine, args: string, kind: 'composer' | 'plugin' = 'composer') {
  const origin = kind === 'plugin' ? { kind: 'plugin', name: 'other' } : { kind: 'composer' }
  const r = await $.command.run({ command: 'docket', args, origin, presentation: { isFullscreen: true, columns: 160 } } as never)
  return (r as { text?: string }).text ?? ''
}

test('Reply new shows beside Reply here where Windows Terminal is found, and not where it is not', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  const ui = await mountPane($, 'terminal')
  expect(await ui.find({ key: 'reply-1' })).toBeDefined()
  expect(await ui.find({ key: 'replynew-1' })).toBeDefined()
  await ui.unmount()
  expect(w.lists.includes(`${APPS}/`)).toBe(true)
})

test('no Windows Terminal: no Reply new button, and the command refuses without touching anything', async ($, on) => {
  const w = world(on, { hasTerminal: false })
  await start($)
  await command($, 'add Renew the domain')
  const ui = await mountPane($, 'terminal')
  expect(await ui.find({ key: 'replynew-1' })).toBeUndefined()
  await ui.unmount()
  const text = await newRun($, 'new #1 — renew it now')
  expect(text.includes('needs Windows Terminal')).toBe(true)
  expect(handoffFiles(w).length).toBe(0)
  expect(await openIds($)).toEqual([1])
})

test('Reply new fills its lead in an empty box, swaps with Reply here keeping the typed tail, and refuses over a draft', async ($, on) => {
  const w = world(on)
  const b = box(on, w)
  await start($)
  await command($, 'add Renew the domain')
  await command($, 'add Rotate the key')
  const items = await (async () => {
    const ui = await mountPane($, 'terminal')
    await ui.press({ key: 'replynew-1' })
    await ui.unmount()
    return b.fills
  })()
  const one = { id: 1, kind: 'do' as const, text: 'Renew the domain', quote: '', singleRec: false, source: 'manual' as const, openedTurn: 0, status: 'open' as const }
  expect(items[0]?.text).toBe(leadNew(one))
  // He types, then switches to Reply here on the same item: the tail stays.
  b.draft = `${leadNew(one)}renew for 2 years`
  let ui = await mountPane($, 'terminal')
  await ui.press({ key: 'reply-1' })
  expect(b.draft).toBe(`${leadHere(one)}renew for 2 years`)
  // And back.
  await ui.press({ key: 'replynew-1' })
  expect(b.draft).toBe(`${leadNew(one)}renew for 2 years`)
  // A here-lead for another item, or any other draft: Reply new refuses and leaves the box alone.
  b.draft = `${leadHere(one)}yes`
  await ui.press({ key: 'replynew-2' })
  expect(b.draft).toBe(`${leadHere(one)}yes`)
  expect(w.toasts.some(t => t.includes('Reply new needs an empty box'))).toBe(true)
  // A then B: Reply here on another item appends, keeping A's answer.
  await ui.press({ key: 'reply-2' })
  expect(b.draft).toBe(`${leadHere(one)}yes\nRe: Rotate the key — `)
  await ui.unmount()
  ui = await mountPane($, 'terminal')
  await ui.unmount()
})

test('/docket new writes the handoff, closes the item as yours, and launches Windows Terminal with only a nonce', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  const text = await newRun($, 'new #1 (Renew the domain) — renew for "2 years"; ok?\nthanks')
  expect(text.startsWith('Docket: opening a new window for "Renew the domain"')).toBe(true)
  await w.clock.settle()
  // The handoff waits with the reply verbatim.
  const files = handoffFiles(w)
  expect(files.length).toBe(1)
  const [path, file] = files[0] as [string, { text: string }]
  const nonce = /([0-9a-f]{32})\.json$/.exec(path)?.[1] ?? ''
  const h = JSON.parse(file.text)
  expect(h.state).toBe('waiting')
  expect(h.reply).toBe('renew for "2 years"; ok?\nthanks')
  expect(h.fromSid).toBe('sess-1')
  // Closed here, as the user's.
  expect(await openIds($)).toEqual([])
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'docket-show-closed' })
  expect(await ui.find({ type: 'Text', text: 'Renew the domain — you: sent to a new window' })).toBeDefined()
  await ui.unmount()
  // One launch: wt from WindowsApps, run from the docket folder, the script carrying only the nonce.
  expect(w.runs.length).toBe(1)
  const run = w.runs[0] as { argv: string[]; cwd?: string }
  expect(run.argv[0]).toBe('C:\\Users\\tester\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe')
  expect(run.cwd).toBe(BASE)
  expect(run.argv.at(-1)).toBe(b64Utf16(launchScript(nonce, undefined)))
  expect(run.argv.join(' ').includes('2 years')).toBe(false)
})

test('Reopen brings a handed-off item back', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  await newRun($, 'new #1 — renew it')
  await w.clock.settle()
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'docket-show-closed' })
  const reopen = (await ui.findAll({ type: 'Button' })).find(x => (x.key ?? '').startsWith('reopen-'))
  await ui.press({ key: reopen?.key ?? '' })
  await ui.unmount()
  expect(await openIds($)).toEqual([1])
})

test('/docket new refuses, touching nothing: a plugin, a closed id, a wrong label, an empty reply, a ! reply', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  expect((await newRun($, 'new #1 — renew', 'plugin')).includes('only runs from your own prompt')).toBe(true)
  expect((await newRun($, 'new #7 — renew')).includes("#7 isn't open")).toBe(true)
  expect((await newRun($, 'new #1 (Rotate the key) — renew')).includes('here is "Renew the domain"')).toBe(true)
  expect((await newRun($, 'new #1 (Renew the domain) — ')).includes('nothing after the dash')).toBe(true)
  expect((await newRun($, 'new #1 — !ls')).includes('something other than ! or /')).toBe(true)
  await w.clock.settle()
  expect(handoffFiles(w).length).toBe(0)
  expect(w.runs.length).toBe(0)
  expect(await openIds($)).toEqual([1])
})

test('a handoff that cannot be written closes nothing and launches nothing', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  w.failWriteMatch = '/handoff/'
  const text = await newRun($, 'new #1 — renew')
  await w.clock.settle()
  expect(text.includes("couldn't write the handoff")).toBe(true)
  expect(await openIds($)).toEqual([1])
  expect(w.runs.length).toBe(0)
})

test('a launch that fails or exits non-zero says so, with the way back', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  await command($, 'add Rotate the key')
  w.runAnswer = { throws: 'spawn ENOENT' }
  await newRun($, 'new #1 — renew')
  await w.clock.settle()
  expect(w.toasts.some(t => t.includes("Windows Terminal didn't start") && t.includes('Reopen'))).toBe(true)
  w.runAnswer = { throws: 'timed out after 15000 ms' }
  await newRun($, 'new #2 — rotate')
  await w.clock.settle()
  expect(w.toasts.some(t => t.includes('may not have started'))).toBe(true)
})

// --- the new window ---

const NONCE = '0123456789abcdef0123456789abcdef'
const waiting = (createdAt: number, root = 'C:/work') =>
  waitingText({ nonce: NONCE, fromSid: 'sess-0', itemId: 3, root, itemText: 'Renew the domain', quote: 'Renew it before Friday?', reply: 'renew for 2 years', createdAt })

test('a window Reply new opened puts the reply in its box, marks it taken, and unsets the variable', async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  const b = box(on, w)
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: waiting(1000), mtimeMs: 1000 })
  await start($)
  await w.clock.settle()
  expect(b.fills.map(f => f.text)).toEqual(['renew for 2 years'])
  expect(w.files.get(`${BASE}/handoff/${NONCE}.json`)?.text).toBe(takenText(NONCE, 'sess-0', 3))
  expect(w.envSets).toEqual([{ name: 'DOCKET_HANDOFF', value: undefined }])
  expect(w.logs.some(l => l.includes('this window answers "Renew the domain"'))).toBe(true)
  // Nothing of the folder's carry was looked at.
  expect(w.lists.some(d => d.includes('/carry/'))).toBe(false)
})

test('the fill is retried while a dialog holds the keys', async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  const b = box(on, w, 2)
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: waiting(1000), mtimeMs: 1000 })
  await start($)
  await w.clock.settle()
  expect(b.fills.length).toBe(0)
  await w.clock.advance(1000)
  await w.clock.settle()
  await w.clock.advance(1000)
  await w.clock.settle()
  expect(b.fills.map(f => f.text)).toEqual(['renew for 2 years'])
  expect(w.files.get(`${BASE}/handoff/${NONCE}.json`)?.text).toBe(takenText(NONCE, 'sess-0', 3))
})

test('a box already typed into is never overwritten: the reply is logged instead', async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  const b = box(on, w)
  b.draft = 'something I started'
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: waiting(1000), mtimeMs: 1000 })
  await start($)
  await w.clock.settle()
  expect(b.fills.length).toBe(0)
  expect(w.logs.some(l => l.includes("couldn't put your reply in the box") && l.includes('renew for 2 years'))).toBe(true)
  expect(w.files.get(`${BASE}/handoff/${NONCE}.json`)?.text).toBe(takenText(NONCE, 'sess-0', 3))
})

test('a stale, wrong-folder or missing handoff fills nothing and says so; a taken one is silent', async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  const b = box(on, w)
  // Stale: created 20 minutes before now.
  await w.clock.set(1000 + 20 * 60 * 1000)
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: waiting(1000), mtimeMs: 1000 })
  await start($)
  await w.clock.settle()
  expect(b.fills.length).toBe(0)
  expect(w.logs.some(l => l.includes('missing or stale'))).toBe(true)
})

test('a wrong-folder handoff is refused', async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  const b = box(on, w)
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: waiting(1000, 'C:/elsewhere'), mtimeMs: 1000 })
  await start($)
  await w.clock.settle()
  expect(b.fills.length).toBe(0)
  expect(w.logs.some(l => l.includes('missing or stale'))).toBe(true)
})

test('a taken handoff is silent, and a reload never picks up twice', async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  const b = box(on, w)
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: waiting(1000), mtimeMs: 1000 })
  await start($)
  await w.clock.settle()
  // A hot reload re-runs session.start (the variable reads the same in the mock).
  await start($)
  await w.clock.settle()
  expect(b.fills.length).toBe(1)
  expect(w.logs.filter(l => l.includes('missing or stale')).length).toBe(0)
})

test("the item's context rides with the first real prompt only, and never reaches the judge as the user's words", async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  box(on, w)
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: waiting(1000), mtimeMs: 1000 })
  await start($)
  await w.clock.settle()
  const submit = $.prompt.submit as unknown as (e: Record<string, unknown>) => Promise<{ context?: string[] }>
  // A slash command doesn't use it up.
  const cmd = await submit({ text: '/model', origin: { kind: 'composer' }, queueSubmit: false, command: 'model' })
  expect(cmd.context ?? []).toEqual([])
  const first = await submit({ text: 'renew for 2 years', origin: { kind: 'composer' }, queueSubmit: false })
  expect((first.context ?? []).length).toBe(1)
  expect(first.context?.[0]?.includes('Renew it before Friday?')).toBe(true)
  const second = await submit({ text: 'and then?', origin: { kind: 'composer' }, queueSubmit: false })
  expect(second.context ?? []).toEqual([])
  // Add an item and let a resolve check run: the user text it sends holds only what was typed.
  await command($, 'add Check DNS')
  await submit({ text: 'done with dns', origin: { kind: 'composer' }, queueSubmit: false })
  await w.clock.settle()
  const sent = w.calls.map(c => c.prompt).join('\n')
  expect(sent.includes('Renew it before Friday?')).toBe(false)
})

test('forget blanks the handoffs this session wrote', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  await newRun($, 'new #1 — renew for 2 years')
  await w.clock.settle()
  await command($, 'forget')
  await w.clock.settle()
  const files = handoffFiles(w)
  expect(files.length).toBe(1)
  expect(files[0]?.[1].text.includes('renew for 2 years')).toBe(false)
})

test('a handoff already taken is silent; a missing one says so', async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  const b = box(on, w)
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: takenText(NONCE, 'sess-0', 3), mtimeMs: 1000 })
  await start($)
  await w.clock.settle()
  expect(b.fills.length).toBe(0)
  expect(w.logs.filter(l => l.startsWith('transcript: Docket')).length).toBe(0)
})

test('a missing handoff file says so once', async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  const b = box(on, w)
  await start($)
  await w.clock.settle()
  await start($)
  await w.clock.settle()
  expect(b.fills.length).toBe(0)
  expect(w.logs.filter(l => l.includes('missing or stale')).length).toBe(1)
})

test('a fill refused for the whole window logs the reply and marks the handoff taken', async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  box(on, w, 1000)
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: waiting(1000), mtimeMs: 1000 })
  await start($)
  await w.clock.settle()
  for (let i = 0; i < 125; i += 1) {
    await w.clock.advance(1000)
    await w.clock.settle()
  }
  expect(w.logs.some(l => l.includes("couldn't put your reply in the box") && l.includes('renew for 2 years'))).toBe(true)
  expect(w.files.get(`${BASE}/handoff/${NONCE}.json`)?.text).toBe(takenText(NONCE, 'sess-0', 3))
})

test('a fill that throws is retried, and the reply is never lost to the debug log', async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  let throws = 2
  const fills: string[] = []
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } as never }))
  on('prompt.fill', (_$, e) => {
    if (throws > 0) {
      throws -= 1
      throw new Error('no box yet')
    }
    fills.push(e.text)
    return { isFilled: true, text: e.text, cursor: 0 } as never
  })
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: waiting(1000), mtimeMs: 1000 })
  await start($)
  for (let i = 0; i < 4; i += 1) {
    await w.clock.settle()
    await w.clock.advance(1000)
  }
  await w.clock.settle()
  expect(fills).toEqual(['renew for 2 years'])
  expect(w.files.get(`${BASE}/handoff/${NONCE}.json`)?.text).toBe(takenText(NONCE, 'sess-0', 3))
})

test('a /clear drops a new window\'s pending item context', async ($, on) => {
  const w = world(on, { env: { DOCKET_HANDOFF: NONCE } })
  box(on, w)
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: waiting(1000), mtimeMs: 1000 })
  await start($)
  await w.clock.settle()
  await $.session.end({ reason: 'clear', sessionId: 'sess-1', resume: { id: 'sess-1' } } as never)
  w.sessionId = 'sess-2'
  await w.clock.settle()
  const submit = $.prompt.submit as unknown as (e: Record<string, unknown>) => Promise<{ context?: string[] }>
  const first = await submit({ text: 'hello', origin: { kind: 'composer' }, queueSubmit: false })
  expect(first.context ?? []).toEqual([])
})

test('prune blanks a handoff no window took within 15 minutes', async ($, on) => {
  const w = world(on)
  w.files.set(`${BASE}/handoff/${NONCE}.json`, { text: waiting(0), mtimeMs: 0 })
  await w.clock.set(20 * 60 * 1000)
  await start($)
  await w.clock.advance(60000)
  await w.clock.settle()
  expect(w.files.get(`${BASE}/handoff/${NONCE}.json`)?.text.includes('renew for 2 years')).toBe(false)
})

test('Reply new over a box answering two items refuses, so the second answer stays here', async ($, on) => {
  const w = world(on)
  const b = box(on, w)
  await start($)
  await command($, 'add Renew the domain')
  await command($, 'add Rotate the key')
  b.draft = 'Re: Renew the domain — yes\nRe: Rotate the key — no'
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'replynew-1' })
  await ui.unmount()
  expect(b.draft).toBe('Re: Renew the domain — yes\nRe: Rotate the key — no')
  expect(w.toasts.some(t => t.includes('Reply new needs an empty box'))).toBe(true)
})
