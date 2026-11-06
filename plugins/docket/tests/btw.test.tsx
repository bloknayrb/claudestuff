import { expect, test } from 'claude-code/testing'

import { btwQuestion, leadHere, leadNew } from '../hooks/spawn'
import type { Item } from '../types'
import { command, mountPane, openIds, say, start, verdict, world } from './world'

type Fill = { text: string; mode?: string }

function box(on: Parameters<typeof world>[0], refuse = 0) {
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
  return b
}

const base: Item = { id: 1, kind: 'do', text: 'Renew the domain', quote: '', singleRec: false, source: 'manual', openedTurn: 0, status: 'open' }

test('the /btw question names the item, asks per kind, and carries Claude\'s words on one line', () => {
  expect(btwQuestion(base)).toBe('/btw can you remind me what this item is and give me more context for doing it? "Renew the domain"')
  const decide: Item = { ...base, kind: 'decide', text: 'Choose SQLite or Postgres', quote: 'Which should\nthe cache use?' }
  expect(btwQuestion(decide)).toBe(
    '/btw can you remind me what this item is and give me more context for making a decision? "Choose SQLite or Postgres" You had said: "Which should the cache use?"',
  )
  const carried: Item = { ...decide, carriedAt: 1 }
  expect(btwQuestion(carried).includes('You had said, in an earlier session: "Which should the cache use?"')).toBe(true)
  const long: Item = { ...decide, quote: 'x'.repeat(1000) }
  expect(btwQuestion(long).length < 400).toBe(true)
  expect(btwQuestion(long).includes('\n')).toBe(false)
})

test('/btw fills an empty box, replaces the item\'s own empty lead, and refuses over a draft', async ($, on) => {
  const w = world(on)
  const b = box(on)
  await start($)
  await command($, 'add Renew the domain')
  await command($, 'add Rotate the key')
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'btw-1' })
  expect(b.draft).toBe(btwQuestion(base))
  expect(w.toasts.some(t => t.includes('press Esc, then Enter to ask'))).toBe(true)
  // Pressed again: the same question, unchanged.
  await ui.press({ key: 'btw-1' })
  expect(b.draft).toBe(btwQuestion(base))
  // Reply here pressed first with nothing typed after it (trailing space or not, or only spaces): /btw
  // takes the box.
  for (const draft of [leadHere(base), leadHere(base).trimEnd(), `${leadHere(base)}   `, leadNew(base), leadNew(base).trimEnd()]) {
    b.draft = draft
    await ui.press({ key: 'btw-1' })
    expect(b.draft).toBe(btwQuestion(base))
  }
  // Anything typed after either lead, another item's lead or question, or any other draft: left alone.
  const two: Item = { ...base, id: 2, text: 'Rotate the key' }
  const kept = [`${leadHere(base)}yes`, `${leadNew(base)}renew for 2 years`, `${leadHere(base)}\nmore`, 'half a thought', leadHere(two), btwQuestion(two)]
  for (const draft of kept) {
    b.draft = draft
    await ui.press({ key: 'btw-1' })
    expect(b.draft).toBe(draft)
  }
  expect(w.toasts.filter(t => t.includes('/btw needs an empty box')).length).toBe(kept.length)
  // Changing his mind: Reply here on the same item swaps the question for the lead, so the answer he
  // types never runs as /btw. Reply new refuses over it, as over any draft.
  b.draft = btwQuestion(base)
  await ui.press({ key: 'reply-1' })
  expect(b.draft).toBe(leadHere(base))
  b.draft = btwQuestion(base)
  await ui.press({ key: 'replynew-1' })
  expect(b.draft).toBe(btwQuestion(base))
  expect(w.toasts.some(t => t.includes('Reply new needs an empty box'))).toBe(true)
  // Its own question with a trailing newline is still its own: /btw takes it, no refusal.
  const refusals = w.toasts.filter(t => t.includes('/btw needs an empty box')).length
  b.draft = `${btwQuestion(base)}\n`
  await ui.press({ key: 'btw-1' })
  expect(b.draft).toBe(btwQuestion(base))
  expect(w.toasts.filter(t => t.includes('/btw needs an empty box')).length).toBe(refusals)
  // Reply here over any other /btw draft (another item's question, or words typed after this one's)
  // refuses: the lead appended after it would send the answer as a side question.
  for (const draft of [btwQuestion(two), `${btwQuestion(base)} and also`]) {
    b.draft = draft
    await ui.press({ key: 'reply-1' })
    expect(b.draft).toBe(draft)
  }
  expect(w.toasts.filter(t => t.includes('the box holds a /btw question')).length).toBe(2)
  await ui.unmount()
  // Nothing closed.
  expect(await openIds($)).toEqual([1, 2])
})

test('/btw toasts when the box is not taking text', async ($, on) => {
  const w = world(on)
  box(on, 1)
  await start($)
  await command($, 'add Renew the domain')
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'btw-1' })
  await ui.unmount()
  expect(w.toasts.some(t => t.includes('not taking text'))).toBe(true)
  expect(w.toasts.some(t => t.includes('Enter to ask'))).toBe(false)
})

test('a /btw prompt that reaches prompt.submit is never taken as an answer', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  w.replies.push(verdict({ resolve: [{ id: 1, by: 'you', evidence: 'Renew the domain' }] }))
  await say($, w, btwQuestion(base))
  await w.clock.advance(60_000)
  expect(w.calls.length).toBe(0)
  expect(await openIds($)).toEqual([1])
  // Control: the same words typed without /btw do go to the check.
  await say($, w, btwQuestion(base).slice('/btw '.length))
  await w.clock.advance(60_000)
  expect(w.calls.length).toBe(1)
})
