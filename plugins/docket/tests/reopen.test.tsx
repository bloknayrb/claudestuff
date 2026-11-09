import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { addUser, applyVerdict, clearAll, closeByTool, dismiss, freshSession, keepClosed, markDone, openItems, refusal } from '../hooks/ledger'
import type { Snapshot, Verdict } from '../hooks/judge'
import { parseSlot, toLedger, envelope } from '../hooks/persist'
import { carryText } from '../hooks/carry'
import { reopenByClaude } from '../hooks/tools'
import { indicatorText, listText, reopenedLines } from '../hooks/ui'
import { closeGroups } from '../hooks/ledger'
import type { DocketSession, Item } from '../types'
import { ITEM_41, ITEM_42, MSG_41 } from './fixtures'
import { command, mountPane, openIds, start, world } from './world'

// v0.8: Claude's reopen tool. Without the user's words only the #42 shape (a bare reply or plain pick,
// not aimed at the item, never amended) and Claude's own non-user closes, once per item.

const item = (id: number, over: Partial<Item> = {}): Item => ({
  id, kind: 'decide', text: `Item ${id}`, quote: '', singleRec: false, source: 'judge', openedTurn: 1, status: 'open', ...over,
})

function session(items: Item[], turn = 2, lastFinal = ''): DocketSession {
  return { ...freshSession(), sid: 's', items, nextId: items.length + 1, turn, lastFinal }
}

function resolveWith(s: DocketSession, resolves: { id: number; evidence: string; note?: string }[]) {
  const entry = s.pendingUser.at(-1)
  if (entry === undefined) throw new Error('no reply')
  const snap: Snapshot = { mode: 'resolve', claude: [], tools: [], user: [entry], openIds: openItems(s).map(i => i.id), consumedSeq: entry.seq, consumedTurn: 0 }
  const v: Verdict = { adds: [], resolves: resolves.map(r => ({ id: r.id, by: 'you' as const, note: r.note ?? 'x', evidence: r.evidence, entry })) }
  return applyVerdict(s, v, snap, 5).session
}

const two = () => [item(1, { text: ITEM_41 }), item(2, { text: ITEM_42 })]
const get = (s: DocketSession, id: number) => s.items.find(i => i.id === id) as Item
const reopen = (s: DocketSession, id: number, cite?: string) => reopenByClaude(s, id, 'that "1" was for the other item', cite, false, 100)

// The #42 shape: a bare pick, closed against a message that doesn't aim it at the item.
function wrongClose(): DocketSession {
  return resolveWith(addUser(session(two(), 2, MSG_41), '1'), [{ id: 1, evidence: '1' }])
}

test('the #42 shape reopens without a cite; stamps, record, and the same reply cannot close it again', () => {
  const s = wrongClose()
  expect(get(s, 1).status).toBe('resolved')
  expect(get(s, 1).closedAtSeq).toBe(1)
  const r = reopen(s, 1)
  expect(r.text.startsWith('Reopened #1')).toBe(true)
  const it = get(r.session, 1)
  expect(it.status).toBe('open')
  expect(it.answer).toBeUndefined()
  expect(it.closedAtSeq).toBeUndefined()
  expect(it.reopenedAtSeq).toBe(1)
  expect(it.reopenedAtTurn).toBe(3)
  expect(it.claudeReopens).toBe(1)
  expect(it.reopened?.was).toBe('you chose option 1, "Keep the default (recommended)"')
  expect(it.reopened?.prior.answer?.words).toBe('1')
  expect(it.reopened?.seen).toBe(false)
  expect(it.reopened?.cite).toBeUndefined()
  // The reply that closed it, and Claude's text of the turn the tool ran in, are both stamped out.
  const entry = { seq: 1, text: '1', afterTurn: 2 }
  expect(refusal(r.session, it, { id: 1, by: 'you', note: 'x', evidence: '1', entry } as never)).toBe('evidence-before-reopen')
  expect(refusal(r.session, it, { id: 1, by: 'claude', note: 'x', evidence: 'x', turn: 3 } as never)).toBe('evidence-before-reopen')
})

test('a second reopen needs a cite; Keep closed restores the close exactly, with a fresh seq', () => {
  const r = reopen(wrongClose(), 1)
  const kept = keepClosed(r.session, 1, 200)
  const k = get(kept, 1)
  expect(k.status).toBe('resolved')
  expect(k.by).toBe('you')
  expect(k.answer?.words).toBe('1')
  expect(k.answer?.option?.key).toBe('1')
  expect(k.reopened).toBeUndefined()
  expect(k.claudeReopens).toBe(1)
  expect(k.closedAtSeq).toBe(1)
  expect((reopen(kept, 1)).text.includes('already reopened #1 once')).toBe(true)
  // A reply typed before Keep closed can't be cited; one after, naming the item, can.
  const typedAfter = addUser(kept, `please bring back ${ITEM_41}`)
  const kept2 = keepClosed({ ...reopenByClaude(typedAfter, 1, 'x', `please bring back ${ITEM_41}`, false, 300).session }, 1, 400)
  expect(reopen(kept2, 1, `please bring back ${ITEM_41}`).text.includes("isn't the user's own reply")).toBe(true)
})

test('a cited reopen shows the user\'s whole reply, never the span Claude passed', () => {
  let s = dismiss(session(two()), 1, 10)
  s = addUser(s, `ok, reopen ${ITEM_41} please, I want to rethink it`)
  const r = reopenByClaude(s, 1, 'user asked', `reopen ${ITEM_41} please`, false, 20)
  expect(r.text.startsWith('Reopened #1')).toBe(true)
  expect(get(r.session, 1).reopened?.cite).toBe(`ok, reopen ${ITEM_41} please, I want to rethink it`)
  expect(get(r.session, 1).reopened?.prior.by).toBe('dismiss')
})

test('refused: the user\'s own acts, typed answers, aimed picks, amended items, user-asked closes, bad cites', () => {
  const base = session(two())
  expect(reopen(dismiss(base, 1, 1), 1).text.includes("user's own act (dismiss)")).toBe(true)
  expect(reopen(markDone(base, 1, 1), 1).text.includes("user's own act (done)")).toBe(true)
  expect(reopen(clearAll(base, 1), 1).text.includes("user's own act (clear)")).toBe(true)
  // A typed answer, even unaimed, is never uncited.
  const typed = resolveWith(addUser(session(two(), 2, 'Anything else?'), 'go with the system theme'), [{ id: 1, evidence: 'go with the system theme' }])
  expect(reopen(typed, 1).text.includes('in their own words')).toBe(true)
  // A pick with a tail is typed words too.
  const tail = resolveWith(addUser(session(two(), 2, MSG_41), '1, but only on desktop'), [{ id: 1, evidence: '1, but only on desktop' }])
  expect(reopen(tail, 1).text.includes('needs their later reply')).toBe(true)
  // Aimed through the walk focus or the reply naming it.
  const aimed = resolveWith(addUser(session(two(), 2, MSG_41), `${ITEM_41}: keep it`), [{ id: 1, evidence: 'keep it' }])
  expect(reopen(aimed, 1).text.includes('aimed at it')).toBe(true)
  // A pre-v0.8 answer (no aimed stamp) and a pre-v0.8 close (no closedAtSeq).
  const old = session([item(1, { status: 'resolved', by: 'you', answer: { words: '1', seq: 1 }, closeSeq: 1 })])
  expect(reopen(old, 1).text.includes('needs their later reply')).toBe(true)
  expect(reopen(old, 1, 'anything').text.includes('closed before Docket recorded when')).toBe(true)
  // Claude's close at the user's request carries out their decision.
  const asked = closeByTool(base, 1, { closure: { kind: 'user-asked', reason: 'r', cite: 'x' } }, 1)
  expect(reopen(asked, 1).text.includes("at the user's request (user-asked)")).toBe(true)
  // A cite that is bare, or names the item only by #id, or predates the close.
  let d = addUser(base, `reopen ${ITEM_41}`)
  d = dismiss(d, 1, 5)
  expect(reopen(d, 1, `reopen ${ITEM_41}`).text.includes("isn't the user's own reply")).toBe(true)
  const byId = addUser(dismiss(base, 1, 5), 'reopen #1 please')
  expect(reopen(byId, 1, 'reopen #1 please').text.includes("isn't the user's own reply")).toBe(true)
  const bare = addUser(dismiss(base, 1, 5), 'yes')
  expect(reopen(bare, 1, 'yes').text.includes("isn't the user's own reply")).toBe(true)
  // Unknown, open, no reason.
  expect(reopen(base, 9).text).toBe("#9 isn't on the Docket.")
  expect(reopen(base, 1).text).toBe('#1 is open; nothing to reopen.')
  expect(reopenByClaude(dismiss(base, 1, 1), 1, '', undefined, false, 1).text).toBe('reopen needs a reason.')
})

test('one item out of a clear batch; the rest stay grouped; a lone cleared item reads as itself', () => {
  const s = clearAll(session([item(1), item(2), item(3)]), 1)
  const withAsk = addUser(s, 'bring back Item 2, I still need it')
  const r = reopenByClaude(withAsk, 2, 'asked', 'bring back Item 2, I still need it', false, 2)
  expect(openItems(r.session).map(i => i.id)).toEqual([2])
  const groups = closeGroups(r.session)
  expect(groups.length).toBe(1)
  expect(groups[0]?.items.map(i => i.id)).toEqual([1, 3])
  const back = keepClosed(r.session, 2, 3)
  expect(get(back, 2).by).toBe('clear')
  expect(get(back, 2).batch).toBeUndefined()
})

test('an arm on the item is cleared; the pane being up marks it seen; a prompt between turns marks it seen', () => {
  const s = wrongClose()
  const armed = { ...s, view: { ...s.view, armedDismiss: { id: 1, at: 0, until: 9e9, ready: true } } }
  expect(reopen(armed, 1).session.view.armedDismiss).toBeNull()
  expect(get(reopenByClaude(s, 1, 'x', undefined, true, 1).session, 1).reopened?.seen).toBe(true)
  const r = reopen(s, 1).session
  expect(indicatorText(2, r, false)).toBe('◇ 2 for you to decide or do · 1 reopened by Claude · click to show')
  expect(get(addUser(r, 'later', true), 1).reopened?.seen).toBe(false)
  const seen = addUser(r, 'ok')
  expect(get(seen, 1).reopened?.seen).toBe(true)
  expect(indicatorText(2, seen, false)).toBe('◇ 2 for you to decide or do · click to show')
})

test('the list line and the pane lines show the reopen as Claude\'s, with how it had closed', () => {
  const r = reopen(wrongClose(), 1).session
  const list = listText(r, openItems(r), closeGroups(r), 0, undefined, false)
  expect(list.includes('· reopened by Claude: that "1" was for the other item (was: you chose option 1, "Keep the default (recommended)")')).toBe(true)
  expect(reopenedLines(get(r, 1).reopened as NonNullable<Item['reopened']>)).toEqual([
    '↺ reopened by Claude: that "1" was for the other item',
    'was: you chose option 1, "Keep the default (recommended)"',
  ])
})

test('persist keeps the reopen; a malformed one is dropped, not the slot; carry writes none of it', () => {
  const r = reopen(wrongClose(), 1).session
  const items = (led: unknown) => parseSlot(envelope('s', 'C:/r', 1, 100, JSON.stringify(led)), 's')?.ledger.items ?? []
  const back = items(toLedger(r)).find(i => i.id === 1)
  expect(back?.reopened?.prior.answer?.words).toBe('1')
  expect(back?.claudeReopens).toBe(1)
  expect(back?.reopened?.seen).toBe(false)
  const led = toLedger(r)
  const broken = { ...led, items: led.items.map(i => (i.id === 1 ? { ...i, reopened: { reason: 'x', prior: {} } } : i)) }
  const b2 = items(broken).find(i => i.id === 1)
  expect(b2?.status).toBe('open')
  expect(b2?.reopened).toBeUndefined()
  const carried = carryText({ ...r, carry: { on: true, gen: 1 } })
  expect(carried.includes('"reopened"')).toBe(false)
  expect(carried.includes('claudeReopens')).toBe(false)
})

async function call($: Engine, tool: string, input: Record<string, unknown>): Promise<string> {
  const run = $.tool.call as unknown as (e: Record<string, unknown>) => Promise<{ result?: unknown; deny?: string }>
  const r = await run({ tool: `mcp__docket__${tool}`, ...input })
  return typeof r.result === 'string' ? r.result : `DENY ${r.deny ?? ''}`
}

test('end to end: Claude closes as stale, reopens it, the pane shows it, Keep closed puts it back', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  expect((await call($, 'close', { id: '#1', kind: 'stale', reason: 'moved registrar' })).startsWith('Docket: Closed #1')).toBe(true)
  expect((await call($, 'reopen', { id: '#1', reason: 'still on the old registrar', agentId: 'a1' })).includes('subagent cannot change')).toBe(true)
  expect((await call($, 'reopen', { id: '#1', reason: 'still on the old registrar' })).startsWith('Docket: Reopened #1')).toBe(true)
  const ui = await mountPane($, 'terminal')
  expect(await ui.find({ key: 'item-1' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '↺ reopened by Claude: still on the old registrar' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'was: closed by Claude: stale: moved registrar' })).toBeDefined()
  await ui.press({ key: 'keep-1' })
  expect(await ui.find({ key: 'keep-1' })).toBeUndefined()
  await ui.unmount()
  expect(await openIds($)).toEqual([])
  void w
})
