---
description: Validate (or run) GitHub Actions / GitLab CI workflows locally with wrkflw
---

## wrkflw

Drive the `wrkflw` CLI to validate or run CI workflows locally. Invoke the
`wrkflw` skill for full guidance, then follow these steps.

Arguments (optional): `$ARGUMENTS`
- No args, or `validate` → validate detected workflows (default).
- `run [flags]` → execute locally (e.g. `/wrkflw run --job build`).
- Any other wrkflw subcommand/flags → pass through.

### Step 1: Confirm wrkflw is installed

Run `wrkflw --version`. If it's missing, tell the user and offer
`cargo install wrkflw` or `brew install wrkflw`. Do not continue until it's
available.

### Step 2: Detect what's present

Run `wrkflw list` to see the workflows and pipelines in the repo. If none are
found, report that and stop.

### Step 3: Act on the arguments

- **Default / `validate`:** run `wrkflw validate` (add `--gitlab` when the target
  is `.gitlab-ci.yml`), and treat a non-zero exit as failure — validate fails on
  errors by default.
- **`run`:** run `wrkflw run <PATH>` with the user's flags — `run` requires an
  explicit workflow path. Prefer `--runtime emulation` for a quick check unless
  the user asked for `docker`/`podman` parity. Suggest `--job <name>` to avoid
  running every job.
- **Passthrough:** for any other subcommand, run it as given.

### Step 4: Report

Summarize the result: which workflows/jobs ran, pass/fail per workflow, and the
first actionable error if anything failed. If failures stem from an unsupported
feature (encrypted secrets, `services:`, concurrency, private remote `uses:`),
say so and note that final confirmation needs real CI.
