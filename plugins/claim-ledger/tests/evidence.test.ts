import { describe, expect, test } from 'claude-code/testing'

import { classify, commandsOf, configOf, DEFAULT_BUILD_COMMANDS, DEFAULT_TEST_COMMANDS, factsOf, isCodeMutation, listOption } from '../hooks/evidence'
import type { Segment } from '../hooks/evidence'

const CONFIG = configOf(DEFAULT_TEST_COMMANDS, DEFAULT_BUILD_COMMANDS)
const HOME = 'C:\\Users\\tester'
const PLACES = { home: HOME, root: 'C:\\work', temp: 'D:\\tmp' }
const OK = { result: { stdout: '', stderr: '', interrupted: false }, text: 'ok' }
const said = (text: string) => ({ result: { stdout: text, stderr: '', interrupted: false }, text })

/** Each run as `kind`, `kind~masked` (weak) or `kind~failed`. */
const kinds = (input: Record<string, unknown>, ran: object = OK) =>
  classify(factsOf(input, ran), CONFIG, PLACES).runs.map(r => (!r.ok ? `${r.kind}~failed` : r.masked ? `${r.kind}~masked` : r.kind))
const sh = (command: string) => ({ tool: 'Bash', command })
const ps = (command: string) => ({ tool: 'PowerShell', command })
const mutations = (tool: string, path: string, ran: object = OK) =>
  classify(factsOf({ tool, file_path: path, notebook_path: path }, ran), CONFIG, PLACES).mutations
const show = (segments: Segment[]) => segments.map(s => [s.words.map(w => w.text).join(' '), s.op])

describe('parsing a command line (decision 8)', () => {
  test('segments and operators', () => {
    expect(show(commandsOf('cd x && pytest -q | tail -5; echo done'))).toEqual([
      ['cd x', '&&'],
      ['pytest -q', '|'],
      ['tail -5', ';'],
      ['echo done', ''],
    ])
  })

  test('quotes, redirections and heredoc bodies', () => {
    expect(show(commandsOf("python - <<'PY'\nimport subprocess  # pytest\nPY\nnpx tsc -p . 2>&1"))).toEqual([
      ['python - <<HEREDOC', '\n'],
      ['npx tsc -p . 2>&1', ''],
    ])
    const quoted = commandsOf('git commit -m "run pytest; done"')
    expect(show(quoted)).toEqual([['git commit -m run pytest; done', '']])
    expect(quoted[0]?.words.map(w => w.quoted)).toEqual([false, false, false, true])
  })

  test('bash -c and pwsh -Command payloads are commands', () => {
    expect(show(commandsOf('bash -c "cd x && pytest"'))).toEqual([
      ['cd x', '&&'],
      ['pytest', ''],
    ])
    expect(show(commandsOf('pwsh -Command "npm test"'))).toEqual([['npm test', '']])
  })
})

describe('runners', () => {
  test('runners match whole tokens', () => {
    expect(kinds(sh('uv run pytest -q'))).toEqual(['tests'])
    expect(kinds(sh('cd plugin && claude plugin test .'))).toEqual(['tests'])
    expect(kinds(ps('claude plugin test C:/x'))).toEqual(['tests'])
    expect(kinds(sh('npx tsc -p .'))).toEqual(['build'])
    expect(kinds(sh('tsc -p . && npm test'))).toEqual(['build', 'tests'])
    expect(kinds(sh('npm run typecheck'))).toEqual(['build'])
    expect(kinds(sh('npm run typecheck:tests'))).toEqual(['build'])
    expect(kinds(sh('npm run test'))).toEqual(['tests'])
    expect(kinds(sh('npm run test:e2e'))).toEqual(['tests'])
    expect(kinds(sh('npx playwright test'))).toEqual(['tests'])
    expect(kinds(sh('pip install pytest-cov'))).toEqual([])
    expect(kinds(sh('pip install pytest'))).toEqual([])
    expect(kinds(sh('cat jest.config.js'))).toEqual([])
  })

  test('runner words inside quotes, heredocs and payloads are not runs (review C4)', () => {
    expect(kinds(sh(`gh pr create --title x --body "$(cat <<'EOF'\nRan vitest and pytest\nEOF\n)"`))).toEqual(['pr-create'])
    expect(kinds(sh("grep -n 'Run: uv run pytest' plan.md"))).toEqual([])
    expect(kinds(sh(`printf '%s' "npm test passed"`))).toEqual([])
    expect(kinds(sh('echo "pytest"'))).toEqual([])
    expect(kinds(sh('git commit -m "make vitest pass"'))).toEqual(['commit'])
    expect(kinds(sh(`python - <<'PY'\nprint("vitest")\nPY`))).toEqual([])
    expect(kinds(sh('bash -c "pytest -q"'))).toEqual(['tests'])
  })

  test('invocations that run nothing', () => {
    for (const command of ['tsc --version', 'pytest --collect-only', 'cargo test --no-run', 'jest --listTests', 'pytest --help']) {
      expect(kinds(sh(command)), command).toEqual([])
    }
  })

  test('masking is judged by output (decision 7)', () => {
    // A later pipe member, `||`, `;`, a later line or `&& echo` hides the runner's own exit status...
    expect(kinds(sh('pytest 2>&1 | tail -20'))).toEqual(['tests~masked'])
    expect(kinds(sh('npm test || true'))).toEqual(['tests~masked'])
    expect(kinds(sh('pytest; echo done'))).toEqual(['tests~masked'])
    expect(kinds(sh('npx vitest run > C:/tmp/vt.log 2>&1; grep -n FAIL C:/tmp/vt.log'))).toEqual(['tests~masked'])
    expect(kinds(sh('pytest\ngit status'))).toEqual(['tests~masked'])
    expect(kinds(sh('pytest && echo ok'), { result: { stdout: '', interrupted: false }, text: '' })).toEqual(['tests~masked'])
    expect(kinds(ps('claude plugin test . | Select-Object -Last 5'))).toEqual(['tests~masked'])
    // ...unless the output shows the runner's summary, or the text an `&& echo` printed.
    expect(kinds(sh('pytest 2>&1 | tail -3'), said('12 passed in 0.31s'))).toEqual(['tests'])
    expect(kinds(sh('claude plugin test . 2>&1 | tail -3'), said(' 66 pass\n 0 fail\nRan 66 tests across 5 files.'))).toEqual(['tests'])
    expect(kinds(sh('pytest 2>&1 | tail -3'), said('1 failed, 11 passed'))).toEqual(['tests~failed'])
    expect(kinds(sh('npx tsc --noEmit && echo TSC-OK'), said('TSC-OK'))).toEqual(['build'])
    // isError speaks only for the last segment.
    expect(kinds(sh('pytest'), { ...OK, isError: true, text: 'Exit code 1' })).toEqual(['tests~failed'])
    expect(kinds(sh('pytest && git status'), { isError: true, result: 'Exit code 128', text: 'Exit code 128\nfatal: not a git repository' })).toEqual(['tests~masked'])
    expect(kinds(sh('pytest && git status'))).toEqual(['tests'])
    // A pipe inside a later `&&` command leaves the earlier run's failure visible (review C8).
    expect(kinds(sh('npx tsc -p . && npm run typecheck:tests 2>&1 | tail -3'))).toEqual(['build', 'build~masked'])
  })

  test('an echo of the run\'s own exit status is its status (brief, second round)', () => {
    // `$?` straight after an unpiped run; `${PIPESTATUS[n]}` or `$LASTEXITCODE` after a pipe.
    const tct = 'npm run typecheck:tests > "$TEMP/tct.log" 2>&1; echo "tct=$?"'
    expect(kinds(sh(tct), said('tct=0'))).toEqual(['build'])
    expect(kinds(sh(tct), said('tct=2'))).toEqual(['build~failed'])
    expect(classify(factsOf(sh(tct), said('tct=0')), CONFIG, PLACES).runs[0]?.basis).toBe('echo')
    expect(kinds(sh('npx vitest run > vt.log 2>&1; echo "vt=$?"; grep -E "Tests " vt.log'), said('vt=0'))).toEqual(['tests'])
    expect(kinds(sh('git push -u origin feat/x > push.log 2>&1; echo "push=$?"'), said('push=0'))).toEqual(['push'])
    expect(kinds(sh('pytest 2>&1 | tail -3; echo "rc=${PIPESTATUS[0]}"'), said('rc=0'))).toEqual(['tests'])
    // The echoed status is read before the piped-tsc rule.
    const tsc = 'npx tsc --noEmit -p tsconfig.server.json 2>&1 | head -30; echo "exit ${PIPESTATUS[0]}"'
    expect(classify(factsOf(sh(tsc), said('exit 0')), CONFIG, PLACES).runs.map(r => [r.kind, r.ok, r.basis])).toEqual([['build', true, 'echo']])
    expect(kinds(sh(tsc), said('exit 2'))).toEqual(['build~failed'])
    expect(kinds(ps('npm test | Select-Object -Last 3; echo "rc=$LASTEXITCODE"'), said('rc=0'))).toEqual(['tests'])
    // ...and nothing else is: `$?` after a pipe is the filter's, PIPESTATUS[1] is another member's, `&&`/`||` echoes are conditional.
    expect(kinds(sh('pytest 2>&1 | tail -3; echo "rc=$?"'), said('rc=0'))).toEqual(['tests~masked'])
    expect(kinds(sh('pytest 2>&1 | tail -3; echo "rc=${PIPESTATUS[1]}"'), said('rc=0'))).toEqual(['tests~masked'])
    expect(kinds(sh('pytest || echo "rc=$?"'), said('rc=1'))).toEqual(['tests~masked'])
    expect(kinds(sh('pytest && git status; echo "rc=$?"'), said('rc=0'))).toEqual(['tests~masked'])
  })

  test('echoes that print lines of one shape are read in order (third round)', () => {
    expect(kinds(sh('npx tsc -p a.json > a.log 2>&1; echo "exit=$?"; npx tsc -p b.json > b.log 2>&1; echo "exit=$?"'), said('exit=0\nexit=2'))).toEqual(['build', 'build~failed'])
    const two = 'pytest tests/a -q > a.log 2>&1; echo "rc=$?"; pytest tests/b -q > b.log 2>&1; echo "rc=$?"'
    expect(kinds(sh(two), said('rc=0\nrc=1'))).toEqual(['tests', 'tests~failed'])
    expect(kinds(sh(two), said('rc=1\nrc=0'))).toEqual(['tests~failed', 'tests'])
    // Lines that do not pair off with the echoes (a loop prints one per pass) are unsure.
    expect(kinds(sh('for f in a b; do pytest $f > $f.log 2>&1; echo "rc=$?"; done'), said('rc=0\nrc=1'))).toEqual(['tests~masked'])
  })

  test('svelte-check and tsup summaries (brief, second round)', () => {
    expect(kinds(sh('npm run typecheck 2>&1 | tail -1'), said('1790964360196 COMPLETED 1945 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS'))).toEqual(['build'])
    expect(kinds(sh('npm run typecheck 2>&1 | tail -1'), said('1790964360196 COMPLETED 1945 FILES 3 ERRORS 0 WARNINGS 2 FILES_WITH_PROBLEMS'))).toEqual(['build~failed'])
    expect(kinds(sh('npm run build 2>&1 | tail -2'), said('ESM Build success in 5178ms'))).toEqual(['build'])
    expect(kinds(sh('npm run build > build.log 2>&1; echo "exit=$?"; tail -2 build.log'), said('exit=0\nESM Build success in 5178ms'))).toEqual(['build'])
  })

  test('a later `&&` member that showed its own pass summary proves the run before it (brief, second round)', () => {
    const chain = 'npx biome check src 2>&1 | tail -1 && npx tsc -p t.json --noEmit && npx vitest run tests/docs 2>&1 | grep -E "Test Files|Tests "; git log --oneline -1'
    expect(kinds(sh(chain), said(' Test Files  50 passed (50)\n      Tests  359 passed (359)\nabc1234 x'))).toEqual(['build', 'tests'])
    expect(kinds(sh(chain), said('      Tests  2 failed | 357 passed (359)\nabc1234 x'))).toEqual(['build~masked', 'tests~failed'])
  })

  test('a later `&&` member proves only a run that ends its pipeline (third round)', () => {
    // `(exit 2) | tail -1 && echo ran` prints `ran`: the chain went on because tail exited 0, whatever the build did.
    expect(kinds(sh('npm run build 2>&1 | tail -1 && npx vitest run 2>&1 | tail -3'), said('    at async build (file:///x/node_modules/vite/dist/node/chunks/dep.js:1:1)\n      Tests  3 passed (3)'))).toEqual(['build~masked', 'tests'])
    expect(kinds(sh('npm run typecheck:tests 2>&1 | tail -2 && npx vitest run tests/x 2>&1 | grep -E "Tests "'), said("    Type 'string' is not assignable to type 'number'.\n      Tests  12 passed (12)"))).toEqual(['build~masked', 'tests'])
    expect(kinds(sh('npm run build 2>&1 | tail -1 && echo BUILD-OK'), said('    at async build (file:///x/vite.js:1:1)\nBUILD-OK'))).toEqual(['build~masked'])
    // An `||` before the run could have skipped it: `x || pytest && echo ok` prints ok when x passed.
    expect(kinds(sh('git diff --quiet || pytest && echo ok'), said('ok'))).toEqual(['tests~masked'])
    // An `&& echo` in a later command, after `;`, prints whatever the run did.
    expect(kinds(sh('pytest; git pull -q && echo same'), said('same'))).toEqual(['tests~masked'])
  })

  test('a piped tsc with no `error TS` line passed: tsc prints nothing on success (brief, second round)', () => {
    expect(kinds(sh('npx tsc --noEmit 2>&1 | head -5'), said(''))).toEqual(['build'])
    expect(kinds(sh('npx tsc --noEmit -p x 2>&1 | head -30; echo done'), said('done'))).toEqual(['build'])
    expect(kinds(sh('npx tsc --noEmit 2>&1 | tail -5'), said('src/a.ts(3,1): error TS2304: x'))).toEqual(['build~failed'])
    // A count, or a filter that is not tsc's own lines, shows nothing either way.
    expect(kinds(sh('npx tsc --noEmit 2>&1 | grep -c "error TS"'), said('3'))).toEqual(['build~masked'])
    expect(kinds(sh('npx tsc --noEmit 2>&1 | wc -l'), said('0'))).toEqual(['build~masked'])
    expect(kinds(sh('npm run build 2>&1 | tail -5'), said(''))).toEqual(['build~masked'])
  })

  test('tsc passes by silence only if it ran and every line it printed was kept (third round)', () => {
    // A last-N tail can hold only a diagnostic's indented elaboration lines.
    expect(kinds(sh('npx tsc --noEmit -p tsconfig.json 2>&1 | tail -1'), said("    Type 'string' is not assignable to type 'number'."))).toEqual(['build~masked'])
    expect(kinds(sh('npx tsc --noEmit 2>&1 | tail -3'), said("  Types of property 'a' are incompatible.\n    Type 'string' is not assignable to type 'number'.\n      Type 'q' is not assignable to type 'r'."))).toEqual(['build~masked'])
    expect(kinds(sh('npx tsc --noEmit 2>&1 | tail -n +1'), said(''))).toEqual(['build'])
    // No compiler started.
    expect(kinds(sh('npx --no-install tsc -p . 2>&1 | head -20'), said('                This is not the tsc command you are looking for\n\nTo get access to the TypeScript compiler, tsc, from the command line either:'))).toEqual(['build~failed'])
    expect(kinds(sh('tsc --noEmit 2>&1 | head -5'), said('bash: tsc: command not found'))).toEqual(['build~failed'])
    // An earlier `&&` member that is neither a cd nor a proven run may have failed and stopped the chain.
    const helper = 'cd C:/work-2 && python check.py && npx tsc -p tsconfig.server.json --noEmit 2>&1 | head -10 && echo SERVER_OK'
    expect(kinds(sh(helper), { isError: true, result: 'Exit code 1', text: 'Exit code 1\nAssertionError' })).toEqual(['build~masked'])
    expect(kinds(sh(helper), said(''))).toEqual(['build~masked'])
    expect(kinds(sh('cd C:/work-2 && npx tsc -p tsconfig.server.json --noEmit 2>&1 | head -10'), said(''))).toEqual(['build'])
    expect(kinds(sh('npm run build && npx tsc --noEmit 2>&1 | head -5'), said(''))).toEqual(['build', 'build'])
  })

  test('configured commands replace the defaults', () => {
    const custom = configOf(['make check'], [])
    expect(classify(factsOf(sh('make check'), OK), custom, PLACES).runs).toEqual([{ kind: 'tests', ok: true, masked: false, basis: 'exit' }])
    expect(classify(factsOf(sh('pytest'), OK), custom, PLACES).runs).toEqual([])
  })
})

describe('git and gh', () => {
  test('commands', () => {
    expect(kinds(sh('git commit -m "x"'))).toEqual(['commit'])
    expect(kinds(sh('git -C "C:/a b" push origin main'))).toEqual(['push'])
    expect(kinds(sh('gh pr merge 3 --squash'))).toEqual(['merge'])
    expect(kinds(sh('git merge feat/x'))).toEqual(['merge'])
    expect(kinds(sh('gh pr create --fill'))).toEqual(['pr-create'])
    expect(kinds(sh('git log --grep commit'))).toEqual([])
  })

  test('ops inside a loop or conditional, or behind a quoted assignment (re-review)', () => {
    expect(kinds(sh('for n in 4 8; do gh pr merge $n --merge; done'), said('✓ Merged pull request #4 (x)\n✓ Merged pull request #8 (y)'))).toEqual(['merge'])
    expect(kinds(sh('GH_TOKEN="$(cat t)" gh pr merge 3 --squash'))).toEqual(['merge'])
    expect(kinds(sh('if git diff --quiet; then git push; fi'))).toEqual(['push~masked'])
  })

  test('each op is confirmed by its own output only (brief, second round)', () => {
    // A quiet commit's sha line from a later `git log` in the same command, heredoc message included.
    expect(kinds(sh(`git add a && git commit -q -F - <<'EOF'\nfix: x\nEOF\ngit log --oneline -1`), said('925b391 fix: x'))).toEqual(['commit'])
    expect(kinds(sh('git commit -q -m "fix: x" 2>&1 | tail -1; git log --oneline -1'), said('925b391 fix: x'))).toEqual(['commit'])
    expect(kinds(sh('git commit -q -m "fix: x" 2>&1 | tail -1'), said('925b391 fix: x'))).toEqual(['commit~masked'])
    expect(kinds(sh('gh pr merge 6 --merge 2>&1 | tail -2; gh pr view 6 --json state -q .state'), said('MERGED'))).toEqual(['merge'])
    expect(kinds(sh('gh pr merge 6 --squash 2>&1 | tail -3; gh pr view 6 --json state,mergeCommit'), said('{"mergeCommit":{"oid":"e021d03"},"state":"MERGED"}'))).toEqual(['merge'])
    expect(kinds(sh('git commit -m x 2>&1 | tail -1; gh pr view 6 --json state -q .state'), said('MERGED'))).toEqual(['commit~masked'])
    expect(kinds(sh('git push -u origin feat/x 2>&1 | tail -1'), said("branch 'feat/x' set up to track 'origin/feat/x'."))).toEqual(['push'])
    expect(kinds(sh('git push origin v1.2.0 2>&1 | tail -1'), said(' * [new tag]         v1.2.0 -> v1.2.0'))).toEqual(['push'])
  })

  test('a quiet commit\'s sha line is its own only when it carries the subject, or nothing moved in between (third round)', () => {
    // A sha line from a `git log` on another branch is that branch's commit.
    expect(kinds(sh('git commit -q -m "fix: y" 2>&1 | tail -1; git checkout -q main && git log --oneline -1'), said('abc1234 docs: an older commit on main'))).toEqual(['commit~masked'])
    expect(kinds(sh('git commit -q -m "fix: y" 2>&1 | tail -1; git log --oneline -1'), said('abc1234 (HEAD -> fix/y) fix: y'))).toEqual(['commit'])
    expect(kinds(sh(`git commit -q -m "$(cat <<'EOF'\nfix: z\n\nBody.\nEOF\n)"; git log --oneline -1`), said('abc1234 fix: z'))).toEqual(['commit'])
    // With no subject in the command, the log must stay on the commit's branch, folder and repository.
    expect(kinds(sh('git commit -q -F msg.txt; git log --oneline -1'), said('abc1234 fix: from a file'))).toEqual(['commit'])
    expect(kinds(sh('git commit -q -F msg.txt; git checkout -q main; git log --oneline -1'), said('abc1234 docs: main'))).toEqual(['commit~masked'])
    expect(kinds(sh('git commit -q -F msg.txt; git -C ../other log --oneline -1'), said('abc1234 other repo'))).toEqual(['commit~masked'])
  })

  test('the files git or gh read a message or body from (brief, second round)', () => {
    const files = (command: string) => classify(factsOf(sh(command), OK), CONFIG, PLACES).messageFiles
    expect(files('git commit -F "C:\\work\\msg.txt"')).toEqual(['c:/work/msg.txt'])
    expect(files('git -C ../tandem-2 commit --file=./msg.txt')).toEqual(['msg.txt'])
    expect(files('gh pr create --title x --body-file body.txt')).toEqual(['body.txt'])
    expect(files(`git commit -F - <<'EOF'\nx\nEOF`)).toEqual([])
    expect(files('git grep -F needle.ts')).toEqual([])
    expect(files('gh api -F state=closed repos/x')).toEqual([])
  })

  test('merge-base, merge-tree and an aborted merge are not merges (review C4)', () => {
    expect(kinds(sh('git merge-base origin/main HEAD'))).toEqual([])
    expect(kinds(sh('base=$(git merge-base origin/master HEAD)'))).toEqual([])
    expect(kinds(sh('git merge-tree a b'))).toEqual([])
    expect(kinds(sh('git merge --abort'))).toEqual([])
  })

  test('the result gitOperation counts, and unmasks a piped op', () => {
    expect(kinds(sh('./ship.sh'), { result: { gitOperation: { push: { branch: 'main' } } } })).toEqual(['push'])
    expect(kinds(sh('git push 2>&1 | tail -2'), { result: { gitOperation: { push: { branch: 'main' } } } })).toEqual(['push'])
    expect(kinds(sh('git push 2>&1 | tail -2'))).toEqual(['push~masked'])
    expect(kinds(sh('git push 2>&1 | tail -2'), said('   1a2b3c4..5d6e7f8  main -> main'))).toEqual(['push'])
    expect(kinds(sh('./x.sh'), { result: { gitOperation: { pr: { number: 4, action: 'created' } } } })).toEqual(['pr-create'])
    expect(kinds(sh('./x.sh'), { result: { gitOperation: { pr: { number: 4, action: 'merged' } } } })).toEqual(['merge'])
    expect(classify(factsOf(sh('./ship.sh'), { result: { gitOperation: { push: { branch: 'main' } } } }), CONFIG, PLACES).runs[0]?.basis).toBe('gitOperation')
  })
})

describe('facts', () => {
  test('denial, error, interruption, background and the call id', () => {
    expect(factsOf(sh('pytest'), OK)).toMatchObject({ denied: false, isError: false, interrupted: false, background: false, output: 'ok' })
    expect(factsOf(sh('pytest'), { ...OK, isError: true }).isError).toBe(true)
    expect(factsOf(sh('pytest'), { deny: 'no' }).denied).toBe(true)
    expect(factsOf(sh('pytest'), { result: { interrupted: true } }).interrupted).toBe(true)
    expect(factsOf({ ...sh('pytest'), run_in_background: true }, OK).background).toBe(true)
    expect(factsOf(sh('pytest'), { result: { backgroundTaskId: 'b1', interrupted: false } }).background).toBe(true)
    expect(factsOf({ ...sh('pytest'), tool_use_id: 'toolu_1' }, OK).toolUseId).toBe('toolu_1')
    expect(kinds(sh('pytest'), { deny: 'no' })).toEqual(['tests~failed'])
  })
})

describe('mutations (decision 9)', () => {
  test('a successful code edit is a mutation, keyed by its normalized path; .md and failed edits are not', () => {
    expect(mutations('Edit', 'C:\\work\\src\\a.ts')).toEqual(['c:/work/src/a.ts'])
    expect(mutations('Write', 'C:/work/notes/plan.md')).toEqual([])
    expect(mutations('NotebookEdit', 'C:/work/n.ipynb')).toEqual(['c:/work/n.ipynb'])
    expect(mutations('Edit', 'src/rel.ts')).toEqual(['c:/work/src/rel.ts'])
    expect(mutations('Edit', 'C:/work/a.ts', { ...OK, isError: true })).toEqual([])
    expect(mutations('Edit', 'C:/work/a.ts', { deny: 'no' })).toEqual([])
  })

  test('writes anywhere count, sibling worktrees included; scratch and temp writes do not (brief, second round; Review Focus 3)', () => {
    for (const path of [
      'C:/Users/tester/AppData/Local/Temp/claude/x/scratchpad/fix-pr-body.py',
      'C:\\Users\\tester\\AppData\\Local\\Temp\\commit-msg.txt',
      '/tmp/x.py',
      'D:\\tmp\\claude\\helper.py', // %TEMP% from the environment
    ]) {
      expect(isCodeMutation(path, PLACES), path).toBe(false)
    }
    for (const path of [
      'C:/work-2144/src/a.ts', // a sibling worktree of the session root
      'D:/other/repo/a.ts',
      'C:/Users/tester/.claude/dev-mods/s1/claim-ledger/hooks/register.ts',
      'src/rel.ts',
      'C:/work/notes/msg.txt',
    ]) {
      expect(isCodeMutation(path, PLACES), path).toBe(true)
    }
    // With no root, a relative path is still an edit.
    expect(isCodeMutation('src/rel.ts', { home: HOME, root: null, temp: null })).toBe(true)
  })

  test('memory roots in every spelling, even when the session runs in ~/.claude (Review Focus 2)', () => {
    const inClaude = { home: HOME, root: 'C:/Users/tester/.claude', temp: null }
    for (const path of [
      'C:\\Users\\tester\\.claude\\memory\\state.json',
      'c:/users/TESTER/.claude/rules/x.txt',
      '~/.claude/memory/state.json',
      '/c/Users/tester/.claude/projects/C--work/memory/facts.json',
    ]) {
      expect(isCodeMutation(path, inClaude), path).toBe(false)
    }
    expect(isCodeMutation('C:/Users/tester/.claude/settings.json', inClaude)).toBe(true)
    expect(isCodeMutation('C:/Users/tester/.claude/projects/C--work/abc.jsonl', inClaude)).toBe(true)
    expect(isCodeMutation('C:/Users/tester/.claude/settings.json', PLACES)).toBe(true)
  })

  test('Bash edits count when the result lists them, and are unseen otherwise (Review Focus 1)', () => {
    const sed = sh("sed -i 's/a/b/' src/a.ts")
    expect(classify(factsOf(sed, OK), CONFIG, PLACES).mutations).toEqual([])
    const listed = { result: { stdout: '', interrupted: false, bashEditDiff: { files: [], moreFiles: 0, changedFiles: ['C:\\work\\src\\a.ts'] } } }
    expect(classify(factsOf(sed, listed), CONFIG, PLACES).mutations).toEqual(['c:/work/src/a.ts'])
  })
})

describe('options', () => {
  test('listOption takes an array or a comma string; empty falls back', () => {
    expect(listOption(['a', ' b ', ''], ['z'])).toEqual(['a', 'b'])
    expect(listOption('a, b ,', ['z'])).toEqual(['a', 'b'])
    expect(listOption('', ['z'])).toEqual(['z'])
    expect(listOption(undefined, ['z'])).toEqual(['z'])
    expect(listOption([1, 'a'], ['z'])).toEqual(['a'])
  })
})
