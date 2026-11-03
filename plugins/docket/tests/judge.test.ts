import { expect, test } from 'claude-code/testing'

import { BUDGET_CHARS, buildPrompt, parseVerdict, redact } from '../hooks/judge'
import type { JudgeInput } from '../hooks/judge'
import type { Item } from '../types'

const item = (id: number, over: Partial<Item> = {}): Item => ({
  id, kind: 'decide', text: `Choose option ${id}`, quote: `Should I use option ${id}?`, singleRec: false, source: 'judge', openedTurn: 1, status: 'open', ...over,
})

const GH = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123'].join('_')

const base = (over: Partial<JudgeInput> = {}): JudgeInput => ({
  mode: 'full',
  claude: [{ turn: 2, text: 'I can go either way. Your call: SQLite or Postgres for the cache?', isFinal: true }],
  tools: [{ turn: 2, text: 'Bash: gh pr view 18' }],
  user: [{ seq: 1, text: 'use sqlite', afterTurn: 1 }],
  open: [item(1)],
  closed: [],
  toolAsked: [],
  ...over,
})

test('a fenced reply parses; an add needs its quote verbatim in what was sent', async () => {
  const { snapshot } = buildPrompt(base())
  const reply = '```json\n{"add":[{"kind":"decide","text":"Choose SQLite or Postgres","quote":"Your call: SQLite or Postgres for the cache?","singleRec":false},{"kind":"do","text":"Invented","quote":"words Claude never wrote"}],"resolve":[]}\n```'
  const r = parseVerdict(reply, snapshot)
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.verdict.adds.length).toBe(1)
  expect(r.verdict.adds[0]?.turn).toBe(2)
  expect(r.dropped).toBe(1)
})

test('verbatim checks match through curly quotes and whitespace', async () => {
  const { snapshot } = buildPrompt(base({ claude: [{ turn: 2, text: 'Run   “gh auth login” — then tell me.', isFinal: true }] }))
  const r = parseVerdict('{"add":[{"kind":"do","text":"Run gh auth login","quote":"Run \\"gh auth login\\" - then tell me."}],"resolve":[]}', snapshot)
  expect(r.ok && r.verdict.adds.length).toBe(1)
})

test('a resolve needs an open id and evidence from the right side', async () => {
  const { snapshot } = buildPrompt(base())
  const reply = JSON.stringify({
    add: [],
    resolve: [
      { id: 1, by: 'you', note: 'SQLite', evidence: 'use sqlite' },
      { id: 9, by: 'you', note: 'x', evidence: 'use sqlite' },
      { id: 1, by: 'claude', note: 'dup', evidence: 'gh pr view 18' },
    ],
  })
  const r = parseVerdict(reply, snapshot)
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.verdict.resolves.length).toBe(1)
  expect(r.verdict.resolves[0]?.by).toBe('you')
  expect(r.dropped).toBe(2)
})

test('by-you evidence found only in Claude text is refused', async () => {
  const { snapshot } = buildPrompt(base())
  const r = parseVerdict('{"add":[],"resolve":[{"id":1,"by":"you","note":"x","evidence":"Your call"}]}', snapshot)
  expect(r.ok && r.verdict.resolves.length).toBe(0)
})

test('a resolve-only check ignores adds and Claude-side resolves', async () => {
  const { snapshot, prompt } = buildPrompt(base({ mode: 'resolve' }))
  expect(prompt.includes('<claude_text>')).toBe(false)
  const r = parseVerdict('{"add":[{"kind":"do","text":"x","quote":"Your call"}],"resolve":[{"id":1,"by":"claude","note":"x","evidence":"Your call"}]}', snapshot)
  expect(r.ok && r.verdict.adds.length + r.verdict.resolves.length).toBe(0)
})

test('a reply with no JSON object fails', async () => {
  const { snapshot } = buildPrompt(base())
  expect(parseVerdict('Sorry, I cannot.', snapshot)).toEqual({ ok: false, reason: 'not-json' })
})

test('redaction replaces token shapes and leaves look-alike words', async () => {
  // Fake tokens built from parts, so no secret scanner reads this file as holding one.
  const text = `token ${GH} and ${['sk', 'ant', 'abcdefghijklmnopqrstuv1'].join('-')} key ${'AKIA' + 'ABCDEFGHIJKLMNOP'}; task-list desk-lamp`
  const out = redact(text)
  expect(out.includes('ghp_')).toBe(false)
  expect(out.includes('sk-ant')).toBe(false)
  expect(out.includes('AKIA')).toBe(false)
  expect(out.includes('task-list desk-lamp')).toBe(true)
})

test('redaction runs before the budget, so the snapshot holds no secret', async () => {
  const { snapshot, prompt } = buildPrompt(base({ user: [{ seq: 1, text: `here: ${GH}`, afterTurn: 1 }] }))
  expect(prompt.includes('ghp_')).toBe(false)
  expect(snapshot.user[0]?.text.includes('[redacted]')).toBe(true)
})

test('the budget cuts quotes, then old intermediate text, keeps the final message and the closed list', async () => {
  const big = 'x'.repeat(12000)
  const closed = Array.from({ length: 15 }, (_, i) => item(100 + i, { status: 'resolved', closeSeq: i + 1 }))
  const built = buildPrompt(base({
    claude: [
      { turn: 2, text: `old ${big}`, isFinal: false },
      { turn: 2, text: `mid ${big}`, isFinal: false },
      { turn: 2, text: `newer ${big}`, isFinal: false },
      { turn: 2, text: 'FINAL: your call on the cache?', isFinal: true },
    ],
    open: [item(1, { quote: 'q'.repeat(150) })],
    closed,
  }))
  expect(built.prompt.length <= BUDGET_CHARS).toBe(true)
  expect(built.prompt.includes('FINAL: your call on the cache?')).toBe(true)
  expect(built.prompt.includes('(Claude: "')).toBe(false)
  expect(built.snapshot.claude.some(c => c.text.startsWith('old '))).toBe(false)
  for (const c of closed) expect(built.prompt.includes(`${c.id}: [decide]`)).toBe(true)
  // Everything handed in is consumed, cut or not.
  expect(built.snapshot.consumedTurn).toBe(2)
})

test('user text beyond the newest 4 KB is cut oldest first', async () => {
  const user = Array.from({ length: 12 }, (_, i) => ({ seq: i + 1, text: `${i} ${'y'.repeat(3000)}`, afterTurn: 1 }))
  const built = buildPrompt(base({ mode: 'resolve', user }))
  expect(built.prompt.length <= BUDGET_CHARS).toBe(true)
  expect(built.snapshot.user.at(-1)?.seq).toBe(12)
  expect(built.snapshot.user[0]?.seq === 1).toBe(false)
  expect(built.snapshot.consumedSeq).toBe(12)
})

test('a numeric-string id counts as the number; any other string is dropped', async () => {
  const { snapshot } = buildPrompt(base())
  const r = parseVerdict('{"add":[],"resolve":[{"id":"1","by":"you","note":"x","evidence":"use sqlite"},{"id":"one","by":"you","note":"x","evidence":"use sqlite"}]}', snapshot)
  expect(r.ok && r.verdict.resolves.map(x => x.id)).toEqual([1])
  expect(r.ok && r.dropped).toBe(1)
})

test('sk_ keys are redacted as well as sk- keys', async () => {
  const key = ['sk', 'live', 'abcdefghijklmnopqrstuvwx'].join('_')
  expect(redact(`key ${key} here`)).toBe('key [redacted] here')
})

test("a resolve-only check shows Claude's latest message as context, never as evidence", async () => {
  const latest = 'Two things: 1. merge #18? 2. renew the domain?'
  const { prompt, snapshot } = buildPrompt(base({ mode: 'resolve', latest, user: [{ seq: 1, text: '2. done', afterTurn: 1 }] }))
  expect(prompt.includes(`<claude_latest>\n${latest}\n</claude_latest>`)).toBe(true)
  // Evidence must come from the user's words, so text found only in <claude_latest> is refused.
  const r = parseVerdict('{"add":[],"resolve":[{"id":1,"by":"you","note":"x","evidence":"renew the domain"}]}', snapshot)
  expect(r.ok && r.verdict.resolves.length).toBe(0)
  // A full check does not carry it.
  expect(buildPrompt(base({ latest })).prompt.includes('<claude_latest>')).toBe(false)
})
