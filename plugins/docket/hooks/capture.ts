// Pure: one main turn's material, read from $.session.messages() at turn.complete.
//
// The live probe (2026-11-03) found session.append's `response` door carried every assistant text
// row in one turn but none of two mid-turn texts in another, while messages() held all of them; so
// the transcript, not the door, is the source.

import type { SessionMessage } from 'claude-code'

import type { ClaudeEntry, ToolLine } from '../types'
import { clip } from './text'

// messages() returns at most this many entries: past it, the list length stops moving.
export const MESSAGES_CAP = 4096

const ASKING_TOOLS = new Set(['AskUserQuestion', 'mcp__bridge__decide'])

export type TurnMaterial = { claude: ClaudeEntry[]; tools: ToolLine[]; asked: string[] }

// The user's own shell rows (`!cmd`) and the engine's wrapped notices are user-role text that does not
// open a turn.
function isTurnOpener(m: SessionMessage, midTurn: ReadonlySet<string>): boolean {
  if (m.role !== 'user' || (m.toolResults?.length ?? 0) > 0) return false
  const t = m.text.trim()
  if (t === '' || t.startsWith('<bash-') || t.startsWith('<system-reminder>')) return false
  return !midTurn.has(t)
}

// The messages of the turn that just ended, by the first of these that works:
// 1. the newest user message holding the turn's opening prompt (turn.start's text): immune to the
//    4096 cap and to compaction, and not fooled by user-role rows other mods append mid-turn;
// 2. everything past the count taken at turn.start, while the list is under the cap and has not shrunk;
// 3. a walk back to the newest user text that looks like a prompt.
export function turnSlice(msgs: readonly SessionMessage[], startLen: number | undefined, midTurn: ReadonlySet<string>, opener?: string): SessionMessage[] {
  const open = opener?.trim() ?? ''
  if (open !== '') {
    for (let j = msgs.length - 1; j >= 0; j -= 1) {
      const m = msgs[j] as SessionMessage
      if (m.role === 'user' && (m.toolResults?.length ?? 0) === 0 && m.text.trim() === open) return msgs.slice(j + 1)
    }
  }
  if (startLen !== undefined && msgs.length < MESSAGES_CAP && msgs.length >= startLen) return msgs.slice(startLen)
  let i = msgs.length - 1
  while (i >= 0 && !isTurnOpener(msgs[i] as SessionMessage, midTurn)) i -= 1
  return msgs.slice(i + 1)
}

function toolLine(name: string, input: Record<string, unknown>): string {
  const pick = (key: string): string => (typeof input[key] === 'string' ? (input[key] as string) : '')
  const detail = pick('command') || pick('file_path') || pick('url') || pick('pattern') || pick('description')
  return clip(detail === '' ? name : `${name}: ${detail.replace(/\s+/g, ' ')}`, 160)
}

function askedQuestions(name: string, input: Record<string, unknown>): string[] {
  if (name === 'mcp__bridge__decide') return typeof input.question === 'string' ? [input.question] : []
  const qs = Array.isArray(input.questions) ? (input.questions as unknown[]) : []
  return qs.flatMap(q => (q !== null && typeof q === 'object' && typeof (q as { question?: unknown }).question === 'string' ? [(q as { question: string }).question] : []))
}

// Claude's texts (the last one marked final), its tool lines, and the questions it asked through a
// tool. `answer` (turn.complete's final text) is the floor: added when the slice lacks it.
export function material(slice: readonly SessionMessage[], answer: string, turn: number): TurnMaterial {
  const claude: ClaudeEntry[] = []
  const tools: ToolLine[] = []
  const asked: string[] = []
  for (const m of slice) {
    if (m.role !== 'assistant') continue
    if (m.text.trim() !== '') claude.push({ turn, text: m.text.trim(), isFinal: false })
    for (const use of m.toolUses) {
      if (ASKING_TOOLS.has(use.tool)) asked.push(...askedQuestions(use.tool, use.input))
      else tools.push({ turn, text: toolLine(use.tool, use.input) })
    }
  }
  const final = answer.trim()
  if (final !== '' && !claude.some(c => c.text === final)) claude.push({ turn, text: final, isFinal: false })
  const last = claude.at(-1)
  if (last !== undefined) last.isFinal = true
  return { claude, tools, asked }
}

// The user's `!cmd` as the transcript row carries it: "<bash-input>cmd</bash-input>".
export function bashInput(text: string): string | undefined {
  const m = /^<bash-input>([\s\S]*?)<\/bash-input>/.exec(text.trim())
  return m?.[1] === undefined || m[1].trim() === '' ? undefined : m[1].trim()
}
