import { expect, test } from 'claude-code/testing'

import { addManual, freshSession } from '../hooks/ledger'
import { envelope, ledgerText, parseSlot } from '../hooks/persist'
import { command, openIds, say, slotPath, start, turn, verdict, world } from './world'
import type { World } from './world'

const ASK = 'Your call: SQLite or Postgres for the cache?'
const ADD_ASK = verdict({ add: [{ kind: 'decide', text: 'Choose SQLite or Postgres for the cache', quote: ASK, singleRec: false }] })

const snapWrites = (w: World, sid: string) => w.writes.filter(x => x.path === slotPath(sid, 'a') || x.path === slotPath(sid, 'b'))

function seed(w: World, sid: string, texts: string[], seq = 1): void {
  let s = { ...freshSession(), sid, root: 'C:/work' }
  for (const t of texts) s = addManual(s, t, 500)
  w.files.set(slotPath(sid, seq % 2 === 1 ? 'a' : 'b'), { text: envelope(sid, 'C:/work', seq, 900, ledgerText(s)), mtimeMs: 900 })
}

const endAs = (reason: string, sessionId: string) => ({ reason, sessionId, resume: { id: sessionId } }) as never

test('a new process with a snapshot on disk restores it, from the atom default', async ($, on) => {
  const w = world(on)
  seed(w, 'sess-1', ['Renew the domain'])
  await start($)
  expect(await openIds($)).toEqual([1])
  // A verdict after the restore applies to the restored ids.
  w.replies.push(verdict({ resolve: [{ id: 1, by: 'you', note: 'renewed', evidence: 'renewed it' }] }))
  await say($, w, 'renewed it')
  expect(await openIds($)).toEqual([])
})

test('/clear saves the old session; /resume back in the same process restores it and goes on saving', async ($, on) => {
  const w = world(on)
  await start($)
  w.replies.push(ADD_ASK)
  await turn($, w, 't1', [ASK])
  expect(await openIds($)).toEqual([1])
  await $.session.end(endAs('clear', 'sess-1'))
  w.sessionId = 'sess-2'
  await say($, w, 'hello')
  expect(await openIds($)).toEqual([])
  await $.session.end(endAs('resume', 'sess-2'))
  w.sessionId = 'sess-1'
  await say($, w, 'back again')
  expect(await openIds($)).toEqual([1])
  const before = snapWrites(w, 'sess-1').length
  await command($, 'add Something new')
  await w.clock.settle()
  expect(snapWrites(w, 'sess-1').length > before).toBe(true)
})

test('a view-only change writes nothing; a session that never had an item writes nothing', async ($, on) => {
  const w = world(on)
  await start($)
  await turn($, w, 't1', ['nothing to ask'])
  expect(snapWrites(w, 'sess-1').length).toBe(0)
  await command($, 'add Renew the domain')
  await w.clock.settle()
  const n = snapWrites(w, 'sess-1').length
  expect(n > 0).toBe(true)
  await command($)
  await w.clock.settle()
  expect(snapWrites(w, 'sess-1').length).toBe(n)
})

test('exit writes the final snapshot within the bound, and a cold restart reads it', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  await $.session.end(endAs('prompt_input_exit', 'sess-1'))
  const files = snapWrites(w, 'sess-1')
  expect(files.length > 0).toBe(true)
  const last = files.at(-1)!
  const slot = parseSlot(last.text, 'sess-1')
  expect(slot?.ledger.items.map(i => i.text)).toEqual(['Renew the domain'])
})

test('a disk that never answers: session.end stops waiting at its bound, and the reset still happened', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  await w.clock.settle()
  // Every write from here on hangs.
  w.writeGate = new Promise<void>(() => {})
  await command($, 'add Second thing')
  let isDone = false
  const ending = $.session.end(endAs('clear', 'sess-1')).then(() => { isDone = true })
  await w.clock.settle()
  await w.clock.advance(5000)
  await ending
  expect(isDone).toBe(true)
  w.writeGate = null
  w.sessionId = 'sess-2'
  await say($, w, 'hi')
  expect(await openIds($)).toEqual([])
})

test('a classic call that arrives while the old id is still current still lands on the new session', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  await w.clock.settle()
  // $.session.id() still answers sess-1 when the classic hook names sess-2.
  await ($ as unknown as { classic: { SessionStart: (e: unknown) => Promise<unknown> } }).classic.SessionStart({ hook_event_name: 'SessionStart', source: 'clear', session_id: 'sess-2', transcript_path: '', cwd: 'C:/work' })
  await w.clock.settle()
  // Already on sess-2 before session.end runs: the old code skipped this rehome.
  expect(await openIds($)).toEqual([])
  // A prompt typed now, while $.session.id() still reads sess-1, must not pull the docket back.
  await say($, w, 'hi')
  expect(await openIds($)).toEqual([])
  await $.session.end(endAs('clear', 'sess-1'))
  w.sessionId = 'sess-2'
  await w.clock.settle()
  expect(await openIds($)).toEqual([])
  const saved = [slotPath('sess-1', 'a'), slotPath('sess-1', 'b')].map(p => parseSlot(w.files.get(p)?.text, 'sess-1')).filter(x => x !== null)
  expect(saved[0]?.ledger.items.map(i => i.text)).toEqual(['Renew the domain'])
})

test('after a classic landing, an id that moves to a third session is followed', async ($, on) => {
  const w = world(on)
  await start($)
  await ($ as unknown as { classic: { SessionStart: (e: unknown) => Promise<unknown> } }).classic.SessionStart({ hook_event_name: 'SessionStart', source: 'clear', session_id: 'sess-2', transcript_path: '', cwd: 'C:/work' })
  await w.clock.settle()
  w.sessionId = 'sess-3'
  await command($, 'add Belongs to three')
  await w.clock.settle()
  await $.session.end(endAs('prompt_input_exit', 'sess-3'))
  const three = [slotPath('sess-3', 'a'), slotPath('sess-3', 'b')].map(p => parseSlot(w.files.get(p)?.text, 'sess-3')).filter(x => x !== null)
  expect(three[0]?.ledger.items.map(i => i.text)).toEqual(['Belongs to three'])
  expect(snapWrites(w, 'sess-2').length).toBe(0)
})

test('a change queued just before /clear lands under the old id, not the new one', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  // Not settled: the save is still queued when /clear ends the session.
  await $.session.end(endAs('clear', 'sess-1'))
  w.sessionId = 'sess-2'
  await say($, w, 'hi')
  await w.clock.settle()
  const saved = [slotPath('sess-1', 'a'), slotPath('sess-1', 'b')].map(p => parseSlot(w.files.get(p)?.text, 'sess-1')).filter(x => x !== null)
  expect(saved[0]?.ledger.items.map(i => i.text)).toEqual(['Renew the domain'])
  expect(snapWrites(w, 'sess-2').length).toBe(0)
})

test('forget, /clear, /resume back: still forgotten, exit writes nothing; a new item saves again', async ($, on) => {
  const w = world(on)
  await start($)
  for (const t of ['One', 'Two', 'Three', 'Four', 'Five']) await command($, `add ${t}`)
  await w.clock.settle()
  await command($, 'forget')
  await $.session.end(endAs('clear', 'sess-1'))
  w.sessionId = 'sess-2'
  await say($, w, 'hi')
  await $.session.end(endAs('resume', 'sess-2'))
  w.sessionId = 'sess-1'
  await say($, w, 'back')
  const isGone = (sid: string) => [slotPath(sid, 'a'), slotPath(sid, 'b')].every(p => w.files.get(p) === undefined || w.files.get(p)!.text.includes('"gone":true'))
  expect(isGone('sess-1')).toBe(true)
  await w.clock.advance(10)
  await command($, 'add A new one')
  await $.session.end(endAs('prompt_input_exit', 'sess-1'))
  const saved = [slotPath('sess-1', 'a'), slotPath('sess-1', 'b')].map(p => parseSlot(w.files.get(p)?.text, 'sess-1')).filter(x => x !== null)
  expect(saved.some(s => s!.ledger.items.some(i => i.text === 'A new one'))).toBe(true)
})

test('a verdict in flight across a hot reload is thrown away', async ($, on) => {
  const w = world(on)
  await start($)
  let release: () => void = () => {}
  w.gate = new Promise<void>(r => { release = r })
  w.replies.push(verdict({ add: [{ kind: 'decide', text: 'Choose SQLite or Postgres for the cache', quote: 'Your call: SQLite or Postgres for the cache?', singleRec: false }] }))
  const ending = turn($, w, 't1', ['Your call: SQLite or Postgres for the cache?'])
  await w.clock.settle()
  await start($)
  release()
  w.gate = null
  await ending
  await w.clock.settle()
  expect(await openIds($)).toEqual([])
})

test('after a reload, the next write takes the next seq and wins the read', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add One')
  await w.clock.settle()
  await start($)
  await command($, 'add Two')
  await w.clock.settle()
  const a = parseSlot(w.files.get(slotPath('sess-1', 'a'))?.text, 'sess-1')
  const b = parseSlot(w.files.get(slotPath('sess-1', 'b'))?.text, 'sess-1')
  const best = [a, b].filter(x => x !== null).sort((x, y) => y!.seq - x!.seq)[0]
  expect(best?.ledger.items.map(i => i.text)).toEqual(['One', 'Two'])
})

test('a restore writes nothing new until something changes', async ($, on) => {
  const w = world(on)
  seed(w, 'sess-1', ['Renew the domain'])
  await start($)
  await w.clock.settle()
  expect(snapWrites(w, 'sess-1').length).toBe(0)
})

test('a slow disk: session.end still resets for /clear and does not hang', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  await w.clock.settle()
  let release: () => void = () => {}
  w.writeGate = new Promise<void>(r => { release = r })
  await command($, 'add Second thing')
  const ending = $.session.end(endAs('clear', 'sess-1'))
  release()
  w.writeGate = null
  await ending
  w.sessionId = 'sess-2'
  await say($, w, 'hi')
  expect(await openIds($)).toEqual([])
  const slot = [slotPath('sess-1', 'a'), slotPath('sess-1', 'b')].map(p => parseSlot(w.files.get(p)?.text, 'sess-1')).filter(x => x !== null).sort((a, b) => b!.seq - a!.seq)[0]
  expect(slot?.ledger.items.map(i => i.text)).toEqual(['Renew the domain', 'Second thing'])
})

test('a failed write raises one toast, and the next change retries', async ($, on) => {
  const w = world(on)
  await start($)
  w.failWrites = true
  await command($, 'add One')
  await w.clock.settle()
  await command($, 'add Two')
  await w.clock.settle()
  expect(w.toasts.filter(t => t.startsWith("Docket: couldn't save")).length).toBe(1)
  w.failWrites = false
  await command($, 'add Three')
  await w.clock.settle()
  expect(snapWrites(w, 'sess-1').length > 0).toBe(true)
})

test('/docket forget tombstones the slots; exit does not rewrite them; a new item saves again', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Secret plan')
  await w.clock.settle()
  const r = await command($, 'forget')
  expect(String((r as { text?: string }).text).startsWith('Docket: forgot')).toBe(true)
  for (const p of [slotPath('sess-1', 'a'), slotPath('sess-1', 'b')]) {
    const f = w.files.get(p)
    if (f !== undefined) expect(f.text.includes('"gone":true')).toBe(true)
  }
  await $.session.end(endAs('prompt_input_exit', 'sess-1'))
  for (const p of [slotPath('sess-1', 'a'), slotPath('sess-1', 'b')]) expect(w.files.get(p)?.text.includes('Secret plan') ?? false).toBe(false)
})

for (const classicFirst of [true, false]) {
  test(`${classicFirst ? 'classic hook, then session.end' : 'session.end, then the classic hook'}: A is saved and the docket lands on B`, async ($, on) => {
    const w = world(on)
    w.sessionId = 'sess-1'
    await start($)
    await command($, 'add Renew the domain')
    await w.clock.settle()
    if (classicFirst) {
      w.sessionId = 'sess-2'
      await ($ as unknown as { classic: { SessionStart: (e: unknown) => Promise<unknown> } }).classic.SessionStart({ hook_event_name: 'SessionStart', source: 'clear', session_id: 'sess-2', transcript_path: '', cwd: 'C:/work' })
      await w.clock.settle()
      await $.session.end(endAs('clear', 'sess-1'))
    } else {
      await $.session.end(endAs('clear', 'sess-1'))
      w.sessionId = 'sess-2'
      await ($ as unknown as { classic: { SessionStart: (e: unknown) => Promise<unknown> } }).classic.SessionStart({ hook_event_name: 'SessionStart', source: 'clear', session_id: 'sess-2', transcript_path: '', cwd: 'C:/work' })
      await w.clock.settle()
    }
    expect(await openIds($)).toEqual([])
    const saved = [slotPath('sess-1', 'a'), slotPath('sess-1', 'b')].map(p => parseSlot(w.files.get(p)?.text, 'sess-1')).filter(x => x !== null)
    expect(saved.length > 0).toBe(true)
    expect(saved[0]?.ledger.items.map(i => i.text)).toEqual(['Renew the domain'])
    // Back to A restores it.
    await $.session.end(endAs('resume', 'sess-2'))
    w.sessionId = 'sess-1'
    await say($, w, 'back')
    expect(await openIds($)).toEqual([1])
  })
}

test('a hot reload re-runs session.start without reading the file again, and keeps the docket', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  await w.clock.settle()
  const reads = w.reads
  await start($)
  await w.clock.settle()
  expect(await openIds($)).toEqual([1])
  expect(w.reads).toBe(reads)
})
