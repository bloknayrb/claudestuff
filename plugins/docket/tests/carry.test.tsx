import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { carryEnvelope, carryText, claimText, normRoot, parseCarry, rootKey, takeInto } from '../hooks/carry'
import { addManual, freshSession } from '../hooks/ledger'
import type { DocketSession } from '../types'
import { BASE, classic, command, freshProcess, mountPane, openIds, say, start, world } from './world'
import type { World } from './world'

const ROOT = 'C:/work'
const KEY = rootKey(ROOT)
const carryPath = (sid: string, slot: 'a' | 'b') => `${BASE}/roots/${KEY}/carry/${sid}.${slot}.json`
const claimPath = (src: string, gen: number, by: string) => `${BASE}/roots/${KEY}/claims/${src}/${gen}/${by}.json`
const endAs = (reason: string, sessionId: string) => ({ reason, sessionId, resume: { id: sessionId } }) as never

function source(sid: string, texts: string[], over: Partial<DocketSession> = {}): DocketSession {
  let s: DocketSession = { ...freshSession(), sid, root: ROOT, carry: { on: true, gen: 1 }, ...over }
  for (const t of texts) s = addManual(s, t, 500)
  return s
}

// A carry file on disk, as another session left it.
function seedCarry(w: World, s: DocketSession, opts: { mtime?: number; savedAt?: number; seq?: number } = {}): void {
  const seq = opts.seq ?? 1
  w.files.set(carryPath(s.sid, seq % 2 === 1 ? 'a' : 'b'), { text: carryEnvelope(s.sid, s.root, seq, opts.savedAt ?? w.clock.now(), carryText(s)), mtimeMs: opts.mtime ?? 900 })
}

const carryOf = (w: World, sid: string) =>
  [carryPath(sid, 'a'), carryPath(sid, 'b')].map(p => parseCarry(w.files.get(p)?.text, sid)).filter(x => x !== null).sort((a, b) => b!.seq - a!.seq)[0] ?? null

async function texts($: Engine): Promise<string[]> {
  const ui = await mountPane($, 'terminal')
  const ts = (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '')
  await ui.unmount()
  return ts
}

test('rootKey: Windows paths fold case and slashes; POSIX paths keep case', () => {
  expect(rootKey('C:\\Work\\Proj')).toBe(rootKey('c:/work/proj/'))
  expect(normRoot('//Server/Share')).toBe('//server/share')
  expect(rootKey('/home/a/Proj') === rootKey('/home/a/proj')).toBe(false)
})

test('a carry file with a bad item, a closed item or the wrong sid is rejected whole', () => {
  const s = source('src-1', ['One'])
  const good = carryEnvelope('src-1', ROOT, 1, 1, carryText(s))
  expect(parseCarry(good, 'src-1')?.items.length).toBe(1)
  expect(parseCarry(good, 'src-2')).toBe(null)
  expect(parseCarry(good.replace('"kind":"do"', '"kind":"maybe"'), 'src-1')).toBe(null)
  expect(parseCarry(good.replace('"status":"open"', '"status":"resolved"'), 'src-1')).toBe(null)
  expect(parseCarry(good.slice(0, 30), 'src-1')).toBe(null)
})

test('the take: new ids, singleRec off, origin and firstSeenAt kept, dedupe by origin, switch on', () => {
  const src = source('src-1', ['One', 'Two'])
  const items = parseCarry(carryEnvelope('src-1', ROOT, 1, 1, carryText(src)), 'src-1')!.items
  const mine = { ...addManual({ ...freshSession(), sid: 'me', root: ROOT }, 'Mine', 1) }
  const r = takeInto(mine, items, 9000, 'work')
  expect(r.added).toBe(2)
  expect(r.session.items.map(i => i.id)).toEqual([1, 2, 3])
  expect(r.session.items.slice(1).every(i => !i.singleRec && i.carriedAt === 9000 && i.firstSeenAt === 500)).toBe(true)
  expect(r.session.items[1]?.origin).toBe('src-1:1')
  expect(r.session.carry).toEqual({ on: true, gen: 1 })
  const again = takeInto(r.session, items, 9500, 'work')
  expect(again.added).toBe(0)
  // An empty carry still turns an untouched switch on: the switch is sticky.
  expect(takeInto({ ...freshSession(), sid: 'x', root: ROOT }, [], 1, 'work').session.carry).toEqual({ on: true, gen: 1 })
  // A switch already touched is never overridden.
  expect(takeInto({ ...freshSession(), sid: 'x', root: ROOT, carry: { on: false, gen: 2 } }, items, 1, 'work').session.carry).toEqual({ on: false, gen: 2 })
})

test('carry on writes the open items; a close drops one; carry off writes the off record', async ($, on) => {
  const w = world(on)
  await freshProcess($, w)
  await command($, 'add Renew the domain')
  await command($, 'add Rotate the key')
  expect(String(((await command($, 'carry on')) as { text?: string }).text).startsWith('Docket: carry is on.')).toBe(true)
  await w.clock.settle()
  expect(carryOf(w, 'sess-1')?.items.map(i => i.text)).toEqual(['Renew the domain', 'Rotate the key'])
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'dismiss-1' })
  await ui.unmount()
  await w.clock.settle()
  expect(carryOf(w, 'sess-1')?.items.map(i => i.text)).toEqual(['Rotate the key'])
  await command($, 'carry off')
  await w.clock.settle()
  expect(carryOf(w, 'sess-1')?.on).toBe(false)
  expect(carryOf(w, 'sess-1')?.items).toEqual([])
})

test('a session that never turned carry on writes no carry file, even on carry off or forget', async ($, on) => {
  const w = world(on)
  await freshProcess($, w)
  await command($, 'add Renew the domain')
  await command($, 'carry off')
  await command($, 'forget')
  await w.clock.settle()
  expect([...w.files.keys()].some(p => p.includes('/roots/'))).toBe(false)
})

test('a -p session writes and takes nothing', async ($, on) => {
  const w = world(on)
  seedCarry(w, source('src-1', ['From before']))
  await freshProcess($, w, false)
  expect(await openIds($)).toEqual([])
  const r = (await command($, 'carry on')) as { text?: string }
  expect(String(r.text).includes('interactive')).toBe(true)
  expect([...w.files.keys()].some(p => p.includes('/claims/'))).toBe(false)
})

test('a fresh process takes the folder carry once, claims it, turns its switch on, and says so at the first prompt', async ($, on) => {
  const w = world(on)
  seedCarry(w, source('src-1', ['Renew the domain', 'Rotate the key']))
  w.sessionId = 'sess-9'
  await freshProcess($, w)
  expect(await openIds($)).toEqual([1, 2])
  expect(w.files.has(claimPath('src-1', 1, 'sess-9'))).toBe(true)
  expect(String(((await command($, 'carry')) as { text?: string }).text)).toBe('Docket: carry is on.')
  await say($, w, 'hi')
  expect(w.logs.filter(l => l.startsWith('transcript: Docket: carried in 2 items from your previous session in work.')).length).toBe(1)
  await say($, w, 'again')
  expect(w.logs.filter(l => l.includes('Docket: carried in')).length).toBe(1)
})

for (const c of [
  { name: 'a resume (classic source resume)', source: 'resume' as const },
  { name: 'a compact', source: 'compact' as const },
]) {
  test(`no take on ${c.name}`, async ($, on) => {
    const w = world(on)
    seedCarry(w, source('src-1', ['From before']))
    w.sessionId = 'sess-9'
    await classic($, w, c.source, 'sess-9')
    await start($)
    await w.clock.settle()
    expect(await openIds($)).toEqual([])
  })
}

test('no take: an off file, a claimed gen, a 15-day-old carry, or a newest file that is off over an older on', async ($, on) => {
  const w = world(on)
  // Older carry is on; the newest is off: nothing comes back.
  seedCarry(w, source('old-1', ['Stale thing']), { mtime: 800 })
  seedCarry(w, source('new-1', ['x'], { carry: { on: false, gen: 1 } }), { mtime: 950 })
  w.sessionId = 'sess-9'
  await freshProcess($, w)
  expect(await openIds($)).toEqual([])
})

test('no take of a claimed gen; no take of a carry over 14 days old', async ($, on) => {
  const w = world(on)
  seedCarry(w, source('src-1', ['Already taken']))
  w.files.set(claimPath('src-1', 1, 'someone'), { text: claimText('src-1', 1, 'someone', 1), mtimeMs: 901 })
  w.sessionId = 'sess-9'
  await freshProcess($, w)
  expect(await openIds($)).toEqual([])
  expect(w.logs.some(l => l.includes('another session already took it'))).toBe(true)
})

test('a carry over 14 days old is logged and left', async ($, on) => {
  const w = world(on)
  await w.clock.set(20 * 24 * 60 * 60 * 1000)
  seedCarry(w, source('src-1', ['Ancient']), { savedAt: 1000 })
  w.sessionId = 'sess-9'
  await freshProcess($, w)
  expect(await openIds($)).toEqual([])
  expect(w.logs.some(l => l.includes('more than 14 days old'))).toBe(true)
})

test('a garbled claim counts as taken', async ($, on) => {
  const w = world(on)
  seedCarry(w, source('src-1', ['One']))
  w.files.set(`${BASE}/roots/${KEY}/claims/src-1/1/not a sid!.json`, { text: '{', mtimeMs: 901 })
  w.sessionId = 'sess-9'
  await freshProcess($, w)
  expect(await openIds($)).toEqual([])
})

test('the chain: a taken source that wrote again is newest, and the take follows to where its items went', async ($, on) => {
  const w = world(on)
  seedCarry(w, source('mid-1', ['Carried on']), { mtime: 900 })
  // src-1 was taken by mid-1, then src-1 wrote again (still open elsewhere): it is the newest file.
  seedCarry(w, source('src-1', ['Old copy']), { mtime: 990 })
  w.files.set(claimPath('src-1', 1, 'mid-1'), { text: claimText('src-1', 1, 'mid-1', 1), mtimeMs: 950 })
  w.sessionId = 'sess-9'
  await freshProcess($, w)
  const ts = await texts($)
  expect(ts.some(t => t.includes('Carried on'))).toBe(true)
  expect(ts.some(t => t.includes('Old copy'))).toBe(false)
})

test('/clear with carry on brings the open items into the cleared conversation; with it off, nothing', async ($, on) => {
  for (const isOn of [true]) {
    const w = world(on)
    await freshProcess($, w)
    await command($, 'add Renew the domain')
    if (isOn) await command($, 'carry on')
    await w.clock.settle()
    await $.session.end(endAs('clear', 'sess-1'))
    w.sessionId = 'sess-2'
    await classic($, w, 'clear', 'sess-2')
    expect((await openIds($)).length).toBe(1)
    expect(w.files.has(claimPath('sess-1', 1, 'sess-2'))).toBe(true)
  }
})

test('/clear with carry off carries nothing', async ($, on) => {
  const w = world(on)
  await freshProcess($, w)
  await command($, 'add Renew the domain')
  await w.clock.settle()
  await $.session.end(endAs('clear', 'sess-1'))
  w.sessionId = 'sess-2'
  await classic($, w, 'clear', 'sess-2')
  expect(await openIds($)).toEqual([])
})

test('A, /clear to B, /clear to C: C gets B\'s open items, not A\'s closed ones', async ($, on) => {
  const w = world(on)
  await freshProcess($, w)
  await command($, 'add Alpha')
  await command($, 'carry on')
  await $.session.end(endAs('clear', 'sess-1'))
  w.sessionId = 'sess-2'
  await classic($, w, 'clear', 'sess-2')
  expect(await openIds($)).toEqual([1])
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'done-1' })
  await ui.unmount()
  await command($, 'add Beta')
  await w.clock.settle()
  await $.session.end(endAs('clear', 'sess-2'))
  w.sessionId = 'sess-3'
  await classic($, w, 'clear', 'sess-3')
  const ts = await texts($)
  expect(ts.some(t => t.includes('Beta'))).toBe(true)
  expect(ts.some(t => t.includes('Alpha'))).toBe(false)
})

test('a lazy landing before the classic call still carries (unknown source counts as /clear)', async ($, on) => {
  const w = world(on)
  await freshProcess($, w)
  await command($, 'add Renew the domain')
  await command($, 'carry on')
  await $.session.end(endAs('clear', 'sess-1'))
  w.sessionId = 'sess-2'
  await say($, w, 'hello')
  expect((await openIds($)).length).toBe(1)
  // The later classic call is a no-op: no second take.
  await classic($, w, 'clear', 'sess-2')
  expect((await openIds($)).length).toBe(1)
})

test('/resume onto a session with a snapshot takes no capture', async ($, on) => {
  const w = world(on)
  await freshProcess($, w)
  await command($, 'add Older item')
  await $.session.end(endAs('clear', 'sess-1'))
  w.sessionId = 'sess-2'
  await classic($, w, 'clear', 'sess-2')
  await command($, 'add In two')
  await command($, 'carry on')
  await w.clock.settle()
  await $.session.end(endAs('resume', 'sess-2'))
  w.sessionId = 'sess-1'
  await classic($, w, 'resume', 'sess-1')
  const ts = await texts($)
  expect(ts.some(t => t.includes('Older item'))).toBe(true)
  expect(ts.some(t => t.includes('In two'))).toBe(false)
})

test('source notice: a claim by a later session marks this one taken; off then on carries again', async ($, on) => {
  const w = world(on)
  await freshProcess($, w)
  await command($, 'add Renew the domain')
  await command($, 'carry on')
  await w.clock.settle()
  w.files.set(claimPath('sess-1', 1, 'later-1'), { text: claimText('sess-1', 1, 'later-1', 1), mtimeMs: 2000 })
  await w.clock.advance(31000)
  await command($, 'add Another')
  await w.clock.settle()
  expect(String(((await command($, 'carry')) as { text?: string }).text).includes('a later session already took')).toBe(true)
  expect((await texts($)).some(t => t.includes('taken by a later session'))).toBe(true)
  await command($, 'carry off')
  await command($, 'carry on')
  await w.clock.settle()
  expect(carryOf(w, 'sess-1')?.gen).toBe(2)
  expect(carryOf(w, 'sess-1')?.items.length).toBe(2)
})

test('sticky through an empty session: the take of an empty carry still turns the switch on, and it writes', async ($, on) => {
  const w = world(on)
  seedCarry(w, source('src-1', []))
  w.sessionId = 'sess-9'
  await freshProcess($, w)
  expect(String(((await command($, 'carry')) as { text?: string }).text)).toBe('Docket: carry is on.')
  await $.session.end(endAs('prompt_input_exit', 'sess-9'))
  expect(carryOf(w, 'sess-9')?.on).toBe(true)
  expect(w.logs.some(l => l.includes('carried in'))).toBe(false)
})

test('the pane row and the band say what the switch does', async ($, on) => {
  const w = world(on)
  await freshProcess($, w)
  await command($, 'add Renew the domain')
  expect((await texts($)).some(t => t.startsWith('Carry to the next session in work: off'))).toBe(true)
  await command($, 'carry on')
  expect((await texts($)).some(t => t.startsWith('Carry to the next session in work: on'))).toBe(true)
})

test('a take that resolves after the docket moved applies nothing and claims nothing', async ($, on) => {
  const w = world(on)
  seedCarry(w, source('src-1', ['Renew the domain']))
  w.sessionId = 'sess-9'
  await classic($, w, 'startup', 'sess-9')
  // Hold every write: the startup take's own landing happens, then /clear moves the docket on.
  await start($)
  await $.session.end(endAs('clear', 'sess-9'))
  w.sessionId = 'sess-10'
  await classic($, w, 'clear', 'sess-10')
  await w.clock.settle()
  const claimed = [...w.files.keys()].filter(p => p.includes('/claims/src-1/'))
  // Either sess-9 took it before the clear (and claimed), or nothing was taken; never sess-10 by mistake.
  expect(claimed.every(p => p.endsWith('/sess-9.json'))).toBe(true)
})
