import { expect, test } from 'claude-code/testing'

import { BAND_PROPS, command, mountBand, mountPane, openIds, say, slotPath, start, SURFACES, turn, verdict, world } from './world'

const ASK = 'Your call: SQLite or Postgres for the cache?'
const ADD_ASK = verdict({ add: [{ kind: 'decide', text: 'Choose SQLite or Postgres for the cache', quote: ASK, singleRec: false }] })

test('an ask in Claude prose becomes an item; a reply naming it closes it at submit time', async ($, on) => {
  const w = world(on)
  await start($)
  w.replies.push(ADD_ASK)
  await turn($, w, 't1', [ASK])
  expect(await openIds($)).toEqual([1])
  w.replies.push(verdict({ resolve: [{ id: 1, by: 'you', note: 'SQLite', evidence: 'use sqlite' }] }))
  await say($, w, 'use sqlite')
  expect(await openIds($)).toEqual([])
  // The submit check sent the user's text, not Claude's.
  const last = w.calls.at(-1)?.prompt ?? ''
  expect(last.includes('<user_text>\nuse sqlite')).toBe(true)
  expect(last.includes('<claude_text>')).toBe(false)
})

test('a mid-turn ask between tool calls is seen; the AskUserQuestion question is listed as tool-asked', async ($, on) => {
  const w = world(on)
  await start($)
  await turn($, w, 't1', ['Before I go on: should I delete the old branch?', 'Done with the refactor.'], {
    tools: [{ tool_use_id: 'u1', tool: 'AskUserQuestion', input: { questions: [{ question: 'Which theme?' }] } }, { tool_use_id: 'u2', tool: 'Bash', input: { command: 'git status' } }],
  })
  const p = w.calls[0]?.prompt ?? ''
  expect(p.includes('should I delete the old branch?')).toBe(true)
  expect(p.includes('<tool_asked>\nWhich theme?')).toBe(true)
  expect(p.includes('Bash: git status')).toBe(true)
  expect(p.includes('AskUserQuestion:')).toBe(false)
})

test('a channel prompt never closes an item; the same words from the composer do', async ($, on) => {
  const w = world(on)
  await start($)
  w.replies.push(ADD_ASK)
  await turn($, w, 't1', [ASK])
  const close = verdict({ resolve: [{ id: 1, by: 'you', note: 'SQLite', evidence: 'use sqlite' }] })
  w.replies.push(close)
  await say($, w, 'use sqlite', 'channel')
  await say($, w, 'use sqlite', 'plugin')
  expect(await openIds($)).toEqual([1])
  // No check ran for them: their words were never captured.
  expect(w.calls.length).toBe(1)
  await say($, w, 'use sqlite', 'composer')
  expect(await openIds($)).toEqual([])
})

for (const isCleared of [true, false]) {
  test(`a verdict in flight across /clear: ${isCleared ? 'thrown away' : 'applies with no clear'}`, async ($, on) => {
    const w = world(on)
    await start($)
    let release: () => void = () => {}
    w.gate = new Promise<void>(r => { release = r })
    w.replies.push(ADD_ASK)
    const ending = turn($, w, 't1', [ASK])
    await w.clock.settle()
    if (isCleared) {
      await $.session.end({ reason: 'clear', sessionId: 'sess-1' } as Parameters<typeof $.session.end>[0])
      w.sessionId = 'sess-2'
    }
    release()
    w.gate = null
    await ending
    await w.clock.settle()
    expect((await openIds($)).length).toBe(isCleared ? 0 : 1)
  })
}

// v0.2: /clear no longer drops the docket with a notice. It is saved, and /resume brings it back.
test('/clear saves the old docket and starts empty; no "dropped" notice', async ($, on) => {
  const w = world(on)
  await start($)
  w.replies.push(ADD_ASK)
  await turn($, w, 't1', [ASK])
  await $.session.end({ reason: 'clear', sessionId: 'sess-1' } as Parameters<typeof $.session.end>[0])
  w.sessionId = 'sess-2'
  await say($, w, 'hello again')
  expect(w.logs.some(l => l.includes('Docket: dropped'))).toBe(false)
  expect(await openIds($)).toEqual([])
  expect(w.files.has(slotPath('sess-1', 'a')) || w.files.has(slotPath('sess-1', 'b'))).toBe(true)
})

test('a full check due during a resolve check runs after it, never mid-turn', async ($, on) => {
  const w = world(on)
  await start($)
  w.replies.push(ADD_ASK)
  await turn($, w, 't1', [ASK])
  let release: () => void = () => {}
  w.gate = new Promise<void>(r => { release = r })
  await say($, w, 'thinking about it', 'composer')
  // Resolve check in flight; a turn ends meanwhile.
  const ending = turn($, w, 't2', ['Still waiting on the cache choice.'])
  await w.clock.settle()
  expect(w.calls.length).toBe(2)
  release()
  w.gate = null
  await ending
  await w.clock.settle()
  expect(w.calls.length).toBe(3)
  expect(w.calls[1]?.prompt.includes('resolve-only')).toBe(true)
  expect(w.calls[2]?.prompt.includes('Still waiting on the cache choice.')).toBe(true)
})

test('an answer carried in the same check as its ask still closes it (a resolve check follows)', async ($, on) => {
  const w = world(on)
  await start($)
  // The check after t1 fails; the user answers; the retry after t2 adds the ask from t1 and sees the
  // answer, which it cannot resolve in the verdict that adds the item.
  w.replies.push({ fail: 'api-error' })
  await turn($, w, 't1', [ASK])
  await say($, w, 'use sqlite')
  w.replies.push(ADD_ASK, verdict({ resolve: [{ id: 1, by: 'you', note: 'SQLite', evidence: 'use sqlite' }] }))
  await turn($, w, 't2', ['Noted.'])
  expect(w.calls.at(-1)?.prompt.includes('resolve-only')).toBe(true)
  expect(await openIds($)).toEqual([])
})

test('an aborted turn is not judged; its text rides with the next check', async ($, on) => {
  const w = world(on)
  await start($)
  await turn($, w, 't1', ['Should I rotate the key?'], { reason: 'aborted' })
  expect(w.calls.length).toBe(0)
  await turn($, w, 't2', ['Next part done.'])
  expect(w.calls[0]?.prompt.includes('Should I rotate the key?')).toBe(true)
})

test('failures: api-error and non-JSON mark the band; the first of a streak toasts once', async ($, on) => {
  const w = world(on)
  await start($)
  w.replies.push({ fail: 'api-error' }, { text: 'no json here' })
  await turn($, w, 't1', [ASK])
  await turn($, w, 't2', [ASK])
  expect(w.toasts.length).toBe(1)
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)
    expect((await ui.find({ key: 'docket-indicator' }))?.props.label).toBe('◇ Docket · last check failed · click to show')
    await ui.unmount()
  }
  w.replies.push(ADD_ASK)
  await turn($, w, 't3', [ASK])
  const ui = await mountBand($, 'terminal')
  expect((await ui.find({ key: 'docket-indicator' }))?.props.label).toBe('◇ 1 for you to decide or do · click to show')
  await ui.unmount()
})

test('the configured model is the one asked', async ($, on) => {
  const w = world(on)
  await start($)
  await turn($, w, 't1', [ASK])
  expect(w.calls[0]?.model).toBe('haiku')
})

test('config: sonnet', { options: { model: 'sonnet' } }, async ($, on) => {
  const w = world(on)
  await start($)
  await turn($, w, 't1', [ASK])
  expect(w.calls[0]?.model).toBe('sonnet')
})

test('a digit dismisses its row; the keys pause after a change; Reopen brings it back', async ($, on) => {
  const w = world(on)
  await start($)
  w.replies.push(verdict({ add: [
    { kind: 'decide', text: 'Choose the cache', quote: ASK },
    { kind: 'do', text: 'Run gh auth login', quote: 'run gh auth login' },
  ] }))
  await turn($, w, 't1', [`${ASK} Also, run gh auth login when you can.`])
  for (const surface of SURFACES) {
    const ui = await mountPane($, surface)
    expect((await ui.find({ key: 'dismiss-1' }))?.props.hotkey).toBe('1')
    expect((await ui.find({ key: 'dismiss-2' }))?.props.hotkey).toBe('2')
    await ui.unmount()
  }
  // The verdict just changed the list: a press now only restarts the pause.
  const ids = async (ui: Awaited<ReturnType<typeof mountPane>>) =>
    (await ui.findAll({ type: 'Box' })).map(b => b.key ?? '').filter(k => k.startsWith('item-')).map(k => Number(k.slice(5)))
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'dismiss-1' })
  expect(await ids(ui)).toEqual([1, 2])
  await w.clock.advance(1200)
  await ui.press({ key: 'dismiss-1' })
  expect(await ids(ui)).toEqual([2])
  await w.clock.advance(1200)
  await ui.press({ key: 'docket-show-closed' })
  const reopenBtn = (await ui.findAll({ type: 'Button' })).find(b => (b.key ?? '').startsWith('reopen-'))
  expect(reopenBtn).toBeDefined()
  await ui.press({ key: reopenBtn?.key ?? '' })
  expect(await ids(ui)).toEqual([1, 2])
  await ui.unmount()
})

test('decisions are listed before actions, and the digit keys follow that order', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  w.replies.push(verdict({ add: [{ kind: 'decide', text: 'Choose the cache', quote: ASK }] }))
  await turn($, w, 't1', [ASK])
  for (const surface of SURFACES) {
    const ui = await mountPane($, surface)
    // Item 2 (a decision) comes first though it is newer; item 1 (a do) is second.
    expect((await ui.find({ key: 'dismiss-2' }))?.props.hotkey).toBe('1')
    expect((await ui.find({ key: 'dismiss-1' }))?.props.hotkey).toBe('2')
    expect(await ui.find({ type: 'Text', text: 'Decide' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Do' })).toBeDefined()
    await ui.unmount()
  }
})

test('Reply puts "Re: <item>" in the prompt box, after any draft', async ($, on) => {
  const w = world(on)
  const fills: { text: string; mode?: string }[] = []
  let draft = ''
  on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } as never }))
  on('prompt.fill', (_$, e) => {
    fills.push({ text: e.text, ...(e.mode === undefined ? {} : { mode: e.mode }) })
    return { isFilled: true, cursor: 0 } as never
  })
  await start($)
  await command($, 'add Renew the domain')
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'reply-1' })
  draft = 'something typed'
  await ui.press({ key: 'reply-1' })
  await ui.unmount()
  expect(fills[0]?.text).toBe('Re: Renew the domain — ')
  expect(fills[0]?.mode === undefined || fills[0]?.mode === 'replace').toBe(true)
  expect(fills[1]?.mode).toBe('append')
  expect(fills[1]?.text.endsWith('Re: Renew the domain — ')).toBe(true)
  // Reply closes nothing by itself.
  expect(await openIds($)).toEqual([1])
  expect(w.calls.length).toBe(0)
})

test('Done closes an item as yours; the closed list says so', async ($, on) => {
  const w = world(on)
  await start($)
  await command($, 'add Renew the domain')
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'done-1' })
  expect(await ui.find({ key: 'item-1' })).toBeUndefined()
  await ui.press({ key: 'docket-show-closed' })
  expect(await ui.find({ type: 'Text', text: 'Renew the domain — you: marked done' })).toBeDefined()
  await ui.unmount()
  expect(w.calls.length).toBe(0)
})

test("Claude's quote shows only on the item whose button holds the focus ring", async ($, on) => {
  const w = world(on)
  on('ui.focus', () => ({}) as never)
  await start($)
  w.replies.push(verdict({ add: [
    { kind: 'decide', text: 'Choose the cache', quote: ASK },
    { kind: 'do', text: 'Run gh auth login', quote: 'run gh auth login' },
  ] }))
  await turn($, w, 't1', [`${ASK} Also, run gh auth login when you can.`])
  const ui = await mountPane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /Claude: "/ })).toBeUndefined()
  const focus = $.ui.focus as unknown as (e: Record<string, unknown>) => Promise<unknown>
  await focus({ component: 'Pane', requestId: 'docket', plugin: 'docket', element: 'done-2', origin: { kind: 'person' } })
  await ui.unmount()
  const again = await mountPane($, 'terminal')
  // A Text's key is not kept on the drawing, so the quote is found by its words.
  expect(await again.find({ type: 'Text', text: /Claude: "Your call/ })).toBeUndefined()
  expect(await again.find({ type: 'Text', text: /Claude: "run gh auth login"/ })).toBeDefined()
  await again.unmount()
})

test('/docket toggles the pane; add and clear work; clear is one Reopen all', async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.opens.length).toBe(0)
  await command($)
  expect(w.opens.at(-1)).toEqual({ id: 'docket', focus: true })
  await command($)
  expect(w.closes.at(-1)).toBe('docket')
  await command($, 'add Renew the domain')
  await command($, 'add Book the dentist')
  expect(await openIds($)).toEqual([1, 2])
  await command($, 'clear')
  expect(await openIds($)).toEqual([])
  const ui = await mountPane($, 'terminal')
  expect((await ui.find({ key: 'docket-show-closed' }))?.props.label).toBe('1 closed · show')
  await ui.press({ key: 'docket-show-closed' })
  const btn = (await ui.findAll({ type: 'Button' })).find(b => b.props.label === 'Reopen all (2)')
  expect(btn).toBeDefined()
  await ui.press({ key: btn?.key ?? '' })
  await ui.unmount()
  expect(await openIds($)).toEqual([1, 2])
})

test('the band button shows the count over what draws beneath, and a click toggles the pane', async ($, on) => {
  const w = world(on)
  await start($)
  let ui = await mountBand($, 'terminal')
  expect(await ui.find({ key: 'docket-indicator' })).toBeUndefined()
  await ui.unmount()
  await command($, 'add Renew the domain')
  for (const surface of SURFACES) {
    ui = await mountBand($, surface)
    expect((await ui.find({ key: 'docket-indicator' }))?.props.label).toBe('◇ 1 for you to decide or do · click to show')
    expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: '◇ 1 for you to decide or do · click to show' }))?.props.color).toBe('warning')
    await ui.unmount()
  }
  ui = await mountBand($, 'terminal')
  await ui.press({ key: 'docket-indicator' })
  expect(w.openPanes.has('docket')).toBe(true)
  expect((await ui.find({ key: 'docket-indicator' }))?.props.label).toBe('◇ 1 for you to decide or do · click to hide')
  await ui.press({ key: 'docket-indicator' })
  expect(w.openPanes.has('docket')).toBe(false)
  await ui.unmount()
  ui = await mountBand($, 'terminal', { ...BAND_PROPS, hasSurvey: true })
  expect(await ui.find({ key: 'docket-indicator' })).toBeUndefined()
  await ui.unmount()
  await command($, 'clear')
  ui = await mountBand($, 'terminal')
  expect(await ui.find({ key: 'docket-indicator' })).toBeUndefined()
  await ui.unmount()
})

test('an empty pane says so; the heartbeat holds counts, not item text', async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await mountPane($, 'desktop')
  expect(await ui.find({ type: 'Text', text: 'Nothing waiting on you.' })).toBeDefined()
  await ui.unmount()
  await command($, 'add Secret plan text')
  await turn($, w, 't1', ['ok'])
  const beats = w.writes.filter(x => /\/\.claude\/state\/mods\/docket\/[^/]+\.json$/.test(x.path.replace(/\\/g, '/')))
  expect(beats.length > 0).toBe(true)
  expect(beats.some(b => b.text.includes('Secret plan'))).toBe(false)
})
