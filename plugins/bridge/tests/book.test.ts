import { expect, test } from 'claude-code/testing'

import {
  addDecision, EMPTY_BOOK, idForUse, isAnsweredBy, markAnswered, pending, recommendedAnswer, reopen,
} from '../hooks/book'
import { SAMPLE } from './world'

const two = addDecision(addDecision(EMPTY_BOOK, SAMPLE, 'use-a', 5), { ...SAMPLE, question: 'B?' }, 'use-b', 6)

test('ids count from 1 and queueing is idempotent per tool_use_id', () => {
  expect(idForUse(two, 'use-a')).toBe(1)
  expect(idForUse(two, 'use-b')).toBe(2)
  expect(addDecision(two, SAMPLE, 'use-a', 9)).toBe(two)
  expect(pending(two).map(d => d.id)).toEqual([1, 2])
})

test('markAnswered flips only a pending decision, and only the matching nonce owns it', () => {
  const once = markAnswered(two, 1, { choice: 'label', label: 'SQLite' }, 'n1')
  const twice = markAnswered(once, 1, { choice: 'label', label: 'Postgres' }, 'n2')
  expect(isAnsweredBy(twice, 1, 'n1')).toBe(true)
  expect(isAnsweredBy(twice, 1, 'n2')).toBe(false)
  expect(twice.decisions[0]?.answer).toEqual({ choice: 'label', label: 'SQLite' })
  expect(pending(twice).map(d => d.id)).toEqual([2])
})

test('reopen returns a refused delivery to pending, for its own nonce only', () => {
  const answered = markAnswered(two, 1, { choice: 'other', text: 'x' }, 'n1')
  expect(pending(reopen(answered, 1, 'other-nonce')).map(d => d.id)).toEqual([2])
  const back = reopen(answered, 1, 'n1')
  expect(pending(back).map(d => d.id)).toEqual([1, 2])
  expect(back.decisions[0]?.answer).toBeUndefined()
})

test('recommendedAnswer takes the recommended label', () => {
  expect(recommendedAnswer({ ...two.decisions[0]!, recommend: 1 })).toEqual({ choice: 'label', label: 'SQLite' })
})
