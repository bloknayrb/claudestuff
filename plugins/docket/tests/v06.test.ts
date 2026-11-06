import { expect, test } from 'claude-code/testing'

import { closedHead, closedLine, youPart } from '../hooks/attribution'
import { buildPrompt } from '../hooks/judge'
import type { Snapshot, Verdict } from '../hooks/judge'
import { addTurn, addUser, applyVerdict, freshSession, judgeable, markDone, handOff, MAX_REPLY_FAILS, failWaiting, names, normalize, openItems, stripLead, tiedTo } from '../hooks/ledger'
import { parseSlot, toLedger, envelope, restore } from '../hooks/persist'
import { amend, annotate, closeByClaude } from '../hooks/tools'
import { optionPick } from '../hooks/options'
import { closeByTool, present } from '../hooks/ledger'
import { leadHere } from '../hooks/spawn'
import type { DocketSession, Item } from '../types'
import { ITEM_41, ITEM_42, MSG_41, MSG_42 } from './fixtures'

const item = (id: number, over: Partial<Item> = {}): Item => ({
  id, kind: 'decide', text: `Item ${id}`, quote: '', singleRec: false, source: 'judge', openedTurn: 1, status: 'open', ...over,
})

function session(items: Item[], turn = 2, lastFinal = ''): DocketSession {
  return { ...freshSession(), sid: 's', items, nextId: items.length + 1, turn, lastFinal }
}

// A resolve check's verdict for the newest reply, applied.
function resolveWith(s: DocketSession, resolves: { id: number; evidence: string; note?: string }[]) {
  const entry = s.pendingUser.at(-1)
  if (entry === undefined) throw new Error('no reply')
  const snap: Snapshot = { mode: 'resolve', claude: [], tools: [], user: [entry], openIds: openItems(s).map(i => i.id), consumedSeq: entry.seq, consumedTurn: 0 }
  const v: Verdict = { adds: [], resolves: resolves.map(r => ({ id: r.id, by: 'you' as const, note: r.note ?? 'x', evidence: r.evidence, entry })) }
  return applyVerdict(s, v, snap, 5)
}

const two = () => [item(1, { text: ITEM_41 }), item(2, { text: ITEM_42 })]

test('a pick is labelled from the message it answered, which names the item', async () => {
  const s = addUser(session(two(), 2, MSG_41), '1')
  const r = resolveWith(s, [{ id: 1, evidence: '1', note: 'Chose option 2' }])
  const closed = r.session.items.find(i => i.id === 1)
  expect(closed?.answer).toEqual({ words: '1', seq: 1, option: { key: '1', label: 'Stay silent (recommended)' } })
  expect(closed?.note).toBe('')
  expect(closedLine(closed as Item)).toBe('you chose option 1, "Stay silent (recommended)"')
})

test('a pick with a tail shows the words and the option; a reading never sits under "you"', async () => {
  const s = addUser(session(two(), 2, MSG_41), '1, but only for resolved threads')
  const closed = resolveWith(s, [{ id: 1, evidence: '1, but only' }]).session.items.find(i => i.id === 1) as Item
  expect(youPart(closed)).toBe('you said: "1, but only for resolved threads" (option 1, "Stay silent (recommended)")')
  const prose = addUser(session(two(), 2, MSG_41), 'stay silent, obviously')
  const p = resolveWith(prose, [{ id: 1, evidence: 'stay silent', note: 'Approved silence' }]).session.items.find(i => i.id === 1) as Item
  expect(closedLine(p)).toBe('you said: "stay silent, obviously" · Docket\'s reading: Approved silence')
})

test('a pick the message does not tie to the item is refused; one tied by lead or focus closes it', async () => {
  // The message is about #41; the judge says the "1" closes #42.
  const s = addUser(session(two(), 2, MSG_41), '1')
  expect(resolveWith(s, [{ id: 2, evidence: '1' }]).refused).toEqual(['pick-not-tied'])
  // A message naming both items ties a pick to neither.
  const both = addUser(session(two(), 2, `${MSG_41}\n\nAlso: ${ITEM_42}`), '1')
  expect(resolveWith(both, [{ id: 1, evidence: '1' }]).refused).toEqual(['pick-not-tied'])
  // The Reply button's lead ties it, but the message isn't about #42, so no label: the words alone.
  const led = addUser(session(two(), 2, MSG_41), `${leadHere(item(2, { text: ITEM_42 }))}1`)
  const r = resolveWith(led, [{ id: 2, evidence: '1' }])
  expect(r.refused).toEqual([])
  expect(r.session.items.find(i => i.id === 2)?.answer).toEqual({ words: '1', seq: 1 })
  // A lead for one item never lets the pick close another.
  expect(resolveWith(led, [{ id: 1, evidence: '1' }]).refused).toEqual(['option-other-item'])
})

test('a mid-turn pick or bare reply closes nothing unless its lead names the item', async () => {
  const s = addUser(session(two(), 2, MSG_41), '1', true)
  expect(resolveWith(s, [{ id: 1, evidence: '1' }]).refused).toEqual(['mid-turn-unnamed'])
})

test('a clipped answered message, two lists, or a repeated key records the words alone', async () => {
  const clipped = { ...addUser({ ...session(two(), 2, MSG_41), lastFinalClipped: true }, '1') }
  expect(resolveWith(clipped, [{ id: 1, evidence: '1' }]).session.items.find(i => i.id === 1)?.answer).toEqual({ words: '1', seq: 1 })
  const twoLists = addUser(session(two(), 2, `${MSG_41}\n\nSteps:\n1. Build.\n2. Test.`), '1')
  expect(resolveWith(twoLists, [{ id: 1, evidence: '1' }]).session.items.find(i => i.id === 1)?.answer).toEqual({ words: '1', seq: 1 })
})

test('names: text or quote, never a bare #id', async () => {
  expect(names(MSG_41, item(1, { text: ITEM_41 }))).toBe(true)
  expect(names('See PR #2 for the fix.', item(2, { text: 'Merge the release' }))).toBe(false)
  expect(names('as you put it, should it stay silent, or reopen the comment?', item(3, { text: 'x y z', quote: 'should it stay silent, or reopen the comment?' }))).toBe(true)
})

test('the Reply lead is stripped and names its item; the typed words are what is kept', async () => {
  const s = session(two())
  const lead = leadHere(item(2, { text: ITEM_42 }))
  expect(stripLead(s, `${lead}keep the storage`)).toEqual({ words: 'keep the storage', namedId: 2 })
  const after = addUser(s, `${lead}keep the storage`)
  expect(after.userLog.at(-1)?.words).toBe('keep the storage')
  expect(after.pendingUser.at(-1)?.namedId).toBe(2)
})

test('the batch: over the 3-per-reply limit is reported, not dropped; a newer reply clears it once shown', async () => {
  const items = [1, 2, 3, 4, 5].map(n => item(n, { text: `Settled thing ${n}` }))
  let s = addUser(session(items), 'close the settled ones')
  const r = resolveWith(s, [1, 2, 3, 4, 5].map(id => ({ id, evidence: 'close the settled ones' })))
  expect(openItems(r.session).map(i => i.id)).toEqual([4, 5])
  expect(r.overCap).toEqual([4, 5])
  expect(r.session.lastReply).toEqual({ seq: 1, words: 'close the settled ones', closed: [1, 2, 3], overCap: [4, 5], shown: false })
  // Not yet shown: a newer reply leaves it.
  s = addUser(r.session, 'thanks')
  expect(resolveWith(s, []).session.lastReply?.overCap).toEqual([4, 5])
  s = addUser({ ...r.session, lastReply: { ...(r.session.lastReply as NonNullable<DocketSession['lastReply']>), shown: true } }, 'thanks')
  expect(resolveWith(s, []).session.lastReply).toBe(null)
})

test('a reply waits for its turn\'s full check, but not past three failed ones', async () => {
  let s = addTurn(session([item(1)], 3), [{ turn: 3, text: 'x', isFinal: true }], [])
  s = addUser(s, 'use B')
  expect(judgeable(s)).toBe(undefined)
  for (let n = 0; n < MAX_REPLY_FAILS; n += 1) s = failWaiting(s)
  expect(judgeable(s)?.text).toBe('use B')
})

test('a full prompt never carries the user words; a resolve prompt carries one reply and its message', async () => {
  const s = addUser(session(two(), 2, MSG_41), '1')
  const entry = s.pendingUser[0]
  const full = buildPrompt({ mode: 'full', claude: [{ turn: 3, text: MSG_42, isFinal: true }], tools: [], user: s.pendingUser, open: s.items, closed: [], toolAsked: [] })
  expect(full.prompt.includes('<user_text>')).toBe(false)
  const res = buildPrompt({ mode: 'resolve', claude: [], tools: [], user: entry === undefined ? [] : [entry], open: s.items, closed: [], toolAsked: [], latest: entry?.answered?.text ?? '' })
  expect(res.prompt.includes('1. **Stay silent (recommended).**')).toBe(true)
})

test('buttons and Claude closes say so; an unknown close renders safely', async () => {
  expect(closedHead(markDone(session([item(1)]), 1, 0).items[0] as Item)).toBe('you marked it done')
  expect(closedHead(handOff(session([item(1)]), 1, 0).items[0] as Item)).toBe('you sent it to a new window')
  expect(closedHead(item(1, { status: 'resolved', by: 'you', note: 'Approved' }))).toBe('closed by you')
  expect(closedLine(item(1, { status: 'resolved', by: 'claude', note: 'merged' }))).toBe("per Claude's report: merged")
  expect(closedHead(item(1, { status: 'dismissed', by: 'bogus' as never }))).toBe('closed')
})

// --- tools ---

const closeFn = (s: DocketSession, id: number, extra: Partial<Item>) => closeByTool(s, id, extra, 9)

function the41Mislabel(): DocketSession {
  // #41 was closed from "option 2" (typed for another item); the user's real answer was a later "1".
  let s = session([item(1, { text: ITEM_41, openedTurn: 1 }), item(2, { text: ITEM_42 })], 2, MSG_41)
  s = addUser(s, 'option 2')
  s = resolveWith(s, [{ id: 1, evidence: 'option 2', note: 'Chose option 2: reopen the comment' }]).session
  s = { ...s, turn: 3 }
  s = addUser(s, '1')
  return { ...s, pendingUser: [] }
}

test('amend fixes the #41 mislabel by the user\'s later "1": linked by Claude, the old reading kept as replaced', async () => {
  const s = the41Mislabel()
  const r = amend(s, 1, 'The user chose option 1, stay silent.', '1', 10)
  const fixed = r.session.items.find(i => i.id === 1) as Item
  expect(youPart(fixed)).toBe('you chose option 1, "Stay silent (recommended)" (linked by Claude)')
  const line = closedLine(fixed)
  expect(line.includes('Docket\'s earlier reading (replaced): from "option 2"')).toBe(true)
  expect(line.includes("Claude's correction: The user chose option 1, stay silent.")).toBe(true)
  expect(line.startsWith('you chose option 1')).toBe(true)
})

test('review: a bare "yes" for the walk item never closes another, even the only single-rec one raised', async () => {
  let s = session([item(1, { text: 'Renew the domain' }), item(2, { text: 'Rotate the key', singleRec: true, openedTurn: 2 })], 1)
  s = { ...present(s, 1), turn: 2, lastFinal: 'Next: Renew the domain. I recommend two years. OK?' }
  s = addUser(s, 'yes')
  expect(s.pendingUser.at(-1)?.focusId).toBe(1)
  const r = resolveWith(s, [{ id: 2, evidence: 'yes' }])
  expect(r.refused).toEqual(['bare-other-item'])
  expect(openItems(r.session).map(i => i.id)).toEqual([1, 2])
  // The same "yes" with no walk stamp still closes the only single-rec item, as before.
  const plain = addUser({ ...session(s.items, 2), lastFinal: 'Rotate the key? I recommend today.' }, 'yes')
  expect(openItems(resolveWith(plain, [{ id: 2, evidence: 'yes' }]).session).map(i => i.id)).toEqual([1])
})

test('review: a lead for "Ship it — now" never closes "Ship it", though its lead occurs in the text', async () => {
  const s = addUser(session([item(1, { text: 'Ship it — now' }), item(2, { text: 'Ship it', singleRec: true, openedTurn: 2 })], 2), `${leadHere(item(1, { text: 'Ship it — now' }))}yes`)
  expect(s.pendingUser.at(-1)?.namedId).toBe(1)
  const r = resolveWith(s, [{ id: 2, evidence: 'yes' }])
  expect(r.refused).toEqual(['bare-other-item'])
  expect(openItems(r.session).map(i => i.id)).toEqual([1, 2])
})

test('review: words that name the item are not a bare reply to it, whatever span the judge quoted', async () => {
  let s = session([item(1, { text: 'Renew the domain' }), item(2, { text: 'Rotate the key', singleRec: true, openedTurn: 2 })], 1)
  s = { ...present(s, 1), turn: 2, lastFinal: 'Next: Renew the domain. I recommend two years. OK?' }
  s = addUser(s, 'yes, and rotate the key too: ok')
  const r = resolveWith(s, [{ id: 2, evidence: 'ok' }])
  expect(r.refused).toEqual([])
  expect(openItems(r.session).map(i => i.id)).toEqual([1])
})

test('review: amending back to the reply that closed the item drops the linked mark', async () => {
  const once = amend(the41Mislabel(), 1, 'Option 1.', '1', 10).session
  const back = amend(once, 1, 'Option 2 after all.', 'option 2', 11)
  expect(back.session).not.toBe(once)
  const it = back.session.items.find(i => i.id === 1) as Item
  expect((youPart(it) ?? '').includes('linked by Claude')).toBe(false)
  expect(it.answer?.words).toBe('option 2')
})

test('review: an item Claude closed still counts for what a message is about; a duplicate it closed does not', async () => {
  const msg = 'Two things: Merge the docs PR? And Renew the domain?'
  const base = session([item(1, { text: 'Merge the docs PR' }), item(2, { text: 'Renew the domain' })], 2, msg)
  const stale = closeByClaude(base, 2, 'stale', 'no longer relevant', undefined, 9, closeFn).session
  expect(addUser(stale, 'yes').pendingUser.at(-1)?.aboutIds).toEqual([1, 2])
  const dup = closeByClaude(base, 2, 'duplicate-of:#1', 'same ask', undefined, 9, closeFn).session
  expect(addUser(dup, 'yes').pendingUser.at(-1)?.aboutIds).toEqual([1])
})

test('review: a sibling Claude closed keeps a bare "yes" ambiguous; a duplicate it closed does not', async () => {
  const base = session([item(1, { text: 'Merge the docs PR', openedTurn: 2, singleRec: true }), item(2, { text: 'Renew the domain', openedTurn: 2 })], 2)
  const stale = addUser(closeByClaude(base, 2, 'stale', 'no longer relevant', undefined, 9, closeFn).session, 'yes')
  expect(resolveWith(stale, [{ id: 1, evidence: 'yes' }]).refused).toEqual(['bare-reply-ambiguous'])
  const dup = addUser(closeByClaude(base, 2, 'duplicate-of:#1', 'same ask', undefined, 9, closeFn).session, 'yes')
  expect(resolveWith(dup, [{ id: 1, evidence: 'yes' }]).refused).toEqual([])
})

test('review: only a v0.5 value has its pending replies stamped with the last final', async () => {
  // A v0.6 reply typed before any final answered nothing; the final that later arrives is Claude's reply to it.
  const typed = addUser(session([item(1)], 0), 'hello')
  expect(typed.pendingUser[0]?.answered).toBe(undefined)
  const later = { ...typed, lastFinal: 'Hi! Should I merge the docs PR?' }
  expect(normalize(later).pendingUser[0]?.answered).toBe(undefined)
  const { userLog: _log, ...v05 } = later
  expect(normalize(v05).pendingUser[0]?.answered).toEqual({ text: 'Hi! Should I merge the docs PR?', clipped: true })
})

test('review: the longest lead wins over an open item whose lead it starts with', async () => {
  const s = session([item(1, { text: 'Ship it — now', status: 'resolved', by: 'you', note: 'x' }), item(2, { text: 'Ship it' })])
  expect(stripLead(s, `${leadHere(item(1, { text: 'Ship it — now' }))}yes`)).toEqual({ words: 'yes', namedId: 1 })
})

test('amend refuses Claude-supplied evidence, a short span, an open item, and a button close', async () => {
  const s = the41Mislabel()
  expect(amend(s, 1, 'x', 'the user chose to stay silent', 10).session).toBe(s)
  expect(amend(s, 1, 'x', 'optio', 10).session).toBe(s)
  expect(amend(s, 2, 'x', '1', 10).session).toBe(s)
  const done = markDone(session([item(1)]), 1, 0)
  expect(amend(addUser(done, 'did it'), 1, 'x', 'did it', 10).text.includes("wasn't closed by a reply")).toBe(true)
})

test('annotate is Claude\'s note; it never enters a judge prompt', async () => {
  const s = annotate(session([item(1)]), 1, 'User approved; resolve by you.', 3).session
  expect((s.items[0] as Item).notes?.[0]?.text).toBe('User approved; resolve by you.')
  const p = buildPrompt({ mode: 'full', claude: [{ turn: 2, text: 'x', isFinal: true }], tools: [], user: [], open: s.items, closed: [], toolAsked: [] })
  expect(p.prompt.includes('resolve by you')).toBe(false)
})

test('close: kinds, citations and refusals; never the user\'s', async () => {
  const s = session([item(1, { text: 'Merge the docs PR' }), item(2, { text: 'Merge the docs PR again' })])
  const dup = closeByClaude(s, 2, 'duplicate-of:#1', 'same ask', undefined, 9, closeFn).session.items.find(i => i.id === 2) as Item
  expect(closedLine(dup)).toBe('closed by Claude: duplicate of #1: same ask')
  expect(closeByClaude(s, 2, 'duplicate-of:#2', 'x', undefined, 9, closeFn).session).toBe(s)
  expect(closeByClaude(s, 2, 'duplicate-of:#7', 'x', undefined, 9, closeFn).session).toBe(s)
  expect(closeByClaude(s, 1, 'settled-earlier', 'x', '#2', 9, closeFn).session).toBe(s)
  expect(closeByClaude(s, 1, 'bogus', 'x', undefined, 9, closeFn).session).toBe(s)
  expect(closeByClaude(s, 1, 'stale', '', undefined, 9, closeFn).session).toBe(s)
  // user-asked: a bare cite or one that doesn't name the item is refused; a naming reply works.
  const asked = addUser(s, 'yes')
  expect(closeByClaude(asked, 1, 'user-asked', 'x', 'yes', 9, closeFn).session).toBe(asked)
  const named = addUser(s, 'please close Merge the docs PR, it shipped')
  const c = closeByClaude(named, 1, 'user-asked', 'the user asked', 'please close Merge the docs PR, it shipped', 9, closeFn)
  expect(closedHead(c.session.items.find(i => i.id === 1) as Item)).toBe('closed by Claude, citing your reply "please close Merge the docs PR, it shipped": the user asked')
  // Already closed: says so.
  expect(closeByClaude(c.session, 1, 'stale', 'x', undefined, 9, closeFn).text.includes('already closed')).toBe(true)
})

test('user-asked may close what the batch left over the limit, citing that reply', async () => {
  const items = [1, 2, 3, 4].map(n => item(n, { text: `Settled thing ${n}` }))
  const s = resolveWith(addUser(session(items), 'close the settled ones'), [1, 2, 3, 4].map(id => ({ id, evidence: 'close the settled ones' }))).session
  const r = closeByClaude(s, 4, 'user-asked', 'left by the limit', 'close the settled ones', 9, closeFn)
  expect(openItems(r.session).length).toBe(0)
})

test('storage: v0.6 records round-trip, a v0.5 snapshot loads, a restored long final is marked clipped', async () => {
  let s = the41Mislabel()
  s = amend(s, 1, 'Option 1.', '1', 10).session
  s = annotate(s, 2, 'Asked in the walk.', 11).session
  s = closeByClaude(s, 2, 'stale', 'superseded by PR 4', undefined, 12, closeFn).session
  const text = envelope('s', 'C:/r', 1, 100, JSON.stringify(toLedger(s)))
  const slot = parseSlot(text, 's')
  expect(slot).not.toBe(null)
  const back = slot?.ledger.items ?? []
  expect(back.find(i => i.id === 1)?.answer?.linked).toBe(true)
  expect(back.find(i => i.id === 1)?.superseded?.correction).toBe('Option 1.')
  expect(back.find(i => i.id === 2)?.closure?.kind).toBe('stale')
  expect(back.find(i => i.id === 2)?.notes?.length).toBe(1)
  const old = envelope('s', 'C:/r', 1, 100, JSON.stringify({ ...toLedger(session([item(1, { status: 'resolved', by: 'you', note: 'yes', closeSeq: 1 })])), nextCloseSeq: 2 }))
  expect(parseSlot(old, 's')?.ledger.items[0]?.note).toBe('yes')
  const long = restore({ ...toLedger(session([], 1, 'x'.repeat(7000))) }, 's', 'C:/r')
  expect(long.lastFinalClipped).toBe(true)
  void tiedTo
})

test("review: a pick tied by a Reply lead takes no label from another item's list in the same message", async () => {
  const items = [item(1, { text: 'Rotate the deploy key' }), item(2, { text: 'Decide on the badge' })]
  const msg = ['Rotate the deploy key is done on my side.', '', 'Separately, Decide on the badge:', '1. **Keep.** x', '2. **Remove.** y'].join('\n')
  const s = addUser(session(items, 2, msg), `${leadHere(items[0] as Item)}1`)
  const r = resolveWith(s, [{ id: 1, evidence: '1' }])
  expect(r.session.items.find(i => i.id === 1)?.answer).toEqual({ words: '1', seq: 1 })
})

test('review: amend picks the reply that closed the item when two replies share its words', async () => {
  let s = session([item(1, { text: ITEM_41 }), item(2, { text: ITEM_42 })], 2, MSG_41)
  s = addUser(s, '1')
  s = resolveWith(s, [{ id: 1, evidence: '1' }]).session
  s = addUser({ ...s, turn: 3, lastFinal: MSG_42 }, '1')
  s = resolveWith(s, [{ id: 2, evidence: '1' }]).session
  const r = amend(s, 1, 'Recorded right.', '1', 10).session.items.find(i => i.id === 1) as Item
  expect(r.answer).toEqual({ words: '1', seq: 1, option: { key: '1', label: 'Stay silent (recommended)' } })
  expect(youPart(r)).toBe('you chose option 1, "Stay silent (recommended)"')
})

test('review: a hyphenated word is prose, not a pick', async () => {
  for (const t of ['e-mail them', 'a-ok', 'd-day', '10-minute call works']) expect(optionPick(t)).toBe(undefined)
  expect(optionPick('2 - but keep it')).toEqual({ key: '2', tail: 'but keep it' })
})
