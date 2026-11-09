// Pure: the carry switch's files and the take. Nothing here takes $. A carry file or claim read back
// is untrusted, as a snapshot is: every field is rebuilt, and any failure rejects the file.

import type { DocketSession, Item } from '../types'
import { openItems } from './ledger'
import { isSafeSid, readItem, SNAPSHOT_V } from './persist'
import { redact, sanitise } from './text'

// A carry older than this is ignored (and logged), never taken.
export const CARRY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000
// How far the claim chain is followed from the newest carry to where its items went.
export const MAX_HOPS = 8
export const MAX_CARRY_ITEMS = 2000

// The folder key: the root with slashes unified, lower-cased only for a Windows drive or UNC path
// (POSIX folders that differ only in case stay apart), then FNV-1a 32-bit as hex.
export function normRoot(root: string): string {
  const flat = root.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^[A-Za-z]:|^\/\//.test(flat) ? flat.toLowerCase() : flat
}

export function rootKey(root: string): string {
  let h = 0x811c9dc5
  for (const ch of normRoot(root)) {
    h ^= ch.codePointAt(0) ?? 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

export type CarryFile = { sid: string; root: string; gen: number; on: boolean; seq: number; savedAt: number; items: Item[] }

// What a carry write holds and dedupes on: the switch, and the open items only (closed ones never
// travel). Off, or taken by a later session, it is the off record.
export function carryText(s: DocketSession): string {
  const on = s.carry.on && !s.carryTaken
  const items = on
    ? openItems(s).map(item => {
        // v0.8: Claude's reopen belongs to this session (takeInto starts an item fresh): not written.
        const { reopened: _re, claudeReopens: _n, closedAtSeq: _cs, ...i } = item
        return { ...i, text: redact(i.text), quote: redact(i.quote), origin: i.origin ?? `${s.sid}:${i.id}`, ...(i.notes === undefined ? {} : { notes: i.notes.map(n => ({ ...n, text: redact(n.text) })) }) }
      })
    : []
  return JSON.stringify({ gen: s.carry.gen, on, items })
}

export function carryEnvelope(sid: string, root: string, seq: number, savedAt: number, text: string): string {
  const body = JSON.parse(text) as { gen: number; on: boolean; items: unknown[] }
  return JSON.stringify({ v: SNAPSHOT_V, sid, root, gen: body.gen, on: body.on, seq, savedAt, items: body.items })
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function parseCarry(text: string | undefined, sid: string): CarryFile | null {
  if (text === undefined) return null
  try {
    const v: unknown = JSON.parse(text)
    if (!isObj(v) || v.v !== SNAPSHOT_V || v.sid !== sid || !isSafeSid(sid)) return null
    // A root is rejected, not clipped, past 1024 chars (as readClaim does): a clipped root could never
    // match the folder again, and the handoff would be ignored without a word.
    if (typeof v.root !== 'string' || v.root === '' || v.root.length > 1024 || typeof v.on !== 'boolean') return null
    if (!Number.isInteger(v.gen) || (v.gen as number) < 0 || !Number.isInteger(v.seq) || (v.seq as number) < 1) return null
    if (typeof v.savedAt !== 'number' || !Number.isFinite(v.savedAt)) return null
    if (!Array.isArray(v.items) || v.items.length > MAX_CARRY_ITEMS) return null
    const savedAt = v.savedAt
    const items = v.items.map(i => readItem(i, sid, savedAt))
    if (items.some(i => i.status !== 'open')) return null
    return { sid, root: v.root, gen: v.gen as number, on: v.on, seq: v.seq as number, savedAt, items }
  } catch {
    return null
  }
}

export const pickCarry = (a: CarryFile | null, b: CarryFile | null): CarryFile | null =>
  a === null ? b : b === null ? a : a.seq >= b.seq ? a : b

export const claimText = (srcSid: string, gen: number, by: string, at: number): string => JSON.stringify({ v: SNAPSHOT_V, srcSid, gen, by, at })

// The sids that hold a claim in one claims/<src>/<gen>/ listing. Any entry that isn't a plain
// "<safe sid>.json" file still counts as a claim by someone: a torn or planted entry must never
// reopen a carry.
export function claimers(names: readonly { name: string; kind: string; isLink: boolean }[]): string[] {
  return names.map(e => {
    const m = /^(.+)\.json$/.exec(e.name)
    return m !== null && e.kind === 'file' && !e.isLink && isSafeSid(m[1]) ? (m[1] as string) : `?${e.name}`
  })
}

// Taking a carry, inside one transact. Items whose origin this ledger already holds (open or closed)
// are dropped; the rest arrive as new items of this session. An untouched switch (gen 0) turns on:
// the switch is sticky. Returns how many came in.
export function takeInto(s: DocketSession, items: readonly Item[], now: number, folder: string): { session: DocketSession; added: number } {
  const known = new Set(s.items.map(i => i.origin ?? `${s.sid}:${i.id}`))
  let nextId = s.nextId
  const fresh: Item[] = []
  for (const it of items) {
    const origin = it.origin ?? ''
    if (origin === '' || known.has(origin)) continue
    known.add(origin)
    fresh.push({
      id: nextId,
      kind: it.kind,
      text: sanitise(redact(it.text), 120),
      quote: sanitise(redact(it.quote), 200),
      singleRec: false,
      source: it.source,
      openedTurn: s.turn,
      status: 'open',
      origin,
      firstSeenAt: it.firstSeenAt ?? now,
      carriedAt: now,
    })
    nextId += 1
  }
  const carry = s.carry.gen === 0 ? { on: true, gen: 1 } : s.carry
  const added = fresh.length
  return {
    session: {
      ...s,
      items: [...s.items, ...fresh],
      nextId,
      carry,
      carryTaken: s.carry.gen === 0 ? false : s.carryTaken,
      everHadItem: s.everHadItem || added > 0,
      carriedNotice: added > 0 ? { count: added, folder, isSeen: false } : s.carriedNotice,
    },
    added,
  }
}

// "2d", "5h", "now": a carried item's honest age, from when it first appeared.
export function wallAge(ms: number): string {
  const m = Math.floor(ms / 60000)
  if (m < 60) return m <= 0 ? 'now' : `${m}m`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`
}

export const folderName = (root: string): string => normRoot(root).split('/').filter(Boolean).at(-1) ?? root
