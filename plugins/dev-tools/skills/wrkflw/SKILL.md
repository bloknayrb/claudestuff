---
name: wrkflw
description: >-
  This skill should be used when the user wants to validate or run GitHub
  Actions or GitLab CI workflows locally, test CI before pushing, debug a
  failing action without burning CI minutes, check ".github/workflows" or
  ".gitlab-ci.yml" files, or use wrkflw (an `act` alternative). Also triggers
  before pushing changes that touch workflow files. Provides subcommand
  selection (validate/run/watch/tui/trigger/list), runtime-mode guidance
  (docker/podman/emulation), copy-paste recipes, and the tool's known
  limitations so expectations are set correctly.
version: 1.0.0
tags: [ci, github-actions, gitlab-ci, devops, wrkflw, local-testing]
---

# wrkflw: validate and run CI workflows locally

`wrkflw` is a CLI/TUI that validates and executes GitHub Actions (and GitLab CI)
workflows on your machine. Use it to catch broken CI **before** pushing, instead
of the "push → red CI → fix → push" loop.

## When to use this skill

- Before pushing changes that touch `.github/workflows/` or `.gitlab-ci.yml`.
- A workflow is failing on GitHub and you want to reproduce it locally.
- You're authoring or editing a workflow and want fast feedback.
- You want to remotely trigger a workflow or pipeline without opening the browser.

## Step 1 — confirm wrkflw is installed

Run `wrkflw --version`. If it's missing, offer to install:

- `cargo install wrkflw` (Rust toolchain), or
- `brew install wrkflw` (macOS/Linux).

Container runtimes (`docker`/`podman`) are only needed for those execution modes.
The `emulation` runtime needs nothing extra — prefer it for quick checks.

## Step 2 — pick the subcommand

| Goal | Command |
|------|---------|
| Syntax/structure check | `validate` |
| Actually execute a workflow locally | `run` |
| Re-run affected workflows on file change | `watch` |
| Interactive exploration | `tui` (or bare `wrkflw`) |
| Remotely fire a workflow / pipeline | `trigger` / `trigger-gitlab` |
| Enumerate detected workflows | `list` |

**Default pre-push gate:** `validate`. It's fast and needs no containers. It
returns a non-zero exit code on validation errors **by default**, so it's safe
to gate a push or CI step on it. Pass `--no-exit-code` if you want a report
without failing the process.

## Step 3 — choose a runtime (for `run`/`watch`/`tui`)

| Runtime | Containers | Isolation | Use when |
|---------|-----------|-----------|----------|
| `docker` | yes | full | You want CI parity (wrkflw's default) |
| `podman` | yes | full, rootless | Security-focused / no Docker daemon |
| `emulation` | no | none | Fast local sanity check (no containers needed) |
| `secure-emulation` | no | sandboxed | Running untrusted workflows |

`docker` is wrkflw's default; reach for `emulation` when you want a quick check
without a container runtime. Set with `--runtime <mode>`, or cycle with `e` in
the TUI.

## Golden recipes

```bash
# Validate everything in .github/workflows (the pre-push gate; fails on errors)
wrkflw validate

# Validate a single file
wrkflw validate .github/workflows/ci.yml

# Validate a GitLab pipeline
wrkflw validate .gitlab-ci.yml --gitlab

# Run just one job (a PATH is required for run)
wrkflw run --job build .github/workflows/ci.yml

# Run only workflows affected by changed files, simulating a push
wrkflw run --diff --event push .github/workflows/ci.yml

# Simulate a pull_request event
wrkflw run --event pull_request --base-branch main --diff .github/workflows/ci.yml

# Run with full container parity
wrkflw run --runtime docker .github/workflows/ci.yml

# Remotely trigger a workflow_dispatch (needs GITHUB_TOKEN)
wrkflw trigger deploy --branch main --input env=staging
```

When a run fails and you need to inspect the container, add
`--preserve-containers-on-failure`.

## Limitations — set expectations before relying on a local pass

A green `wrkflw` run is **not** a guarantee CI will pass. wrkflw does **not**
support:

- GitHub encrypted secrets and fine-grained permissions
- Service containers (`services:` is parsed but not executed)
- Concurrency groups / `cancel-in-progress`
- Windows/macOS runners (mapped to container images; `runner.os` reflects host)
- Remote `uses:` from **private** repositories

When any of these are central to the workflow, fall back to real CI for the
final check.

## Secrets

`${{ secrets.* }}` resolves from env vars, a `~/.wrkflw/secrets.yml` file
(JSON/YAML/.env), or HashiCorp Vault / AWS / Azure / GCP secret managers. See
`references/command-reference.md` for the full flag and configuration surface.
