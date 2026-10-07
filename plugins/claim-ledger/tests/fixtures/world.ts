import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

export type ToolResult = { result: unknown; text: string; isError?: true }

/** The world beneath the plugin: what it wrote, logged and submitted, and how tools and steps answer. */
export type World = {
  /** Every fs.write, its path normalized to forward slashes (the host hands fs hooks native paths). */
  writes: { path: string; text: string }[]
  logs: string[]
  submitted: string[]
  commands: string[]
  /** What $.session.id() answers; a test changes it to stand in for /clear. */
  sessionId: string
  /** What $.session.root() answers, in native form. */
  root: string
  /** How the next tool calls answer; tests replace it. */
  toolResult: (input: Record<string, unknown>) => ToolResult
  /** Mock-clock milliseconds a tool call takes to answer (0: at once). Needs `sleep`, which boot() sets. */
  delay: (input: Record<string, unknown>) => number
  sleep: ((ms: number) => Promise<void>) | null
  /** The responses the next turn.step calls return, in order. */
  steps: { answer: string; tools: number }[]
  /** Runs inside the next turn.step, after the step began and before its response resolves. */
  midStep: (() => Promise<unknown>) | null
}

export const SESSION = { cwd: 'C:/work', surface: 'terminal' as const, isInteractive: true }
export const HOME_ENV = { USERPROFILE: 'C:\\Home\\tester' }
export const healthOf = (id: string) => `C:/Home/tester/.claude/state/mods/claim-ledger/${id}.json`
export const HEALTH = healthOf('sess-1')
export const TRAIL = 'C:/Home/tester/.claude/state/mods/claim-ledger/trail/sess-1.jsonl'

export const OK: ToolResult = { result: { stdout: '', stderr: '', interrupted: false }, text: 'ok' }
export const FAILED: ToolResult = { result: 'Exit code 1', text: 'Exit code 1', isError: true }

/** Seats the world beneath the plugin. Call before the test's first call on `$`. */
export function worldOf(on: On, env: Readonly<Record<string, string>> = HOME_ENV): World {
  const world: World = {
    writes: [],
    logs: [],
    submitted: [],
    commands: [],
    sessionId: 'sess-1',
    root: 'C:\\work',
    toolResult: () => OK,
    delay: () => 0,
    sleep: null,
    steps: [],
    midStep: null,
  }

  on('env.get', (_$, e) => ({ value: env[e.name] }))
  on('session.id', () => ({ value: world.sessionId }))
  on('session.root', () => ({ value: world.root }))
  on('fs.write', (_$, e) => {
    world.writes.push({ path: e.path.replace(/\\/g, '/'), text: e.text })
    return { value: undefined }
  })
  on('ui.log', (_$, e) => {
    world.logs.push(e.text)
    return { value: undefined }
  })
  on('command.register', (_$, e) => {
    world.commands.push(e.name)
    return { value: { command: e.name } } as never
  })
  on('prompt.submit', (_$, e) => {
    world.submitted.push(e.text)
    return { text: e.text } as never
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('tool.call', async (_$, e) => {
    const input = e as unknown as Record<string, unknown>
    const ms = world.delay(input)
    if (ms > 0 && world.sleep !== null) await world.sleep(ms)
    return world.toolResult(input) as never
  })
  on('turn.step', async function* (_$, e) {
    const next = world.steps.shift() ?? { answer: '', tools: 0 }
    const during = world.midStep
    world.midStep = null
    if (during !== null) await during()
    return {
      turnId: e.turnId,
      index: e.index,
      answer: next.answer,
      toolUses: Array.from({ length: next.tools }, () => ({ name: 'Bash', input: {} })),
      stopReason: next.tools > 0 ? 'tool_use' : 'end_turn',
      usage: null,
    } as never
  })

  return world
}

/** Drives one model request of a turn through the plugins, the response taken from world.steps. */
export async function step($: Engine, turnId: string, index: number, agentId?: string): Promise<void> {
  const stream = $.turn.step({ turnId, index, model: 'test-model', messageCount: 1, ...(agentId !== undefined && { agentId }) } as never)
  for await (const _chunk of stream) {
    // drain: the bottom yields nothing
  }
  await stream.result
}

/** Ends a turn through the plugins; resolves what the chain answered ({ text }). */
export function complete(
  $: Engine,
  answer: string,
  opts: { turnId?: string; agentId?: string; reason?: 'answer' | 'aborted' | 'error' } = {},
): Promise<{ text: string }> {
  const reason = opts.reason ?? 'answer'
  return $.turn.complete({
    answer,
    durationMs: 1,
    isAborted: reason === 'aborted',
    turnId: opts.turnId ?? 't1',
    reason,
    ...(opts.agentId !== undefined && { agentId: opts.agentId }),
  } as never) as Promise<{ text: string }>
}

export const bash = (command: string, extra: Record<string, unknown> = {}) => ({ tool: 'Bash', command, ...extra }) as never
export const pwsh = (command: string, extra: Record<string, unknown> = {}) => ({ tool: 'PowerShell', command, ...extra }) as never
export const edit = (path: string) => ({ tool: 'Edit', file_path: path, old_string: 'a', new_string: 'b' }) as never

/** Runs /claim-ledger as the user typing it. */
export function runCommand($: Engine): Promise<{ text?: string }> {
  return $.command.run({ command: 'claim-ledger', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as never) as Promise<{ text?: string }>
}
