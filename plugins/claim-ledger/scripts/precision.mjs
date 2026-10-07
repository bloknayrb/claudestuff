// Claim Ledger precision check. Replays Claude Code transcripts, with their subagent files, through the same
// detector and ledger the mod uses.
// Usage: node scripts/precision.mjs <out-dir> <list-file>   (list-file: one top-level transcript path per line)
// Writes summary.txt, hits.txt, blind-hits.txt, flags.txt, misses.txt, forms.txt and packs/flag-<id>.txt to <out-dir>.
// Hit counts in summary.txt are per step (a claim restated in two steps counts twice); hits.txt holds one item per claim per turn.
// They quote transcript text: keep them out of any repo.
// Items carry stable ids, `hit-<fnv1a(file|turn|claim)>` and `flag-<fnv1a(file|turn|claim|status)>`, so labels keep
// their meaning across tuning rounds (a flag whose status changes is a new item).
// A flag pack holds each call's output in full up to its last 20,000 characters (OUT_CAP), where runner summaries sit:
// for a tests or build flag, the last CALL_CAP calls since the last code edit; for a shipped flag, the last CALL_CAP
// calls since its turn began plus every earlier call in the turn that ran a ship op. The header says when calls were omitted.
// Each file is in the `tune` or the `holdout` set, by the hash of its path; tune only on `tune`.
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { createInterface } from 'node:readline'

import { findClaims, fnv1a } from '../hooks/claims.ts'
import { DEFAULT_BUILD_COMMANDS, DEFAULT_TEST_COMMANDS, asOfNow, classify, closeTurn, configOf, emptyLedger, factsOf, hhmm, noteClaims, readBack, record } from '../hooks/evidence.ts'

const [outDir, listFile] = process.argv.slice(2)
if (outDir === undefined || listFile === undefined) {
  console.error('usage: node scripts/precision.mjs <out-dir> <list-file>')
  process.exit(2)
}
const files = readFileSync(listFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
const HOME = process.env.USERPROFILE ?? process.env.HOME ?? null
const TEMP = process.env.TEMP ?? null
const CONFIG = configOf(DEFAULT_TEST_COMMANDS, DEFAULT_BUILD_COMMANDS)
const NEAR = /\b(?:pass(?:es|ed|ing)?|green|compiles?|builds?|type-?checks?|committed|pushed|merged|opened)\b/i
const SPLIT = /(?<=[.!?])\s+|\n+/
const OUT_CAP = 20000
const CALL_CAP = 60 // calls per pack
const CALL_KEEP = 400 // calls remembered per transcript

const zero = () => ({ tests: 0, build: 0, shipped: 0 })
const totals = { files: 0, turns: 0, steps: 0, stepsWithClaim: 0, readBacks: 0, hits: { tune: zero(), holdout: zero() }, flags: { tune: zero(), holdout: zero() }, status: {} }
const hits = []
const hitIds = new Set()
const flags = []
const misses = []
// The recall gaps the re-review named: a present-state ship verb with a subject the detector does not take, "N test files pass".
const FORMS = /\b(?:is|are)\s+(?:now\s+|all\s+)?(?:committed|pushed|merged)\b|\btest\s+files?\s+pass/i
const forms = []

const textOf = blocks => blocks.filter(b => b && b.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n')
const sentenceWith = (text, phrase) => (text.split(SPLIT).find(s => s.includes(phrase)) ?? phrase).slice(0, 240)
const resultText = b => (typeof b.content === 'string' ? b.content : Array.isArray(b.content) ? b.content.map(x => (x && typeof x.text === 'string' ? x.text : '')).join('\n') : '')
const setOf = file => (parseInt(fnv1a(file).slice(-1), 16) % 2 === 0 ? 'tune' : 'holdout')

// A turn starts at a prompt row: not isMeta, not a tool result, and not a background task's notification (review C6).
function isPrompt(row) {
  if (row.type !== 'user' || row.isMeta === true) return false
  if (row.origin?.kind === 'task-notification') return false
  const content = row.message?.content
  if (typeof content === 'string') return true
  return Array.isArray(content) && !content.some(b => b?.type === 'tool_result')
}

/** The main transcript's rows and its subagents' rows, merged by timestamp (stable: ties keep file order). */
async function rowsOf(file) {
  const rows = []
  const read = async (path, agentId) => {
    let last = 0
    const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })
    for await (const raw of lines) {
      let row
      try {
        row = JSON.parse(raw)
      } catch {
        continue
      }
      const ts = Date.parse(row.timestamp ?? '')
      if (Number.isFinite(ts)) last = ts
      rows.push({ row, agentId, ts: last })
    }
  }
  await read(file, null)
  const subDir = join(dirname(file), basename(file, '.jsonl'), 'subagents')
  if (existsSync(subDir)) {
    for (const name of readdirSync(subDir)) {
      if (/^agent-.*\.jsonl$/.test(name)) await read(join(subDir, name), name.slice('agent-'.length, -'.jsonl'.length))
    }
  }
  return rows.sort((a, b) => a.ts - b.ts)
}

async function replay(file) {
  const ledger = emptyLedger()
  const tools = new Map()
  const where = `${basename(dirname(file))}/${basename(file)}`
  const set = setOf(file)
  let root = null
  let turn = 0
  let turnId = 't0'
  let step = null
  let stepTexts = []
  let lastTs = 0
  let calls = [] // recent shell and Agent calls with their outputs and seq, for the flag packs

  const closeStep = () => {
    if (step === null) return
    const text = step.text.trim()
    const asOf = step.asOf
    step = null
    if (text === '') return
    totals.steps += 1
    stepTexts.push(text)
    const claims = findClaims(text)
    if (claims.length > 0) totals.stepsWithClaim += 1
    for (const c of claims) {
      totals.hits[set][c.family] += 1
      // One item per claim per turn, however many steps restate it.
      const id = fnv1a(`${where}|${turn}|${c.hash}`)
      if (hitIds.has(id)) continue
      hitIds.add(id)
      const sentence = sentenceWith(text, c.phrase)
      const at = text.indexOf(sentence)
      hits.push({ id, set, where, turn, family: c.family, op: c.op, phrase: c.phrase, sentence, before: text.slice(Math.max(0, at - 300), Math.max(0, at)) })
    }
    for (const s of text.split(SPLIT)) {
      if (!NEAR.test(s) || claims.some(c => s.includes(c.phrase))) continue
      if (misses.length < 400) misses.push({ set, where, turn, sentence: s.slice(0, 240) })
      if (FORMS.test(s) && forms.length < 100) forms.push({ set, where, turn, sentence: s.slice(0, 240) })
    }
    // Step-time judgement against the ledger as it stood when the step began (decision 5).
    noteClaims(ledger, turnId, claims, asOf)
  }

  const endTurn = () => {
    closeStep()
    // The windows the claims are judged on: after the last code edit (tests, build) or after the turn began (shipped).
    const turnFrom = ledger.turnFrom
    const edit = ledger.lastMutation
    const out = closeTurn(ledger, turnId, lastTs, hhmm)
    out.fired.forEach((f, i) => {
      totals.flags[set][f.claim.family] += 1
      totals.status[f.status] = (totals.status[f.status] ?? 0) + 1
      const said = stepTexts.map(t => sentenceWith(t, f.claim.phrase)).find(s => s.includes(f.claim.phrase)) ?? ''
      const shipped = f.claim.family === 'shipped'
      const from = shipped ? turnFrom : (edit?.seq ?? 0)
      // The last CALL_CAP calls of the window; a shipped flag also keeps every call that ran a ship op, however early,
      // since the flag rests on the turn's ops (third round).
      const window = calls.filter(c => c.seq > from)
      const recent = new Set(window.slice(-CALL_CAP))
      const shown = window.filter(c => recent.has(c) || (shipped && c.ship))
      const id = fnv1a(`${where}|${turn}|${f.claim.hash}|${f.status}`)
      flags.push({ id, set, where, turn, family: f.claim.family, shipped, line: out.lines[i] ?? '(past the five-line cap)', said, lastEdit: edit?.path ?? 'none', calls: shown, omitted: window.length - shown.length })
    })
    stepTexts = []
  }

  for (const { row, agentId } of await rowsOf(file)) {
    const ts = Date.parse(row.timestamp ?? '')
    if (Number.isFinite(ts)) lastTs = ts
    if (root === null && agentId === null && typeof row.cwd === 'string') root = row.cwd
    const content = Array.isArray(row.message?.content) ? row.message.content : []
    const isMain = agentId === null && row.isSidechain !== true
    if (isMain && isPrompt(row)) {
      endTurn()
      turn += 1
      turnId = `t${turn}`
      totals.turns += 1
      continue
    }
    if (row.type === 'assistant') {
      if (isMain) {
        const id = row.message?.id ?? row.uuid
        if (step !== null && step.id !== id) closeStep()
        if (step === null) step = { id, text: '', asOf: asOfNow(ledger) }
        const text = textOf(content)
        if (text !== '') step.text += `\n${text}`
      }
      for (const b of content) {
        if (b?.type !== 'tool_use') continue
        ledger.seq += 1
        tools.set(b.id, { input: { tool: b.name, tool_use_id: b.id, ...(b.input ?? {}) }, seq: ledger.seq, ts: lastTs, agentId })
      }
      continue
    }
    if (row.type !== 'user') continue
    for (const b of content) {
      if (b?.type !== 'tool_result') continue
      const call = tools.get(b.tool_use_id)
      if (call === undefined) continue
      tools.delete(b.tool_use_id)
      const output = resultText(b)
      const facts = factsOf(call.input, { isError: b.is_error === true, result: row.toolUseResult, text: output })
      const classified = classify(facts, CONFIG, { home: HOME, root, temp: TEMP })
      record(ledger, facts, classified, call.seq, call.ts, call.agentId)
      // A background run whose result this call read back is judged now (round 3), as register.ts does.
      totals.readBacks += readBack(ledger, facts, CONFIG, { home: HOME, root, temp: TEMP }).length
      if (['Bash', 'PowerShell', 'Agent', 'Task'].includes(call.input.tool)) {
        const what = call.input.command ?? `${call.input.description ?? ''} :: ${String(call.input.prompt ?? '').slice(0, 300)}`
        const ship = classified.runs.some(r => ['commit', 'push', 'merge', 'pr-create'].includes(r.kind))
        calls.push({ seq: call.seq, tool: call.input.tool, agentId: call.agentId, what, error: b.is_error === true, ship, output: output.slice(-OUT_CAP) })
        if (calls.length > CALL_KEEP) calls.shift()
      }
    }
  }
  endTurn()
  totals.files += 1
}

for (const file of files) {
  try {
    await replay(file)
  } catch (err) {
    console.error(`skipped ${file}: ${err.message}`)
  }
}

mkdirSync(join(outDir, 'packs'), { recursive: true })
const pctOf = (a, b) => (b === 0 ? '-' : `${((100 * a) / b).toFixed(1)}%`)
const shareLine = set => ['tests', 'build', 'shipped'].map(f => `${f} ${totals.flags[set][f]}/${totals.hits[set][f]} (${pctOf(totals.flags[set][f], totals.hits[set][f])})`).join(', ')
const summary = [
  `files ${totals.files}, turns ${totals.turns}, steps with text ${totals.steps}`,
  `steps with a claim: ${totals.stepsWithClaim} (${pctOf(totals.stepsWithClaim, totals.steps)})`,
  `hits tune: ${JSON.stringify(totals.hits.tune)}; holdout: ${JSON.stringify(totals.hits.holdout)}`,
  `flagged share of claims, tune: ${shareLine('tune')}`,
  `flagged share of claims, holdout: ${shareLine('holdout')}`,
  `flag status: ${JSON.stringify(totals.status)}`,
  `background runs judged from a read-back: ${totals.readBacks}`,
].join('\n')
writeFileSync(join(outDir, 'summary.txt'), `${summary}\n`)
writeFileSync(join(outDir, 'hits.txt'), `${hits.map(h => `hit-${h.id} {${h.set}} [${h.family}${h.op ? `:${h.op}` : ''}] ${h.where}#${h.turn} | ${h.phrase} || ${h.sentence}`).join('\n')}\n`)
// Blind: the sentence and the text before it, with no family and no verdict.
writeFileSync(join(outDir, 'blind-hits.txt'), `${hits.map(h => `hit-${h.id} || before: ${h.before.replace(/\s+/g, ' ')} || sentence: ${h.sentence}`).join('\n')}\n`)
writeFileSync(join(outDir, 'flags.txt'), `${flags.map(f => `flag-${f.id} {${f.set}} [${f.family}] ${f.where}#${f.turn} | ${f.line}\n    said: ${f.said}\n    last edit: ${f.lastEdit}`).join('\n')}\n`)
for (const f of flags) {
  // Blind: the claim and the evidence, with no ledger line or status.
  const body = [
    `Claim, as written: ${f.said}`,
    `Last code edit before the claim: ${f.lastEdit}`,
    f.shipped
      ? 'Shell and Agent calls since the turn began (a commit, push, merge or pull request is judged on its own turn, edits notwithstanding), oldest first:'
      : 'Shell and Agent calls since that edit, oldest first:',
    ...(f.omitted > 0
      ? [`(${f.omitted} earlier calls omitted: the last ${CALL_CAP} are shown${f.shipped ? ', plus every earlier call that ran a commit, push, merge or pull request' : ''}.)`]
      : []),
    ...f.calls.map(c => `--- [${c.tool}${c.agentId ? ` in subagent ${c.agentId}` : ''}${c.error ? ', errored' : ''}] ${c.what}\n${c.output}`),
  ].join('\n')
  writeFileSync(join(outDir, 'packs', `flag-${f.id}.txt`), `${body}\n`)
}
const every = Math.max(1, Math.floor(misses.length / 40))
writeFileSync(join(outDir, 'misses.txt'), `${misses.filter((_, i) => i % every === 0).slice(0, 40).map((m, i) => `#${i + 1} {${m.set}} ${m.where}#${m.turn} || ${m.sentence}`).join('\n')}\n`)
writeFileSync(join(outDir, 'forms.txt'), `${forms.map((m, i) => `#${i + 1} {${m.set}} ${m.where}#${m.turn} || ${m.sentence}`).join('\n')}\n`)
console.log(summary)
