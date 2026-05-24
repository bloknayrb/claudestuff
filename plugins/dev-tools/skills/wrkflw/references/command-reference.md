# wrkflw command reference

Full subcommand and flag surface. Load this when the SKILL.md recipes don't
cover the flag you need.

## Installation

- `cargo install wrkflw`
- `brew install wrkflw`
- From source: clone the repo, `cargo build --release`.

## `wrkflw` (bare) — default TUI

Launches the interactive terminal UI, auto-detecting `.github/workflows`. No
arguments required. Equivalent to `wrkflw tui`.

## `validate`

Check workflow syntax and structure. CI/CD-compatible exit codes.

```
wrkflw validate [PATH(S)] [--gitlab] [--verbose] [--no-exit-code]
```

- `--gitlab` — validate a GitLab `.gitlab-ci.yml`.
- `--verbose` — detailed output.
- `--exit-code` — set exit code to `1` on validation failure. **On by default**,
  so plain `wrkflw validate` already gates.
- `--no-exit-code` — don't set a failing exit code (overrides `--exit-code`);
  use for a report-only run.

Examples:
```
wrkflw validate
wrkflw validate path/to/workflow.yml
wrkflw validate .gitlab-ci.yml --gitlab
```

## `run`

Execute workflows locally. Requires an explicit `<PATH>` to a workflow/pipeline
file (unlike `validate`, which defaults to `.github/workflows`).

- `--runtime [docker|podman|emulation|secure-emulation]` — execution environment
  (default: `docker`).
- `--job <NAME>` — run only the named job.
- `--event <TYPE>` — simulate a trigger event (`push`, `pull_request`, …).
- `--diff` — skip workflows not matching changed files. Pair with
  `--diff-base` / `--diff-head` to set the comparison range.
- `--changed-files <CSV>` — explicitly list modified files.
- `--base-branch <NAME>` — required for `pull_request` under strict mode.
- `--no-strict-filter` — disable strict event/path filtering rejection.
- `--preserve-containers-on-failure` — keep failed containers for debugging.

Examples:
```
wrkflw run .github/workflows/ci.yml
wrkflw run --runtime podman .github/workflows/ci.yml
wrkflw run --job build .github/workflows/ci.yml
wrkflw run --diff --event push .github/workflows/ci.yml
wrkflw run --diff --diff-base origin/main --diff-head HEAD .github/workflows/ci.yml
wrkflw run --event pull_request --base-branch main --diff .github/workflows/ci.yml
```

## `watch`

Monitor file changes and re-run affected workflows with trigger-aware filtering.

- `--event <TYPE>` — simulate event type.
- `--base-branch <NAME>` — for `pull_request` events.
- `--max-concurrency <N>` — cap parallel executions.
- `--debounce <MS>` — delay before re-run.
- `--ignore-dir <PATH>` — exclude directories beyond the built-in list.

Example:
```
wrkflw watch --event pull_request --base-branch main --max-concurrency 2
```

## `tui`

Open the terminal UI explicitly, with optional runtime override.

```
wrkflw tui --runtime podman
```

TUI tabs: Workflows · Execution · DAG · Logs · Trigger · Secrets · Help.
Controls: `Tab`/`Shift+Tab` navigate tabs · `Space` select · `Enter` run/details
· `r` execute selected · `e` cycle runtime · `v` toggle validate/execute · `d`/`D`
diff filter / simulate event · `t` remote trigger · `,` tweaks overlay · `?` help.

## `trigger` (GitHub)

Remotely fire a `workflow_dispatch`. Requires `GITHUB_TOKEN`.

```
wrkflw trigger <WORKFLOW-NAME> --branch main --input key=value
```

## `trigger-gitlab`

Remotely trigger a GitLab pipeline. Requires `GITLAB_TOKEN`. Takes no positional
argument — the project is resolved from the local git remote.

```
wrkflw trigger-gitlab --branch main --variable key=value
```

## `list`

Show detected workflows and pipelines in the current directory.

```
wrkflw list
```

## Runtime modes

| Mode | Container | Isolation | Best use |
|------|-----------|-----------|----------|
| `docker` | yes | full | Production, CI/CD parity |
| `podman` | yes | full (rootless) | Security-focused |
| `emulation` | no | none | Quick local testing |
| `secure-emulation` | no | sandboxed processes | Untrusted workflows |

## Supported GitHub Actions features

Implemented: Docker-container / JavaScript / composite / local actions; reusable
workflows with output propagation (local and remote `owner/repo/path@ref`);
artifact upload/download and cache; inter-job outputs via
`needs.<id>.outputs.*`; GitHub context variables and output mechanisms
(`GITHUB_OUTPUT`, `GITHUB_ENV`, `GITHUB_PATH`, `GITHUB_STEP_SUMMARY`); matrix
builds (`include`, `exclude`, `max-parallel`, `fail-fast`); expression evaluation
(`toJSON`, `fromJSON`, `contains`, `startsWith`, …); job dependency resolution
and parallel execution.

Not supported: encrypted secrets and fine-grained permissions; service
containers (`services:` parsed but not executed); concurrency groups /
`cancel-in-progress`; Windows/macOS runners (mapped to container images,
`runner.os` reflects host); remote `uses:` from private repos.

## GitLab CI support

- Validate: `wrkflw validate .gitlab-ci.yml --gitlab`
- Remote trigger: `trigger-gitlab`
- Local pipeline execution.

## Secrets

`${{ secrets.* }}` backends: environment variables; file-based (JSON, YAML,
`.env`); HashiCorp Vault; AWS Secrets Manager; Azure Key Vault; Google Cloud
Secret Manager. Configured via `~/.wrkflw/secrets.yml`; supports AES-256-GCM
encryption and masking.
