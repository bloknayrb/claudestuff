# Claim Ledger

Checks end-of-turn claims ("tests pass", "builds cleanly", "I've pushed") against the tool calls that actually ran, and
puts one line beneath the answer for each claim with no evidence or only weak evidence. It makes no model calls and
never blocks, changes or re-runs a tool call.

## What it does

Claude's answers are read for three families of claim, and each needs its own evidence:

| Family | Example claims | Evidence that counts |
|---|---|---|
| tests | "tests pass", "all tests passing", "tests are green" | the latest foreground run of a test command after the last code edit, showing it passed |
| build | "builds cleanly", "compiles", "type-checks" | the latest foreground run of a build or type-check command after the last code edit, showing it passed |
| shipped | "I committed", "I've pushed", "I merged", "opened PR #N", "the PR is merged" | the matching `git commit` / `git push` / `gh pr merge` (or `git merge`) / `gh pr create` **this turn**, showing it succeeded |

A run "shows it passed" through its exit code, or, when the exit code is masked (piped into `tail`, followed by `; echo`
and so on), through an echo of its own status or a result summary in its output. Quoted text, code spans, negations,
hedges ("should pass", "will pass") and questions are not claims. Subagent answers are not checked; tool calls from
every loop, subagents included, count as evidence.

## What you see

One line beneath the answer for each unbacked claim, at most five per turn and then a count:

```
Claim Ledger: "all tests pass" has no test run after the last edit (17:39).
Claim Ledger: "the tests pass": the last test run after the last edit failed (17:45).
Claim Ledger: "all tests passing" rests on `npm test ...`, whose exit code is masked and whose output shows no result.
Claim Ledger: "I've pushed" has no git push this turn.
```

Times are local. A claim sentence is flagged once per evidence state, so restating it over the same evidence adds no
second line.

With `tellModel` on, the same lines are also added to the conversation as a hidden note Claude reads on its next
request. The note never starts a turn: it waits until you next send something.

## Config

Set through `/plugin` (the plugin's options):

| Option | Default | Meaning |
|---|---|---|
| `tellModel` | `true` | Also add each flag as a hidden note for Claude |
| `testCommands` | `pytest`, `uv run pytest`, `npm test`, `npm run test`, `npm run test:e2e`, `pnpm test`, `yarn test`, `vitest`, `jest`, `npx playwright test`, `cargo test`, `go test`, `claude plugin test` | Commands whose run backs a tests claim, matched as whole words in Bash and PowerShell commands |
| `buildCommands` | `tsc`, `cargo build`, `npm run build`, `npm run typecheck`, `npm run typecheck:tests`, `idf.py build` | Commands whose run backs a build claim |

## `/claim-ledger`

Prints, across all sessions, how many claims of each family were flagged, how many of those were **later backed**, and
how many were repeated while still unbacked. A tests or build flag is later backed when a passing run follows it with no
edit between, so the claim may well have been true when it was made: the later-backed rate is the false-positive
measure, and a high rate means the check is noisy. Shipped flags are never later backed, since they are judged on their
own turn only. The report also shows this session's tool-call count, the last code edit, the current tests and build
verdicts, and the last five flags.

## Files

Under `~/.claude/state/mods/claim-ledger/`:

- `<session id>.json`, the health file: when the mod loaded (`loadedAt`) and the last hook failure (`lastError`, or
  `null`). Written at session start, when `/clear` moves to a new session, and on any failure.
- `trail/<session id>.jsonl`, the trail: one JSON object per line, the last 200 events of the session. It records each
  code edit (`edit`), each test, build or git run with how it was judged (`run`: kind, ok, masked, background, basis), a
  background run judged when its result was read back (`read-back`), each claim's outcome (`claim`: backed, fired with
  its status, or repeated), and each hidden note sent (`append`, or `append-failed`). For a background run, the `run`
  row's `ok` is the launch; its result lands in the later `read-back` row. The trail is written only when something
  was recorded, so a session with no claim, edit or run has none.

## Limits

- **Edits.** Any successful Edit, Write or NotebookEdit counts as a code edit, in any folder, except `.md` files, memory
  folders (`~/.claude/memory/`, `~/.claude/projects/*/memory/`, `~/.claude/rules/`), scratch and temp folders, and a
  commit-message or PR-body file that git or gh then reads. So an edit in a sibling worktree voids an earlier run, and
  any other page or data file written outside scratch counts too.
- **Code changed through Bash** counts as an edit only when the result lists the file (`bashEditDiff`, an internal
  field that may be absent).
- **Masked runs.** A run whose exit code is hidden counts only when one of these shows how it ended: an echo of its own
  status (`$?` directly after it, `${PIPESTATUS[n]}`, `$LASTEXITCODE`); its output's summary; a later `&&` member's pass
  summary, for a run that ends its pipeline; or, for a piped `tsc` that surely ran into filters that keep its lines, the
  absence of `error TS`.
- **A status held in a variable before the echo is missed.** `git push > log 2>&1; ec=$?; echo "push exit $ec"` echoes
  `$ec`, not `$?`, so the echo is not read as the push's exit status. Echo `$?` (or `${PIPESTATUS[n]}`) directly.
- **Quiet commits.** A quiet commit followed by `git log` in the same command counts on a sha line that carries the
  commit's subject, or, when the command does not show the subject, on any sha line with no branch, folder or
  repository change between the two. So a commit a hook blocked can still pass when its subject repeats the previous
  commit's, or when its message came from a file.
- **`git ls-remote` matching `HEAD` is not counted** as push evidence. A push is confirmed by its own output
  (`a..b x -> y`, `[new branch]`, `set up to track`), an echoed exit status, or the result's `gitOperation`.
- **Shipped claims need a known subject and this turn's op.** "The PR is merged" is a claim; "P4 is merged" is not.
  A push made in an earlier turn does not back "I've pushed" now.
- **Background runs.** A background run counts as evidence only when a later tool call reads its result back (its task
  output, or a file it wrote) and that read shows a status or summary. A background run that is never read back counts
  for nothing: the claim gets a "background run" line.
- **Task notifications are not read.** The completion notification that arrives between turns is not a tool call, so a
  background run whose result was only reported that way stays weak.
- **Read-back keys are paths as the command names them.** A path is resolved from the session root through the command's
  own `cd`s, with `$TEMP`, `$HOME` and assignments made on the line expanded. A log named through a loop variable or an
  environment variable set elsewhere is matched only when the reader names it the same way.
- **Read-back keys keep `..` segments as written.** A log written as `repo/../push.log` and read as `push.log` (or the
  other way round) is not matched, so the run stays weak.
- **Temp-file names are shared machine-wide.** A read-back matches a log by path; `$TEMP/push.log` written by another
  session at the same time would be read as this session's run.
- **Log paths resolve from the session root,** not the shell's persisted working directory: relative log names written
  from two different persisted directories can collide.
- **A push's pre-push suite counts as test evidence** only when a read-back of that push shows the runner's summary.
- **Some PowerShell loops can be credited.** Runs inside a loop are never strong evidence, but PowerShell's `%` alias,
  `do { ... } while (...)` / `do { ... } until (...)` and `.ForEach({ ... })` are not recognised as loops.
- **Some bash loops can be credited:** a loop inside backtick substitution, `until bash -c "..."`, a function called
  inside a loop, and `select`.
- **PowerShell loops weaken runs to the end of the command.** Braces are not tracked, so a run after a `foreach`,
  `ForEach-Object`, `while` or `for` block in the same command is weak too.
- **A git operation the tool result records (`gitOperation`) can be credited inside a loop** when the command itself
  was not matched: `eval "git push"` in a loop, or a push segment over 1,000 characters in a loop.
- **`cmd /c`, `cargo +nightly test`, `node --test` and `yarn workspace X test` are not recognised** as runs.
- **A segment over 1,000 characters is not matched** for runners or git operations: it yields no run, so a true claim
  resting on a very long command gets a "no run" note.
- **Not checked:** subagent answers, and "verified", "works" and "fixed", which are too vague to match against a run.
- **Stop-hook continuations.** Seen live: when a Stop hook blocks the end of a turn and Claude continues, the turn keeps
  one id and the end-of-turn event fires once, after the continuation, carrying only the newer text. Claims made before
  the block are still caught, because every response's text is read as it finishes, and their lines appear beneath the
  final answer. A response with two text blocks was not seen, so how they are joined is untested live. A tool call can start up to tens of milliseconds before the response that issued it finishes (38 ms
  was measured); each response's claims are judged against the evidence as it stood when that response began.
- **Hot reload was not verified live.** That the ledger survives a hot reload, and that a hook which throws after a
  reload fails open (the answer shows, the error goes to the health file), were not checked in a live session, because
  `/reload-plugins` did not restart a mod loaded with `--plugin-dir`. A unit test covers restoring a saved ledger; a hook that throws has no test beyond a failing state write being
  recorded while the line still shows.
- **The hooks API is early access** and changes between Claude Code releases.

## Precision

Measured by replaying the detector over 107 real session transcripts (722 turns), split by file into a tuning set and a
held-out set; no transcript text is kept here.

- **Detection** (claims found that a labeller agreed were claims), held-out: tests 0.93, shipped 0.97 (build had 4
  labelled claims, too few to judge), against a 0.85 target.
- **Flag justification** (a flag the labeller agreed was unbacked) first came in at 0.14 held-out against a 0.70
  target. 8 of the 13 unjustified flags rested on background runs whose result a later call read back, so read-back
  became evidence, along with `idf.py build` and a few confirmation forms.
- **Independent re-label** of the held-out set after that change, by a separate labeller that had not tuned the
  detector: detection tests 0.98, shipped 0.99 on 112 claims; 96% agreement with the earlier labels; 2 spurious notes in
  112 claims; read-back credits 11 of 11 correct. Too few flags remained (3 to 5 per family) to judge justification.

## Install

```
/plugin marketplace add bloknayrb/claudestuff
/plugin install claim-ledger@claudestuff-marketplace
```

## Develop

Run `claude --plugin-dir plugins/claim-ledger` once; it lays down `.claude-plugin/types/` (git-ignored). Then:

```
claude plugin test plugins/claim-ledger
claude plugin validate plugins/claim-ledger
npx -y -p typescript@5 tsc -p plugins/claim-ledger
```

`node plugins/claim-ledger/scripts/precision.mjs <out> <list>` replays the detector over a list of transcripts. Its output holds transcript
text and must stay out of the repository.
