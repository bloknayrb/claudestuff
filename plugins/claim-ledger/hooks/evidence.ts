import type { AsOf, Basis, Claim, Entry, Family, Kind, Ledger, Pending, ShipOp, Status } from '../types'

// Pure: no `$`, no runtime imports. scripts/precision.mjs imports this file under Node.

// Equal to the manifest's userConfig defaults: change both together.
export const DEFAULT_TEST_COMMANDS: readonly string[] = ['pytest', 'uv run pytest', 'npm test', 'npm run test', 'npm run test:e2e', 'pnpm test', 'yarn test', 'vitest', 'jest', 'npx playwright test', 'cargo test', 'go test', 'claude plugin test']
export const DEFAULT_BUILD_COMMANDS: readonly string[] = ['tsc', 'cargo build', 'npm run build', 'npm run typecheck', 'npm run typecheck:tests', 'idf.py build']

export type Config = { tests: readonly RegExp[]; build: readonly RegExp[] }
/** What a tool call answered (the ToolCallResult arms, read loosely). `text` is the result as the model read it. */
export type Ran = { readonly deny?: string; readonly isError?: boolean; readonly result?: unknown; readonly text?: string }
export type Facts = {
  tool: string
  command: string | null
  path: string | null
  toolUseId: string | null
  denied: boolean
  isError: boolean
  interrupted: boolean
  background: boolean
  /** The result as the model read it: where a runner's summary shows. */
  output: string
  git: Partial<Record<ShipOp, true>>
  /** Files a Bash command changed, when its result lists them (bashEditDiff, @internal: may be absent). */
  changed: string[]
  /** A background command's task id (`backgroundTaskId`, or the id its notice names), when it has one. */
  taskId?: string | null
  /**
   * False when `isError` is not this command's exit status: a background run re-judged from a read-back that shows no
   * `[exited with code N]` line. Absent means known.
   */
  exitKnown?: boolean
  /** The result says `gh pr merge` only enabled auto-merge (`gitOperation.pr.action`): nothing was merged yet. */
  autoMerge?: boolean
}
export type Run = { kind: Kind; ok: boolean; masked: boolean; basis: Basis }
/**
 * `mutations`: code edits, as pathKey()s. `messageFiles`: files a git or gh command read a message or body from
 * (`-F`, `--file`, `--body-file`), normalized; relative ones as written.
 */
export type Classified = { mutations: string[]; runs: Run[]; messageFiles: string[]; keys?: string[] }
/** Where things live: the home folder (memory roots), the session's project root (relative paths) and %TEMP%. Each may be unknown. */
export type Places = { home: string | null; root: string | null; temp: string | null }
export type Word = { text: string; quoted: boolean }
/** The operator after a segment; '' ends the line (a trailing `&` is kept: the line ran in the background). */
export type Op = '' | ';' | '\n' | '&' | '&&' | '||' | '|'
export type Segment = { words: Word[]; op: Op }

const SHELLS = new Set(['Bash', 'PowerShell'])
const EDITORS = new Set(['Edit', 'Write', 'NotebookEdit'])
const SHIP_OPS: readonly ShipOp[] = ['commit', 'push', 'merge', 'pr-create']

// ---- Parsing a command line ----

// A heredoc's body is data: keep the line that opens it, drop the body and its closing delimiter. With no closing
// delimiter it is not a heredoc (`python -c "print(1<<n)"` is a shift), and nothing is dropped.
// Matched at one position (sticky): heredocsOf only starts it at an opener whose word closes a later line.
const HEREDOC = /<<-?[ \t]*(['"]?)([A-Za-z_]\w*)\1([^\n]*)\n(?:[\s\S]*?\n)?[ \t]*\2[ \t\r]*(?=\n|$)/y
const OPENER = /<<-?[ \t]*(['"]?)([A-Za-z_]\w*)\1/g

/**
 * The heredocs in a command, in order. An opener whose word is no later line of the command never enters the body
 * scan, so many unterminated `<<` (shifts, comparisons) cost nothing; the lazy scan from each one to the end was
 * O(openers x length).
 */
function heredocsOf(command: string): RegExpExecArray[] {
  if (!command.includes('<<')) return []
  // Where each trimmed line last occurs.
  const lastAt = new Map<string, number>()
  let at = 0
  for (const line of command.split('\n')) {
    lastAt.set(line.trim(), at)
    at += line.length + 1
  }
  const found: RegExpExecArray[] = []
  OPENER.lastIndex = 0
  for (let m = OPENER.exec(command); m !== null; m = OPENER.exec(command)) {
    if ((lastAt.get(m[2] ?? '') ?? -1) <= m.index) continue
    HEREDOC.lastIndex = m.index
    const h = HEREDOC.exec(command)
    if (h === null) continue
    found.push(h)
    OPENER.lastIndex = h.index + h[0].length
  }
  return found
}

/** The command with each heredoc's body and closing line dropped; its opener becomes `<<HEREDOC` and keeps its line. */
function withoutHeredocs(command: string): string {
  let out = ''
  let last = 0
  for (const h of heredocsOf(command)) {
    out += `${command.slice(last, h.index)}<<HEREDOC${h[3] ?? ''}`
    last = h.index + h[0].length
  }
  return out + command.slice(last)
}
// PowerShell here-strings are data too.
const HERESTRING = /@(['"])\r?\n[\s\S]*?\r?\n\1@/g
// A line continuation (bash backslash, PowerShell backtick) joins two lines.
const CONTINUATION = /\\\r?\n|`\r?\n/g
const BREAKS = new Set([' ', '\t', '\r', '(', ')', '{', '}'])

/** Splits a bash or PowerShell line into simple commands at top-level operators, outside quotes. */
export function segmentsOf(command: string): Segment[] {
  const src = withoutHeredocs(command).replace(HERESTRING, ' @HERE@ ').replace(CONTINUATION, ' ')
  const segments: Segment[] = []
  let words: Word[] = []
  let text = ''
  let quoted = false
  let open = false
  let quote: string | null = null
  const endWord = (): void => {
    if (open) words.push({ text, quoted })
    text = ''
    quoted = false
    open = false
  }
  const endSegment = (op: Op): void => {
    endWord()
    if (words.length > 0) segments.push({ words, op })
    words = []
  }
  for (let i = 0; i < src.length; i += 1) {
    const ch = src.charAt(i)
    const next = src.charAt(i + 1)
    if (quote !== null) {
      if (ch === quote) {
        quote = null
      } else if (ch === '\\' && quote === '"' && next !== '' && '"\\$`'.includes(next)) {
        text += next
        i += 1
      } else {
        text += ch
      }
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      quoted = true
      open = true
    } else if (ch === '\\' && next !== '') {
      text += next
      open = true
      i += 1
    } else if (ch === '#' && !open) {
      while (i + 1 < src.length && src.charAt(i + 1) !== '\n') i += 1
    } else if (ch === ';' || ch === '\n') {
      endSegment(ch === ';' ? ';' : '\n')
    } else if (ch === '&') {
      const prev = src.charAt(i - 1)
      if (next === '&') {
        endSegment('&&')
        i += 1
      } else if (prev === '>' || prev === '<' || next === '>') {
        // A redirection: 2>&1, >&2, &>.
        text += ch
        open = true
      } else if (open || words.length > 0) {
        endSegment('&')
      }
      // Otherwise PowerShell's call operator, `& "C:/x.exe"`: nothing to record.
    } else if (ch === '|') {
      if (next === '|') {
        endSegment('||')
        i += 1
      } else {
        if (next === '&') i += 1 // `|&` pipes stderr too
        endSegment('|')
      }
    } else if (BREAKS.has(ch)) {
      endWord()
    } else {
      text += ch
      open = true
    }
  }
  endSegment('')
  const last = segments[segments.length - 1]
  if (last !== undefined && last.op !== '&') last.op = ''
  return segments
}

const SHELL_PAYLOAD: Readonly<Record<string, readonly string[]>> = {
  bash: ['-c', '-lc'],
  sh: ['-c'],
  zsh: ['-c'],
  pwsh: ['-command', '-c'],
  powershell: ['-command', '-c'],
  cmd: ['/c'],
}
const WRAPPERS = new Set(['sudo', 'time', 'env', 'command', 'exec', 'nice', 'nohup', 'xvfb-run', 'cross-env', 'dotenv', 'watchexec'])
// Wrappers whose own options end at `--` (`dotenv -e .env -- npm test`, `watchexec -e ts -- pytest`).
const DASHDASH_WRAPPERS = new Set(['dotenv', 'watchexec'])
// Commands whose arguments are data: a runner word inside them is not a run.
const DATA_HEADS = new Set(['echo', 'printf', 'grep', 'egrep', 'fgrep', 'rg', 'sed', 'awk', 'cat', 'head', 'tail', 'less', 'jq', 'which', 'where', 'pip', 'pip3', 'write-output', 'write-host', 'select-string', 'sls', 'findstr', 'get-content', 'set-content', 'out-file'])
const ECHO_HEADS = new Set(['echo', 'printf', 'write-output', 'write-host'])
// Flags whose value is a message or a body, not a command.
const PAYLOAD_FLAGS = new Set(['-m', '--message', '--body', '-b', '--title', '-t', '-F', '--file', '--body-file'])

// Shell keywords that open a loop or conditional body: `do gh pr merge $n`, `then git push`.
const KEYWORDS = new Set(['do', 'then', 'else', 'elif', 'if', 'while', 'until', '!'])

/**
 * The index past a wrapper's own options: `nice -n 10`, `xvfb-run -a`, `xvfb-run -s "-screen 0 1x1x24"`. An option's
 * value is skipped when it is a number or quoted; a `--`-terminated wrapper skips everything up to its `--`.
 */
function pastWrapperOptions(segment: Segment, from: number, toDashDash: boolean): number {
  const words = segment.words
  if (toDashDash) {
    const dd = words.findIndex((w, k) => k >= from && !w.quoted && w.text === '--')
    if (dd >= 0) return dd + 1
  }
  let i = from
  while (i < words.length) {
    const w = words[i]
    if (w === undefined || w.quoted || !w.text.startsWith('-')) break
    i += 1
    if (w.text === '--') break
    const value = words[i]
    if (value !== undefined && (value.quoted || /^\d+$/.test(value.text))) i += 1
  }
  return i
}

/** The index of a segment's command word, past keywords, `X=1` assignments (quoted or not) and wrappers such as `sudo` or `timeout 60`. */
function headOf(segment: Segment): number {
  let i = 0
  while (i < segment.words.length) {
    const word = segment.words[i]
    if (word === undefined) break
    const t = word.text.toLowerCase()
    if (/^[A-Za-z_]\w*=/.test(word.text)) i += 1
    // PowerShell's `$out = idf.py build`: the command is what is assigned.
    else if (/^\$[\w:]+$/.test(word.text) && segment.words[i + 1]?.text === '=') i += 2
    else if (KEYWORDS.has(t)) i += 1
    else if (WRAPPERS.has(t)) i = pastWrapperOptions(segment, i + 1, DASHDASH_WRAPPERS.has(t))
    else if (t === 'timeout') i += 2
    else break
  }
  return i
}

// A loop's status is its last pass's (or 0 when it ran none), and its status lines print once per pass, so no run
// inside a loop is strong evidence. A loop keyword counts as a segment's command word or as any word before it that
// headOf skips (`then for`, `time for`, `do while`), never inside quoted text. A bash loop runs from its keyword to its
// matching `done`; PowerShell's braces are not segment boundaries, so a `foreach` or `ForEach-Object` runs to the end.
const BASH_LOOPS = new Set(['for', 'while', 'until'])
const PS_LOOPS = new Set(['foreach', 'foreach-object'])

/** Which segments sit inside a loop. */
function loopSegments(segments: readonly Segment[]): boolean[] {
  let depth = 0
  let toEnd = false
  return segments.map(s => {
    const words = s.words.slice(0, headOf(s) + 1)
    const lead = words.filter(w => !w.quoted).map(w => w.text.toLowerCase())
    if (lead.some(w => PS_LOOPS.has(w))) toEnd = true
    depth += lead.filter(w => BASH_LOOPS.has(w)).length
    const inside = toEnd || depth > 0
    // `done` closes a loop, glued to a redirection too (`done>log`, `done<list`, `done>"$TEMP/x"`, which reads as quoted).
    depth = Math.max(0, depth - words.filter(w => /^done(?![\w-])/.test(w.text)).length)
    return inside
  })
}

const commandWord = (segment: Segment): string => (segment.words[headOf(segment)]?.text ?? '').toLowerCase().replace(/\.exe$/, '')

/** segmentsOf, with `bash -c "..."` and `pwsh -Command "..."` payloads parsed as the commands they are. */
export function commandsOf(command: string, depth = 0): Segment[] {
  const out: Segment[] = []
  for (const segment of segmentsOf(command)) {
    const flags = SHELL_PAYLOAD[commandWord(segment)]
    const head = headOf(segment)
    const at = flags === undefined ? -1 : segment.words.findIndex((w, i) => i > head && flags.includes(w.text.toLowerCase()))
    const payload = at < 0 ? undefined : segment.words[at + 1]
    const inner = payload === undefined || depth >= 2 ? [] : commandsOf(payload.text, depth + 1)
    const tail = inner[inner.length - 1]
    if (tail === undefined) {
      out.push(segment)
      continue
    }
    tail.op = segment.op
    out.push(...inner)
  }
  return out
}

const PYTHONS = /^(?:python[\d.]*|py)$/

/** A segment as matching sees it: from the command word on, quoted and payload arguments as `Q`; '' for a data command. */
function plainOf(segment: Segment): string {
  const head0 = commandWord(segment)
  if (DATA_HEADS.has(head0)) return ''
  const head = headOf(segment)
  const out: string[] = []
  for (let i = head; i < segment.words.length; i += 1) {
    const word = segment.words[i]
    if (word === undefined) continue
    const before = segment.words[i - 1]
    // `python -m pytest`: there `-m` names a module to run, not a message.
    const isPayload = word.quoted || (i > head && before !== undefined && !before.quoted && PAYLOAD_FLAGS.has(before.text) && !(before.text === '-m' && segment.words.slice(head, i - 1).some(w => PYTHONS.test(w.text.toLowerCase()))))
    out.push(isPayload ? 'Q' : word.text)
  }
  return out.join(' ')
}

// ---- Runners, git ops and their outcome ----

// After the runner, in its segment: flags that make it run nothing.
const NON_RUN = /\s(?:--(?:version|help|init|co|collect-only|no-run|listTests)|-h)(?=\s|$)/i

const GIT = String.raw`^git(?:\s+-[cC]\s+\S+)*\s+`
const SHIP_RES: Readonly<Record<ShipOp, RegExp>> = {
  commit: new RegExp(`${GIT}commit(?![\\w-])`, 'i'),
  push: new RegExp(`${GIT}push(?![\\w-])`, 'i'),
  merge: new RegExp(`^gh\\s+pr\\s+merge(?![\\w-])|${GIT}merge(?![\\w-])`, 'i'),
  'pr-create': /^gh\s+pr\s+create(?![\w-])/i,
}
// An op that does nothing: `git merge --abort`, `git push --dry-run`, `git push -n`, `git commit --help`, and
// `gh pr merge --auto`, which only enables auto-merge. (`git commit -n` is --no-verify and still commits.)
const SHIP_SKIP: Readonly<Record<ShipOp, RegExp>> = {
  commit: /\s(?:--abort|--dry-run|--help|-h)(?=\s|$)/i,
  push: /\s(?:--dry-run|--help|-h|-n)(?=\s|$)/i,
  merge: /\s(?:--abort|--dry-run|--help|-h|--auto)(?=\s|$)/i,
  'pr-create': /\s(?:--dry-run|--help|-h)(?=\s|$)/i,
}

// What a runner's visible output says. `claude plugin test` prints "66 pass" / "4 fail"; svelte-check prints
// "COMPLETED ... 0 ERRORS"; tsup prints "Build success"; tsc prints nothing on success.
const SUMMARY: Readonly<Record<'tests' | 'build', { fail: RegExp; pass: RegExp }>> = {
  tests: {
    // `FAILED` counts at a line's start (pytest's `FAILED tests/x.py::t`), not inside a test title. TAP and node:test
    // print `not ok N` and `# fail N`; unittest prints `OK` or `OK (skipped=1)`, not any line that starts with OK.
    fail: /\b[1-9]\d*\s+(?:failed|failing|fail|failures?|errors?)\b|^FAILED\b|^[ \t]*FAIL\b|^\(fail\)|test result: FAILED|^not ok\b|^#\s*fail\s+[1-9]/m,
    pass: /\b[1-9]\d*\s+(?:passed|passing|pass)\b|\btest result: ok\b|^OK(?: \(|$)|^ok\s+\S/m,
  },
  build: {
    // The last three: the compiler never started (npx found no tsc, or it is not on PATH), so its silence proves nothing.
    // ESP-IDF's `idf.py build`: "Project build complete" on success; ninja's "build stopped" or a FAILED step on failure.
    fail: /\berror TS\d+|\bFound [1-9]\d* errors?\b|^error(?:\[E\d+\])?:|\bBuild failed\b|\bFailed to compile\b|\bCOMPLETED\b.*\b[1-9]\d* ERRORS\b|This is not the tsc command|command not found|is not recognized as|\bninja: build stopped\b|^FAILED: /im,
    pass: /^[ \t]*Finished\b|\bCompiled successfully\b|\bbuilt in \d|\bFound 0 errors\b|\bCOMPLETED\b.*\b0 ERRORS\b|\bBuild success\b|\bProject build complete\b/im,
  },
}
const SHIP_FAIL = /^(?:error|fatal):|\[rejected\]|\bnothing to commit\b|\bfailed to push\b|\bAutomatic merge failed\b|^CONFLICT \(/im
// Each op's own confirmation, so one op's output cannot confirm another (`MERGED` from `gh pr view` is not a commit).
const SHIP_PASS: Readonly<Record<ShipOp, RegExp>> = {
  commit: /^\[[\w./-]+(?: \(root-commit\))? [0-9a-f]{7,}\]/m,
  push: /^[ \t]*(?:\+[ \t]*)?[0-9a-f]{7,}\.\.\.?[0-9a-f]{7,}\s+\S+\s+->\s+\S+|^[ \t]*\*\s+\[new (?:branch|tag)\]|\bset up to track\b/im,
  // `gh pr view --json state` prints MERGED bare, first in a --jq line, or as JSON. `git merge` prints "Merge made by",
  // and a `git log` after it shows the merge commit's own subject (`git merge x | tail -5 && git log --oneline -3`).
  merge: /\bMerged pull request\b|^[ \t]*MERGED\b|"state"\s*:\s*"MERGED"|\bstate\s*[=:]\s*"?MERGED\b|^Merge made by\b|^[0-9a-f]{7,40} +(?:\([^)]*\) +)?Merge (?:remote-tracking branch|branch|pull request #\d+)\b/im,
  'pr-create': /github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/i,
}
// `git commit -q` prints nothing; a later `git log --oneline` in the same command prints a sha line: the commit's own
// when it carries the commit's subject (after any `(HEAD -> x)` decoration), or, with no subject known, when nothing
// between the commit and the log moved to another branch, folder or repository.
const SHA_LINE = /^[0-9a-f]{7,40} +(?:\([^)]*\) +)?(\S.*)$/
// `git show --oneline HEAD` prints the same sha line as `git log --oneline -1`. Without `--oneline` it prints
// `commit <sha>`, which SHA_LINE does not take.
const GIT_LOG = /^git(?:\s+-[cC]\s+\S+)*\s+(?:log|show)(?![\w-])/i
// `gh pr view` in a call of its own: its MERGED is merge evidence, read only from gh's own forms, never from a
// `git log` line another segment printed.
const PR_VIEW = /^gh\s+pr\s+view(?![\w-])/i
// `--jq .state` prints MERGED bare; `--json state` prints `"state": "MERGED"`; a jq template can print `state=MERGED`.
const VIEW_MERGED = /^[ \t]*MERGED\b|"state"\s*:\s*"MERGED"|\bstate\s*[=:]\s*"?MERGED\b/im
const GIT_ELSEWHERE = /^git(?:\s+-[cC]\s+\S+)*\s+(?:checkout|switch|pull|merge|reset)(?![\w-])/
const CD = new Set(['cd', 'pushd', 'popd', 'chdir', 'set-location', 'sl'])
const TSC = /(?:^|\s)tsc(?=$|\s)/i
// Pipe members that keep every line tsc prints, so a failure would still show its first `error TS` line. `tail` keeps
// them only as `tail -n +K` (a last-N `tail` often holds only a diagnostic's indented elaboration lines),
// and `Select-Object` only without `-Last`; `less` and `more` are left out.
const FILTERS = new Set(['head', 'tail', 'grep', 'egrep', 'rg', 'cat', 'tee', 'sort', 'uniq', 'select-object', 'select', 'out-host', 'out-string', 'select-string', 'sls', 'findstr'])
const GREPS = new Set(['grep', 'egrep', 'rg', 'select-string', 'sls', 'findstr'])
// Grep flags that print a count, a file name or nothing instead of the lines.
const COUNTING = /^-(?:-(?:count|quiet|silent|files-with(?:out)?-matches)$|[A-Za-z]*[cqlL][A-Za-z]*$)|^-Quiet$/

/** A parsed command line, with what classify has learned so far about each segment. */
type Line = {
  segments: readonly Segment[]
  plains: readonly string[]
  kindsAt: readonly Kind[][]
  /** Segment k holds a run already judged strong and ok (classify fills this in order, so earlier segments are known). */
  strong: readonly boolean[]
  /** The first line of the heredoc segment k reads, when it reads one. */
  heredocAt: readonly (string | undefined)[]
  /** Each segment's echo shape (`filled(echoText)`), or null for a non-echo: filled on first use. */
  shapes: (string | null)[]
  /** The echoes matching each status pattern seen so far, by pattern source. */
  like: Map<string, number[]>
}

/** An `echo` of a run's own status: the line pattern (status as group 1), and which of the echoes printing lines of that shape it is. */
type Echoed = { pattern: StatusShape; n: number; of: number }

type Place = {
  /** Something after the run can replace its exit status. */
  masked: boolean
  /** The run's pipeline ends the line, so the call's isError is its status. */
  last: boolean
  /** What an `&& echo` after the run printed (only for a run that ends its pipeline). */
  echoes: string[]
  /** An `echo` of this run's own exit status straight after its pipeline. */
  status: Echoed | null
  /**
   * Kinds run by later members of this run's `&&` chain: one that showed its own pass summary ran, so this run exited 0.
   * Only for a run that ends its pipeline: otherwise the chain went on because the last filter exited 0.
   */
  chained: Kind[]
  /** A `git log` after this run can show a quiet commit's sha line (see SHA_LINE). */
  logged: boolean
  /** The commit's subject, when the command shows it (`-m`, or the heredoc's first line). */
  subject: string | null
  /** Piped only into filters that keep every line tsc prints. */
  filtered: boolean
  /** Every earlier member of this run's `&&` chain is a `cd` or a proven run, so this run surely started. */
  ran: boolean
}

/** What an echo prints: its arguments, without `-n`/`-e` and without a redirection (`>> log`), which prints nothing. */
function echoText(segment: Segment): string {
  const out: string[] = []
  const words = segment.words.slice(headOf(segment) + 1)
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i]
    if (w === undefined) continue
    if (!w.quoted && /^[0-9&]?>/.test(w.text)) {
      if (/^[0-9&]?>>?$/.test(w.text)) i += 1 // the target is the next word
      continue
    }
    if (w.quoted || !/^-[neE]+$/.test(w.text)) out.push(w.text)
  }
  return out.join(' ').trim()
}

/**
 * The line an echo of a run's status prints, as a pattern. `$?` is the status of the command just before the echo, so
 * it counts only for the last member of that pipeline; `${PIPESTATUS[n]}` names the n-th member; `$LASTEXITCODE` is
 * PowerShell's. Any other variable in the echo matches any text.
 */
function statusPattern(template: string, last: boolean, member: number, piped: boolean): StatusShape | null {
  const own = [...(last ? [String.raw`\$\?`, String.raw`\$\{\?\}`] : []), ...(piped ? [String.raw`\$\{PIPESTATUS\[${member}\]\}`] : []), String.raw`\$LASTEXITCODE\b`]
  const found = new RegExp(own.join('|'), 'i').exec(template)
  if (found === null) return null
  return statusShape(template.slice(0, found.index), template.slice(found.index + found[0].length))
}

/** The shape of a status line, matched like a regex (`source`, `test`, `exec` with the status as group 1). */
type StatusShape = { source: string; test: (line: string) => boolean; exec: (line: string) => [string, string] | null }

const VARIABLE = /\$\{[^}$]*\}|\$[A-Za-z_?][\w]*/

/**
 * A status line is the echo's literal pieces in order with anything at each variable (a glob with `*` per variable),
 * then the status, then the tail's pieces. It is matched with indexOf, never a regex of lazy wildcards (which
 * backtracks as length^k). The head's pieces before its last are matched leftmost from the line's start once, and the
 * tail's pieces after its first rightmost from the line's end once; each candidate status position is then checked in
 * constant time, so a line costs time linear in its length however many variables the echo has.
 */
function statusShape(before: string, after: string): StatusShape {
  const head = before.split(VARIABLE)
  const tail = after.split(VARIABLE)
  // Lines are trimmed, so a leading variable that printed nothing leaves its line starting at the next piece with the
  // space trimmed off (and a trailing one likewise at the end). That reading is tried only anchored at the line's
  // start (or end), never in place of the separator when the variable printed something.
  const heads = [head]
  if (head.length > 1 && head[0] === '' && (head[1] ?? '') !== (head[1] ?? '').trimStart()) heads.push([(head[1] ?? '').trimStart(), ...head.slice(2)])
  const tails = [tail]
  if (tail.length > 1 && tail[tail.length - 1] === '') {
    const piece = tail[tail.length - 2] ?? ''
    if (piece !== piece.trimEnd()) tails.push([...tail.slice(0, -2), piece.trimEnd()])
  }
  const exec = (line: string): [string, string] | null => {
    for (const h of heads) {
      for (const t of tails) {
        const hit = shapeMatch(h, t, line)
        if (hit !== null) return hit
      }
    }
    return null
  }
  return { source: `${head.join('\u0000')}\u0001${tail.join('\u0000')}`, test: line => exec(line) !== null, exec }
}

/** One reading of a status line against the head and tail globs (see statusShape). */
function shapeMatch(head: readonly string[], tail: readonly string[], line: string): [string, string] | null {
  const lastHead = head[head.length - 1] ?? ''
  const firstTail = tail[0] ?? ''
  {
    // Where the head's last piece may start (minStart), and where the tail's first piece may end (maxEnd).
    let minStart = 0
    if (head.length > 1) {
      const first = head[0] ?? ''
      if (!line.startsWith(first)) return null
      minStart = first.length
      for (let h = 1; h < head.length - 1; h += 1) {
        const piece = head[h] ?? ''
        if (piece === '') continue
        const k = line.indexOf(piece, minStart)
        if (k < 0) return null
        minStart = k + piece.length
      }
    }
    let maxEnd = line.length
    if (tail.length > 1) {
      const last = tail[tail.length - 1] ?? ''
      if (!line.endsWith(last)) return null
      maxEnd = line.length - last.length
      for (let t = tail.length - 2; t >= 1; t -= 1) {
        const piece = tail[t] ?? ''
        if (piece === '') continue
        const k = line.lastIndexOf(piece, maxEnd - piece.length)
        if (k < 0) return null
        maxEnd = k
      }
    }
    // The tail's first piece must occur somewhere after the head: a quick reject before any candidate scan.
    if (firstTail !== '' && line.indexOf(firstTail, minStart) < 0) return null
    // The status at `at`: the head ends there and the tail starts right after the digits.
    const check = (at: number): [string, string] | null => {
      DIGITS.lastIndex = at
      const m = DIGITS.exec(line)
      if (m === null) return null
      const b = at + m[0].length
      const tailOk = tail.length === 1 ? line.length - b === firstTail.length && line.startsWith(firstTail, b) : line.startsWith(firstTail, b) && b + firstTail.length <= maxEnd
      return tailOk ? [line, m[0]] : null
    }
    if (head.length === 1) return line.startsWith(lastHead) ? check(lastHead.length) : null
    // A tail with no variable fixes where the status ends: only the digits just before it are candidates.
    if (tail.length === 1) {
      const b = line.length - firstTail.length
      if (b < 0 || !line.startsWith(firstTail, b)) return null
      let a = b
      while (a > 0 && line.charCodeAt(a - 1) >= 48 && line.charCodeAt(a - 1) <= 57) a -= 1
      if (a > 0 && line.charCodeAt(a - 1) === 45) a -= 1
      for (let at = a; at < b; at += 1) {
        const start = at - lastHead.length
        if (start < minStart || !line.startsWith(lastHead, start)) continue
        // Everything from `a` to `b` is digits, but for a minus sign at `a`: a lone `-` is no status.
        if (b - at === 1 && line.charCodeAt(at) === 45) continue
        return [line, line.slice(at, b)]
      }
      return null
    }
    if (lastHead !== '') {
      // Each place the head's last piece occurs (no earlier than its predecessors allow) is a candidate.
      for (let p = line.indexOf(lastHead, minStart); p >= 0; p = line.indexOf(lastHead, p + 1)) {
        const hit = check(p + lastHead.length)
        if (hit !== null) return hit
      }
      return null
    }
    // The head ends in a variable: each maximal digit run (with its minus sign) from minStart on is a candidate. Every
    // start inside one run ends at the same place, so the tail is checked once per run; the run's own start wins.
    const isDigit = (c: number): boolean => c >= 48 && c <= 57
    for (let p = minStart; p < line.length; ) {
      const c = line.charCodeAt(p)
      // A `-` is a minus sign only where it cannot be a hyphen inside a word (`run-0` holds no status -0).
      const minus = c === 45 && isDigit(line.charCodeAt(p + 1)) && (p === minStart || !/[A-Za-z0-9_]/.test(line.charAt(p - 1)))
      if (!isDigit(c) && !minus) {
        p += 1
        continue
      }
      let e = c === 45 ? p + 1 : p
      while (e < line.length && isDigit(line.charCodeAt(e))) e += 1
      const tailOk = tail.length === 1 ? line.length - e === firstTail.length && line.startsWith(firstTail, e) : line.startsWith(firstTail, e) && e + firstTail.length <= maxEnd
      if (tailOk) return [line, line.slice(p, e)]
      p = e
    }
    return null
  }
}

const DIGITS = /-?\d+/y

const STATUS_LINE_CAP = 300
let statusCache: { output: string; lines: string[]; by: Map<string, { found: string[]; once: string[] }> } | null = null

/** An echo's text with every variable as `0`: the shape of the line it prints. */
const filled = (text: string): string => text.replace(/\$\{[^}$]*\}|\$[A-Za-z_?][\w]*/g, '0')

/**
 * The status an echo printed. Several echoes can print lines of one shape (`echo "exit=$?"` after each of two runs),
 * so the n-th matching line is the n-th such echo's; when the count of matching lines differs from the count of those
 * echoes (a loop, or a program printing the same shape), the status is unsure.
 */
function statusIn(output: string, status: Echoed): number | 'unsure' | null {
  // One command's runs share its output and usually one status shape: split the output and scan it once per shape.
  if (statusCache?.output !== output) {
    // A status line is short; a long line is never one, and skipping it bounds the pattern's work.
    const lines = output
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length <= STATUS_LINE_CAP)
    statusCache = { output, lines, by: new Map() }
  }
  const cache = statusCache
  let seen = cache.by.get(status.pattern.source)
  if (seen === undefined) {
    const matching = cache.lines.filter(line => status.pattern.test(line))
    const values = (from: readonly string[]) => from.map(line => status.pattern.exec(line)?.[1]).filter((v): v is string => v !== undefined)
    // A reader that prints the same log twice (grep, then tail) repeats each status line: identical lines are one.
    seen = { found: values(matching), once: values([...new Set(matching)]) }
    cache.by.set(status.pattern.source, seen)
  }
  if (seen.found.length === 0) return null
  if (seen.found.length === status.of) return Number(seen.found[status.n])
  return seen.once.length === status.of ? Number(seen.once[status.n]) : 'unsure'
}

/** A pipe member that keeps every line tsc prints (FILTERS). */
function keepsLines(segment: Segment): boolean {
  const word = commandWord(segment)
  if (!FILTERS.has(word)) return false
  const args = segment.words.slice(headOf(segment) + 1).filter(w => !w.quoted).map(w => w.text)
  if (word === 'tail') return args.some(a => /^(?:-n|--lines=)?\+\d+$/.test(a))
  if (word === 'select-object' || word === 'select') return !args.some(a => /^-l/i.test(a))
  return !GREPS.has(word) || !args.some(a => COUNTING.test(a))
}

/** The repository a git segment names with `-C` before its verb, or null. */
function gitDirOf(segment: Segment): string | null {
  if (commandWord(segment) !== 'git') return null
  for (let k = headOf(segment) + 1; k < segment.words.length; ) {
    const word = segment.words[k]
    if (word === undefined || !word.text.startsWith('-')) break
    if (word.text === '-C') return segment.words[k + 1]?.text ?? null
    k += word.text === '-c' ? 2 : 1
  }
  return null
}

/** A commit segment's subject: the first line of its `-m` value, or of the heredoc it reads; null when the command does not show it. */
function subjectOf(segment: Segment, heredoc: string | undefined): string | null {
  const words = segment.words
  const at = words.findIndex(w => !w.quoted && (w.text === '-m' || w.text === '--message'))
  let value = at >= 0 ? words[at + 1]?.text : words.map(w => /^--message=([\s\S]*)$/.exec(w.text)?.[1]).find(v => v !== undefined)
  if (value === undefined || value.includes('<<HEREDOC')) value = words.some(w => w.text.includes('<<HEREDOC')) ? heredoc : undefined
  else if (/[$`]/.test(value)) value = undefined // `-m "$(cat msg.txt)"`: the text is not in the command
  const subject = (value ?? '').split(/\r?\n/)[0]?.trim() ?? ''
  return subject === '' ? null : subject
}

/**
 * The echoes on the line that print a line of this pattern's shape, in order. Each echo's shape is computed once per
 * line and each distinct pattern is scanned once, so a line of many runs and echoes stays linear.
 */
function echoesLike(line: Line, pattern: StatusShape): number[] {
  const cached = line.like.get(pattern.source)
  if (cached !== undefined) return cached
  if (line.shapes.length === 0) {
    for (const s of line.segments) line.shapes.push(ECHO_HEADS.has(commandWord(s)) ? filled(echoText(s)) : null)
  }
  const found: number[] = []
  line.shapes.forEach((shape, k) => {
    if (shape !== null && shape.length <= STATUS_LINE_CAP && pattern.test(shape)) found.push(k)
  })
  line.like.set(pattern.source, found)
  return found
}

/** What, after segment i, can replace its exit status, and what else on the line can show how it ended. */
function placeOf(line: Line, i: number): Place {
  const { segments, plains, kindsAt, strong } = line
  let start = i
  while (start > 0 && segments[start - 1]?.op === '|') start -= 1
  let j = i
  while (j < segments.length - 1 && segments[j]?.op === '|') j += 1
  // A later `&&` member proves this run only when this run's status is its pipeline's (it ends the pipeline: a piped
  // run's chain goes on because the last filter exited 0), and when no `||` before it could have skipped it
  // (`x || run && echo ok` prints ok when x passed and run never ran).
  const credits = j === i && segments[start - 1]?.op !== '||'
  let masked = j > i // a later pipe member's status is the pipeline's
  const echoes: string[] = []
  // Still in this run's `&&` chain: an `&& echo` after a `;`, newline, `&` or `||` prints whatever this run did.
  let chain = true
  for (let k = j; k < segments.length; k += 1) {
    const op = segments[k]?.op ?? ''
    if (op === '') break
    if (op === '|') continue // a pipe inside a later && command: this run's failure still stops the chain
    if (op === '&&') {
      const after = segments[k + 1]
      if (after !== undefined && ECHO_HEADS.has(commandWord(after))) {
        masked = true
        if (credits && chain) echoes.push(echoText(after))
      }
      continue
    }
    masked = true // `;`, a newline, `&` or `||`: another command's status ends the line
    chain = false
    break // nothing later can unmask the run or join its chain
  }
  // An echo of the status straight after the pipeline (`; echo "rc=$?"`), never after `&&` or `||`.
  const end = segments[j]?.op
  const next = segments[j + 1]
  const echoed = (end === ';' || end === '\n') && next !== undefined && ECHO_HEADS.has(commandWord(next))
  const pattern = echoed ? statusPattern(echoText(next), j === i, i - start, j > start) : null
  let status: Echoed | null = null
  if (pattern !== null) {
    // Every echo on the line that prints a line of this shape, in order; this one is the n-th.
    const same = echoesLike(line, pattern)
    const n = same.indexOf(j + 1)
    if (n >= 0) status = { pattern, n, of: same.length }
  }
  // The members of this run's `&&` chain after it, each a pipeline.
  const chained: Kind[] = []
  for (let k = j; credits && segments[k]?.op === '&&'; ) {
    let last = k + 1
    while (last < segments.length - 1 && segments[last]?.op === '|') last += 1
    for (let m = k + 1; m <= last; m += 1) chained.push(...(kindsAt[m] ?? []))
    k = last
  }
  // A later `git log`. With the commit's subject known, its sha line must carry it (shaShows). Without it, nothing
  // between the commit and the log may change branch, folder or repository.
  const segment = segments[i]
  const subject = segment !== undefined && (kindsAt[i] ?? []).includes('commit') ? subjectOf(segment, line.heredocAt[i]) : null
  const here = segment === undefined ? null : gitDirOf(segment)
  // Only a commit reads a later log, so only a commit pays for the scan.
  const log = (kindsAt[i] ?? []).includes('commit') ? plains.findIndex((plain, m) => m > j && GIT_LOG.test(plain)) : -1
  const stays =
    log >= 0 &&
    segments.slice(j + 1, log + 1).every((s, k) => !CD.has(commandWord(s)) && !GIT_ELSEWHERE.test(plains[j + 1 + k] ?? '') && (commandWord(s) !== 'git' || gitDirOf(s) === here))
  // tsc's silence proves something only if tsc started: every earlier member of its `&&` chain is a `cd` or a run
  // already proven, and no `||` could have skipped it.
  let ran = true
  for (let k = start - 1; k >= 0; ) {
    const op = segments[k]?.op
    if (op === '||') ran = false
    if (op !== '&&') break
    let first = k
    while (first > 0 && segments[first - 1]?.op === '|') first -= 1
    const before = segments[k]
    const cd = first === k && before !== undefined && CD.has(commandWord(before))
    if (!cd && !strong.slice(first, k + 1).some(Boolean)) {
      ran = false
      break
    }
    k = first - 1
  }
  return {
    masked,
    last: j === segments.length - 1,
    echoes,
    status,
    chained,
    logged: log >= 0 && (subject !== null || stays),
    subject,
    filtered: j > i && segments.slice(i + 1, j + 1).every(keepsLines),
    ran,
  }
}

/** A sha line in the output: one carrying the subject when it is known, else any. */
function shaShows(output: string, subject: string | null): boolean {
  // `git show --stat HEAD` and `git log -1` without `--oneline` print the subject indented by four spaces.
  const head = subject === null ? '' : subject.slice(0, 40)
  if (head !== '' && output.split(/\r?\n/).some(text => /^ {4}\S/.test(text) && text.trim().startsWith(head))) return true
  return output.split(/\r?\n/).some(text => {
    const match = SHA_LINE.exec(text.trim())
    return match !== null && (subject === null || (match[1] ?? '').startsWith(subject.slice(0, 40)))
  })
}

// One command's runs share its output: each summary pattern is tested against it once, and its lines are split once.
let shownCache: { output: string; tested: Map<RegExp, boolean>; lines: string[] | null } | null = null
function outputHas(re: RegExp, output: string): boolean {
  if (shownCache?.output !== output) shownCache = { output, tested: new Map(), lines: null }
  let hit = shownCache.tested.get(re)
  if (hit === undefined) {
    hit = re.test(output)
    shownCache.tested.set(re, hit)
  }
  return hit
}
function outputLines(output: string): string[] {
  if (shownCache?.output !== output) shownCache = { output, tested: new Map(), lines: null }
  shownCache.lines ??= output.split(/\r?\n/).map(l => l.trim())
  return shownCache.lines
}

function shownBy(kind: Kind, output: string, echoes: readonly string[], logged: boolean, subject: string | null): 'pass' | 'fail' | null {
  const group = kind === 'tests' || kind === 'build' ? SUMMARY[kind] : { fail: SHIP_FAIL, pass: SHIP_PASS[kind] }
  if (outputHas(group.fail, output)) return 'fail'
  if (outputHas(group.pass, output)) return 'pass'
  if (kind === 'commit' && logged && shaShows(output, subject)) return 'pass'
  // The text an `&& echo` printed shows the run before it succeeded.
  if (echoes.some(t => t.length >= 2) && echoes.some(t => t.length >= 2 && outputLines(output).includes(t))) return 'pass'
  return null
}

function strengthOf(kind: Kind, facts: Facts, place: Place, plain: string): Omit<Run, 'kind'> {
  if (facts.denied || facts.interrupted) return { ok: false, masked: false, basis: 'exit' }
  // The exit status speaks for this run only when nothing after it can replace it; isError speaks for the last segment.
  if (facts.exitKnown !== false && !place.masked && (place.last || !facts.isError)) return { ok: !facts.isError, masked: false, basis: 'exit' }
  // An echo of this run's own status is its exit code; echoed lines that do not pair off with their echoes are unsure.
  const status = place.status === null ? null : statusIn(facts.output, place.status)
  // Unsure status lines still let a visible failure speak; a visible pass does not outvote them.
  if (status === 'unsure') {
    const seen = shownBy(kind, facts.output, [], false, null)
    return seen === 'fail' ? { ok: false, masked: false, basis: 'output' } : { ok: true, masked: true, basis: 'none' }
  }
  if (status !== null) return { ok: status === 0, masked: false, basis: 'echo' }
  const shown = shownBy(kind, facts.output, place.echoes, place.logged, place.subject)
  if (shown === 'fail') return { ok: false, masked: false, basis: 'output' }
  if (shown === 'pass') return { ok: true, masked: false, basis: 'output' }
  // A later `&&` member that showed its own pass summary ran, so this run exited 0. (A failure summary is not used:
  // a generic `error:` line may be this run's own.) `chained` is empty unless this run ends its pipeline.
  if (place.chained.some(k => shownBy(k, facts.output, [], false, null) === 'pass')) return { ok: true, masked: false, basis: 'output' }
  // tsc prints nothing on success, and its first line on failure is an `error TS` line. So no such line is a pass when
  // tsc surely started (the call did not error, every earlier `&&` member is a `cd` or proven) and every later pipe
  // member keeps all its lines (no last-N `tail`, no count).
  if (kind === 'build' && facts.exitKnown !== false && place.filtered && place.ran && !facts.isError && TSC.test(plain)) return { ok: true, masked: false, basis: 'output' }
  return { ok: true, masked: true, basis: 'none' }
}

/** A userConfig list: an array (the manifest's `multiple` form) or a comma string; empty means the defaults. */
export function listOption(value: unknown, fallback: readonly string[]): string[] {
  const raw: unknown[] = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const list = raw.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(v => v.length > 0)
  return list.length > 0 ? list : [...fallback]
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// One option with at most one value. The option name starts with a word character, so `--opt` splits only one way
// (`--?[\w-]+` could read it as `-` plus `-opt`, which doubles the work per option when a match fails).
// A word that starts a launcher is never an option's value, so `pnpm -a pnpm -a ...` reads one way only. Only words
// that really start one are kept out: a bare launcher word, `X run`, `npm exec`, `python -m`. A value such as `node`,
// `py` or `python3.12` alone stays a value (`pnpm --filter node test`, `uv run --python python3.12 pytest`).
const OPTION = String.raw`\s+--?\w[\w-]*(?:[= ](?!(?:npx|bunx|pnpx|pnpm|yarn|bun|uvx)(?:\s|$)|(?:uv|poetry|pdm|hatch|pipenv|pipx)\s+run(?:\s|$)|(?:pnpm|yarn)\s+dlx(?:\s|$)|npm\s+exec(?:\s|$)|(?:python[\d.]*|py)\s+-m(?:\s|$))[^\s-]\S*)?`
// Options between a runner's words: `idf.py -C firmware build`.
const OPTIONS_BETWEEN = String.raw`(?:${OPTION})*\s+`
// What may come before a runner that is not the command word itself: a launcher that runs it.
const LAUNCHER = String.raw`(?:(?:npx|bunx|pnpx)(?:${OPTION})*\s+|uvx(?:${OPTION})*\s+|(?:pnpm|yarn)\s+dlx(?:${OPTION})*\s+|(?:uv|poetry|pdm|hatch|pipenv|pipx)\s+run(?:${OPTION})*\s+|(?:pnpm|npm)\s+exec(?:${OPTION})*\s+(?:--\s+)?|(?:pnpm|yarn)(?:${OPTION})*\s+|bun(?:\s+run|\s+x)?(?:${OPTION})*\s+|python[\d.]*\s+-m\s+|py\s+-m\s+)`

/**
 * A runner as whole tokens at the start of a segment's command, or after a launcher: `pytest -q`, `npx vitest run`,
 * `uv run --with pytest pytest`, `python -m pytest`. Never an argument of another command (`npm install -D vitest`,
 * `find . -name jest`, `mkdir -p tsc`). Options may sit between its words (`idf.py -C firmware build`).
 */
export function runnerRe(command: string): RegExp {
  const body = command.trim().split(/\s+/).map(escapeRe).join(OPTIONS_BETWEEN)
  // At most three launchers deep (`uv run python -m pytest` is two): an unbounded repeat costs 2^n on a failing match.
  return new RegExp(`^(?:${LAUNCHER}){0,3}${body}(?=$|\\s)`, 'i')
}

export function configOf(tests: readonly string[], build: readonly string[]): Config {
  return { tests: tests.map(runnerRe), build: build.map(runnerRe) }
}

function runnerIn(plain: string, res: readonly RegExp[]): boolean {
  for (const re of res) {
    const match = re.exec(plain)
    if (match === null) continue
    if (NON_RUN.test(plain.slice(match.index + match[0].length))) continue
    return true
  }
  return false
}

const objectOf = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

/** What a finished tool call tells the ledger. `input` is the tool.call event (tool name beside its arguments). */
export function factsOf(input: Readonly<Record<string, unknown>>, ran: Ran): Facts {
  const result = objectOf(ran.result)
  const op = objectOf(result.gitOperation)
  const pr = objectOf(op.pr)
  const branch = objectOf(op.branch)
  const git: Partial<Record<ShipOp, true>> = {}
  if (op.commit !== undefined) git.commit = true
  if (op.push !== undefined) git.push = true
  if (pr.action === 'merged' || branch.action === 'merged') git.merge = true
  if (pr.action === 'created') git['pr-create'] = true
  const diff = objectOf(result.bashEditDiff)
  const listed: unknown[] = Array.isArray(diff.changedFiles)
    ? diff.changedFiles
    : Array.isArray(diff.files)
      ? diff.files.map(f => objectOf(f).filePath)
      : []
  const stdout = typeof result.stdout === 'string' ? result.stdout : null
  const stderr = typeof result.stderr === 'string' ? result.stderr : ''
  const output = typeof ran.text === 'string' ? ran.text : stdout !== null ? `${stdout}\n${stderr}` : typeof ran.result === 'string' ? ran.result : ''
  return {
    tool: String(input.tool),
    command: typeof input.command === 'string' ? input.command : null,
    path: typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : null,
    toolUseId: typeof input.tool_use_id === 'string' ? input.tool_use_id : null,
    denied: ran.deny !== undefined,
    isError: ran.isError === true,
    interrupted: result.interrupted === true,
    background: input.run_in_background === true || typeof result.backgroundTaskId === 'string',
    output,
    git,
    changed: listed.filter((p): p is string => typeof p === 'string'),
    taskId: typeof result.backgroundTaskId === 'string' ? result.backgroundTaskId : (BG_ID.exec(output)?.[1] ?? null),
    autoMerge: pr.action === 'auto-merge-enabled',
  }
}

// ---- Mutation scope ----

// The user's temp folder comes from the environment (`places.temp`); these are the fixed ones.
const SCRATCH_DIRS = /^\/tmp\/|\/scratchpad\/|^[a-z]:\/windows\/temp\//
const trimEnd = (p: string): string => p.replace(/\/+$/, '')

/** Forward slashes, `~/` and git-bash `/c/` expanded, lowercased (Windows paths compare case-insensitively). */
export function normPath(path: string, home: string | null): string {
  let p = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  if (p.startsWith('~/') && home !== null) p = trimEnd(home.replace(/\\/g, '/')) + p.slice(1)
  const drive = /^\/([a-zA-Z])\//.exec(p)
  if (drive !== null) p = `${drive[1]}:/${p.slice(3)}`
  return p.toLowerCase()
}

/** A path as the ledger keys it: normalized, and made absolute against the session root when it is relative and the root is known. */
export function pathKey(path: string, places: Places): string {
  const p = normPath(path, places.home)
  if (/^(?:[a-z]:\/|\/)/.test(p) || places.root === null) return p
  return `${trimEnd(normPath(places.root, places.home))}/${p.replace(/^\.\//, '')}`
}

/**
 * A write that counts as a code edit: anywhere, sibling worktrees included, except `.md` files,
 * memory roots, and scratch or temp folders (the session scratchpad and %TEMP%). A commit-message or PR-body file is
 * taken back out when a git or gh command reads it (`record`).
 */
export function isCodeMutation(path: string, places: Places): boolean {
  const p = pathKey(path, places)
  if (p.endsWith('.md') || SCRATCH_DIRS.test(p)) return false
  if (places.temp !== null) {
    const temp = trimEnd(normPath(places.temp, places.home))
    if (temp !== '' && p.startsWith(`${temp}/`)) return false
  }
  if (places.home !== null) {
    const claude = `${trimEnd(normPath(places.home, null))}/.claude/`
    if (p.startsWith(`${claude}memory/`) || p.startsWith(`${claude}rules/`)) return false
    const projects = `${claude}projects/`
    if (p.startsWith(projects) && p.slice(projects.length).split('/')[1] === 'memory') return false
  }
  return true
}

/** The kinds of run a segment is: test or build runners, and git or gh ops. */
// A segment longer than this (as matching sees it, quoted arguments collapsed) is not matched at all: no real runner
// or git command is that long, and it bounds the pattern work. It yields no run, so a claim on it reads as unknown.
const SEGMENT_CAP = 1000

function kindsIn(plain: string, config: Config): Kind[] {
  if (plain === '' || plain.length > SEGMENT_CAP) return []
  const found: Kind[] = []
  if (runnerIn(plain, config.tests)) found.push('tests')
  if (runnerIn(plain, config.build)) found.push('build')
  for (const op of SHIP_OPS) if (SHIP_RES[op].test(plain) && !SHIP_SKIP[op].test(plain)) found.push(op)
  return found
}

// A git or gh command that reads its message or body from a file: that file was a message, not code.
const MESSAGE_CMD = /^(?:git(?:\s+-[cC]\s+\S+)*\s+(?:commit|tag|merge)|gh\s+(?:pr|issue|release)\s+(?:create|edit|merge|comment))(?![\w-])/i
const MESSAGE_FLAGS = new Set(['-F', '--file', '--body-file'])

/** The files git or gh read a message or body from, normalized; a relative one as written. `-F -` (stdin) is none. */
function messageFilesOf(segments: readonly Segment[], plains: readonly string[], home: string | null): string[] {
  const out: string[] = []
  segments.forEach((segment, i) => {
    if (!MESSAGE_CMD.test(plains[i] ?? '')) return
    segment.words.forEach((word, k) => {
      const inline = /^--(?:file|body-file)=(.+)$/.exec(word.text)
      const value = inline !== null ? inline[1] : MESSAGE_FLAGS.has(word.text) ? segment.words[k + 1]?.text : undefined
      if (value !== undefined && value !== '' && value !== '-') out.push(normPath(value, home).replace(/^\.\//, ''))
    })
  })
  return out
}

export function classify(facts: Facts, config: Config, places: Places): Classified {
  if (EDITORS.has(facts.tool)) {
    const ok = !facts.denied && !facts.isError && !facts.interrupted
    const edited = ok && facts.path !== null && isCodeMutation(facts.path, places)
    return { mutations: edited && facts.path !== null ? [pathKey(facts.path, places)] : [], runs: [], messageFiles: [] }
  }
  const command = facts.command
  if (!SHELLS.has(facts.tool) || command === null) return { mutations: [], runs: [], messageFiles: [] }
  const segments = commandsOf(command)
  const plains = segments.map(plainOf)
  const kindsAt = plains.map(plain => kindsIn(plain, config))
  // Each heredoc's first body line, in order; segmentsOf leaves `<<HEREDOC` where each one was.
  const heredocs = heredocsOf(command).map(m => (m[0].split('\n')[1] ?? '').trim())
  let seen = 0
  const heredocAt = segments.map(segment => {
    const count = segment.words.reduce((n, w) => n + w.text.split('<<HEREDOC').length - 1, 0)
    const first = count > 0 ? heredocs[seen] : undefined
    seen += count
    return first
  })
  const strong: boolean[] = segments.map(() => false)
  const line: Line = { segments, plains, kindsAt, strong, heredocAt, shapes: [], like: new Map() }
  const runs: Run[] = []
  // Every run inside a loop stays weak, whatever its own status or output showed; so does a `gh pr view` inside one.
  const inLoop = loopSegments(segments)
  const looped = new Set<Run>()
  kindsAt.forEach((kinds, i) => {
    if (kinds.length === 0) return
    const place = placeOf(line, i)
    for (const kind of kinds) {
      const run: Run = { kind, ...strengthOf(kind, facts, place, plains[i] ?? '') }
      runs.push(run)
      if (inLoop[i] === true) looped.add(run)
      else if (run.ok && !run.masked) strong[i] = true
    }
  })
  // A `gh pr view` that printed MERGED shows a merge, though the merge ran in an earlier call whose own output hid it
  // (`gh pr merge N | tail -5`, then `gh pr view N --json state`). Not a run otherwise: an OPEN PR is no merge.
  const view = plains.findIndex(p => PR_VIEW.test(p))
  if (!facts.denied && !facts.interrupted && view >= 0 && !runs.some(r => r.kind === 'merge') && VIEW_MERGED.test(facts.output)) {
    const run: Run = { kind: 'merge', ok: true, masked: false, basis: 'output' }
    runs.push(run)
    if (plains.every((p, k) => !PR_VIEW.test(p) || inLoop[k] === true)) looped.add(run)
  }
  // The result's gitOperation confirms an op whatever the command looked like.
  for (const op of SHIP_OPS) {
    if (facts.git[op] !== true) continue
    const seen = runs.filter(r => r.kind === op)
    if (seen.length === 0) runs.push({ kind: op, ok: true, masked: false, basis: 'gitOperation' })
    for (const run of seen) Object.assign(run, { ok: true, masked: false, basis: 'gitOperation' })
  }
  for (const run of looped) Object.assign(run, { ok: true, masked: true, basis: 'none' })
  return {
    mutations: facts.changed.filter(p => isCodeMutation(p, places)).map(p => pathKey(p, places)),
    // `gh pr merge` that only enabled auto-merge merged nothing yet.
    runs: facts.autoMerge === true ? runs.filter(r => r.kind !== 'merge') : runs,
    messageFiles: messageFilesOf(segments, plains, places.home),
    // A background command's names for a later read-back (full paths, so two worktrees' logs of one name do not collide).
    keys: facts.background ? outputKeys(command, facts.taskId ?? null, places) : [],
  }
}

// ---- Recording and judging ----

export const ENTRY_CAP = 100
export const EDIT_CAP = 20
export const FLAGGED_CAP = 500
export const PENDING_CAP = 50
export const STEP_CAP = 50
export const LINE_CAP = 5
export const NOTE_HEAD = "[claim-ledger plugin note, not the user's words. No reply needed.]"

export type Verdict = { status: Status; entry: Entry | null }
export type Fired = { claim: Claim; status: Status }
export type Assessment = { lines: string[]; fired: Fired[]; repeated: Claim[]; backed: Claim[] }

const NOUN: Record<Kind, string> = {
  tests: 'test run',
  build: 'build or type-check',
  commit: 'git commit',
  push: 'git push',
  merge: 'merge',
  'pr-create': 'gh pr create',
}

const isShipKind = (kind: Kind): kind is ShipOp => kind !== 'tests' && kind !== 'build'

export function emptyLedger(): Ledger {
  return { seq: 0, done: 0, calls: 0, turnFrom: 0, lastMutation: null, edits: [], entries: [], ships: {}, flagged: [], flaggedEvidence: [], pending: [], backed: [], steps: null }
}

/** A hot reload: the saved ledger, unless this module already holds one. Fields an older build lacked are filled. */
export function restoreLedger(current: Ledger, saved: unknown): Ledger {
  if (current.calls > 0 || typeof saved !== 'object' || saved === null || Array.isArray(saved)) return current
  // A copy, because values read from the host may be frozen.
  const restored: Ledger = { ...emptyLedger(), ...(JSON.parse(JSON.stringify(saved)) as Partial<Ledger>) }
  // A ledger saved before `edits` existed keeps its last edit.
  if (restored.edits.length === 0 && restored.lastMutation !== null) restored.edits = [restored.lastMutation]
  return restored
}

/** Whether a message file named to git or gh (normalized; relative as written) is this edit's file. */
function sameFile(edited: string, named: string): boolean {
  return edited === named || (!/^(?:[a-z]:\/|\/)/.test(named) && edited.endsWith(`/${named}`))
}

export function shortOf(command: string): string {
  const one = command.replace(/\s+/g, ' ').trim()
  return one.length > 80 ? `${one.slice(0, 77)}...` : one
}

/** Records one finished call; returns the entries it added. `seq` and `ts` are from hook entry, so order is call order. */
export function record(ledger: Ledger, facts: Facts, classified: Classified, seq: number, ts: number, agentId: string | null): Entry[] {
  ledger.calls += 1
  ledger.done += 1
  // A command's own edits are taken to come before its own runs (`sed -i ... && pytest`).
  const editSeq = classified.runs.length > 0 ? seq - 0.5 : seq
  for (const path of classified.mutations) {
    ledger.edits = ledger.edits.filter(m => m.path !== path)
    ledger.edits.push({ seq: editSeq, ts, path })
  }
  // Calls complete out of order: keep the edits in call order, one per path, newest last.
  ledger.edits.sort((a, b) => a.seq - b.seq)
  if (ledger.edits.length > EDIT_CAP) ledger.edits.splice(0, ledger.edits.length - EDIT_CAP)
  // A file git or gh read a commit message or PR body from was a message, not code: its write no longer counts.
  if (classified.messageFiles.length > 0) ledger.edits = ledger.edits.filter(m => !classified.messageFiles.some(f => sameFile(m.path, f)))
  const newest = ledger.edits[ledger.edits.length - 1]
  ledger.lastMutation = newest === undefined ? null : { ...newest }
  const added: Entry[] = []
  const keys = facts.background && facts.command !== null ? (classified.keys ?? []) : []
  const nth: Partial<Record<Kind, number>> = {}
  for (const run of classified.runs) {
    const n = nth[run.kind] ?? 0
    nth[run.kind] = n + 1
    const entry: Entry = {
      seq,
      done: ledger.done,
      ts,
      agentId,
      toolUseId: facts.toolUseId,
      tool: facts.tool,
      short: shortOf(facts.command ?? ''),
      kind: run.kind,
      ok: run.ok,
      background: facts.background,
      masked: run.masked,
      basis: run.basis,
    }
    if (keys.length > 0 && facts.command !== null) entry.watch = { tool: facts.tool, command: facts.command.slice(0, WATCH_CAP), keys, n }
    ledger.entries.push(entry)
    added.push(entry)
    if (isShipKind(run.kind) && entry.ok && !entry.masked && !entry.background) ledger.ships[run.kind] = entry
  }
  if (ledger.entries.length > ENTRY_CAP) ledger.entries.splice(0, ledger.entries.length - ENTRY_CAP)
  return added
}

// ---- Background runs read back ----

const WATCH_CAP = 4000
const BG_ID = /running in background with ID: ([\w-]+)/
const EXITED = /^\[exited with code (\d+)\]\s*$/m
const REDIRECT = /^(?:[0-9&]?>>?)(?!&)(.*)$/
// The Read tool numbers each line ("    12→text"); runner summaries are matched at line starts.
const READ_PREFIX = /^ *\d+(?:→|\t)/gm

/**
 * The files a command writes (`> f`, `>> f`, `2> f`, `tee f`) and the other file-like words it names, each resolved to a
 * full, normalized path (a basename alone would let one worktree's `push.log` judge another's run). Resolution follows
 * the command's own `cd`s from the session root, expands `NAME=value` assignments made on the line, `$TEMP`, `$HOME` and
 * `~`; a path still holding a variable is kept as written (normalized), so a reader that names it the same way matches.
 */
function filesOf(command: string, places: Places): { written: string[]; named: string[] } {
  const vars = new Map<string, string>()
  if (places.temp !== null) {
    vars.set('TEMP', places.temp)
    vars.set('TMP', places.temp)
  }
  if (places.home !== null) {
    vars.set('HOME', places.home)
    vars.set('USERPROFILE', places.home)
  }
  const expand = (text: string): string => text.replace(/\$\{?([A-Za-z_]\w*)\}?/g, (all, name: string) => vars.get(name) ?? all)
  let cwd = places.root
  const resolve = (word: string): string => pathKey(expand(word), { ...places, root: cwd })
  const written = new Set<string>()
  const named = new Set<string>()
  for (const s of segmentsOf(command)) {
    for (const w of s.words) {
      const m = /^([A-Za-z_]\w*)=(\S+)$/.exec(w.text)
      if (m !== null && m[1] !== undefined && m[2] !== undefined) vars.set(m[1], expand(m[2]))
    }
    const word = commandWord(s)
    const head = headOf(s)
    if (CD.has(word)) {
      const to = s.words[head + 1]?.text
      if (to !== undefined && !to.startsWith('-')) cwd = resolve(to)
      continue
    }
    const tee = word === 'tee'
    for (let i = head + 1; i < s.words.length; i += 1) {
      const w = s.words[i]
      if (w === undefined) continue
      const m = w.quoted ? null : REDIRECT.exec(w.text)
      if (m !== null) {
        const inline = m[1] ?? ''
        const target = inline !== '' ? inline : s.words[i + 1]?.text
        if (inline === '') i += 1
        if (target !== undefined && FILE_LIKE.test(expand(target))) written.add(resolve(target))
        continue
      }
      if (!FILE_LIKE.test(expand(w.text)) || w.text.startsWith('-')) continue
      if (tee) written.add(resolve(w.text))
      else named.add(resolve(w.text))
    }
  }
  return { written: [...written], named: [...named] }
}

// A word that names a file: it ends in a name with an extension.
const FILE_LIKE = /(?:^|[\\/])[\w.$-]*\.[A-Za-z0-9]+["']?$/

/** The names a later call would use to read a background command's result: its task id and the files it wrote. */
export function outputKeys(command: string, taskId: string | null, places: Places): string[] {
  return [...(taskId === null ? [] : [taskId.toLowerCase()]), ...filesOf(command, places).written]
}

// A task id is a bare word; a file key is a path.
const isTaskKey = (key: string): boolean => !key.includes('/')
const keyIn = (text: string, key: string): boolean => new RegExp(`(?<![\\w.-])${escapeRe(key)}(?![\\w-])`).test(text)

/**
 * A call that reads a background run's result back (its task output, or a file the run wrote) re-judges that run on what
 * it shows, by the same rules as a foreground run's own output. The read-back's `[exited with code N]` line, when it
 * shows one, is the command's exit status; otherwise only a status echo or a pass or fail summary counts. A run judged
 * so leaves the background with its own `seq` (its place against edits) and the read-back's `done` (when it became
 * known). A run that shows nothing stays weak until a later read. Each name belongs to the latest run that wrote it.
 * Returns the entries it changed.
 */
const STATUS_VARIABLE = /\$\?|\$\{\?\}|\$LASTEXITCODE|PIPESTATUS/i
const NUMBERING_GREPS = new Set(['grep', 'egrep', 'rg'])

/** A reader's git or gh command that withholds judgement: any but `git ls-remote` and `gh pr view`. */
function mixingGit(segment: Segment): boolean {
  const word = commandWord(segment)
  if (word !== 'git' && word !== 'gh') return false
  // The subcommand: the first word after the command word that is no option (or option value: `-C dir`, `-c k=v`).
  const rest: string[] = []
  const words = segment.words
  for (let k = headOf(segment) + 1; k < words.length; k += 1) {
    const w = words[k]?.text ?? ''
    if (w === '-C' || w === '-c' || w === '-R' || w === '--repo') k += 1
    else if (!w.startsWith('-')) rest.push(w.toLowerCase())
    if (rest.length === 2) break
  }
  if (word === 'git') return rest[0] !== 'ls-remote'
  return !(rest[0] === 'pr' && rest[1] === 'view')
}

/** Whether a line is a glob's pieces in order (first at the start, last at the end), with anything between. */
function globLine(pieces: readonly string[], line: string): boolean {
  if (pieces.length === 1) return line === pieces[0]
  const first = pieces[0] ?? ''
  const last = pieces[pieces.length - 1] ?? ''
  if (line.length < first.length + last.length || !line.startsWith(first) || !line.endsWith(last)) return false
  let at = first.length
  const end = line.length - last.length
  for (let k = 1; k < pieces.length - 1; k += 1) {
    const piece = pieces[k] ?? ''
    if (piece === '') continue
    const found = line.indexOf(piece, at)
    if (found < 0 || found + piece.length > end) return false
    at = found + piece.length
  }
  return true
}

export function readBack(ledger: Ledger, facts: Facts, config: Config, places: Places): Entry[] {
  if (facts.denied || facts.interrupted || facts.background) return []
  const text = `${facts.command ?? ''}\n${facts.path ?? ''}`.toLowerCase()
  if (text.trim() === '') return []
  const files = facts.command === null ? { written: [], named: [] } : filesOf(facts.command, places)
  const named = new Set<string>(files.named)
  if (facts.path !== null) named.add(pathKey(facts.path, places))
  const own = new Set<string>(files.written)
  const latest = new Map<string, number>()
  for (const e of ledger.entries) for (const k of e.watch?.keys ?? []) latest.set(k, Math.max(latest.get(k) ?? 0, e.seq))
  const calls = new Set<number>()
  for (const [key, seq] of latest) if (isTaskKey(key) ? keyIn(text, key) : named.has(key) && !own.has(key)) calls.add(seq)
  if (calls.size === 0) return []
  const readerSegments = facts.command === null ? [] : commandsOf(facts.command)
  // `grep -n` prefixes each line with its number ("31024:exit=0"); the status lines are matched without it. Read from
  // the parsed words: a pattern over the raw command grew with the number of grep words times the line length.
  const numbered = readerSegments.some(s => NUMBERING_GREPS.has(commandWord(s)) && s.words.some(w => !w.quoted && /^-[A-Za-z]*n/.test(w.text)))
  // A read that also runs a test or build runner, or any git or gh command but `git ls-remote` and `gh pr view`,
  // prints that command's summaries, failures and sha lines beside the run's (`nothing to commit` from `git status`,
  // `fatal:` from `git rev-parse`, "2 failed" in a `git log` subject, a failing check in `gh pr checks`, a ref update
  // from `git fetch`). Such a read judges nothing; a clean read can later.
  if (readerSegments.some(s => kindsIn(plainOf(s), config).length > 0 || mixingGit(s))) return []
  // A status echo the reader itself runs prints the reader's status, never the run's: its lines are dropped before the
  // run is judged, even when the run echoed the same template (then neither line can be told apart).
  const ownEchoes = readerSegments
    .filter(s => ECHO_HEADS.has(commandWord(s)))
    .map(echoText)
    .filter(t => STATUS_VARIABLE.test(t))
    .map(t => t.split(VARIABLE))
  const read = facts.tool === 'Read' ? facts.output.replace(READ_PREFIX, '') : numbered ? facts.output.replace(/^\d+[:-]/gm, '') : facts.output
  const output =
    ownEchoes.length === 0
      ? read
      : read
          .split('\n')
          .filter(line => !ownEchoes.some(pieces => globLine(pieces, line.trim())))
          .join('\n')
  const exit = EXITED.exec(output)
  const changed: Entry[] = []
  for (const seq of calls) {
    const waiting = ledger.entries.filter(e => e.seq === seq && e.background && e.watch !== undefined)
    const watch = waiting[0]?.watch
    if (watch === undefined) continue
    // A read that also prints a file this run did not write (and that is not its task output) is mixed: skip it.
    const taskIds = watch.keys.filter(isTaskKey)
    const foreign = [...named].some(path => !watch.keys.includes(path) && !taskIds.some(id => keyIn(path, id)))
    if (foreign) continue
    // The exit line is the task's own only when the read names the task (its id has no dot; a file name has one).
    const status = taskIds.some(k => keyIn(text, k)) ? exit : null
    // A command that loops keeps every run weak in classify, so a read-back of one changes nothing.
    const again = classify(
      {
        tool: watch.tool,
        command: watch.command,
        path: null,
        toolUseId: null,
        denied: false,
        isError: status !== null && status[1] !== '0',
        interrupted: false,
        background: false,
        output,
        git: {},
        changed: [],
        exitKnown: status !== null,
      },
      config,
      places,
    ).runs
    for (const entry of waiting) {
      const run = again.filter(r => r.kind === entry.kind)[entry.watch?.n ?? 0]
      if (run === undefined || run.masked) continue
      Object.assign(entry, { background: false, ok: run.ok, masked: false, basis: run.basis, done: ledger.done })
      if (isShipKind(entry.kind) && entry.ok) ledger.ships[entry.kind] = entry
      changed.push(entry)
      const tests = prePushTests(entry, ledger, seq, output)
      if (tests !== null) changed.push(tests)
    }
  }
  return changed
}

// A test runner's own failure summary line, never a bare FAILED inside a test title or stderr: vitest and jest's
// "Tests  1 failed", pytest's "1 failed, 3 passed" / "1 failed in", cargo's "test result: FAILED", TAP's "# fail 1".
const TESTS_FAILED_SUMMARY = /^[ \t]*(?:Test Files|Tests|Test Suites):?\s[^\n]*\b[1-9]\d*\s+failed\b|\b[1-9]\d* failed(?:,| in )|^test result: FAILED|^#\s*fail\s+[1-9]/m

/**
 * The suite a push's pre-push hook ran, from the push's read-back, as a `tests` entry at the push's place: a pass only
 * when the push itself succeeded (with a multi-stage hook, a failed push may be a later stage failing after the tests'
 * pass line), a failure only from a runner's failure summary line. Not when the push command runs tests itself.
 */
function prePushTests(push: Entry, ledger: Ledger, seq: number, output: string): Entry | null {
  if (push.kind !== 'push' || ledger.entries.some(e => e.seq === seq && e.kind === 'tests')) return null
  const fail = TESTS_FAILED_SUMMARY.test(output)
  if (!fail && !(push.ok && SUMMARY.tests.pass.test(output))) return null
  const tests: Entry = { ...push, kind: 'tests', ok: !fail, masked: false, basis: 'output', background: false, done: ledger.done }
  delete tests.watch
  ledger.entries.push(tests)
  return tests
}

export function kindOf(c: { family: Family; op: ShipOp | null }): Kind {
  return c.family === 'shipped' ? (c.op ?? 'commit') : c.family
}

/** What the ledger knows now, for judging a step's claims later. */
export function asOfNow(ledger: Ledger): AsOf {
  return { done: ledger.done, lastMutation: ledger.lastMutation === null ? null : { ...ledger.lastMutation } }
}

/** How a claim of this kind stands: now, or as of a snapshot. Shipped reads this turn's ops; tests and build read runs after the last edit. */
export function judge(kind: Kind, ledger: Ledger, asOf: AsOf | null = null): Verdict {
  const isShip = isShipKind(kind)
  const edit = asOf === null ? ledger.lastMutation : asOf.lastMutation
  const since = isShip ? ledger.turnFrom : (edit?.seq ?? 0)
  const kept = isShip ? ledger.ships[kind] : undefined
  const pool = kept !== undefined && !ledger.entries.some(e => e.seq === kept.seq && e.kind === kept.kind) ? [...ledger.entries, kept] : ledger.entries
  const runs = pool.filter(e => e.kind === kind && e.seq > since && (asOf === null || e.done <= asOf.done)).sort((a, b) => a.seq - b.seq)
  if (runs.length === 0) return { status: 'none', entry: null }
  const foreground = runs.filter(e => !e.background)
  if (foreground.length === 0) return { status: 'background', entry: runs[runs.length - 1] ?? null }
  if (isShip) {
    const strong = foreground.find(e => e.ok && !e.masked)
    if (strong !== undefined) return { status: 'backed', entry: strong }
    const weak = foreground.find(e => e.ok)
    return weak !== undefined ? { status: 'masked', entry: weak } : { status: 'failed', entry: foreground[foreground.length - 1] ?? null }
  }
  const last = foreground[foreground.length - 1] ?? null
  if (last === null || !last.ok) return { status: 'failed', entry: last }
  return { status: last.masked ? 'masked' : 'backed', entry: last }
}

/** The evidence a verdict rests on: a restated claim over the same evidence is not flagged again. */
function evidenceKey(kind: Kind, verdict: Verdict, ledger: Ledger): string {
  const scope = isShipKind(kind) ? ledger.turnFrom : (ledger.lastMutation?.seq ?? 0)
  return `${kind}|${verdict.status}|${verdict.entry?.seq ?? 0}|${scope}`
}

/** Local HH:MM. Uses the local time zone. */
export function hhmm(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function lineOf(claim: Claim, verdict: Verdict, ledger: Ledger, clock: (ms: number) => string): string {
  const said = `Claim Ledger: "${claim.phrase.replace(/"/g, "'")}"`
  const noun = NOUN[kindOf(claim)]
  const isShip = claim.family === 'shipped'
  const edit = ledger.lastMutation
  switch (verdict.status) {
    case 'none':
      if (isShip) return `${said} has no ${noun} this turn.`
      return edit === null ? `${said} has no ${noun} this session.` : `${said} has no ${noun} after the last edit (${clock(edit.ts)}).`
    case 'failed':
      if (isShip) return `${said}: the ${noun} this turn failed.`
      return `${said}: the last ${noun}${edit === null ? ' this session' : ' after the last edit'} failed (${clock(verdict.entry?.ts ?? 0)}).`
    case 'masked':
      return `${said} rests on \`${verdict.entry?.short ?? ''}\`, whose exit code is masked and whose output shows no result.`
    case 'background':
      return `${said} rests on a background run, which shows only that it started.`
    default:
      return ''
  }
}

/** The text appended for the model: a frame, then the lines. */
export function noteText(lines: readonly string[]): string {
  return `${NOTE_HEAD}\n${lines.join('\n')}`
}

/** Step-time judgement against the snapshot taken when the step began: a claim backed then is settled for this turn. */
export function noteClaims(ledger: Ledger, turnId: string, claims: readonly Claim[], asOf: AsOf): void {
  const steps: NonNullable<Ledger['steps']> = ledger.steps !== null && ledger.steps.turnId === turnId ? ledger.steps : { turnId, candidates: [], backed: [] }
  for (const claim of claims) {
    if (steps.backed.some(c => c.hash === claim.hash) || steps.candidates.some(c => c.hash === claim.hash)) continue
    if (judge(kindOf(claim), ledger, asOf).status === 'backed') {
      if (steps.backed.length < STEP_CAP) steps.backed.push(claim)
    } else if (steps.candidates.length < STEP_CAP) {
      steps.candidates.push(claim)
    }
  }
  ledger.steps = steps
}

/** Turn-end judgement: flags each candidate still unbacked, once per sentence and per evidence state. Mutates the ledger's flag lists. */
export function assess(candidates: readonly Claim[], ledger: Ledger, now: number, clock: (ms: number) => string): Assessment {
  const out: Assessment = { lines: [], fired: [], repeated: [], backed: [] }
  for (const claim of candidates) {
    const kind = kindOf(claim)
    const verdict = judge(kind, ledger)
    if (verdict.status === 'backed') {
      out.backed.push(claim)
      continue
    }
    const key = evidenceKey(kind, verdict, ledger)
    if (ledger.flagged.includes(claim.hash) || ledger.flaggedEvidence.includes(key)) {
      out.repeated.push(claim)
      continue
    }
    ledger.flagged.push(claim.hash)
    ledger.flaggedEvidence.push(key)
    // Only a tests or build flag can be later backed.
    if (claim.family !== 'shipped') ledger.pending.push({ hash: claim.hash, family: claim.family, op: claim.op, ts: now, edit: ledger.lastMutation?.seq ?? 0 })
    out.fired.push({ claim, status: verdict.status })
    out.lines.push(lineOf(claim, verdict, ledger, clock))
  }
  if (ledger.flagged.length > FLAGGED_CAP) ledger.flagged.splice(0, ledger.flagged.length - FLAGGED_CAP)
  if (ledger.flaggedEvidence.length > FLAGGED_CAP) ledger.flaggedEvidence.splice(0, ledger.flaggedEvidence.length - FLAGGED_CAP)
  if (ledger.pending.length > PENDING_CAP) ledger.pending.splice(0, ledger.pending.length - PENDING_CAP)
  if (out.lines.length > LINE_CAP) {
    const extra = out.lines.length - LINE_CAP
    out.lines = [...out.lines.slice(0, LINE_CAP), `Claim Ledger: ${extra} more unbacked claim${extra === 1 ? '' : 's'} this turn.`]
  }
  return out
}

/** Ends an answered main turn: judges its candidates, then opens the next turn's shipped window. */
export function closeTurn(ledger: Ledger, turnId: string, now: number, clock: (ms: number) => string): Assessment {
  const steps = ledger.steps !== null && ledger.steps.turnId === turnId ? ledger.steps : null
  ledger.steps = null
  const out = assess(steps?.candidates ?? [], ledger, now, clock)
  out.backed.unshift(...(steps?.backed ?? []))
  ledger.turnFrom = ledger.seq
  return out
}

/** Moves each pending flag that a strong run now backs, with no code edit since the flag, into `backed`. */
export function markBacked(ledger: Ledger): void {
  const edit = ledger.lastMutation?.seq ?? 0
  const still: Pending[] = []
  for (const pending of ledger.pending) {
    // An edit since the flag: a later run can no longer show the claim was true when made. Drop it. (A message file
    // taken back out can move the last edit earlier; that is no new edit.)
    if (edit > pending.edit) continue
    if (judge(kindOf(pending), ledger).status === 'backed') ledger.backed.push(pending)
    else still.push(pending)
  }
  ledger.pending = still
}
