import type { On, SessionMessage } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

export const SURFACES = ['terminal', 'desktop'] as const

export const PANE_PROPS = {
  title: 'Docket',
  isFocused: true,
  bodyColumns: 56,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}


export const BAND_PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 6,
  bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 6 },
  view: {},
}

export const WIDE = { columns: 160, rows: 50, isFullscreen: true }

const USAGE = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

// What the next model call answers: a JSON verdict, or a failure arm.
export type Reply = { text: string } | { fail: 'api-error' | 'empty-reply' } | { hold: true; text: string }

export type World = {
  clock: MockClock
  sessionId: string
  messages: SessionMessage[]
  replies: Reply[]
  calls: { model: string; prompt: string }[]
  opens: { id: string; focus?: true }[]
  closes: string[]
  openPanes: Set<string>
  toasts: string[]
  logs: string[]
  writes: { path: string; text: string }[]
  commands: string[]
  // Set: the next model call waits for this to be resolved (a check in flight).
  gate: Promise<void> | null
  // The plugin's status line as last set ($.ui.status); undefined when cleared.
  status: string | undefined
  // An in-memory disk: path -> text and the mtime it was written at (fileClock).
  files: Map<string, { text: string; mtimeMs: number }>
  fileClock: number
  failWrites: boolean
  reads: number
  root: string
  // Folder path -> where fs.stat says it really resolves (a junction).
  links: Map<string, string>
  // Set: an fs.list of a path containing `match` waits for `gate` (a slow claim listing).
  listGate: { match: string; gate: Promise<void> } | null
  // Set: an fs.write of a path containing this fails (a guard on one folder).
  failWriteMatch: string | null
  // Every folder fs.list was asked for, in order.
  lists: string[]
  // Set: every fs.write waits for this (a slow disk).
  writeGate: Promise<void> | null
}

export const BASE = 'C:/Users/tester/.claude/state/mods/docket'
export const slotPath = (sid: string, slot: 'a' | 'b') => `${BASE}/sessions/${sid}.${slot}.json`

export function world(on: On): World {
  const w: World = {
    clock: mock.clock(on, { now: 1000 }),
    sessionId: 'sess-1',
    messages: [],
    replies: [],
    calls: [],
    opens: [],
    closes: [],
    openPanes: new Set<string>(),
    toasts: [],
    logs: [],
    writes: [],
    commands: [],
    gate: null,
    status: undefined,
    files: new Map(),
    fileClock: 1000,
    failWrites: false,
    reads: 0,
    root: 'C:/work',
    links: new Map(),
    listGate: null,
    failWriteMatch: null,
    lists: [],
    writeGate: null,
  }
  mock.env(on, { USERPROFILE: 'C:\\Users\\tester' })
  on('session.id', () => ({ value: w.sessionId }))
  on('session.messages', () => ({ value: w.messages }))
  on('command.register', (_$, e) => {
    w.commands.push(e.name)
    return { value: { command: e.name } }
  })
  // The engine hands fs hooks the path in the platform's form; the fake disk keys on forward slashes.
  const norm = (p: string) => p.replace(/\\/g, '/')
  on('fs.write', async (_$, e) => {
    if (w.failWrites) throw new Error('blocked by a guard')
    if (w.failWriteMatch !== null && norm(e.path).includes(w.failWriteMatch)) throw new Error('blocked by a guard')
    if (w.writeGate !== null) await w.writeGate
    w.writes.push({ path: norm(e.path), text: e.text })
    w.files.set(norm(e.path), { text: e.text, mtimeMs: w.fileClock })
    return { value: undefined }
  })
  on('fs.read', (_$, e) => {
    w.reads += 1
    const f = w.files.get(norm(e.path))
    if (f === undefined) throw new Error(`no file ${e.path}`)
    return { value: f.text }
  })
  on('classic.SessionStart', () => ({}))
  on('fs.list', async (_$, e) => {
    const dir = `${norm(e.path ?? '').replace(/\/+$/, '')}/`
    w.lists.push(dir)
    if (w.listGate !== null && dir.includes(w.listGate.match)) await w.listGate.gate
    const value = [...w.files.entries()]
      .filter(([p]) => p.startsWith(dir) && !p.slice(dir.length).includes('/'))
      .map(([p, f]) => ({ name: p.slice(dir.length), kind: 'file' as const, size: f.text.length, mtimeMs: f.mtimeMs, isLink: false }))
    return { value }
  })
  // A folder exists when some file sits under it; it resolves to itself (no links on the fake disk).
  const isDir = (p: string) => [...w.files.keys()].some(k => k.startsWith(`${norm(p).replace(/\/+$/, '')}/`))
  on('fs.stat', (_$, e) => {
    const p = norm(e.path)
    // A planted junction: the folder resolves somewhere else.
    const link = w.links.get(p)
    if (link !== undefined) return { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false, realPath: link } }
    const f = w.files.get(p)
    if (f !== undefined) return { value: { kind: 'file' as const, size: f.text.length, mtimeMs: f.mtimeMs, isLink: false, realPath: p } }
    if (isDir(p)) return { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false, realPath: p } }
    throw new Error(`no such path ${e.path}`)
  })
  on('fs.exists', (_$, e) => ({ value: w.files.has(norm(e.path)) || isDir(e.path) }))
  on('session.root', () => ({ value: w.root }))
  on('ui.log', (_$, e) => {
    w.logs.push(`${e.to ?? 'transcript'}: ${e.text}`)
    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', (_$, e) => {
    w.status = e.text
    return { value: undefined }
  })
  on('ui.open', (_$, e) => {
    w.opens.push({ id: e.id, ...(e.focus ? { focus: true as const } : {}) })
    w.openPanes.add(e.id)
    return { value: { isPlaced: true as const } }
  })
  on('ui.close', (_$, e) => {
    w.closes.push(e.id)
    w.openPanes.delete(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: [...w.openPanes].map(id => ({ id, title: 'Docket', isShown: true, isFocused: false, isPlaced: true })) }))
  on('model.complete', async (_$, e) => {
    w.calls.push({ model: e.model, prompt: e.prompt })
    if (w.gate !== null) await w.gate
    const r = w.replies.shift() ?? { text: '{"add":[],"resolve":[]}' }
    if ('fail' in r) {
      const value = r.fail === 'api-error'
        ? { isAnswered: false as const, reason: 'api-error' as const, status: 529, error: 'overloaded' as never, usage: USAGE }
        : { isAnswered: false as const, reason: 'empty-reply' as const, usage: USAGE }
      return { value }
    }
    return { value: { isAnswered: true as const, text: r.text, usage: USAGE } }
  })
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context, origin: e.origin }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('command.run', (_$, e) => ({ text: `unhandled ${e.command}` }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="engine-band">beneath</Text>
  })
  return w
}

export async function start($: Engine, isInteractive = true): Promise<void> {
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive })
}

// The settings hook's session start, as the engine fires it (before session.start for a fresh process).
export async function classic($: Engine, w: World, source: 'startup' | 'resume' | 'clear' | 'compact' | 'fork', sessionId: string): Promise<void> {
  const fire = ($ as unknown as { classic: { SessionStart: (e: unknown) => Promise<unknown> } }).classic.SessionStart
  await fire({ hook_event_name: 'SessionStart', source, session_id: sessionId, transcript_path: '', cwd: w.root })
  await w.clock.settle()
}

// A fresh interactive process landing on w.sessionId: classic startup first, then session.start (probe g).
export async function freshProcess($: Engine, w: World, isInteractive = true): Promise<void> {
  await classic($, w, 'startup', w.sessionId)
  await start($, isInteractive)
  await w.clock.settle()
}

type Origin = 'composer' | 'channel' | 'plugin' | 'bridge'

export async function say($: Engine, w: World, text: string, origin: Origin = 'composer', turnId?: string): Promise<void> {
  const o = origin === 'plugin' ? { kind: 'plugin', name: 'other' } : origin === 'channel' ? { kind: 'channel', server: 'discord' } : { kind: origin }
  const submit = $.prompt.submit as unknown as (e: Record<string, unknown>) => Promise<unknown>
  await submit({ text, origin: o, queueSubmit: false, ...(turnId === undefined ? {} : { turnId }) })
  w.messages.push({ role: 'user', text, toolUses: [] })
  await w.clock.settle()
}

// One main turn: Claude's texts (and tool uses) land in the transcript, then the turn ends.
export async function turn(
  $: Engine,
  w: World,
  turnId: string,
  texts: string[],
  opts: { tools?: SessionMessage['toolUses']; reason?: 'answer' | 'aborted' | 'error' } = {},
): Promise<void> {
  await $.turn.start({ text: 'x', turnId } as Parameters<Engine['turn']['start']>[0])
  for (const text of texts) w.messages.push({ role: 'assistant', text, toolUses: [] })
  if (opts.tools !== undefined) w.messages.push({ role: 'assistant', text: '', toolUses: opts.tools })
  const reason = opts.reason ?? 'answer'
  await $.turn.complete({
    answer: texts.at(-1) ?? '',
    durationMs: 1,
    isAborted: reason === 'aborted',
    turnId,
    reason,
  } as Parameters<Engine['turn']['complete']>[0])
  await w.clock.settle()
}

export function verdict(v: { add?: unknown[]; resolve?: unknown[] }): Reply {
  return { text: JSON.stringify({ add: v.add ?? [], resolve: v.resolve ?? [] }) }
}

export async function mountPane($: Engine, surface: 'terminal' | 'desktop' | 'mobile', isFocused = true) {
  return $.ui.mount({ plugin: 'docket', surface, component: 'Pane', requestId: 'docket', props: { ...PANE_PROPS, isFocused }, viewport: WIDE })
}


export async function mountBand($: Engine, surface: 'terminal' | 'desktop', props = BAND_PROPS) {
  return $.ui.mount({ plugin: 'docket', surface, component: 'AbovePrompt', props, viewport: WIDE })
}

// Open item ids, as the pane draws them (item-<id> Boxes).
export async function openIds($: Engine): Promise<number[]> {
  const ui = await mountPane($, 'terminal')
  const ids = (await ui.findAll({ type: 'Box' }))
    .map(b => b.key ?? '')
    .filter(k => k.startsWith('item-'))
    .map(k => Number(k.slice('item-'.length)))
  await ui.unmount()
  return ids
}

export async function command($: Engine, args = '') {
  return $.command.run({ command: 'docket', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
}
