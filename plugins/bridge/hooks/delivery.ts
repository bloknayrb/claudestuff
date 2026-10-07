/**
 * Delivery bookkeeping for a mod that appends rows for the main loop to read (00-shared "Delivering a
 * message to me", race guard as settled 2026-10-06). Pure and `$`-free, and imports nothing, so another mod
 * copies this file whole; the `$` calls (the append, the wake prompt) stay in the mod's register file.
 *
 * - A main-loop step marks read only the rows appended before that step began.
 * - Each row causes at most one wake in its life. A turn end that finds several unwoken rows wakes once
 *   for all of them.
 * - Nothing wakes after a main turn that ended aborted, error or refusal, and that is remembered: a row
 *   appended later, while idle, waits for the next main turn (the user's next prompt) to read it.
 */

export type EndReason = 'answer' | 'aborted' | 'error' | 'refusal'

export type DeliveryRow = {
  id: number
  /** What the row carries, for the mod's own checks (Red Team: 'findings'). */
  tag: string
  /** The count of main-loop steps begun when the row was appended; a step that begins later reads it. */
  step: number
  /** Whether this row has had its one wake. */
  hasWoken: boolean
}

export type DeliveryState = {
  /** Rows appended and not yet read by a main-loop step, oldest first. */
  unread: DeliveryRow[]
  nextId: number
  /** Main-loop steps begun so far. */
  steps: number
  isMainTurnRunning: boolean
  /** How the last main turn ended; null before any, and again once a new main turn starts. */
  lastMainEnd: EndReason | null
}

export const UNREAD_CAP = 32

export function freshDelivery(): DeliveryState {
  return { unread: [], nextId: 1, steps: 0, isMainTurnRunning: false, lastMainEnd: null }
}

function canWakeNow(d: DeliveryState): boolean {
  return !d.isMainTurnRunning && (d.lastMainEnd === null || d.lastMainEnd === 'answer')
}

/** Records a row the mod has just appended. `isWake`: the mod submits its wake prompt now. */
export function rowAppended(d: DeliveryState, tag: string): { delivery: DeliveryState; isWake: boolean } {
  const isWake = canWakeNow(d)
  const row: DeliveryRow = { id: d.nextId, tag, step: d.steps, hasWoken: isWake }
  return { delivery: { ...d, nextId: d.nextId + 1, unread: [...d.unread, row].slice(-UNREAD_CAP) }, isWake }
}

/**
 * A main-loop step began: every row recorded so far is in its request, so it is read. A row appended later is
 * not in this step's unread list because it is not recorded yet: the guarantee comes from call order (the mod's
 * `turn.step` hook runs this before `next(e)`, and `deliver` appends before it records the row), not from
 * `step`, which is kept as a record of when the row arrived.
 */
export function stepBegan(d: DeliveryState): DeliveryState {
  const steps = d.steps + 1
  return { ...d, steps, unread: d.unread.filter(r => r.step >= steps) }
}

export function mainTurnStarted(d: DeliveryState): DeliveryState {
  return { ...d, isMainTurnRunning: true, lastMainEnd: null }
}

/** A main turn ended. An answered turn that left unwoken rows unread wakes once for all of them. */
export function mainTurnEnded(d: DeliveryState, reason: EndReason): { delivery: DeliveryState; isWake: boolean } {
  const ended: DeliveryState = { ...d, isMainTurnRunning: false, lastMainEnd: reason }
  if (reason !== 'answer') return { delivery: ended, isWake: false }
  const isWake = d.unread.some(r => !r.hasWoken)
  return { delivery: { ...ended, unread: d.unread.map(r => ({ ...r, hasWoken: true })) }, isWake }
}

export function hasUnread(d: DeliveryState, tag: string): boolean {
  return d.unread.some(r => r.tag === tag)
}
