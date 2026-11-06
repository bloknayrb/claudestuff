import { expect, test } from 'claude-code/testing'

import type { CheckedResolve, Snapshot, Verdict } from '../hooks/judge'
import { addManual, addTurn, addUser, applyVerdict, clearAll, closedForJudge, closeGroups, dismiss, freshSession, isBlocked, judgeable, KEEP_CLOSES, KEEP_USER, openItems, reopen } from '../hooks/ledger'
import { isBare } from '../hooks/text'
import type { DocketSession, Item } from '../types'

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  mode: 'full', claude: [], tools: [], user: [], openIds: [], consumedSeq: 0, consumedTurn: 0, ...over,
})

function withItems(items: Partial<Item>[], turn = 1): DocketSession {
  const s = freshSession()
  const full = items.map((o, n): Item => ({
    id: n + 1, kind: 'decide', text: `Item ${n + 1}`, quote: `Ask ${n + 1}?`, singleRec: false, source: 'judge', openedTurn: 1, status: 'open', ...o,
  }))
  return { ...s, items: full, nextId: full.length + 1, turn }
}

const you = (id: number, evidence: string, seq: number, afterTurn: number, text = evidence): CheckedResolve => ({
  id, by: 'you', note: 'done', evidence, entry: { seq, text, afterTurn },
})
const claude = (id: number, evidence: string, turn: number): CheckedResolve => ({ id, by: 'claude', note: 'done', evidence, turn })
const v = (resolves: CheckedResolve[], adds: Verdict['adds'] = []): Verdict => ({ adds, resolves })

test('a specific reply closes the item it names', async () => {
  const s = withItems([{}, {}])
  const r = applyVerdict(s, v([you(2, 'use B', 1, 1)]), snap(), 10)
  expect(openItems(r.session).map(i => i.id)).toEqual([1])
  expect(r.session.items.find(i => i.id === 2)?.by).toBe('you')
})

test('a bare go-ahead closes only the single recommendation opened the turn before', async () => {
  const s = withItems([{ singleRec: true, openedTurn: 3 }], 3)
  expect(openItems(applyVerdict(s, v([you(1, 'make it so', 1, 3)]), snap(), 0).session).length).toBe(0)
})

test('a bare go-ahead is refused when the item has no single recommendation', async () => {
  const s = withItems([{ singleRec: false, openedTurn: 3 }], 3)
  const r = applyVerdict(s, v([you(1, 'yes', 1, 3)]), snap(), 0)
  expect(r.refused).toEqual(['bare-reply-ambiguous'])
})

test('a bare go-ahead is refused for an item from an older turn', async () => {
  const s = withItems([{ singleRec: true, openedTurn: 2 }], 3)
  expect(applyVerdict(s, v([you(1, 'ok', 1, 3)]), snap(), 0).refused).toEqual(['bare-reply-ambiguous'])
})

test('a bare go-ahead is refused when two items opened that turn', async () => {
  const s = withItems([{ singleRec: true, openedTurn: 3 }, { openedTurn: 3 }], 3)
  expect(applyVerdict(s, v([you(1, 'engage', 1, 3)]), snap(), 0).refused).toEqual(['bare-reply-ambiguous'])
})

test('a bare refusal follows the same rule', async () => {
  const s = withItems([{ singleRec: true, openedTurn: 3 }, { openedTurn: 3 }], 3)
  expect(applyVerdict(s, v([you(1, 'no', 1, 3)]), snap(), 0).refused).toEqual(['bare-reply-ambiguous'])
})

test('a Reply-prefixed "yes" closes an older item, though the judge quotes only "yes"', async () => {
  const s = withItems([{ text: 'Merge PR #18', openedTurn: 1 }, { openedTurn: 1 }], 4)
  const r = applyVerdict(s, v([you(1, 'yes', 1, 4, 'Re: Merge PR #18 — yes')]), snap(), 0)
  expect(r.refused).toEqual([])
  expect(openItems(r.session).map(i => i.id)).toEqual([2])
})

test('a bare span quoted out of a longer reply is still gated', async () => {
  const s = withItems([{ text: 'Merge PR #18', openedTurn: 1 }, { openedTurn: 1 }], 4)
  expect(applyVerdict(s, v([you(1, 'ok', 1, 4, 'ok thanks')]), snap(), 0).refused).toEqual(['bare-reply-ambiguous'])
  expect(applyVerdict(s, v([you(1, 'yes', 1, 4, 'yes, and run the tests')]), snap(), 0).refused).toEqual(['bare-reply-ambiguous'])
})

test('a dismissed sibling no longer makes a bare go-ahead ambiguous', async () => {
  let s = withItems([{ singleRec: true, openedTurn: 3 }, { openedTurn: 3 }], 3)
  s = dismiss(s, 2, 0)
  expect(applyVerdict(s, v([you(1, 'yes', 1, 3)]), snap(), 0).refused).toEqual([])
})

test("Claude's later short report may share words with the ask", async () => {
  const s = withItems([{ quote: 'Merge #18 once it is merged upstream?', openedTurn: 2 }], 3)
  expect(applyVerdict(s, v([claude(1, 'merged', 3)]), snap(), 0).refused).toEqual([])
})

test('a reply waits for the full check of the turn it answered, then is judgeable (v0.6, replaces keptForNew)', async () => {
  let s = { ...freshSession(), turn: 4 }
  s = addTurn(s, [{ turn: 4, text: 'SQLite or Postgres?', isFinal: true }], [])
  s = addUser(s, 'use sqlite')
  expect(judgeable(s)).toBe(undefined)
  expect(isBlocked(s)).toBe(true)
  const add = { kind: 'decide' as const, text: 'Choose the cache', quote: 'q', singleRec: false, turn: 4 }
  const r = applyVerdict(s, v([], [add]), snap({ consumedTurn: 4 }), 0)
  expect(r.session.pendingUser.map(u => u.text)).toEqual(['use sqlite'])
  expect(judgeable(r.session)?.text).toBe('use sqlite')
})

test('the backlog is capped while checks fail', async () => {
  let s = freshSession()
  for (let i = 0; i < 50; i += 1) s = addUser(s, `m${i}`)
  expect(s.pendingUser.length).toBe(KEEP_USER)
  expect(s.pendingUser.at(-1)?.text).toBe('m49')
})

test('isBare reads go-ahead and refusal phrases, not specific replies', async () => {
  for (const t of ['make it so', 'Yes, please!', 'ok do it', 'Engage.', 'nope', "don't", 'lgtm']) expect(isBare(t)).toBe(true)
  for (const t of ['use B', 'yes, use SQLite', 'merge it', '']) expect(isBare(t)).toBe(false)
})

test('evidence written before the item existed is refused', async () => {
  const s = withItems([{ openedTurn: 4 }], 4)
  expect(applyVerdict(s, v([you(1, 'merge it', 1, 2)]), snap(), 0).refused).toEqual(['evidence-before-item'])
  expect(applyVerdict(s, v([claude(1, 'merged', 3)]), snap(), 0).refused).toEqual(['evidence-before-item'])
})

test('Claude quoting its own ask is not proof it is done', async () => {
  const s = withItems([{ quote: 'Should I merge #18?', openedTurn: 2 }], 2)
  expect(applyVerdict(s, v([claude(1, 'merge #18', 2)]), snap(), 0).refused).toEqual(['evidence-is-the-ask'])
})

test('a reopen sticks against the evidence that closed it, for both sides', async () => {
  let s = withItems([{}, {}], 2)
  s = addUser(s, 'use B')
  const wrong = applyVerdict(s, v([you(1, 'use B', 1, 2)]), snap({ mode: 'resolve' }), 0).session
  const group = closeGroups(wrong)[0]
  expect(group).toBeDefined()
  const reopened = reopen(wrong, group?.closeSeq ?? 0)
  expect(openItems(reopened).length).toBe(2)
  // The full check at turn end sends the same pendingUser; the same evidence must not close it again.
  expect(applyVerdict(reopened, v([you(1, 'use B', 1, 2)]), snap(), 0).refused).toEqual(['evidence-before-reopen'])
  expect(applyVerdict(reopened, v([claude(1, 'done', 2)]), snap(), 0).refused).toEqual(['evidence-before-reopen'])
  // Newer words still close it.
  const later = addUser(reopened, 'use A after all')
  expect(applyVerdict(later, v([you(1, 'use A', 2, 2)]), snap(), 0).refused).toEqual([])
})

test('a full verdict consumes Claude text and tool lines, never replies; a resolve verdict consumes its one reply (v0.6)', async () => {
  let s = withItems([{}])
  s = addUser(addUser(s, 'a'), 'b')
  s = { ...s, claude: [{ turn: 1, text: 'x', isFinal: true }], tools: [{ turn: 1, text: 'Bash: ls' }] }
  const full = applyVerdict(s, v([]), snap({ consumedTurn: 1 }), 0).session
  expect(full.pendingUser.map(u => u.text)).toEqual(['a', 'b'])
  expect(full.claude.length + full.tools.length).toBe(0)
  const first = s.pendingUser[0]
  const resolved = applyVerdict(s, v([]), snap({ mode: 'resolve', user: first === undefined ? [] : [first], consumedSeq: 1 }), 0).session
  expect(resolved.pendingUser.map(u => u.text)).toEqual(['b'])
})

test('an add that repeats a held item, open or closed, is skipped', async () => {
  const s = dismiss(withItems([{ text: 'Run gh auth login' }]), 1, 0)
  const add = { kind: 'do' as const, text: 'run gh auth login', quote: 'q', singleRec: false, turn: 2 }
  const r = applyVerdict(s, v([], [add, { ...add, text: 'Rotate the key' }]), snap(), 0)
  expect(r.added).toBe(1)
  expect(closedForJudge(r.session).map(i => i.text)).toEqual(['Run gh auth login'])
})

test('/docket clear is one batch that Reopen all restores, whatever its size', async () => {
  let s = withItems(Array.from({ length: 20 }, () => ({})))
  s = dismiss(s, 1, 0)
  s = clearAll(s, 1)
  const groups = closeGroups(s)
  expect(groups[0]?.items.length).toBe(19)
  expect(closedForJudge(s).length).toBe(20)
  s = reopen(s, groups[0]?.closeSeq ?? 0)
  expect(openItems(s).length).toBe(19)
})

test('closes beyond the kept number are dropped, a batch counting once', async () => {
  let s = withItems(Array.from({ length: KEEP_CLOSES + 3 }, () => ({})))
  for (let id = 1; id <= KEEP_CLOSES + 3; id += 1) s = dismiss(s, id, id)
  expect(closeGroups(s).length).toBe(KEEP_CLOSES)
  expect(s.items.some(i => i.id === 1)).toBe(false)
})

test('a manual item is a do, has no quote, and is closable by later words', async () => {
  let s = addManual({ ...freshSession(), turn: 2 }, 'Renew the domain')
  s = addUser(s, 'renewed the domain')
  const item = openItems(s)[0]
  expect(item?.source).toBe('manual')
  expect(applyVerdict(s, v([you(item?.id ?? 0, 'renewed the domain', 1, 2)]), snap(), 0).resolved).toBe(1)
})
