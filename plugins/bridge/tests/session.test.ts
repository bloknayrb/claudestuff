import { expect, test } from 'claude-code/testing'

import { addDecision } from '../hooks/book'
import { freshDelivery, rowAppended } from '../hooks/delivery'
import { freshSession, normalize, resetSession } from '../hooks/session'
import { SAMPLE } from './world'

test('a fresh session is empty, with the shared module fresh', () => {
  const s = freshSession()
  expect(s.book).toEqual({ decisions: [], nextId: 1 })
  expect(s.delivery).toEqual(freshDelivery())
  expect(s.view).toEqual({ isPaneUp: false, otherFor: null, keysPausedUntil: null })
  expect(s.isWakeQueued).toBe(false)
})

test('normalize fills what an older value lacks and keeps what it has', () => {
  const book = addDecision(freshSession().book, SAMPLE, 'u', 1)
  const s = normalize({ book, view: { isPaneUp: true, otherFor: null } as never })
  expect(s.book).toBe(book)
  expect(s.view).toEqual({ isPaneUp: true, otherFor: null, keysPausedUntil: null })
  expect(s.delivery).toEqual(freshDelivery())
  expect(normalize(undefined)).toEqual(freshSession())
})

test('resetSession forgets decisions and delivery', () => {
  const busy = { ...freshSession(), book: addDecision(freshSession().book, SAMPLE, 'u', 1), delivery: rowAppended(freshDelivery(), 'decision').delivery }
  expect(busy.book.decisions).toHaveLength(1)
  expect(resetSession()).toEqual(freshSession())
})

// A value stored by the build that had the typed go-ahead (a hot reload keeps $.state).
test('normalize drops the fields an older build stored and this one no longer has', () => {
  const old = { ...freshSession(), turnText: 'Shall I push?', last: { reason: 'answer', text: 'x' }, pendingRows: [{ tag: 'note', text: 'n', id: 1, nonce: 'z' }] }
  expect(normalize(old as never)).toEqual(freshSession())
})
