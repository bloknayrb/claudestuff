import type { On, RenderSurface, RenderViewport, ToolCallResult, TurnStepResult } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

import { APPEND_MARK } from '../hooks/row'

export const SURFACES = ['terminal', 'desktop'] as const

export const WAKE = '<bridge-wake/>'

// fs.* hooks see native Windows paths (backslashes) whatever the plugin wrote.
export function norm(path: string): string {
  return path.replace(/\\/g, '/')
}

export const SAMPLE = {
  question: 'Which database?',
  context: '**Postgres** has the extension we need; SQLite is simpler to host.',
  options: [{ label: 'Postgres', detail: 'Has pgvector' }, { label: 'SQLite' }],
  recommend: 0,
  why: 'pgvector does the search for us.',
  why_yours: 'It changes the hosting bill, which is your budget.',
}

export const PANE_PROPS = {
  title: 'Bridge',
  isFocused: true,
  bodyColumns: 80,
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
export const NARROW = { columns: 120, rows: 50, isFullscreen: true }
export const MAIN_SCREEN = { columns: 160, rows: 50, isFullscreen: false }

export type World = {
  clock: MockClock
  sessionId: string
  placed: boolean
  // false: the pane is placed but sits as a background tab behind another plugin's pane.
  isShown: boolean
  dropWakes: boolean
  dropTyped: boolean
  // >0: each turn.step stub sleeps this long on the mock clock, so a test can press mid-step.
  stepHoldMs: number
  // >0: each prompt.submit stub sleeps this long on the mock clock before answering (see above).
  submitHoldMs: number
  // The visible text each next main step returns (TurnStepResult.answer), in order; '' when empty.
  stepAnswers: string[]
  // Rows the plugin appended, read from its append seam's debug lines (the kit serves no plugin append).
  appends: string[]
  prompts: { text: string; origin: string; context: readonly string[] }[]
  opens: { id: string; focus?: true }[]
  closes: string[]
  // The engine's record of this plugin's open panes, as $.ui.panes() answers it.
  openPanes: Set<string>
  paneQueries: number
  // Set: the ui.open stub refuses with this text (another plugin's hook refusing the open).
  openRefusal: string | null
  toasts: string[]
  writes: { path: string; text: string }[]
  commands: string[]
  tools: string[]
}

type WorldOptions = { placed?: boolean; env?: Record<string, string> }

export function world(on: On, options: WorldOptions = {}): World {
  const w: World = {
    clock: mock.clock(on, { now: 1000 }),
    sessionId: 'sess-1',
    placed: options.placed ?? true,
    isShown: true,
    dropWakes: false,
    dropTyped: false,
    stepHoldMs: 0,
    submitHoldMs: 0,
    stepAnswers: [],
    appends: [],
    prompts: [],
    opens: [],
    closes: [],
    openPanes: new Set<string>(),
    paneQueries: 0,
    openRefusal: null,
    toasts: [],
    writes: [],
    commands: [],
    tools: [],
  }
  mock.env(on, options.env ?? { USERPROFILE: 'C:\\Users\\tester' })
  on('session.id', () => ({ value: w.sessionId }))
  on('tool.register', (_$, e) => {
    w.tools.push(e.name)
    return { value: { tool: `mcp__bridge__${e.name}` } }
  })
  on('command.register', (_$, e) => {
    w.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('fs.write', (_$, e) => {
    w.writes.push({ path: e.path, text: e.text })
    return { value: undefined }
  })
  on('ui.log', (_$, e) => {
    if (e.to === 'debug' && e.text.startsWith(APPEND_MARK)) w.appends.push(e.text.slice(APPEND_MARK.length))
    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', (_$, e) => {
    // An op hook may answer { deny }, which rejects the caller's promise.
    if (w.openRefusal !== null) return { deny: w.openRefusal }
    w.opens.push({ id: e.id, ...(e.focus ? { focus: true as const } : {}) })
    w.openPanes.add(e.id)
    return { value: w.placed ? { isPlaced: true as const } : { isPlaced: false as const, reason: 'narrow terminal' } }
  })
  on('ui.close', (_$, e) => {
    w.closes.push(e.id)
    w.openPanes.delete(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => {
    w.paneQueries += 1
    const panes = [...w.openPanes].map(id => ({ id, title: 'Bridge', isShown: w.isShown, isFocused: false, isPlaced: w.placed }))
    return { value: panes }
  })
  // The kit cannot observe $.ui.focus (it rejects a plugin's call, and runs no test hook for it), so the
  // focus move into the Other field is checked in a live session.
  // No session.append stub: the kit never runs a test hook for a plugin's own append. The
  // plugin's append seam treats the kit's refusal as appended and logs the row under APPEND_MARK.
  on('prompt.submit', async (_$, e) => {
    // Holding the submit open models the engine's order: next() resolves only once the prompt's turn
    // has started, so a test can raise turn.start while the plugin's hook is still waiting on it.
    if (w.submitHoldMs > 0) await w.clock.sleep(w.submitHoldMs)
    if (e.origin.kind === 'plugin' && w.dropWakes) return { drop: 'wake refused in test' }
    if (e.origin.kind !== 'plugin' && w.dropTyped) return { drop: 'prompt refused in test' }
    w.prompts.push({ text: e.text, origin: e.origin.kind, context: e.context ?? [] })
    return { text: e.text, context: e.context, origin: e.origin }
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('turn.step', async function* (_$, e) {
    // Holding the step open on the mock clock lets a test press while the model request is in flight
    // (a press can land while a model request is in flight).
    if (w.stepHoldMs > 0) await w.clock.sleep(w.stepHoldMs)
    const result: TurnStepResult = {
      turnId: e.turnId,
      index: e.index,
      answer: e.agentId === undefined ? (w.stepAnswers.shift() ?? '') : '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: null,
    }
    return result
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine-band" />
  })
  return w
}

export async function start($: Engine): Promise<void> {
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
}

export async function decide($: Engine, input: Record<string, unknown> = SAMPLE): Promise<ToolCallResult> {
  const call = $.tool.call as unknown as (input: Record<string, unknown>) => Promise<ToolCallResult>
  return call({ tool: 'mcp__bridge__decide', ...input })
}

export async function step($: Engine, turnId: string, agentId?: string): Promise<void> {
  const stream = $.turn.step({
    turnId,
    index: 0,
    model: 'claude-opus-5-5',
    messageCount: 1,
    ...(agentId === undefined ? {} : { agentId }),
  })
  for await (const _chunk of stream) {
    // drain: the stub yields nothing
  }
}

export async function endTurn(
  $: Engine,
  w: World,
  turnId: string,
  reason: 'answer' | 'aborted' | 'refusal' | 'error' = 'answer',
  answer = 'Done.',
  agentId?: string,
): Promise<void> {
  await $.turn.complete({
    answer,
    durationMs: 1,
    isAborted: reason === 'aborted',
    turnId,
    reason,
    ...(agentId === undefined ? {} : { agentId }),
  } as Parameters<Engine['turn']['complete']>[0])
  // turn.complete starts the wake unawaited; let it settle before the test looks.
  await w.clock.settle()
}

// One main turn with one step whose visible text is `answer` (so the turn's text is `answer`).
export async function runTurn($: Engine, w: World, turnId: string, answer = 'Done.'): Promise<void> {
  await $.turn.start({ text: 'x', turnId })
  w.stepAnswers.push(answer)
  await step($, turnId)
  await endTurn($, w, turnId, 'answer', answer)
}

export function wakes(w: World): number {
  return w.prompts.filter(p => p.text === WAKE).length
}

// Generic in the surface, so a terminal or desktop mount keeps `input` (a union with mobile drops it).
export async function mountPane<S extends RenderSurface>($: Engine, surface: S) {
  return $.ui.mount({ plugin: 'bridge', surface, component: 'Pane', requestId: 'bridge', props: PANE_PROPS, viewport: WIDE })
}

// A press, then let what it started run: a wake sent from a timer callback has then happened, and with
// a direct submit this changes nothing.
export async function press(ui: { press: (args: { key: string }) => Promise<unknown> }, w: World, key: string): Promise<void> {
  await ui.press({ key })
  await w.clock.settle()
}

export async function mountBand($: Engine, surface: 'terminal' | 'desktop', viewport: RenderViewport = WIDE, props = BAND_PROPS) {
  return $.ui.mount({ plugin: 'bridge', surface, component: 'AbovePrompt', props, viewport })
}

// The pending decisions as the pane draws them (card-<id> Boxes): an observable read of the book. One
// surface is enough here: it reads state, and the drawing per surface is checked in surface.test.tsx.
export async function pendingIds($: Engine): Promise<number[]> {
  const ui = await mountPane($, 'terminal')
  const ids = (await ui.findAll({ type: 'Box' }))
    .map(box => box.key ?? '')
    .filter(key => key.startsWith('card-'))
    .map(key => Number(key.slice('card-'.length)))
  await ui.unmount()
  return ids
}

export async function openWithCommand($: Engine) {
  return $.command.run({
    command: 'bridge',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })
}
