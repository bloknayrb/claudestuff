import { describe, expect, test } from 'claude-code/testing'

import { findClaims } from '../hooks/claims'
import {
  asOfNow,
  assess,
  classify,
  closeTurn,
  commandsOf,
  configOf,
  DEFAULT_BUILD_COMMANDS,
  DEFAULT_TEST_COMMANDS,
  emptyLedger,
  factsOf,
  hhmm,
  isCodeMutation,
  judge,
  LINE_CAP,
  listOption,
  markBacked,
  noteClaims,
  noteText,
  readBack,
  record,
  restoreLedger,
} from '../hooks/evidence'
import type { Segment } from '../hooks/evidence'
import type { Ledger } from '../types'
import { REAL_GIT_RESULT } from './fixtures/real'

const CONFIG = configOf(DEFAULT_TEST_COMMANDS, DEFAULT_BUILD_COMMANDS)
const HOME = 'C:\\Home\\tester'
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

describe('parsing a command line', () => {
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

  test('runner words inside quotes, heredocs and payloads are not runs', () => {
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

  test('masking is judged by output', () => {
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
    // A pipe inside a later `&&` command leaves the earlier run's failure visible.
    expect(kinds(sh('npx tsc -p . && npm run typecheck:tests 2>&1 | tail -3'))).toEqual(['build', 'build~masked'])
  })

  test('an echo of the run\'s own exit status is its status', () => {
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

  test('echoes that print lines of one shape are read in order', () => {
    expect(kinds(sh('npx tsc -p a.json > a.log 2>&1; echo "exit=$?"; npx tsc -p b.json > b.log 2>&1; echo "exit=$?"'), said('exit=0\nexit=2'))).toEqual(['build', 'build~failed'])
    const two = 'pytest tests/a -q > a.log 2>&1; echo "rc=$?"; pytest tests/b -q > b.log 2>&1; echo "rc=$?"'
    expect(kinds(sh(two), said('rc=0\nrc=1'))).toEqual(['tests', 'tests~failed'])
    expect(kinds(sh(two), said('rc=1\nrc=0'))).toEqual(['tests~failed', 'tests'])
    // Lines that do not pair off with the echoes (a loop prints one per pass) are unsure.
    expect(kinds(sh('for f in a b; do pytest $f > $f.log 2>&1; echo "rc=$?"; done'), said('rc=0\nrc=1'))).toEqual(['tests~masked'])
  })

  test('svelte-check and tsup summaries', () => {
    expect(kinds(sh('npm run typecheck 2>&1 | tail -1'), said('1790964360196 COMPLETED 1945 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS'))).toEqual(['build'])
    expect(kinds(sh('npm run typecheck 2>&1 | tail -1'), said('1790964360196 COMPLETED 1945 FILES 3 ERRORS 0 WARNINGS 2 FILES_WITH_PROBLEMS'))).toEqual(['build~failed'])
    expect(kinds(sh('npm run build 2>&1 | tail -2'), said('ESM Build success in 5178ms'))).toEqual(['build'])
    expect(kinds(sh('npm run build > build.log 2>&1; echo "exit=$?"; tail -2 build.log'), said('exit=0\nESM Build success in 5178ms'))).toEqual(['build'])
  })

  test('a later `&&` member that showed its own pass summary proves the run before it', () => {
    const chain = 'npx biome check src 2>&1 | tail -1 && npx tsc -p t.json --noEmit && npx vitest run tests/docs 2>&1 | grep -E "Test Files|Tests "; git log --oneline -1'
    expect(kinds(sh(chain), said(' Test Files  50 passed (50)\n      Tests  359 passed (359)\nabc1234 x'))).toEqual(['build', 'tests'])
    expect(kinds(sh(chain), said('      Tests  2 failed | 357 passed (359)\nabc1234 x'))).toEqual(['build~masked', 'tests~failed'])
  })

  test('a later `&&` member proves only a run that ends its pipeline', () => {
    // `(exit 2) | tail -1 && echo ran` prints `ran`: the chain went on because tail exited 0, whatever the build did.
    expect(kinds(sh('npm run build 2>&1 | tail -1 && npx vitest run 2>&1 | tail -3'), said('    at async build (file:///x/node_modules/vite/dist/node/chunks/dep.js:1:1)\n      Tests  3 passed (3)'))).toEqual(['build~masked', 'tests'])
    expect(kinds(sh('npm run typecheck:tests 2>&1 | tail -2 && npx vitest run tests/x 2>&1 | grep -E "Tests "'), said("    Type 'string' is not assignable to type 'number'.\n      Tests  12 passed (12)"))).toEqual(['build~masked', 'tests'])
    expect(kinds(sh('npm run build 2>&1 | tail -1 && echo BUILD-OK'), said('    at async build (file:///x/vite.js:1:1)\nBUILD-OK'))).toEqual(['build~masked'])
    // An `||` before the run could have skipped it: `x || pytest && echo ok` prints ok when x passed.
    expect(kinds(sh('git diff --quiet || pytest && echo ok'), said('ok'))).toEqual(['tests~masked'])
    // An `&& echo` in a later command, after `;`, prints whatever the run did.
    expect(kinds(sh('pytest; git pull -q && echo same'), said('same'))).toEqual(['tests~masked'])
  })

  test('a piped tsc with no `error TS` line passed: tsc prints nothing on success', () => {
    expect(kinds(sh('npx tsc --noEmit 2>&1 | head -5'), said(''))).toEqual(['build'])
    expect(kinds(sh('npx tsc --noEmit -p x 2>&1 | head -30; echo done'), said('done'))).toEqual(['build'])
    expect(kinds(sh('npx tsc --noEmit 2>&1 | tail -5'), said('src/a.ts(3,1): error TS2304: x'))).toEqual(['build~failed'])
    // A count, or a filter that is not tsc's own lines, shows nothing either way.
    expect(kinds(sh('npx tsc --noEmit 2>&1 | grep -c "error TS"'), said('3'))).toEqual(['build~masked'])
    expect(kinds(sh('npx tsc --noEmit 2>&1 | wc -l'), said('0'))).toEqual(['build~masked'])
    expect(kinds(sh('npm run build 2>&1 | tail -5'), said(''))).toEqual(['build~masked'])
  })

  test('tsc passes by silence only if it ran and every line it printed was kept', () => {
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

  test('ops inside a loop or conditional, or behind a quoted assignment', () => {
    // An op inside a loop is found, but a loop is never strong evidence.
    expect(kinds(sh('for n in 4 8; do gh pr merge $n --merge; done'), said('✓ Merged pull request #4 (x)\n✓ Merged pull request #8 (y)'))).toEqual(['merge~masked'])
    expect(kinds(sh('GH_TOKEN="$(cat t)" gh pr merge 3 --squash'))).toEqual(['merge'])
    expect(kinds(sh('if git diff --quiet; then git push; fi'))).toEqual(['push~masked'])
  })

  test('each op is confirmed by its own output only', () => {
    // A quiet commit's sha line from a later `git log` in the same command, heredoc message included.
    expect(kinds(sh(`git add a && git commit -q -F - <<'EOF'\nfix: x\nEOF\ngit log --oneline -1`), said('925b391 fix: x'))).toEqual(['commit'])
    expect(kinds(sh('git commit -q -m "fix: x" 2>&1 | tail -1; git log --oneline -1'), said('925b391 fix: x'))).toEqual(['commit'])
    expect(kinds(sh('git commit -q -m "fix: x" 2>&1 | tail -1'), said('925b391 fix: x'))).toEqual(['commit~masked'])
    expect(kinds(sh('gh pr merge 6 --merge 2>&1 | tail -2; gh pr view 6 --json state -q .state'), said('MERGED'))).toEqual(['merge'])
    expect(kinds(sh('gh pr merge 6 --squash 2>&1 | tail -3; gh pr view 6 --json state,mergeCommit'), said('{"mergeCommit":{"oid":"e021d03"},"state":"MERGED"}'))).toEqual(['merge'])
    // MERGED never confirms the commit; the view is merge evidence of its own.
    expect(kinds(sh('git commit -m x 2>&1 | tail -1; gh pr view 6 --json state -q .state'), said('MERGED'))).toEqual(['commit~masked', 'merge'])
    expect(kinds(sh('git push -u origin feat/x 2>&1 | tail -1'), said("branch 'feat/x' set up to track 'origin/feat/x'."))).toEqual(['push'])
    expect(kinds(sh('git push origin v1.2.0 2>&1 | tail -1'), said(' * [new tag]         v1.2.0 -> v1.2.0'))).toEqual(['push'])
  })

  test('a quiet commit\'s sha line is its own only when it carries the subject, or nothing moved in between', () => {
    // A sha line from a `git log` on another branch is that branch's commit.
    expect(kinds(sh('git commit -q -m "fix: y" 2>&1 | tail -1; git checkout -q main && git log --oneline -1'), said('abc1234 docs: an older commit on main'))).toEqual(['commit~masked'])
    expect(kinds(sh('git commit -q -m "fix: y" 2>&1 | tail -1; git log --oneline -1'), said('abc1234 (HEAD -> fix/y) fix: y'))).toEqual(['commit'])
    expect(kinds(sh(`git commit -q -m "$(cat <<'EOF'\nfix: z\n\nBody.\nEOF\n)"; git log --oneline -1`), said('abc1234 fix: z'))).toEqual(['commit'])
    // With no subject in the command, the log must stay on the commit's branch, folder and repository.
    expect(kinds(sh('git commit -q -F msg.txt; git log --oneline -1'), said('abc1234 fix: from a file'))).toEqual(['commit'])
    expect(kinds(sh('git commit -q -F msg.txt; git checkout -q main; git log --oneline -1'), said('abc1234 docs: main'))).toEqual(['commit~masked'])
    expect(kinds(sh('git commit -q -F msg.txt; git -C ../other log --oneline -1'), said('abc1234 other repo'))).toEqual(['commit~masked'])
  })

  test('the files git or gh read a message or body from', () => {
    const files = (command: string) => classify(factsOf(sh(command), OK), CONFIG, PLACES).messageFiles
    expect(files('git commit -F "C:\\work\\msg.txt"')).toEqual(['c:/work/msg.txt'])
    expect(files('git -C ../repo-2 commit --file=./msg.txt')).toEqual(['msg.txt'])
    expect(files('gh pr create --title x --body-file body.txt')).toEqual(['body.txt'])
    expect(files(`git commit -F - <<'EOF'\nx\nEOF`)).toEqual([])
    expect(files('git grep -F needle.ts')).toEqual([])
    expect(files('gh api -F state=closed repos/x')).toEqual([])
  })

  test('merge-base, merge-tree and an aborted merge are not merges', () => {
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

describe('merge and commit evidence found in real transcripts', () => {
  test('a gh pr view in a call of its own shows a merge only when it printed MERGED', () => {
    expect(kinds(sh('gh pr view 6 --json state -q .state'), said('MERGED'))).toEqual(['merge'])
    expect(kinds(sh('gh pr view 6 --json state,mergedAt -q \'.state + " " + .mergedAt\''), said('MERGED 2026-01-02T03:04:05Z'))).toEqual(['merge'])
    expect(kinds(sh('gh pr view 6 --json state -q .state'), said('OPEN'))).toEqual([])
    // A `git log` line in the same call is not gh's word: an open PR beside an old merge commit is no merge.
    expect(kinds(sh('gh pr view 6 --json state -q .state; git log --oneline -1'), said('OPEN\nabc1234 Merge pull request #5 from a/b'))).toEqual([])
    expect(kinds(sh('gh pr view 6 --json state -q .state'), { deny: 'no' })).toEqual([])
  })

  test('a git merge is confirmed by its merge commit in a later git log, and fails on a conflict', () => {
    const merge = "git merge origin/feat/x --no-edit 2>&1 | tail -5 && git log --oneline -3"
    expect(kinds(sh(merge), said(" a.ts | 2 +-\n 1 file changed\na99bf06 Merge remote-tracking branch 'origin/feat/x' into feat/x\nc07f24c docs: y"))).toEqual(['merge'])
    expect(kinds(sh(merge), said("CONFLICT (content): Merge conflict in a.ts\nAutomatic merge failed; fix conflicts and then commit the result.\n645fb13 Merge branch 'main' into feat/x"))).toEqual(['merge~failed'])
    expect(kinds(sh('git merge --no-edit origin/main 2>&1 | tail -1'), said("Merge made by the 'ort' strategy."))).toEqual(['merge'])
  })

  test('a quiet commit is confirmed by git show --oneline, never by a bare stat', () => {
    const commit = (show: string) => `git add a && git commit -q -F - <<'EOF'\nfix: x\nEOF\n${show}`
    expect(kinds(sh(commit('git show --stat --oneline HEAD | tail -8')), said('925b391 fix: x\n a.ts | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)'))).toEqual(['commit'])
    expect(kinds(sh(commit('git show --stat HEAD | tail -5')), said(' a.ts | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)'))).toEqual(['commit~masked'])
  })
})

describe('a real gitOperation record', () => {
  test('a commit is seen through gitOperation, even piped', () => {
    const runs = classify(factsOf(sh('git commit -F C:/tmp/msg.txt 2>&1 | tail -1'), { result: REAL_GIT_RESULT }), CONFIG, PLACES).runs
    expect(runs.map(r => [r.kind, r.basis])).toEqual([['commit', 'gitOperation']])
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

describe('mutations', () => {
  test('a successful code edit is a mutation, keyed by its normalized path; .md and failed edits are not', () => {
    expect(mutations('Edit', 'C:\\work\\src\\a.ts')).toEqual(['c:/work/src/a.ts'])
    expect(mutations('Write', 'C:/work/notes/plan.md')).toEqual([])
    expect(mutations('NotebookEdit', 'C:/work/n.ipynb')).toEqual(['c:/work/n.ipynb'])
    expect(mutations('Edit', 'src/rel.ts')).toEqual(['c:/work/src/rel.ts'])
    expect(mutations('Edit', 'C:/work/a.ts', { ...OK, isError: true })).toEqual([])
    expect(mutations('Edit', 'C:/work/a.ts', { deny: 'no' })).toEqual([])
  })

  test('writes anywhere count, sibling worktrees included; scratch and temp writes do not', () => {
    for (const path of [
      'C:/Home/tester/tmp/claude/x/scratchpad/fix-pr-body.py',
      'D:\\tmp\\commit-msg.txt',
      '/tmp/x.py',
      'D:\\tmp\\claude\\helper.py', // %TEMP% from the environment
    ]) {
      expect(isCodeMutation(path, PLACES), path).toBe(false)
    }
    for (const path of [
      'C:/work-feature/src/a.ts', // a sibling worktree of the session root
      'D:/other/repo/a.ts',
      'C:/Home/tester/.claude/dev-mods/s1/claim-ledger/hooks/register.ts',
      'src/rel.ts',
      'C:/work/notes/msg.txt',
    ]) {
      expect(isCodeMutation(path, PLACES), path).toBe(true)
    }
    // With no root, a relative path is still an edit.
    expect(isCodeMutation('src/rel.ts', { home: HOME, root: null, temp: null })).toBe(true)
  })

  test('memory roots in every spelling, even when the session runs in ~/.claude', () => {
    const inClaude = { home: HOME, root: 'C:/Home/tester/.claude', temp: null }
    for (const path of [
      'C:\\Home\\tester\\.claude\\memory\\state.json',
      'c:/home/TESTER/.claude/rules/x.txt',
      '~/.claude/memory/state.json',
      '/c/Home/tester/.claude/projects/C--work/memory/facts.json',
    ]) {
      expect(isCodeMutation(path, inClaude), path).toBe(false)
    }
    expect(isCodeMutation('C:/Home/tester/.claude/settings.json', inClaude)).toBe(true)
    expect(isCodeMutation('C:/Home/tester/.claude/projects/C--work/abc.jsonl', inClaude)).toBe(true)
    expect(isCodeMutation('C:/Home/tester/.claude/settings.json', PLACES)).toBe(true)
  })

  test('Bash edits count when the result lists them, and are unseen otherwise', () => {
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

const MIN = 60_000
const claimOf = (text: string) => findClaims(text)[0]!

/** Records one finished call at time seq * MIN. */
function at(ledger: Ledger, seq: number, input: Record<string, unknown>, ran: object = OK, agentId: string | null = null): void {
  const facts = factsOf(input, ran)
  ledger.seq = Math.max(ledger.seq, seq)
  record(ledger, facts, classify(facts, CONFIG, PLACES), seq, seq * MIN, agentId)
}

const editAt = (ledger: Ledger, seq: number, path = 'C:/work/a.ts') => at(ledger, seq, { tool: 'Edit', file_path: path })
const lineFor = (text: string, ledger: Ledger) => assess([claimOf(text)], ledger, 99 * MIN, hhmm).lines

describe('judging tests and build claims', () => {
  test('no run and no edit', () => {
    expect(lineFor('All tests pass.', emptyLedger())).toEqual(['Claim Ledger: "All tests pass" has no test run this session.'])
  })

  test('no run after the last edit names the edit time', () => {
    const ledger = emptyLedger()
    editAt(ledger, 3)
    expect(lineFor('All tests pass.', ledger)).toEqual([`Claim Ledger: "All tests pass" has no test run after the last edit (${hhmm(3 * MIN)}).`])
  })

  test('a run after the edit backs it; a run before it does not', () => {
    const before = emptyLedger()
    at(before, 1, sh('pytest'))
    editAt(before, 2)
    expect(judge('tests', before).status).toBe('none')

    const after = emptyLedger()
    editAt(after, 1)
    at(after, 2, sh('pytest'))
    expect(judge('tests', after).status).toBe('backed')
  })

  test('a .md, memory or scratch write after the run does not void it', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    at(ledger, 2, sh('pytest'))
    editAt(ledger, 3, 'C:/work/README.md')
    editAt(ledger, 4, 'C:\\Home\\tester\\.claude\\rules\\x.txt')
    editAt(ledger, 5, 'C:/Home/tester/tmp/claude/s/scratchpad/msg.txt')
    expect(judge('tests', ledger).status).toBe('backed')
  })

  test('a commit-message or PR-body file is taken back out when git or gh reads it', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    at(ledger, 2, sh('pytest'))
    editAt(ledger, 3, 'C:/work/commit-msg.txt')
    expect(judge('tests', ledger).status).toBe('none')
    at(ledger, 4, sh('git commit -F commit-msg.txt'))
    expect(ledger.lastMutation?.path).toBe('c:/work/a.ts')
    expect(judge('tests', ledger).status).toBe('backed')
    editAt(ledger, 5, 'C:/work/pr-body.txt')
    at(ledger, 6, sh('gh pr create --title x --body-file C:/work/pr-body.txt'))
    expect(judge('tests', ledger).status).toBe('backed')
  })

  test('an edit in a sibling worktree voids the run', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    at(ledger, 2, sh('pytest'))
    editAt(ledger, 3, 'C:/work-feature/src/a.ts')
    expect(judge('tests', ledger).status).toBe('none')
  })

  test("a PowerShell run and a subagent's run both count", () => {
    const ps1 = emptyLedger()
    editAt(ps1, 1)
    at(ps1, 2, ps('claude plugin test .'))
    expect(judge('tests', ps1).status).toBe('backed')

    const sub = emptyLedger()
    editAt(sub, 1)
    at(sub, 2, sh('uv run pytest'), OK, 'agent-1')
    expect(judge('tests', sub).status).toBe('backed')
  })

  test('a Bash command that edits then runs: its own run counts after its edit', () => {
    const ledger = emptyLedger()
    at(ledger, 1, sh("sed -i 's/a/b/' src/a.ts && pytest"), { result: { stdout: '3 passed', interrupted: false, bashEditDiff: { files: [], moreFiles: 0, changedFiles: ['C:/work/src/a.ts'] } } })
    expect(ledger.lastMutation?.seq).toBe(0.5)
    expect(judge('tests', ledger).status).toBe('backed')
  })

  test('background is no evidence; a later foreground pass is', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    at(ledger, 2, { ...sh('pytest'), run_in_background: true })
    expect(judge('tests', ledger).status).toBe('background')
    expect(lineFor('Tests pass.', ledger)).toEqual(['Claim Ledger: "Tests pass" rests on a background run, which shows only that it started.'])
    at(ledger, 3, sh('pytest'))
    expect(judge('tests', ledger).status).toBe('backed')
  })

  test('weak is named with the command', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    at(ledger, 2, sh('pytest -q 2>&1 | tail -5'))
    expect(lineFor('Tests pass.', ledger)).toEqual(['Claim Ledger: "Tests pass" rests on `pytest -q 2>&1 | tail -5`, whose exit code is masked and whose output shows no result.'])
  })

  test('the latest foreground run decides: pass then fail is failed', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    at(ledger, 2, sh('pytest'))
    at(ledger, 3, sh('pytest -k slow'), { ...OK, isError: true })
    expect(judge('tests', ledger).status).toBe('failed')
    expect(lineFor('Tests pass.', ledger)).toEqual([`Claim Ledger: "Tests pass": the last test run after the last edit failed (${hhmm(3 * MIN)}).`])
  })

  test('build claims read build runs', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    at(ledger, 2, sh('npx tsc -p .'))
    expect(judge('build', ledger).status).toBe('backed')
    expect(judge('tests', ledger).status).toBe('none')
  })
})

describe('judging shipped claims', () => {
  test('a strong op this turn backs it, edits notwithstanding; a later failed op does not unship it', () => {
    const ledger = emptyLedger()
    at(ledger, 1, sh('git commit -m x'))
    editAt(ledger, 2)
    at(ledger, 3, sh('git commit -m y'), { ...OK, isError: true })
    expect(judge('commit', ledger).status).toBe('backed')
  })

  test('an op before the turn began does not back it', () => {
    const ledger = emptyLedger()
    at(ledger, 1, sh('git push origin main'))
    closeTurn(ledger, 't1', 1, hhmm)
    expect(judge('push', ledger).status).toBe('none')
    expect(lineFor("I've pushed the branch.", ledger)).toEqual([`Claim Ledger: "I've pushed" has no git push this turn.`])
  })

  test('only a failed op is failed; none is none', () => {
    const ledger = emptyLedger()
    at(ledger, 1, sh('git push'), { ...OK, isError: true })
    expect(lineFor("I've pushed the branch.", ledger)).toEqual([`Claim Ledger: "I've pushed": the git push this turn failed.`])
    expect(lineFor('I merged it.', emptyLedger())).toEqual(['Claim Ledger: "I merged" has no merge this turn.'])
  })

  test('the latest strong op is kept past the entry cap', () => {
    const ledger = emptyLedger()
    at(ledger, 1, sh('git commit -m x'))
    for (let i = 2; i <= 130; i += 1) at(ledger, i, sh('pytest'))
    expect(ledger.entries.some(e => e.kind === 'commit')).toBe(false)
    expect(judge('commit', ledger).status).toBe('backed')
  })
})

describe('turns, flag once, caps', () => {
  test('a claim backed when its step began is not flagged at turn end, even after a later edit', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    at(ledger, 2, sh('pytest'))
    noteClaims(ledger, 't1', findClaims('All tests pass. Now the parser.'), asOfNow(ledger))
    editAt(ledger, 3)
    expect(closeTurn(ledger, 't1', 99 * MIN, hhmm).lines).toEqual([])
  })

  test('step-time judgement uses the evidence as it stood when the step began', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    at(ledger, 2, sh('pytest'))
    const asOf = asOfNow(ledger)
    editAt(ledger, 3) // the step's own Edit, landing while the response streams
    noteClaims(ledger, 't1', findClaims('All tests pass.'), asOf)
    expect(closeTurn(ledger, 't1', 99 * MIN, hhmm).lines).toEqual([])

    const late = emptyLedger()
    editAt(late, 1)
    at(late, 2, sh('pytest'))
    editAt(late, 3)
    noteClaims(late, 't1', findClaims('All tests pass.'), asOfNow(late))
    expect(closeTurn(late, 't1', 99 * MIN, hhmm).lines).toHaveLength(1)
  })

  test('a run that completes after the step began is not in its snapshot', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    ledger.seq = 2 // the run entered before the step began...
    const asOf = asOfNow(ledger)
    at(ledger, 2, sh('pytest')) // ...and completed after
    expect(judge('tests', ledger, asOf).status).toBe('none')
    expect(judge('tests', ledger).status).toBe('backed')
  })

  test('a claim unbacked at its step but backed by turn end is not flagged', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    noteClaims(ledger, 't1', findClaims('Tests pass.'), asOfNow(ledger))
    at(ledger, 2, sh('pytest'))
    const out = closeTurn(ledger, 't1', 99 * MIN, hhmm)
    expect(out.lines).toEqual([])
    expect(out.backed.map(c => c.phrase)).toEqual(['Tests pass'])
  })

  test('candidates from another turn are dropped', () => {
    const ledger = emptyLedger()
    noteClaims(ledger, 't1', findClaims('Tests pass.'), asOfNow(ledger))
    expect(closeTurn(ledger, 't2', 99 * MIN, hhmm).lines).toEqual([])
  })

  test('each claim is flagged once per session; a repeat is counted, not shown', () => {
    const ledger = emptyLedger()
    const first = assess([claimOf('Tests pass.')], ledger, 1, hhmm)
    const second = assess([claimOf('Tests pass.')], ledger, 2, hhmm)
    expect(first.lines).toHaveLength(1)
    expect(second.lines).toEqual([])
    expect(second.repeated).toHaveLength(1)
  })

  test('a restated claim over the same evidence is counted, not shown', () => {
    const out = assess([claimOf('Tests pass.'), claimOf('The test suite passes.')], emptyLedger(), 1, hhmm)
    expect(out.lines).toHaveLength(1)
    expect(out.repeated.map(c => c.phrase)).toEqual(['test suite passes'])
  })

  test('at most five lines, then a count', () => {
    const texts = ['Tests pass.', 'It builds cleanly.', 'I committed it.', "I've pushed it.", 'I merged it.', 'Opened PR #4.']
    const out = assess(texts.map(claimOf), emptyLedger(), 1, hhmm)
    expect(out.lines).toHaveLength(LINE_CAP + 1)
    expect(out.lines.at(-1)).toBe('Claim Ledger: 1 more unbacked claim this turn.')
    expect(out.fired).toHaveLength(6)
  })

  test('markBacked moves a flag once a strong run lands with no edit between', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    assess([claimOf('Tests pass.')], ledger, 1, hhmm)
    expect(ledger.pending).toHaveLength(1)
    at(ledger, 2, sh('pytest'))
    markBacked(ledger)
    expect(ledger.pending).toEqual([])
    expect(ledger.backed.map(p => p.family)).toEqual(['tests'])
  })

  test('a run after a further edit is not later backing; shipped flags never wait', () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    assess([claimOf('Tests pass.'), claimOf("I've pushed it.")], ledger, 1, hhmm)
    expect(ledger.pending.map(p => p.family)).toEqual(['tests'])
    editAt(ledger, 2)
    at(ledger, 3, sh('pytest'))
    markBacked(ledger)
    expect(ledger.pending).toEqual([])
    expect(ledger.backed).toEqual([])
  })

  test('entries are capped', () => {
    const ledger = emptyLedger()
    for (let i = 1; i <= 130; i += 1) at(ledger, i, sh('pytest'))
    expect(ledger.entries).toHaveLength(100)
    expect(ledger.calls).toBe(130)
  })
})

describe('note and restore', () => {
  test('the note is framed as a plugin note', () => {
    expect(noteText(['a', 'b'])).toBe("[claim-ledger plugin note, not the user's words. No reply needed.]\na\nb")
  })

  test('a reload restores the saved ledger and fills fields an older build lacked', () => {
    const restored = restoreLedger(emptyLedger(), { seq: 4, calls: 4, entries: [] })
    expect(restored.seq).toBe(4)
    expect(restored.ships).toEqual({})
    expect(restored.turnFrom).toBe(0)
    const held = emptyLedger()
    held.calls = 2
    expect(restoreLedger(held, { seq: 9, calls: 9 })).toBe(held)
    expect(restoreLedger(emptyLedger(), undefined).calls).toBe(0)
  })
})

describe('background runs read back, idf.py, state=MERGED, quiet commits', () => {
  /** Records one call, then lets it read back any background run; returns what the read-back changed. */
  const call = (ledger: Ledger, seq: number, input: Record<string, unknown>, ran: object = OK) => {
    const facts = factsOf(input, ran)
    ledger.seq = Math.max(ledger.seq, seq)
    record(ledger, facts, classify(facts, CONFIG, PLACES), seq, seq * MIN, null)
    return readBack(ledger, facts, CONFIG, PLACES)
  }
  const bg = (id: string) => ({ result: { backgroundTaskId: id, stdout: `Command running in background with ID: ${id}.`, stderr: '', interrupted: false }, text: `Command running in background with ID: ${id}. Output is being written to: C:\\t\\tasks\\${id}.output.` })
  const PUSH = 'git push -u origin feat/x > "$TEMP/push.log" 2>&1; echo "exit=$?" >> "$TEMP/push.log"'

  test('a read-back that shows a status or summary makes the run strong', () => {
    const ledger = emptyLedger()
    call(ledger, 1, sh(PUSH), bg('b1'))
    expect(judge('push', ledger).status).toBe('background')
    const changed = call(ledger, 2, sh('tail -3 "$TEMP/push.log"'), said(' * [new branch]      feat/x -> feat/x\nexit=0'))
    expect(changed.map(e => [e.seq, e.kind, e.basis])).toEqual([[1, 'push', 'echo']])
    expect(judge('push', ledger)).toMatchObject({ status: 'backed', entry: { seq: 1 } })
  })

  test('a read-back that shows no status leaves the run weak; a later one can still judge it', () => {
    const ledger = emptyLedger()
    call(ledger, 1, sh(PUSH), bg('b1'))
    expect(call(ledger, 2, sh('tail -c 300 "$TEMP/push.log"'), said('··········'))).toEqual([])
    expect(judge('push', ledger).status).toBe('background')
    call(ledger, 3, sh('tail -3 "$TEMP/push.log"'), said('error: failed to push some refs\nexit=1'))
    expect(judge('push', ledger).status).toBe('failed')
  })

  test('a grep -n read-back is read without its line numbers, with the log named through a variable', () => {
    const ledger = emptyLedger()
    call(ledger, 1, sh('L=/c/t/push3.log && git push > $L 2>&1; echo "exit=$?" >> $L'), bg('b3'))
    call(ledger, 2, sh('L=/c/t/push3.log; grep -naE "FAIL |exit=" $L | tail -3'), said('31007:test result: ok. 3 passed\n31024:exit=0'))
    expect(judge('push', ledger)).toMatchObject({ status: 'backed', entry: { seq: 1, basis: 'echo' } })
  })

  test('the run keeps its own place: an edit between the run and the read-back still voids it', () => {
    const ledger = emptyLedger()
    call(ledger, 1, sh('npx vitest run > /tmp/v.log 2>&1'), bg('b2'))
    editAt(ledger, 2)
    const changed = call(ledger, 3, sh('tail -3 /tmp/v.log'), said('      Tests  12 passed (12)'))
    expect(changed.map(e => [e.seq, e.ok, e.background])).toEqual([[1, true, false]])
    expect(judge('tests', ledger).status).toBe('none')
  })

  test("the task's output file carries the command's exit status", () => {
    const ledger = emptyLedger()
    call(ledger, 1, sh('npm run typecheck'), bg('bx9'))
    call(ledger, 2, sh('cat "C:/t/tasks/bx9.output"'), said('\n[exited with code 0]'))
    expect(judge('build', ledger).status).toBe('backed')
    const failed = emptyLedger()
    call(failed, 1, sh('npm run typecheck'), bg('bx9'))
    call(failed, 2, { tool: 'Read', file_path: 'C:/t/tasks/bx9.output' }, said('     1→src/a.ts(1,1): error TS2322: no\n     2→[exited with code 2]'))
    expect(judge('build', failed).status).toBe('failed')
  })

  test('a file name belongs to the latest run that wrote it, and a writer is not a reader', () => {
    const ledger = emptyLedger()
    call(ledger, 1, sh(PUSH), bg('b1'))
    expect(call(ledger, 2, sh(PUSH), bg('b2'))).toEqual([])
    call(ledger, 3, sh('tail -3 "$TEMP/push.log"'), said('exit=0'))
    expect(ledger.entries.map(e => [e.seq, e.background])).toEqual([[1, true], [2, false]])
  })

  test('idf.py build is a build runner, options between its words included', () => {
    expect(kinds(ps('idf.py -C firmware build 2>&1 | Select-String "error|build complete"'), said('Project build complete. To flash, run:'))).toEqual(['build'])
    expect(kinds(ps('idf.py -C firmware build 2>&1 | Select-String "error"'), said('ninja: build stopped: subcommand failed.'))).toEqual(['build~failed'])
    expect(kinds(ps('idf.py -p COM3 flash'))).toEqual([])
    expect(kinds(sh('npm --silent test'))).toEqual(['tests'])
    expect(kinds(sh('npm install test'))).toEqual([])
  })

  test('gh pr view prints state=MERGED from a jq template', () => {
    expect(kinds(sh('gh pr view 1 --json state,mergedAt -q x'), said('state=MERGED mergedAt=2026-01-02T03:04:05Z'))).toEqual(['merge'])
    expect(kinds(sh('gh pr merge 1 --merge 2>&1 | tail -5; echo "---"; gh pr view 1 --json state -q x'), said('---\nstate=MERGED'))).toEqual(['merge'])
    expect(kinds(sh('gh pr view 1 --json state -q x'), said('state=OPEN'))).toEqual([])
  })

  test('a quiet commit is confirmed by git show --stat printing its subject', () => {
    const quiet = `git add a && git commit -q -F - <<'EOF'\nfix: x\nEOF\ngit show --stat HEAD | tail -9`
    expect(kinds(sh(quiet), said('commit 925b391aaaa\nAuthor: A <a@b>\nDate:   today\n\n    fix: x\n\n a.ts | 2 +-'))).toEqual(['commit'])
    expect(kinds(sh(quiet), said('commit 925b391aaaa\n\n    docs: an older subject\n\n a.ts | 2 +-'))).toEqual(['commit~masked'])
  })
})

describe('full-path read-back keys, repeated status lines, pre-push tests', () => {
  const call = (ledger: Ledger, seq: number, input: Record<string, unknown>, ran: object = OK) => {
    const facts = factsOf(input, ran)
    ledger.seq = Math.max(ledger.seq, seq)
    record(ledger, facts, classify(facts, CONFIG, PLACES), seq, seq * MIN, null)
    return readBack(ledger, facts, CONFIG, PLACES)
  }
  const bg = (id: string) => ({ result: { backgroundTaskId: id, stdout: '', stderr: '', interrupted: false }, text: `Command running in background with ID: ${id}.` })
  const pushIn = (dir: string) => `cd ${dir} && git push > push.log 2>&1; echo "exit=$?" >> push.log`

  test("one worktree's push.log does not judge another worktree's run", () => {
    const ledger = emptyLedger()
    call(ledger, 1, sh(pushIn('/c/w/one')), bg('b1'))
    call(ledger, 2, sh(pushIn('/c/w/two')), bg('b2'))
    call(ledger, 3, sh('tail -2 /c/w/one/push.log'), said('exit=0'))
    expect(ledger.entries.map(e => [e.seq, e.background, e.ok])).toEqual([[1, false, true], [2, true, true]])
    call(ledger, 4, sh('cd /c/w/two && tail -2 push.log'), said('error: failed to push some refs\nexit=1'))
    expect(ledger.entries.map(e => [e.seq, e.background, e.ok])).toEqual([[1, false, true], [2, false, false]])
  })

  test('a reader that prints the same status line twice is read once; disagreeing lines still let a failure show', () => {
    const PUSH = 'git push > "$TEMP/p.log" 2>&1; echo "exit=$?" >> "$TEMP/p.log"'
    const twice = emptyLedger()
    call(twice, 1, sh(PUSH), bg('b1'))
    call(twice, 2, sh('grep -E "exit=" "$TEMP/p.log"; tail -2 "$TEMP/p.log"'), said('exit=1\nerror: failed to push some refs\nexit=1'))
    expect(judge('push', twice)).toMatchObject({ status: 'failed', entry: { basis: 'echo' } })
    const mixed = emptyLedger()
    call(mixed, 1, sh(PUSH), bg('b1'))
    call(mixed, 2, sh('cat "$TEMP/p.log"'), said('exit=0\nerror: failed to push some refs\nexit=1'))
    expect(judge('push', mixed)).toMatchObject({ status: 'failed', entry: { basis: 'output' } })
  })

  test("a push's read-back that shows the pre-push suite's summary is test evidence at the push's place", () => {
    const ledger = emptyLedger()
    editAt(ledger, 1)
    call(ledger, 2, sh('git push > "$TEMP/p.log" 2>&1'), bg('b1'))
    call(ledger, 3, sh('tail -4 "$TEMP/p.log"'), said(' Test Files  12 passed (12)\n * [new branch]      feat/x -> feat/x'))
    expect(judge('tests', ledger)).toMatchObject({ status: 'backed', entry: { seq: 2, kind: 'tests' } })
    const failed = emptyLedger()
    call(failed, 1, sh('git push > "$TEMP/p.log" 2>&1'), bg('b1'))
    call(failed, 2, sh('tail -4 "$TEMP/p.log"'), said(' Tests  1 failed | 30 passed (31)\nerror: failed to push some refs'))
    expect(judge('tests', failed).status).toBe('failed')
  })
})

describe('runners are commands, not arguments; ops that do nothing', () => {
  test('a runner word as an argument of another command is no run', () => {
    for (const command of [
      'npm install -D vitest',
      'uv add --dev pytest',
      'pnpm add -D vitest',
      'npm i jest',
      'npm ls vitest',
      'npm uninstall jest',
      'uv pip install pytest',
      'git log --grep pytest',
      'find . -name jest',
      'npx tsc --init',
      'mkdir -p tsc',
      'ls tsc',
    ]) {
      expect(kinds(sh(command)), command).toEqual([])
    }
  })

  test('a runner as the command word, or after a launcher, is a run', () => {
    for (const [command, want] of [
      ['pytest -q', ['tests']],
      ['npx vitest run', ['tests']],
      ['uv run --with pytest pytest -q', ['tests']],
      ['python -m pytest', ['tests']],
      ['pnpm exec vitest run', ['tests']],
      ['npx -y -p typescript@5 tsc -p .', ['build']],
      ['$out = idf.py -C firmware build 2>&1', ['build']],
      // pnpm, yarn and bun run a runner word directly.
      ['pnpm vitest run', ['tests']],
      ['yarn jest --ci', ['tests']],
      ['bun x vitest', ['tests']],
      // Wrappers and their own options.
      ['nice -n 10 pytest', ['tests']],
      ['xvfb-run -a npm test', ['tests']],
      ['cross-env CI=1 npm test', ['tests']],
      ['dotenv -e .env.test -- npm test', ['tests']],
      ['watchexec -e ts -- pytest', ['tests']],
      // `-m` names a module through a launcher too.
      ['uv run python -m pytest -q', ['tests']],
      // An option whose value merely names a launcher (`node`, `py`, `python3.12`) is still an option.
      ['uv run --python python3.12 pytest', ['tests']],
      ['uv run -p python3.11 pytest -q', ['tests']],
      ['hatch run -e py pytest', ['tests']],
      ['pnpm --filter node test', ['tests']],
      ['yarn --cwd node test', ['tests']],
      ['npx --package node vitest run', ['tests']],
      ['pnpm --dir node test', ['tests']],
      ['npm --prefix node test', ['tests']],
      ['uv run --directory py pytest', ['tests']],
      // One-shot launchers.
      ['uvx pytest', ['tests']],
      ['pnpm dlx vitest run', ['tests']],
      ['pipx run pytest', ['tests']],
      ['npx vitest --help', []],
      ['pytest -h', []],
      ['pytest --co -q', []],
      ['pytest --collect-only', []],
      ['pnpm add -D vitest', []],
    ] as const) {
      expect(kinds(sh(command)), command).toEqual(want)
    }
  })

  test('help, dry runs and auto-merge are not ship ops', () => {
    for (const command of ['git push --help', 'git push -n origin main', 'git commit --help', 'gh pr merge 5 --auto --squash']) {
      expect(kinds(sh(command)), command).toEqual([])
    }
    // `git commit -n` is --no-verify: it still commits.
    expect(kinds(sh('git commit -n -m x'))).toEqual(['commit'])
    const auto = { result: { stdout: '', stderr: '', interrupted: false, gitOperation: { pr: { number: 5, action: 'auto-merge-enabled' } } }, text: '' }
    expect(kinds(sh('gh pr merge 5 --squash'), auto)).toEqual([])
  })

  test('a shift inside quoted code is not a heredoc that swallows the next line', () => {
    expect(kinds(sh('python3 -c "print(1<<n)" || true\npytest -q'))).toEqual(['tests'])
  })

  test('TAP failures fail a piped run; a line that merely starts with OK is no pass', () => {
    expect(kinds(sh('npm test 2>&1 | tail -30'), said('ok 1 - adds\nnot ok 2 - subtracts\n# tests 2\n# pass 1\n# fail 1'))).toEqual(['tests~failed'])
    expect(kinds(sh('npm test 2>&1 | tail -3'), said('OK, server stopped\nsomething else'))).toEqual(['tests~masked'])
    expect(kinds(sh('npm test 2>&1 | tail -3'), said('Ran 4 tests in 0.1s\n\nOK'))).toEqual(['tests'])
  })
})

describe('time stays bounded on adversarial inputs', () => {
  const ms = (fn: () => unknown) => {
    const t = performance.now()
    fn()
    return performance.now() - t
  }
  test('a many-variable status echo against long output lines', () => {
    for (const [k, len] of [[4, 700], [5, 300], [8, 40]] as const) {
      const vars = Array.from({ length: k }, (_, i) => `$V${i}`).join(' ')
      expect(ms(() => kinds(sh(`npm test; echo "${vars} rc=$?"`), said('ab '.repeat(len)))), `${k} variables`).toBeLessThan(50)
    }
  })

  test('a status echo whose variables are joined by a literal separator, against digit-dense lines', () => {
    kinds(sh('npm test; echo "rc=$?"'), said('rc=0')) // warm the code path, so the budgets time matching, not compiling
    for (const [sep, k, unit] of [[',', 8, ',1'], [',', 10, ',1'], [':', 8, ':1'], [':', 10, ':1'], [', ', 10, ', 1'], ['/', 10, '/1'], [':', 10, '1 ']] as const) {
      const vars = Array.from({ length: k }, (_, i) => `$V${i}`).join(sep)
      // Every position is a digit or next to one, so the candidate scan runs; just under the status-line cap.
      const line = unit.repeat(Math.floor(298 / unit.length))
      expect(ms(() => kinds(sh(`npm test; echo "${vars} rc=$?"`), said(line))), `${JSON.stringify(sep)} x${k} on ${JSON.stringify(unit)}`).toBeLessThan(50)
      expect(ms(() => kinds(sh(`npm test; echo "${vars} $? ${vars}"`), said(line))), `${JSON.stringify(sep)} x${k} both sides`).toBeLessThan(50)
    }
    // Mixed separators still read the status.
    expect(kinds(sh('npm test; echo "$A,$B:$C/$D rc=$?"'), said('a,b:c/d rc=1'))).toEqual(['tests~failed'])
  })

  test('many options before a word that is not the runner', () => {
    const re = configOf(['npm test'], []).tests[0]
    const plain = `npm ${Array.from({ length: 24 }, (_, i) => `--opt${i}`).join(' ')} install`
    expect(ms(() => re?.test(plain))).toBeLessThan(50)
  })

  test('launchers and options repeated, with no runner after them', () => {
    const re = configOf(['vitest'], []).tests[0]
    kinds(sh('pnpm -a install')) // warm
    for (const n of [24, 30]) {
      for (const unit of ['pnpm -a ', 'yarn -a ', 'bun -a ', 'npx -a ', 'pnpm --x ', 'bun run -a ', 'uv run -a ']) {
        const command = `${unit.repeat(n)}install`
        expect(ms(() => re?.test(command)), `${JSON.stringify(unit)} x${n}`).toBeLessThan(50)
        expect(ms(() => kinds(sh(command))), `classify ${JSON.stringify(unit)} x${n}`).toBeLessThan(50)
      }
    }
  })

  test('status lines whose literal ends in a dash or a digit, or whose leading variable printed nothing', () => {
    expect(kinds(sh('npm test; echo "a-$?"'), said('a-1'))).toEqual(['tests~failed'])
    expect(kinds(sh('npm test; echo "a1$?"'), said('a10'))).toEqual(['tests'])
    expect(kinds(sh('npm test; echo "$X rc=$?"'), said('rc=2'))).toEqual(['tests~failed'])
    expect(kinds(sh('npm test; echo "rc=$? $X"'), said('rc=0'))).toEqual(['tests'])
  })

  test('a leading variable that printed something keeps its separator: its own digits are no status', () => {
    expect(kinds(sh('npm test; echo "$T $? $SECONDS"'), said('spec0 1 12'))).toEqual(['tests~failed'])
    expect(kinds(sh('npm test; echo "$T $? ${SECONDS}s"'), said('run-0 2 7s'))).toEqual(['tests~failed'])
    expect(kinds(sh('npm test; echo "$T $?$X"'), said('v0 1'))).toEqual(['tests~failed'])
  })

  test('whitespace runs in a push output and digit-dense echo texts', () => {
    // Each case runs once untimed on a slightly different input, so the budget times matching, not the engine's
    // first compile of a pattern for large inputs (which a cubic pattern would not survive either: 3,000 lines took 33 s).
    const push = (out: string) => kinds(sh('git push 2>&1 | tail -3'), said(out))
    push(`To github.com:x/y.git\n${'\n'.repeat(2999)}done`)
    expect(ms(() => push(`To github.com:x/y.git\n${'\n'.repeat(3000)}done`)), 'blank lines').toBeLessThan(50)
    push(`a${' \r'.repeat(399)}\nb`)
    expect(ms(() => push(`a${' \r'.repeat(400)}\nb`)), 'space and CR').toBeLessThan(50)
    // One long run of spaces or tabs on a single line: the optional plus no longer splits it two ways.
    push(`${' '.repeat(8999)}x`)
    expect(ms(() => push(`${' '.repeat(9000)}x`)), '9,000 spaces').toBeLessThan(50)
    push(`${'\t'.repeat(9899)}x`)
    expect(ms(() => push(`${'\t'.repeat(9900)}x`)), '9,900 tabs').toBeLessThan(50)
    // 150 echoes whose texts end in 40 digits: the scan checks each maximal digit run once.
    const echoes = (n: number) => Array.from({ length: n }, (_, i) => `pytest;echo "$A$?x${i}$B ${'1'.repeat(40)}"`).join('\n')
    kinds(sh(echoes(149)), said(''))
    expect(ms(() => kinds(sh(echoes(150)), said(''))), 'digit-dense echoes').toBeLessThan(50)
  })

  test('unterminated heredoc openers and long `${` runs', () => {
    const openers = (n: number) => `${'cat <<A '.repeat(n)}\nnpm test`
    kinds(sh(openers(2499)))
    expect(ms(() => kinds(sh(openers(2500)))), '2,500 openers').toBeLessThan(50)
    const nested = (n: number) => `bash -c 'bash -c "${'x <<A '.repeat(n)}"'`
    kinds(sh(nested(2499)))
    expect(ms(() => kinds(sh(nested(2500)))), '2,500 openers inside bash -c twice').toBeLessThan(50)
    // A real heredoc is still dropped as data, and a later run still counts.
    expect(kinds(sh("cat <<A\npytest\nA\nnpm test"))).toEqual(['tests'])
    const dollars = (n: number) => `npm test; echo "${'${'.repeat(n)} $?"`
    kinds(sh(dollars(4984)), said('x 0'))
    expect(ms(() => kinds(sh(dollars(4985)), said('x 0'))), '4,985 `${`').toBeLessThan(50)
  })

  test('a segment over 1,000 characters is not matched: no run', () => {
    expect(kinds(sh(`pytest ${'tests/t.py '.repeat(100)}`))).toEqual([])
    expect(kinds(sh(`pytest ${'tests/t.py '.repeat(80)}`))).toEqual(['tests'])
  })

  test('a command of 1,500 runs, each with a status echo, stays linear', () => {
    const command = Array.from({ length: 1500 }, (_, i) => `pytest tests/t${i}.py; echo "exit=$?"`).join('\n')
    const output = Array.from({ length: 1500 }, () => 'exit=0').join('\n')
    // A wider budget than the regex probes: this one does real work per run (was 2.7 s quadratic).
    expect(ms(() => kinds(sh(command), said(output)))).toBeLessThan(250)
  })
})

describe('read-backs judge a run only from its own output', () => {
  const call = (ledger: Ledger, seq: number, input: Record<string, unknown>, ran: object = OK) => {
    const facts = factsOf(input, ran)
    ledger.seq = Math.max(ledger.seq, seq)
    record(ledger, facts, classify(facts, CONFIG, PLACES), seq, seq * MIN, null)
    return readBack(ledger, facts, CONFIG, PLACES)
  }
  const bg = (id: string) => ({ result: { backgroundTaskId: id, stdout: '', stderr: '', interrupted: false }, text: `Command running in background with ID: ${id}.` })
  const PUSH = 'git push > "$TEMP/p.log" 2>&1; echo "exit=$?" >> "$TEMP/p.log"'

  test("a failed push credits no pre-push tests, though one stage's pass line is in view", () => {
    const ledger = emptyLedger()
    call(ledger, 1, sh(PUSH), bg('b1'))
    call(ledger, 2, sh('tail -6 "$TEMP/p.log"'), said(' Test Files  12 passed (12)\nerror: could not compile the crate\nhusky - pre-push script failed (code 101)\nerror: failed to push some refs\nexit=1'))
    expect(judge('push', ledger).status).toBe('failed')
    expect(judge('tests', ledger).status).toBe('none')
  })

  test('a bare FAILED inside test titles is no failure summary', () => {
    const ledger = emptyLedger()
    call(ledger, 1, sh(PUSH), bg('b1'))
    call(ledger, 2, sh('tail -6 "$TEMP/p.log"'), said('stderr | tests/m.test.ts > reports CONNECT_FAILED after retries\n Test Files  3 passed (3)\n   abc1234..def5678  feat/x -> feat/x\nexit=0'))
    expect(judge('tests', ledger).status).toBe('backed')
  })

  test('a read that also prints another file judges nothing; only git ls-remote and gh pr view beside it do not withhold', () => {
    const other = emptyLedger()
    call(other, 1, sh(PUSH), bg('b1'))
    expect(call(other, 2, sh('cat "$TEMP/npm-debug.log"; tail -3 "$TEMP/p.log"'), said('12 errors\nexit=0'))).toEqual([])
    expect(judge('push', other).status).toBe('background')
    for (const extra of ['git ls-remote origin feat/x', 'git -C ../x ls-remote origin', 'gh pr view 5 --json state']) {
      const git = emptyLedger()
      call(git, 1, sh(PUSH), bg('b1'))
      expect(call(git, 2, sh(`tail -3 "$TEMP/p.log"; ${extra}`), said('exit=0\nabc1234\trefs/heads/feat/x')).length, extra).toBe(1)
      expect(judge('push', git).status, extra).toBe('backed')
    }
    for (const extra of ['git rev-parse HEAD', 'git status --short', 'git log --oneline -1', 'git show --stat HEAD', 'gh pr checks 5', 'gh pr list', 'git fetch origin']) {
      const git = emptyLedger()
      call(git, 1, sh(PUSH), bg('b1'))
      expect(call(git, 2, sh(`tail -3 "$TEMP/p.log"; ${extra}`), said('exit=0')), extra).toEqual([])
    }
    // A git op that changes something, beside the read, still withholds.
    const pushing = emptyLedger()
    call(pushing, 1, sh(PUSH), bg('b1'))
    expect(call(pushing, 2, sh('tail -3 "$TEMP/p.log"; git push origin v1'), said('exit=0'))).toEqual([])
    // The task's own output and its log together are one source.
    const both = emptyLedger()
    call(both, 1, sh(PUSH), bg('b1'))
    expect(call(both, 2, sh('cat "C:/t/tasks/b1.output"; tail -2 "$TEMP/p.log"'), said('exit=0\n[exited with code 0]')).length).toBe(1)
  })

  test("the reader's own git status, log, rev-parse or checks never flips a run to failed", () => {
    const PUSH_LOG = 'git push origin feat/x > "$TEMP/q.log" 2>&1'
    const OK_PUSH = 'To github.com:o/r.git\n   abc1234..def5678  feat/x -> feat/x'
    const TESTS = 'npm test > "$TEMP/t.log" 2>&1'
    const VITEST = ' Test Files  3 passed (3)\n      Tests  40 passed (40)'
    for (const [run, reader, out, kind] of [
      [PUSH_LOG, 'tail -3 "$TEMP/q.log"; git status', `${OK_PUSH}\nnothing to commit, working tree clean`, 'push'],
      [PUSH_LOG, 'tail -3 "$TEMP/q.log"; git rev-parse origin/feat/y', `${OK_PUSH}\nfatal: ambiguous argument 'origin/feat/y'`, 'push'],
      [TESTS, 'tail -5 "$TEMP/t.log"; git log --oneline -3', `${VITEST}\nabc1234 fix: retry when 2 failed uploads remain`, 'tests'],
      [TESTS, 'tail -5 "$TEMP/t.log"; gh pr checks 5', `${VITEST}\n1 failing, 3 successful, 0 skipped, and 0 pending checks`, 'tests'],
      ['npm run build > "$TEMP/b.log" 2>&1', 'tail -3 "$TEMP/b.log"; git log --oneline -2', ' built in 2.1s\nabc1234 fix: Build failed on Windows', 'build'],
    ] as const) {
      const ledger = emptyLedger()
      call(ledger, 1, sh(run), bg('b1'))
      expect(call(ledger, 2, sh(reader), said(out)), reader).toEqual([])
      expect(judge(kind, ledger).status, reader).toBe('background')
    }
  })

  test("a status echo the reader runs is the reader's status, never the run's", () => {
    const run = 'git push origin feat/x > "$TEMP/p.log" 2>&1; echo "EXIT=$?" >> "$TEMP/p.log"'
    const ledger = emptyLedger()
    call(ledger, 1, sh(run), bg('b1'))
    // The tail cut off the run's own EXIT=1; the EXIT=0 in view is the reader's own echo after git ls-remote.
    call(ledger, 2, sh('git ls-remote origin feat/x; echo "EXIT=$?"; tail -3 "$TEMP/p.log"'), said('EXIT=0\nhusky - pre-push script failed (code 1)\nerror: failed to push some refs'))
    expect(judge('push', ledger).status).toBe('failed')
  })

  test('a looping background command stays weak through every read-back', () => {
    const shapes = [
      'for s in a b c; do npx vitest run $s; echo "rc=$?"; done > "$TEMP/loop.log" 2>&1',
      'if true; then for s in a b c; do npx vitest run $s; echo "rc=$?"; done; fi > "$TEMP/loop.log" 2>&1',
      'time for s in a b c; do npx vitest run $s; echo "rc=$?"; done > "$TEMP/loop.log" 2>&1',
      'for s in a b; do pytest $s; done > "$TEMP/loop.log" 2>&1',
      'for s in a b; do npx vitest run $s | tail -3; done > "$TEMP/loop.log" 2>&1',
      'until pytest; do sleep 1; done > "$TEMP/loop.log" 2>&1',
    ]
    for (const command of shapes) {
      const ledger = emptyLedger()
      call(ledger, 1, sh(command), bg('b9'))
      expect(call(ledger, 2, sh('tail -2 "$TEMP/loop.log"'), said(' Tests  4 passed (4)\n4 passed in 0.1s\nrc=0')), command).toEqual([])
      expect(call(ledger, 3, sh('cat "C:/t/tasks/b9.output"'), said(' Tests  4 passed (4)\nrc=0\n[exited with code 0]')), command).toEqual([])
      expect(judge('tests', ledger).status, command).toBe('background')
    }
  })

  test('a loop in the foreground is weak too, a plain body and a visible pass included', () => {
    expect(kinds(sh('for s in a b; do pytest $s; done'))).toEqual(['tests~masked'])
    expect(kinds(sh('if true; then for s in a b; do pytest $s; done; fi'), said('4 passed'))).toEqual(['tests~masked'])
    expect(kinds(sh('time for s in a b; do pytest $s; done'), said('4 passed'))).toEqual(['tests~masked'])
    expect(kinds(sh('while read f; do pytest "$f"; done < list.txt'))).toEqual(['tests~masked'])
    // A `done` glued to its redirection closes the loop too: the run after it keeps its strength.
    expect(kinds(sh('for s in a b; do pytest $s; done>log.txt; npm test'))).toEqual(['tests~masked', 'tests'])
    expect(kinds(sh('while read f; do pytest "$f"; done<list.txt; npm test'))).toEqual(['tests~masked', 'tests'])
    expect(kinds(sh('for s in a b; do pytest $s; done>"$TEMP/l.log"; npm test'))).toEqual(['tests~masked', 'tests'])
    // A run after the loop's `done` is outside it, and keeps its own strength.
    expect(kinds(sh('for s in a b; do pytest $s; done; npm test'))).toEqual(['tests~masked', 'tests'])
    expect(kinds(sh('for n in 1 2; do gh issue view $n; done; gh pr view 5 --json state -q .state'), said('CLOSED\nCLOSED\nMERGED'))).toEqual(['merge'])
    // A PowerShell block keeps its body in the loop's own segment, so no run is found at all: no credit either way.
    expect(kinds(ps('foreach ($p in $ps) { npm test }'))).toEqual([])
  })

  test('the word "for" inside an echo or a commit message does not make a loop', () => {
    const echo = emptyLedger()
    call(echo, 1, sh('npm test > "$TEMP/t.log" 2>&1; echo "done for now rc=$?" >> "$TEMP/t.log"'), bg('b5'))
    call(echo, 2, sh('tail -2 "$TEMP/t.log"'), said('done for now rc=0'))
    expect(judge('tests', echo)).toMatchObject({ status: 'backed', entry: { basis: 'echo' } })
    const commit = emptyLedger()
    call(commit, 1, sh('git commit -m "guard for null" && npm test 2>&1 | tail -5'), bg('b4'))
    call(commit, 2, sh('cat "C:/t/tasks/b4.output"'), said(' Tests  1 failed (4)\n[exited with code 0]'))
    expect(judge('tests', commit).status).toBe('failed')
  })

  test('a read that also runs a test runner judges nothing', () => {
    const ledger = emptyLedger()
    call(ledger, 1, sh('git push > "$TEMP/p.log" 2>&1; echo "exit=$?" >> "$TEMP/p.log"'), bg('b3'))
    call(ledger, 2, sh('tail -3 "$TEMP/p.log"; cargo test'), said('exit=0\ntest result: FAILED. 3 passed; 1 failed'))
    expect(judge('push', ledger).status).toBe('background')
  })
})
