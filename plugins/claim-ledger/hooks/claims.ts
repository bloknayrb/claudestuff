import type { Claim, Family, ShipOp } from '../types'

// Pure: no `$`, no runtime imports. scripts/precision.mjs imports this file under Node.

/** `gap`: the match spans a subject and the words before its verb (the present-state forms). */
type Pattern = { family: Family; op: ShipOp | null; re: RegExp; gap?: boolean }

// First person: "I committed", "I've pushed", "I have just merged".
const I = String.raw`\bI(?:'ve|\s+have)?\s+(?:just\s+|now\s+|also\s+|already\s+)?`
// A ship verb already said, joined to the next: "Committed and pushed", "committed, pushed".
const THEN = String.raw`(?:(?:committed|pushed|force-pushed|merged|squash-merged)(?:\s*,\s*|\s+and\s+))?`
// Sentence-initial, as a list item or in bold: "Committed.", "- **Merged** into main." (review C9).
const START = String.raw`^(?:[-*]\s+)?(?:\*\*)?`
const BY_ME = `(?:${START}${THEN}|${I}${THEN})`
// Present state needs a git noun as its subject, so "rows are merged into the tracker" is not a claim (review C5).
// "Everything", "the tag", "Task 3" and "round 2" are the other subjects real end-of-task claims use (re-review), and
// "Unit 8c" (Task 7).
const GIT_NOUN = String.raw`(?<![\w#])(?:PR\s*#?\s*\d+|#\d+|pull\s+requests?|PRs?|branch(?:es)?|commits?|changes|fix(?:es)?|patch(?:es)?|work|everything|tags?|task\s+\d+|round\s+\d+|units?\s+\d+[a-z]?)(?![\w-])`

const shipped = (verb: string): RegExp => new RegExp(`${BY_ME}${verb}\\b`, 'i')
const present = (verb: string): RegExp => new RegExp(`${GIT_NOUN}[^.;:!?]{0,40}?\\b(?:is|are)\\s+(?:now\\s+|all\\s+|both\\s+)?${verb}\\b`, 'i')

const PATTERNS: readonly Pattern[] = [
  { family: 'tests', op: null, re: /\b(?:all\s+)?(?:\d+(?:\s*\/\s*\d+)?\s+)?(?:the\s+)?(?:unit\s+|integration\s+|e2e\s+|new\s+)?(?:tests?|test\s+files?)\s+(?:now\s+|still\s+|all\s+)?(?:pass(?:es|ing)?|are\s+(?:all\s+|now\s+)?(?:passing|green)|is\s+(?:now\s+)?(?:passing|green))\b/i },
  { family: 'tests', op: null, re: /\b(?:test\s+)?suite\s+(?:now\s+|still\s+)?(?:passes|is\s+(?:now\s+)?(?:passing|green))\b/i },
  { family: 'tests', op: null, re: /\ball\s+green\b/i },
  { family: 'build', op: null, re: /\b(?:builds|compiles|type-?checks)\s+(?:cleanly|clean|successfully|fine|without\s+(?:errors?|warnings?))\b/i },
  // "It builds its own stub" describes; it does not claim (review C9): no object may follow the verb.
  { family: 'build', op: null, re: /\b(?:it|everything|the\s+(?:project|code|plugin|mod|crate|package|app|module))\s+(?:now\s+|still\s+)?(?:builds|compiles|type-?checks)\b(?!\s+(?:its|their|his|her|our|my|your|the|a|an|this|that|these|those|on|for|against|into|to|from|with)\b)/i },
  { family: 'build', op: null, re: /\b(?:the\s+)?(?:build|type-?check|tsc)\s+(?:now\s+|still\s+)?(?:passes|succeeds|is\s+(?:now\s+)?(?:clean|green))\b/i },
  { family: 'shipped', op: 'commit', re: shipped('committed') },
  { family: 'shipped', op: 'commit', re: present('committed'), gap: true },
  // "Committed" is git's word whatever the subject ("The helper scripts are committed on the spike branch"): any subject,
  // with the hedges and negations in its clause, but not "committed to" (Task 7: 20 of 52 present-state forms missed).
  { family: 'shipped', op: 'commit', re: /\b(?:is|are)\s+(?:now\s+|all\s+|both\s+)?committed\b(?!\s+to\b)/i },
  { family: 'shipped', op: 'push', re: shipped('(?:force-)?pushed') },
  { family: 'shipped', op: 'push', re: present('(?:force-)?pushed'), gap: true },
  { family: 'shipped', op: 'merge', re: shipped('(?:squash-)?merged') },
  { family: 'shipped', op: 'merge', re: present('(?:squash-)?merged'), gap: true },
  { family: 'shipped', op: 'pr-create', re: new RegExp(`(?:${START}|${I}|\\band\\s+)opened\\s+(?:PR\\s*#\\s*\\d+|(?:a|the)\\s+(?:PR|pull\\s+request))\\b`, 'i') },
]

// A word here, in the same clause before the match, makes it a negation, a condition, a future, an instruction or a question.
const HEDGE = /\b(?:not|never|no|nothing|none|neither|nor|nobody|don't|doesn't|didn't|won't|isn't|aren't|wasn't|weren't|haven't|hasn't|if|once|until|unless|when|whether|should|would|could|might|may|must|will|make|makes|making|ensure|ensures|verify|check|confirm|expect|expects|expected|need|needs|want|wait|before|get|getting|keep|so\s+that|to\s+see|what|how)\b/i
// A word here, in the same clause after the match, negates it: "I've pushed nothing yet".
const NEG_AFTER = /\b(?:yet|nothing|not)\b/i
// After "merged": "into" a thing that is no branch. A branch is main, master, develop, trunk, a base, release or upstream
// branch, an inline-code name (`CODE`) or a slashed name (feat/x).
const FIGURATIVE_INTO = /^\W*into\s+(?!(?:the\s+|its\s+|their\s+)?(?:main|master|develop|dev|trunk|base|branch|release|origin|upstream|CODE)\b)(?![\w.-]+\/)[a-z]/i
// Anywhere in the sentence: a description of how a test behaves under a mutation, not a claim that the suite passes (review C9).
// "against that mutation" too (Task 7: a real sentence saying a negative test passes against a mutation).
const UNCLAIM = /\b(?:even\s+without|identically|(?:against|under)\s+(?:(?:the|a|each|every|that|this|these|those)\s+)?mutations?|with\s+(?:\S+\s+){0,3}removed)\b/i

/** Removes what is not my own claim: fenced code, blockquotes, inline code, and double- or single-quoted text. */
export function stripNonClaims(text: string): string {
  return text
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/```[\s\S]*?(?:```|$)/g, '\n')
    .replace(/^[ \t]*>.*$/gm, '\n')
    .replace(/`[^`\n]*`/g, ' CODE ')
    .replace(/"[^"\n]*"/g, ' QUOTE ')
    // A single-quoted span opens and closes beside a non-letter; an apostrophe between two letters ('I've pushed') stays inside it.
    .replace(/(?<![\p{L}\p{N}])'(?:[^'\n]|(?<=\p{L})'(?=\p{L}))+?'(?![\p{L}\p{N}])/gu, ' QUOTE ')
}

/** Splits on sentence ends and on line breaks (so list items are sentences). */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/** FNV-1a, 32-bit, as 8 hex digits. Not security: a stable key for "flagged once per session". */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const CLAUSE_MARKS = [',', ';', ':', '—', ' - ']

function clauseBefore(sentence: string, index: number): string {
  const head = sentence.slice(0, index)
  const cut = Math.max(...CLAUSE_MARKS.map(m => head.lastIndexOf(m)))
  return head.slice(cut + 1)
}

function clauseAfter(sentence: string, end: number): string {
  const tail = sentence.slice(end)
  const cuts = CLAUSE_MARKS.map(m => tail.indexOf(m)).filter(i => i >= 0)
  return cuts.length === 0 ? tail : tail.slice(0, Math.min(...cuts))
}

function normalize(sentence: string): string {
  return sentence.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim()
}

/** Every claim in my text, one per (family, op, sentence), in pattern order within a sentence. */
export function findClaims(text: string): Claim[] {
  const found = new Map<string, Claim>()
  for (const sentence of sentencesOf(stripNonClaims(text))) {
    if (sentence.endsWith('?') || UNCLAIM.test(sentence)) continue
    for (const pattern of PATTERNS) {
      const match = pattern.re.exec(sentence)
      if (match === null) continue
      if (HEDGE.test(clauseBefore(sentence, match.index))) continue
      // A present-state match spans its subject and up to 40 characters before the verb: a hedge in that gap counts
      // too, so "branch review runs before anything is pushed" is not a claim (Task 7).
      if (pattern.gap === true && HEDGE.test(match[0])) continue
      if (NEG_AFTER.test(clauseAfter(sentence, match.index + match[0].length))) continue
      // "Merged into the pipeline", "merged into the tracker": merged into something that is not a branch is not git (round 4).
      if (pattern.op === 'merge' && FIGURATIVE_INTO.test(clauseAfter(sentence, match.index + match[0].length))) continue
      const hash = fnv1a(`${pattern.family}|${pattern.op ?? ''}|${normalize(sentence)}`)
      if (found.has(hash)) continue
      const phrase = match[0].replace(/\s+/g, ' ').trim().slice(0, 60)
      found.set(hash, { family: pattern.family, op: pattern.op, phrase, hash })
    }
  }
  return [...found.values()]
}
