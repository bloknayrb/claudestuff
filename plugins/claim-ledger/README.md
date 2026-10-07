# Claim Ledger

Checks end-of-turn claims ("tests pass", "builds cleanly", "I've pushed") against the tool calls that actually ran, and
puts one line beneath the answer for each claim with no evidence or only weak evidence.

## Limits

- **Task notifications are not read.** A background run becomes evidence only when a later tool call reads its result
  back (its task output, or a file it wrote) and that read shows a status or summary. The completion notification that
  arrives between turns is not a tool call, so a background run whose result was only reported that way stays weak.
- **A status held in a variable before the echo is missed.** `git push > log 2>&1; ec=$?; echo "push exit $ec"` echoes
  `$ec`, not `$?`, so the echo is not read as the push's exit status. Echo `$?` (or `${PIPESTATUS[n]}`) directly.
- **`git ls-remote` matching `HEAD` is not counted** as push evidence. A push is confirmed by its own output (`a..b x -> y`,
  `[new branch]`, `set up to track`), an echoed exit status, or the result's `gitOperation`.
- **Code changed through Bash** counts as an edit only when the result lists the file (`bashEditDiff`, an internal
  field that may be absent).
- **Read-back keys are paths as the command names them.** A path is resolved from the session root through the command's
  own `cd`s, with `$TEMP`, `$HOME` and assignments made on the line expanded. A log named through a loop variable or an
  environment variable set elsewhere is matched only when the reader names it the same way.
- **A push's pre-push suite counts as test evidence** only when a read-back of that push shows the runner's summary.
- **Some PowerShell loops can be credited.** Runs inside a loop are never strong evidence, but PowerShell's `%` alias,
  `do { ... } while (...)` / `do { ... } until (...)` and `.ForEach({ ... })` are not recognised as loops.
- **Some bash loops can be credited:** a loop inside backtick substitution, `until bash -c "..."`, a function called
  inside a loop, and `select`.
- **PowerShell loops weaken runs to the end of the command.** Braces are not tracked, so a run after a `foreach`,
  `ForEach-Object`, `while` or `for` block in the same command is weak too.
- **Temp-file names are shared machine-wide.** A read-back matches a log by path; `$TEMP/push.log` written by another
  session at the same time would be read as this session's run.
- **Log paths resolve from the session root,** not the shell's persisted working directory: relative log names written
  from two different persisted directories can collide.
- **`cmd /c`, `cargo +nightly test`, `node --test` and `yarn workspace X test` are not recognised** as runs.
- **Read-back keys keep `..` segments as written.** A log written as `repo/../push.log` and read as `push.log` (or the
  other way round) is not matched, so the run stays weak.
- **A segment over 1,000 characters is not matched** for runners or git operations: it yields no run, so a true claim
  resting on a very long command gets a "no run" note.
- **A git operation the tool result records (`gitOperation`) can be credited inside a loop** when the command itself
  was not matched: `eval "git push"` in a loop, or a push segment over 1,000 characters in a loop.
