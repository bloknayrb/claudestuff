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
