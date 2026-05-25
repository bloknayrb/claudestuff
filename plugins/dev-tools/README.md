# dev-tools

Software-development tooling for Claude Code. This is the consolidation home for
dev-focused capabilities — it starts with **local CI workflow testing** and will
grow to hold other software-development tools.

## wrkflw — validate and run CI workflows locally

[`wrkflw`](https://github.com/bahdotsh/wrkflw) is a CLI/TUI that validates and
executes GitHub Actions (and GitLab CI) workflows on your machine. This plugin
teaches Claude when and how to drive it, so you catch broken CI **before** you
push — instead of the "push → red CI → fix → push" loop.

### Components

- **`wrkflw` skill** — subcommand selection (validate / run / watch / tui /
  trigger / list), runtime-mode guidance (docker / podman / emulation /
  secure-emulation), copy-paste recipes, and the tool's known limitations. Loads
  a `references/command-reference.md` on demand for the full flag surface.
- **`/wrkflw` command** — explicit entry point. Defaults to validating detected
  workflows; pass through any subcommand/flags (e.g. `/wrkflw run --job build`).
- **Pre-push hook** — a non-blocking `PreToolUse` reminder that fires on
  `git push` *only when the repo has CI files* (`.github/workflows/` or
  `.gitlab-ci.yml`), nudging Claude to validate them locally first.

### When the skill triggers

Validating or running GitHub Actions / GitLab CI locally, testing CI before
pushing, debugging a failing action, or working with `.github/workflows` files.

## Plan-review hook

A `PreToolUse` hook on the `ExitPlanMode` tool that blocks plan submission until
the plan has been reviewed by agents. When Claude submits a plan, the hook denies
the call with step-by-step instructions to dispatch a review agent, fold the
findings back into the plan, and append a marker line:

```
[plan-reviewed-by-agents: general-purpose; no blocking issues]
```

Once that marker is present in the plan text, submission is allowed.

> **Heads up — this hook is global.** Once the plugin is enabled it gates
> **every** `ExitPlanMode` call in **all** your projects and sessions, not just
> repos with CI. The bypass marker is self-attested by design: its job is to
> remind a forgetful Claude to review the plan, not to enforce against an
> adversarial one. To turn it off, disable the dev-tools plugin or remove the
> `ExitPlanMode` matcher object from `hooks/hooks.json`.

## Requirements

Install the `wrkflw` binary:

```bash
cargo install wrkflw
# or
brew install wrkflw
```

Docker or Podman are only needed for those runtimes — the `emulation` runtime
needs nothing extra.

> **Note:** a green local run is not a guarantee CI passes. wrkflw does not
> support encrypted secrets, service containers, concurrency groups, non-Linux
> runners, or private remote `uses:`. When those matter, confirm on real CI.

## Installation

```
/plugin marketplace add bloknayrb/claudestuff
```

Or install just this plugin:

```
/plugin add bloknayrb/claudestuff/plugins/dev-tools
```
