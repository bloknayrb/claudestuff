# anti-slop

Pre-PR branch quality audit that catches the gap between what you *said* you changed and what you *actually* changed.

## The Problem

Claude's most common quality failure when creating PRs: the description reflects the conversation context rather than the actual diff. You discuss five approaches, settle on one, and the PR description reads like a summary of the discussion instead of a description of the code changes.

## What It Does

The **anti-slop audit agent** runs 6 checks before you open a PR, ordered by value:

1. **Description-diff alignment** (headline) — Compares the PR description against `git diff --stat` to catch generic boilerplate, file narration ("Updated foo.ts"), or conversation-derived descriptions that don't match the actual changes.
2. **Commit messages** — Conventional commits format, imperative mood, under 72 chars, Co-Authored-By trailer (warn-only).
3. **Branch name** — Checks for `type/description` pattern, flags work directly on main/master.
4. **PR quality** — Title format, description substance, issue references, maintainer modifications enabled.
5. **Template compliance** — If the repo has a PR template, verifies all sections are filled in and checkboxes checked.
6. **File hygiene** — Flags touches to protected files (README, LICENSE, etc.) and missing final newlines.

## Usage

### Invoke directly

The audit agent runs proactively when you're about to create a PR, or invoke it explicitly:

> "Run the anti-slop audit on this branch"

### Hook reminder

The plugin includes a `PreToolUse` hook that fires when `gh pr create` is detected in a Bash command. It injects a reminder to run the audit first — it doesn't block, just nudges.

### Graceful degradation

- No `gh` CLI? PR-dependent checks (1, 4, 5) are skipped; git-only checks (2, 3, 6) still run.
- No PR yet? Same — git-only checks run, with a note that PR checks become available after `gh pr create`.
- Huge diff (50+ files)? Truncated with a note.

## Companion: CLAUDE.md Quality Rules

The audit agent catches issues at PR time, but baseline quality rules should be always-active. Add these to your `~/.claude/CLAUDE.md` so they apply across all projects:

```markdown
## Code Quality Standards

### Behavioral Defaults
- Conventional commits: `type(scope): description` — types: feat, fix, refactor, docs, test, chore, ci, perf, style, build
- Subject line: imperative mood, under 72 chars, no trailing period
- Commit body explains *why*, not *what* — the diff shows what changed
- Always include Co-Authored-By trailer when making commits
- Don't commit directly to main/master
- Use `type/short-description` branch names (e.g., `feat/user-auth`, `fix/null-pointer`)
- All files end with a newline
- Don't touch README.md, LICENSE, SECURITY.md, or CODE_OF_CONDUCT.md unless that's the explicit task
- Comments explain *why*, not *what* — don't over-annotate obvious code
- Never use AI filler: "I've gone ahead and", "Certainly!", "I hope this helps", "Let me know if you need anything else"
- PR descriptions should read like a developer wrote them, not an assistant

### Pre-PR Discipline
- Before writing a PR description, run `git diff <base>..HEAD` and describe *what the diff shows*, not what the conversation discussed
- PR title follows conventional commits format, under 72 chars
- Description explains the *motivation and impact* — why this change, what problem it solves, what reviewers should pay attention to
- Use `Closes #N` or `Fixes #N` when resolving an issue
- If the repo has a PR template, fill in every section substantively — never leave boilerplate unchanged
- Allow maintainer modifications
- One PR per concern — don't bundle unrelated changes
```

## Installation

```
/plugin marketplace add bloknayrb/claudestuff
```

Or install just this plugin:

```
/plugin add bloknayrb/claudestuff/plugins/anti-slop
```
