import { expect, test } from 'claude-code/testing'

import { addManual, addUser, freshSession, normalize } from '../hooks/ledger'
import { envelope, isRealSid, isSafeSid, ledgerText, parseSlot, pickSlot, restore, slotName, tombstone, toLedger } from '../hooks/persist'
import type { DocketSession } from '../types'

const SID = 'aaaa-1111'

function session(over: Partial<DocketSession> = {}): DocketSession {
  let s: DocketSession = { ...freshSession(), sid: SID, root: 'C:/work', ...over }
  s = addManual(s, 'Renew the domain', 5000)
  s = addUser(s, 'secret buffer text')
  return { ...s, claude: [{ turn: 1, text: 'claude buffer', isFinal: true }], tools: [{ turn: 1, text: 'Bash: ls' }], lastFinal: 'Shall I merge?' }
}

const file = (s: DocketSession, seq: number, savedAt = 9000) => envelope(s.sid, s.root, seq, savedAt, ledgerText(s))

test('a round trip restores items, counters, everHadItem and carry; buffers stay out', () => {
  const s = { ...session(), carry: { on: true, gen: 2 } }
  const slot = parseSlot(file(s, 3), SID)
  expect(slot === null).toBe(false)
  const back = restore(slot!.ledger, SID, slot!.root)
  expect(back.items.map(i => i.text)).toEqual(['Renew the domain'])
  expect(back.items[0]?.origin).toBe(`${SID}:1`)
  expect(back.items[0]?.firstSeenAt).toBe(5000)
  expect(back.nextId).toBe(2)
  expect(back.everHadItem).toBe(true)
  expect(back.carry).toEqual({ on: true, gen: 2 })
  expect(back.lastFinal).toBe('Shall I merge?')
  expect(back.restored).toBe(true)
  expect(back.pendingUser).toEqual([])
  expect(back.claude).toEqual([])
  expect(back.tools).toEqual([])
  expect(file(s, 3).includes('secret buffer text')).toBe(false)
})

test('an older-shaped ledger without the new fields loads with backfills', () => {
  const s = session()
  const old = JSON.parse(ledgerText(s))
  delete old.everHadItem
  delete old.carry
  for (const i of old.items) { delete i.origin; delete i.firstSeenAt }
  const slot = parseSlot(envelope(SID, 'C:/work', 1, 7777, JSON.stringify(old)), SID)
  expect(slot?.ledger.carry).toEqual({ on: false, gen: 0 })
  expect(slot?.ledger.everHadItem).toBe(true)
  expect(slot?.ledger.items[0]?.origin).toBe(`${SID}:1`)
  expect(slot?.ledger.items[0]?.firstSeenAt).toBe(7777)
})

test('the A/B pick takes the higher valid seq; a torn slot falls back to the other', () => {
  const s = session()
  const a = parseSlot(file(s, 5), SID)
  const b = parseSlot(file({ ...s, turn: 9 }, 6), SID)
  expect(pickSlot(a, b)?.seq).toBe(6)
  const torn = parseSlot(file({ ...s, turn: 9 }, 6).slice(0, 40), SID)
  expect(torn).toBe(null)
  expect(pickSlot(a, torn)?.seq).toBe(5)
  expect(slotName(5)).toBe('a')
  expect(slotName(6)).toBe('b')
})

test('garbled, foreign-sid, wrong-version, tombstoned, over-cap and bad-id files are rejected', () => {
  const s = session()
  const good = file(s, 1)
  expect(parseSlot('not json', SID)).toBe(null)
  expect(parseSlot(good, 'bbbb-2222')).toBe(null)
  expect(parseSlot(good.replace('"v":1', '"v":2'), SID)).toBe(null)
  expect(parseSlot(tombstone(SID), SID)).toBe(null)
  const many = { ...s, items: Array.from({ length: 2001 }, (_, n) => ({ ...s.items[0]!, id: n + 1 })), nextId: 2002 }
  const real = { ...s, items: Array.from({ length: 150 }, (_, n) => ({ ...s.items[0]!, id: n + 1 })), nextId: 151 }
  expect(parseSlot(file(real, 1), SID) === null).toBe(false)
  expect(parseSlot(file(many, 1), SID)).toBe(null)
  const badNext = JSON.parse(ledgerText(s))
  badNext.nextId = 1
  expect(parseSlot(envelope(SID, 'C:/work', 1, 1, JSON.stringify(badNext)), SID)).toBe(null)
  const badKind = JSON.parse(ledgerText(s))
  badKind.items[0].kind = 'maybe'
  expect(parseSlot(envelope(SID, 'C:/work', 1, 1, JSON.stringify(badKind)), SID)).toBe(null)
})

test('unknown keys and __proto__ are dropped; strings are sanitised on load', () => {
  const s = session()
  const raw = JSON.parse(ledgerText(s))
  raw.items[0].evil = 'x'
  raw.items[0].text = 'Renew\u001b[31m the domain\u202e'
  const text = envelope(SID, 'C:/work', 1, 1, JSON.stringify(raw)).replace('"evil":"x"', '"evil":"x","__proto__":{"polluted":true}')
  const slot = parseSlot(text, SID)
  const item = slot?.ledger.items[0] as unknown as Record<string, unknown>
  expect(item.evil).toBe(undefined)
  expect(({} as Record<string, unknown>).polluted).toBe(undefined)
  expect(item.text).toBe('Renew the domain')
})

// v0.6 keeps a closed item's note (an amend's replaced reading must survive a resume), redacted.
test('closed items keep their note on disk, redacted; strings are redacted again as a backstop', () => {
  const s = session()
  const closed = { ...s, items: [{ ...s.items[0]!, status: 'resolved' as const, by: 'you' as const, note: 'with ghp_abcdefghijklmnopqrstuvwxyz0123', closedAt: 1, closeSeq: 1 }] }
  expect(ledgerText(closed).includes('with [redacted]')).toBe(true)
  const leaky = { ...s, items: [{ ...s.items[0]!, quote: 'use ghp_abcdefghijklmnopqrstuvwxyz0123 now' }] }
  expect(ledgerText(leaky).includes('ghp_')).toBe(false)
  expect(toLedger(leaky).items[0]?.quote.includes('[redacted]')).toBe(true)
})

test('isSafeSid refuses paths, empty and over-long ids', () => {
  expect(isSafeSid('2ec60fdb-b376-43ca-8cde-73e64361985c')).toBe(true)
  expect(isSafeSid('../x')).toBe(false)
  expect(isSafeSid('C:\\x')).toBe(false)
  expect(isSafeSid('')).toBe(false)
  expect(isSafeSid('a'.repeat(65))).toBe(false)
  expect(isRealSid('pending')).toBe(false)
  expect(isRealSid('')).toBe(false)
})

test('a value with no sid key is the v0.1 marker; the atom default is pending', () => {
  expect(freshSession().sid).toBe('pending')
  const v01 = { ...freshSession() } as Partial<DocketSession>
  delete v01.sid
  delete v01.carry
  expect(normalize(v01).sid).toBe('')
  expect(normalize(v01).carry).toEqual({ on: false, gen: 0 })
})

test('entry redaction: /docket add text and tool-asked questions', () => {
  const s = addManual(freshSession(), 'rotate sk-abcdefghijklmnopqrstuvwxyz', 1)
  expect(s.items[0]?.text.includes('sk-')).toBe(false)
  expect(s.everHadItem).toBe(true)
})
