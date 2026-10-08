import type { BridgeSession } from '../types'
import { EMPTY_BOOK } from './book'
import { freshDelivery } from './delivery'

export function freshSession(): BridgeSession {
  return {
    book: EMPTY_BOOK,
    delivery: freshDelivery(),
    isWakeQueued: false,
    view: { isPaneUp: false, otherFor: null, keysPausedUntil: null },
  }
}

// Fills fields a value written by an older build of this module lacks (a hot reload keeps $.state), and
// drops any it no longer has, since only the fields named here are copied.
export function normalize(value: Partial<BridgeSession> | undefined): BridgeSession {
  const fresh = freshSession()
  if (value === undefined) return fresh
  return {
    book: value.book ?? fresh.book,
    delivery: value.delivery ?? fresh.delivery,
    isWakeQueued: value.isWakeQueued ?? false,
    view: { ...fresh.view, ...(value.view ?? {}) },
  }
}

// /clear and an in-process /resume: nothing of the old conversation survives.
export function resetSession(): BridgeSession {
  return freshSession()
}
