import { mock } from 'claude-code/testing'
import type { MockClock, Plugin } from 'claude-code/testing'
import type { AgentSpawnInput, On, SessionRateLimit, TurnCompleteInput, UsageUnit } from 'claude-code'

export const T0 = Date.parse('2026-10-06T12:00:00Z')
export const MIN = 60_000
export const START = { cwd: 'C:/work', surface: 'terminal', isInteractive: true } as const
export const END_CLEAR = { reason: 'clear', sessionId: 'S1', resume: { id: 'S1' } } as const
/** A workflow script's agent(): AgentSpawnInput's `workflow` field (2.1.292). */
export const WORKFLOW = { runId: 'wf_test', agentIndex: 1 }

export type World = {
  clock: MockClock
  store: Map<string, unknown>
  status: (string | undefined)[]
  toasts: string[]
  logs: { text: string; to: string }[]
  writes: { path: string; text: string }[]
  spawned: AgentSpawnInput[]
  registered: string[]
  setLimits: (limits: SessionRateLimit[]) => void
  setSessionId: (id: string) => void
}

export type WorldInit = {
  limits?: SessionRateLimit[]
  store?: Record<string, unknown>
  env?: Record<string, string>
  failStoreSet?: boolean
  failUsage?: boolean
}

function copy<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T)
}

/**
 * Answers every op and event the mod touches, beneath the plugin, and records what it was asked.
 * The kit answers $.state itself. Stubs for calls on `$` answer `{ value }`.
 */
export function world(on: On, init: WorldInit = {}): World {
  let limits = init.limits ?? []
  let sessionId = 'S1'
  const w: World = {
    clock: mock.clock(on, { now: T0 }),
    store: new Map(Object.entries(init.store ?? {})),
    status: [],
    toasts: [],
    logs: [],
    writes: [],
    spawned: [],
    registered: [],
    setLimits: next => {
      limits = next
    },
    setSessionId: id => {
      sessionId = id
    },
  }
  mock.env(on, init.env ?? { USERPROFILE: 'C:\\Users\\tester' })

  on('store.get', (_$, e) => ({ value: copy(w.store.get(e.key)) }))
  on('store.set', (_$, e) => {
    // Thrown, not { deny }: a throw beneath the plugin surely rejects the plugin's $.store.set.
    if (init.failStoreSet === true) throw new Error('store full')
    w.store.set(e.key, copy(e.value))
    return { value: undefined }
  })
  on('store.delete', (_$, e) => {
    w.store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...w.store.keys()] }))
  on('session.id', () => ({ value: sessionId }))
  on('session.usage', () => {
    if (init.failUsage === true) throw new Error('usage unavailable')
    return { value: { startedAt: T0, context: { window: 200_000 }, rateLimits: limits } }
  })
  on('ui.status', (_$, e) => {
    w.status.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.log', (_$, e) => {
    w.logs.push({ text: e.text, to: e.to })
    return { value: undefined }
  })
  on('fs.write', (_$, e) => {
    // fs hooks see the native path, backslashes on Windows: record it with forward slashes.
    w.writes.push({ path: e.path.split('\\').join('/'), text: e.text })
    return { value: undefined }
  })
  on('command.register', (_$, e) => {
    w.registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('agent.spawn', (_$, e) => {
    w.spawned.push(copy(e) as AgentSpawnInput)
    // Always a defined model: the kit's plugin spawns arrive with no model or parentModel.
    return { model: e.model ?? e.parentModel ?? 'inherited', agentId: `agent-${w.spawned.length}` }
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('session.measure', (_$, e) => ({ changed: [...e.changed] }))
  on('turn.complete', () => ({ text: '' }))
  return w
}

let toolUse = 0

/** A whole AgentSpawnInput as the Agent tool would raise it; each call gets a fresh tool_use_id. */
export function spawn(over: Partial<AgentSpawnInput> = {}): AgentSpawnInput {
  toolUse += 1
  return {
    tool_use_id: `toolu_test_${toolUse}`,
    prompt: 'Summarise README.md in three lines.',
    description: 'summarise readme',
    subagentType: 'general-purpose',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
    ...over,
  }
}

export function fiveHourAt(pct: number, resetsAt: number = T0 + 180 * MIN): SessionRateLimit {
  return { kind: 'five_hour', percentUsed: pct, resetsAt: new Date(resetsAt).toISOString() }
}

export function measure(rateLimits: SessionRateLimit[]) {
  return { context: { window: 200_000 }, rateLimits, changed: ['rateLimits'] as UsageUnit[] }
}

/** A turn's end; with agentId it is a subagent's. With model it carries usage (check ModelUsage in T if tsc objects). */
export function turnEnd(agentId?: string, model?: string): TurnCompleteInput {
  return {
    answer: 'done',
    durationMs: 1000,
    isAborted: false,
    turnId: `turn-${agentId ?? 'main'}`,
    reason: 'answer',
    ...(agentId === undefined ? {} : { agentId }),
    ...(model === undefined
      ? {}
      : {
          usage: {
            model,
            input_tokens: 1,
            output_tokens: 1,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        }),
  } as TurnCompleteInput
}

export function command(name: string) {
  return {
    command: name,
    args: '',
    origin: { kind: 'composer' as const },
    presentation: { isFullscreen: false, columns: 120 },
  }
}

/**
 * Inline plugins that spawn from their own session.start hook, so the spawn's next.origin is the
 * plugin. Raise $.session.start(START) once per spawn. The kit raises these spawns in the Agent
 * tool's input shape, which the mod reads through viewOf; a live session's shape is a
 * residual to check against a live session.
 */
export const SPAWNER_BARE: Plugin = {
  name: 'spawner-bare',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.agent.spawn({ prompt: 'review the diff', description: 'review', subagentType: 'general-purpose' })
      return next(e)
    })
  },
}

export const SPAWNER_OPUS: Plugin = {
  name: 'spawner-opus',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.agent.spawn({ prompt: 'review the plan', description: 'review', subagentType: 'general-purpose', model: 'opus' })
      return next(e)
    })
  },
}
