import type { BridgeSession, LastTurn } from '../types'
import { EMPTY_BOOK } from './book'
import { freshDelivery } from './delivery'

// Enough text to find a question near the end of a long turn; older text is dropped.
export const TURN_TEXT_CAP = 20_000

export function freshSession(): BridgeSession {
  return {
    book: EMPTY_BOOK,
    delivery: freshDelivery(),
    isWakeQueued: false,
    turnText: '',
    last: null,
    pendingRows: [],
    view: { isPaneUp: false, otherFor: null, keysPausedUntil: null },
  }
}

// Fills fields a value written by an older build of this module lacks (a hot reload keeps $.state).
export function normalize(value: Partial<BridgeSession> | undefined): BridgeSession {
  const fresh = freshSession()
  if (value === undefined) return fresh
  return {
    book: value.book ?? fresh.book,
    delivery: value.delivery ?? fresh.delivery,
    isWakeQueued: value.isWakeQueued ?? false,
    turnText: value.turnText ?? '',
    last: value.last ?? null,
    pendingRows: value.pendingRows ?? [],
    view: { ...fresh.view, ...(value.view ?? {}) },
  }
}

// /clear and an in-process /resume: nothing of the old conversation survives.
export function resetSession(): BridgeSession {
  return freshSession()
}

export function withTurnText(s: BridgeSession, stepText: string): BridgeSession {
  if (stepText === '') return s
  const joined = s.turnText === '' ? stepText : `${s.turnText}\n\n${stepText}`
  return { ...s, turnText: joined.slice(-TURN_TEXT_CAP) }
}

export function lastTurn(s: BridgeSession, reason: LastTurn['reason'], finalAnswer: string): LastTurn {
  return { reason, text: s.turnText !== '' ? s.turnText : finalAnswer }
}
