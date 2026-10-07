import { expect, test } from 'claude-code/testing'

import { addDecision } from '../hooks/book'
import { freshDelivery, rowAppended } from '../hooks/delivery'
import { freshSession, lastTurn, normalize, resetSession, TURN_TEXT_CAP, withTurnText } from '../hooks/session'
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

test('the turn text joins every step and keeps the newest end', () => {
  const s = withTurnText(withTurnText(withTurnText(freshSession(), 'Shall I push?'), ''), 'Done.')
  expect(s.turnText).toBe('Shall I push?\n\nDone.')
  expect(lastTurn(s, 'answer', 'Done.')).toEqual({ reason: 'answer', text: 'Shall I push?\n\nDone.' })
  const long = withTurnText(freshSession(), 'x'.repeat(TURN_TEXT_CAP + 10) + '?')
  expect(long.turnText).toHaveLength(TURN_TEXT_CAP)
  expect(long.turnText.endsWith('?')).toBe(true)
})

test('with no step text, the last turn falls back to the final answer', () => {
  expect(lastTurn(freshSession(), 'aborted', 'cut')).toEqual({ reason: 'aborted', text: 'cut' })
})
