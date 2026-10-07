import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { hhmm } from '../hooks/evidence'
import { bash, complete, edit, FAILED, HEALTH, healthOf, OK, pwsh, runCommand, SESSION, step, TRAIL, worldOf } from './fixtures/world'
import type { World } from './fixtures/world'

const MIN = 60_000
const CODE = 'C:/work/src/app.ts'

async function boot($: Engine, on: On, now = 10 * MIN) {
  const world = worldOf(on)
  const clock = mock.clock(on, { now })
  world.sleep = ms => clock.sleep(ms)
  mock.store(on)
  await $.session.start(SESSION)
  return { world, clock }
}

type TrailEvent = Record<string, unknown> & { ev: string }

/** The trail as last written: the seam for what the kit cannot observe. */
function trailOf(world: World): TrailEvent[] {
  const last = [...world.writes].reverse().find(w => w.path === TRAIL)
  return (last?.text ?? '').split('\n').filter(l => l.trim() !== '').map(l => JSON.parse(l) as TrailEvent)
}
const appends = (world: World) => trailOf(world).filter(e => e.ev === 'append')
const lastHealth = (world: World) =>
  JSON.parse([...world.writes].reverse().find(w => w.path === HEALTH)?.text ?? '{}') as { lastError: { message: string } | null }

describe('the done-when cases', () => {
  test('a "tests pass" answer after an edit with no run gets the line beneath it', async ($, on) => {
    const { clock } = await boot($, on)
    const editedAt = clock.now()
    await $.tool.call(edit(CODE))
    await clock.advance(MIN)

    expect((await complete($, 'Done. All tests pass.')).text).toBe(`Claim Ledger: "All tests pass" has no test run after the last edit (${hhmm(editedAt)}).`)
  })

  test('the same claim after a real foreground test run gets no line', async ($, on) => {
    await boot($, on)
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('uv run pytest -q'))

    expect((await complete($, 'Done. All tests pass.')).text).toBe('Done. All tests pass.')
  })
})

describe('evidence', () => {
  test('evidence before the last code edit does not count; a .md edit after it does not void it', async ($, on) => {
    await boot($, on)
    await $.tool.call(bash('pytest'))
    await $.tool.call(edit(CODE))
    expect((await complete($, 'Tests pass.', { turnId: 't1' })).text).toContain('has no test run after the last edit')

    await $.tool.call(bash('pytest'))
    await $.tool.call(edit('C:/work/README.md'))
    expect((await complete($, 'The tests are green.', { turnId: 't2' })).text).toBe('The tests are green.')
  })

  test("a PowerShell runner and a subagent's run both count", async ($, on) => {
    await boot($, on)
    await $.tool.call(edit(CODE))
    await $.tool.call(pwsh('claude plugin test C:/work'))
    expect((await complete($, 'Tests pass.', { turnId: 't1' })).text).toBe('Tests pass.')

    await $.tool.call(edit(CODE))
    await $.tool.call(bash('npx tsc -p .', { agentId: 'agent-1' }))
    expect((await complete($, 'It builds cleanly.', { turnId: 't2' })).text).toBe('It builds cleanly.')
  })

  test('a background run is no evidence; a masked run with no summary is weak', async ($, on) => {
    const { world } = await boot($, on)
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('pytest', { run_in_background: true }))
    expect((await complete($, 'Tests pass.', { turnId: 't1' })).text).toContain('rests on a background run')

    world.toolResult = () => ({ result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b1', timedOutAfterMs: 120000 }, text: 'moved to background' })
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('npx tsc -p .'))
    expect((await complete($, 'The build passes.', { turnId: 't2' })).text).toContain('rests on a background run')

    world.toolResult = () => OK
    await $.tool.call(bash('pytest | tail -3'))
    expect((await complete($, 'All tests passing.', { turnId: 't3' })).text).toContain('whose exit code is masked')
  })

  test('a piped run whose output shows a pass summary backs the claim; one showing failures is failed', async ($, on) => {
    const { world } = await boot($, on)
    world.toolResult = () => ({ result: { stdout: '12 passed in 0.4s', stderr: '', interrupted: false }, text: '12 passed in 0.4s' })
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('pytest -q 2>&1 | tail -3'))
    expect((await complete($, 'Tests pass.', { turnId: 't1' })).text).toBe('Tests pass.')

    world.toolResult = () => ({ result: { stdout: '1 failed, 11 passed', stderr: '', interrupted: false }, text: '1 failed, 11 passed' })
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('pytest -q 2>&1 | tail -3'))
    expect((await complete($, 'All tests passing.', { turnId: 't2' })).text).toContain('the last test run after the last edit failed')
  })

  test('`; cmd` after the runner masks its exit status', async ($, on) => {
    await boot($, on)
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('npx vitest run > C:/tmp/vt.log 2>&1; grep -n FAIL C:/tmp/vt.log'))
    expect((await complete($, 'Tests pass.')).text).toContain('whose exit code is masked')
  })

  test('shipped claims need the matching op in their turn', async ($, on) => {
    const { world } = await boot($, on)
    expect((await complete($, "I've pushed the branch.", { turnId: 't1' })).text).toBe(`Claim Ledger: "I've pushed" has no git push this turn.`)

    world.toolResult = () => FAILED
    await $.tool.call(bash('git commit -m x'))
    expect((await complete($, 'I committed the fix.', { turnId: 't2' })).text).toContain('the git commit this turn failed')

    world.toolResult = () => OK
    await $.tool.call(bash('gh pr create --fill'))
    expect((await complete($, 'Opened PR #3.', { turnId: 't3' })).text).toBe('Opened PR #3.')
  })

  test('an op in an earlier turn does not back a claim in a later one', async ($, on) => {
    await boot($, on)
    await $.tool.call(bash('git push origin main'))
    await complete($, 'Done.', { turnId: 't1' })

    expect((await complete($, "I've pushed the branch.", { turnId: 't2' })).text).toBe(`Claim Ledger: "I've pushed" has no git push this turn.`)
  })

  test('configured test commands replace the defaults', { options: { testCommands: ['make check'] } }, async ($, on) => {
    await boot($, on)
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('pytest'))
    expect((await complete($, 'Tests pass.', { turnId: 't1' })).text).toContain('has no test run')

    await $.tool.call(bash('make check'))
    expect((await complete($, 'All tests pass.', { turnId: 't2' })).text).toBe('All tests pass.')
  })

  test('a scratch write or a commit-message file does not void a run; an edit in a sibling worktree does', async ($, on) => {
    await boot($, on)
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('pytest'))
    await $.tool.call(edit('C:/Home/tester/tmp/claude/s/scratchpad/fix-pr-body.py'))
    await $.tool.call(edit('C:/work/commit-msg.txt'))
    await $.tool.call(bash('git commit -F commit-msg.txt'))
    expect((await complete($, 'Tests pass.', { turnId: 't1' })).text).toBe('Tests pass.')

    await $.tool.call(edit('C:/work-feature/src/app.ts'))
    expect((await complete($, 'All tests pass.', { turnId: 't2' })).text).toContain('has no test run after the last edit')
  })
})

describe('what is not checked', () => {
  test('negation, quotes, code spans and recaps do not flag', async ($, on) => {
    await boot($, on)
    const answer = "Tests don't pass yet. The log says \"all tests pass\". Run `pytest` until the tests pass. PR #2 was merged last week."
    expect((await complete($, answer)).text).toBe(answer)
  })

  test("quoting the ledger's own line is not a claim", async ($, on) => {
    await boot($, on)
    const answer = 'You flagged this: Claim Ledger: "tests pass" has no test run after the last edit (12:41).'
    expect((await complete($, answer)).text).toBe(answer)
  })

  test('subagent answers are never checked', async ($, on) => {
    const { world } = await boot($, on)
    await $.tool.call(edit(CODE))
    world.steps.push({ answer: 'All tests pass.', tools: 0 })
    await step($, 'sub-1', 0, 'agent-1')
    expect((await complete($, 'All tests pass.', { turnId: 'sub-1', agentId: 'agent-1' })).text).toBe('All tests pass.')

    // A main turn with no claim writes the trail: it holds the edit, and no claim or append from the subagent.
    await complete($, 'Done.', { turnId: 't-main' })
    const trail = trailOf(world)
    expect(trail.some(e => e.ev === 'edit')).toBe(true)
    expect(trail.filter(e => e.ev === 'claim' || e.ev === 'append')).toEqual([])
  })

  test("a subagent's step does not drop the main turn's claims", async ($, on) => {
    const { world } = await boot($, on)
    await $.tool.call(edit(CODE))
    world.steps.push({ answer: 'All tests pass.', tools: 1 }, { answer: 'Sub reply.', tools: 0 }, { answer: 'Done.', tools: 0 })
    await step($, 't1', 0)
    await step($, 'sub-1', 0, 'agent-1')
    await step($, 't1', 1)

    expect((await complete($, 'Done.')).text).toContain('Claim Ledger: "All tests pass" has no test run after the last edit')
  })

  test('aborted and errored turns are not checked', async ($, on) => {
    await boot($, on)
    await $.tool.call(edit(CODE))
    expect((await complete($, 'All tests pass.', { turnId: 't1', reason: 'aborted' })).text).toBe('All tests pass.')
    expect((await complete($, 'All tests pass.', { turnId: 't2', reason: 'error' })).text).toBe('All tests pass.')
  })
})

describe('steps (turn.complete answer holds only the last text block)', () => {
  test('a claim in an earlier step of the turn is still checked', async ($, on) => {
    const { world } = await boot($, on)
    await $.tool.call(edit(CODE))
    world.steps.push({ answer: 'All tests pass. Committing now.', tools: 1 }, { answer: 'Committed as abc123.', tools: 0 })
    await step($, 't1', 0)
    await $.tool.call(bash('git commit -m x'))
    await step($, 't1', 1)

    expect((await complete($, 'Committed as abc123.')).text).toContain('Claim Ledger: "All tests pass" has no test run after the last edit')
  })

  test('a claim true when its step began survives a later edit in the turn', async ($, on) => {
    const { world } = await boot($, on)
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('pytest'))
    world.steps.push({ answer: 'All tests pass. Now the parser.', tools: 1 }, { answer: 'Parser done.', tools: 0 })
    await step($, 't1', 0)
    await $.tool.call(edit(CODE))
    await step($, 't1', 1)

    expect((await complete($, 'Parser done.')).text).toBe('Parser done.')
  })

  test('an edit that lands while the step streams does not void its claim', async ($, on) => {
    const { world } = await boot($, on)
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('pytest'))
    world.steps.push({ answer: 'All tests pass. Now the parser.', tools: 1 }, { answer: 'Parser done.', tools: 0 })
    world.midStep = () => $.tool.call(edit(CODE))
    await step($, 't1', 0)
    await step($, 't1', 1)

    expect((await complete($, 'Parser done.')).text).toBe('Parser done.')
  })

  test('order is taken at hook entry: a run that started before an edit does not back a claim after it', async ($, on) => {
    const { world, clock } = await boot($, on)
    world.delay = input => (input.command === 'pytest' ? 5_000 : 0)
    const run = $.tool.call(bash('pytest'))
    await clock.settle()
    await $.tool.call(edit(CODE))
    await clock.advance(5_000)
    await run

    expect((await complete($, 'Tests pass.')).text).toContain('has no test run after the last edit')
  })
})

describe('delivery, flag once, reset', () => {
  test('the note is handed to $.session.append once, framed, and nothing wakes the session', async ($, on) => {
    const { world } = await boot($, on)
    await $.tool.call(edit(CODE))
    await complete($, 'All tests pass.')

    const tried = appends(world)
    expect(tried).toHaveLength(1)
    expect(String(tried[0]?.text)).toStartWith("[claim-ledger plugin note, not the user's words.")
    expect(String(tried[0]?.text)).toContain('Claim Ledger: "All tests pass" has no test run after the last edit')
    expect(world.submitted).toEqual([])
  })

  test('with tellModel off, the line shows but nothing is appended', { options: { tellModel: false } }, async ($, on) => {
    const { world } = await boot($, on)
    await $.tool.call(edit(CODE))

    expect((await complete($, 'All tests pass.')).text).toContain('Claim Ledger:')
    expect(trailOf(world).some(e => e.ev === 'claim' && e.outcome === 'fired')).toBe(true)
    expect(appends(world)).toEqual([])
  })

  test('each claim is flagged once per session', async ($, on) => {
    await boot($, on)
    await $.tool.call(edit(CODE))
    expect((await complete($, 'All tests pass.', { turnId: 't1' })).text).toContain('Claim Ledger:')
    expect((await complete($, 'All tests pass.', { turnId: 't2' })).text).toBe('All tests pass.')
  })

  test('a restated claim over the same evidence is not flagged again', async ($, on) => {
    const { world } = await boot($, on)
    await $.tool.call(edit(CODE))
    expect((await complete($, 'All tests pass.', { turnId: 't1' })).text).toContain('Claim Ledger:')
    expect((await complete($, 'The test suite passes.', { turnId: 't2' })).text).toBe('The test suite passes.')
    expect(trailOf(world).filter(e => e.ev === 'claim').map(e => e.outcome)).toEqual(['fired', 'repeated'])
  })

  test('/clear resets: earlier runs no longer count', async ($, on) => {
    await boot($, on)
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('pytest'))
    await $.session.end({ reason: 'clear', sessionId: 'sess-1', resume: { id: 'sess-1' } } as never)

    expect((await complete($, 'All tests pass.')).text).toBe('Claim Ledger: "All tests pass" has no test run this session.')
  })

  test("/clear writes the ending session's trail before it resets", async ($, on) => {
    const { world } = await boot($, on)
    await $.tool.call(bash('pytest'))
    await $.session.end({ reason: 'clear', sessionId: 'sess-1', resume: { id: 'sess-1' } } as never)
    expect(trailOf(world).some(e => e.ev === 'run' && e.kind === 'tests')).toBe(true)
  })

  test('/resume resets too', async ($, on) => {
    await boot($, on)
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('pytest'))
    await $.session.end({ reason: 'resume', sessionId: 'sess-1' } as never)

    expect((await complete($, 'All tests pass.')).text).toBe('Claim Ledger: "All tests pass" has no test run this session.')
  })

  test('/claim-ledger reports flags and later-backed counts', async ($, on) => {
    await boot($, on)
    await $.tool.call(edit(CODE))
    await complete($, 'All tests pass.')
    await $.tool.call(bash('pytest'))

    const text = (await runCommand($)).text ?? ''
    expect(text).toContain('tests   1 flagged, 1 later backed (100%)')
    expect(text).toContain('tests: backed')
  })

  test('a run after a further edit is not counted as later backing', async ($, on) => {
    await boot($, on)
    await $.tool.call(edit(CODE))
    await complete($, 'All tests pass.')
    await $.tool.call(edit(CODE))
    await $.tool.call(bash('pytest'))

    expect((await runCommand($)).text ?? '').toContain('tests   1 flagged, 0 later backed (0%)')
  })
})

describe('failure and health', () => {
  test('the health file is written at start, and a refused append is recorded without hiding the line', async ($, on) => {
    const { world } = await boot($, on, 5 * MIN)
    expect(world.writes.map(w => w.path)).toEqual([HEALTH])

    // The kit serves no plugin append, so this append is refused by the host.
    await $.tool.call(edit(CODE))
    expect((await complete($, 'All tests pass.')).text).toContain('Claim Ledger:')
    expect(lastHealth(world).lastError?.message).toContain('session.append')
    expect(trailOf(world).some(e => e.ev === 'append-failed')).toBe(true)
  })

  test('a failing $.state write is recorded and the line still shows', { options: { tellModel: false } }, async ($, on) => {
    // Hooks beneath the plugins are registered before the test's first call on `$`. A throwing hook is skipped, so refuse.
    on('state.set', () => ({ deny: 'state refused' }) as never)
    const { world } = await boot($, on)
    await $.tool.call(edit(CODE))

    expect((await complete($, 'All tests pass.')).text).toContain('Claim Ledger:')
    expect(lastHealth(world).lastError?.message).toContain('state.set')
  })

  test('the heartbeat follows the new session id after /clear', async ($, on) => {
    const { world } = await boot($, on)
    await $.session.end({ reason: 'clear', sessionId: 'sess-1' } as never)
    world.sessionId = 'sess-2'
    await $.tool.call(bash('ls'))

    expect(world.writes.map(w => w.path)).toContain(healthOf('sess-2'))
  })

  test("a tool's result passes through unchanged", async ($, on) => {
    const { world } = await boot($, on)
    world.toolResult = () => FAILED
    expect(await $.tool.call(bash('pytest'))).toMatchObject({ isError: true, text: 'Exit code 1' })
  })
})
