import { describe, expect, test } from 'claude-code/testing'

import {
  freshDelivery,
  hasUnread,
  mainTurnEnded,
  mainTurnStarted,
  rowAppended,
  stepBegan,
  UNREAD_CAP,
} from '../hooks/delivery'
import type { DeliveryState } from '../hooks/delivery'

function append(d: DeliveryState, tag = 'findings'): { d: DeliveryState; isWake: boolean } {
  const r = rowAppended(d, tag)
  return { d: r.delivery, isWake: r.isWake }
}

describe('delivery bookkeeping', () => {
  test('idle before any turn: a row wakes at once and is marked woken', () => {
    const r = append(freshDelivery())
    expect(r.isWake).toBe(true)
    expect(r.d.unread).toEqual([{ id: 1, tag: 'findings', step: 0, hasWoken: true }])
  })

  test('during a turn: no wake; the next step reads the row, and a row recorded after a step is read by the one after', () => {
    let d = stepBegan(mainTurnStarted(freshDelivery()))
    const r = append(d)
    expect(r.isWake).toBe(false)
    d = r.d
    expect(hasUnread(d, 'findings')).toBe(true)
    d = stepBegan(d)
    expect(hasUnread(d, 'findings')).toBe(false)
    expect(mainTurnEnded(d, 'answer').isWake).toBe(false)
  })

  test('a row still unread when the turn answers wakes once, never twice', () => {
    let d = stepBegan(mainTurnStarted(freshDelivery()))
    d = append(d).d
    const end = mainTurnEnded(d, 'answer')
    expect(end.isWake).toBe(true)
    expect(end.delivery.unread.every(r => r.hasWoken)).toBe(true)
    const again = mainTurnEnded(mainTurnStarted(end.delivery), 'answer')
    expect(again.isWake).toBe(false)
  })

  test('several unwoken rows at a turn end make one wake', () => {
    let d = stepBegan(mainTurnStarted(freshDelivery()))
    d = append(d, 'findings').d
    d = append(d, 'other').d
    const end = mainTurnEnded(d, 'answer')
    expect(end.isWake).toBe(true)
    expect(end.delivery.unread.map(r => r.hasWoken)).toEqual([true, true])
  })

  for (const reason of ['aborted', 'error', 'refusal'] as const) {
    test(`after a turn ends ${reason}, nothing wakes, not even a row appended later while idle`, () => {
      let d = stepBegan(mainTurnStarted(freshDelivery()))
      d = append(d).d
      const end = mainTurnEnded(d, reason)
      expect(end.isWake).toBe(false)
      expect(end.delivery.lastMainEnd).toBe(reason)
      const later = append(end.delivery)
      expect(later.isWake).toBe(false)
      expect(later.d.unread.map(r => r.hasWoken)).toEqual([false, false])
      // The user's next prompt starts a turn: the memory clears and its first step reads both rows.
      const next = stepBegan(mainTurnStarted(later.d))
      expect(next.lastMainEnd).toBeNull()
      expect(next.unread).toEqual([])
    })
  }

  test('after an answered turn ends, an idle append wakes again', () => {
    const d = mainTurnEnded(stepBegan(mainTurnStarted(freshDelivery())), 'answer').delivery
    expect(append(d).isWake).toBe(true)
  })

  test('unread rows are capped, oldest dropped', () => {
    let d = mainTurnStarted(freshDelivery())
    for (let i = 0; i < UNREAD_CAP + 3; i += 1) d = append(d).d
    expect(d.unread).toHaveLength(UNREAD_CAP)
    expect(d.unread[0]?.id).toBe(4)
  })
})
