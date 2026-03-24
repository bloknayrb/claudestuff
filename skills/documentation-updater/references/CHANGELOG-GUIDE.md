# Changelog Generation Guide

This reference provides guidance for generating and updating CHANGELOG.md files. It covers the Keep a Changelog format, generation from conventional commits, and fallback strategies for repos without structured commit history.

---

## Keep a Changelog Format

The standard format for human-readable changelogs.

### Structure

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- New feature description

## [1.2.0] - 2024-03-15

### Added
- Feature A description
- Feature B description

### Changed
- Modified behavior description

### Fixed
- Bug fix description

## [1.1.0] - 2024-02-01

### Added
- Initial feature set

[Unreleased]: https://github.com/user/repo/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/user/repo/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/user/repo/releases/tag/v1.1.0
```

### Section Types

Use only the sections that have entries. Don't include empty sections.

| Section | When to use |
|---------|------------|
| `### Added` | New features, new capabilities |
| `### Changed` | Changes to existing functionality, behavior modifications |
| `### Deprecated` | Features marked for future removal |
| `### Removed` | Features that have been removed |
| `### Fixed` | Bug fixes |
| `### Security` | Vulnerability fixes, security patches |

### Rules

- Reverse chronological order (newest first)
- `## [Unreleased]` section always at the top for changes not yet in a release
- Version headers: `## [x.y.z] - YYYY-MM-DD`
- Comparison links at the bottom of the file (see template above)
- One entry per user-visible change — don't list every commit

---

## Generating from Conventional Commits

When commit messages follow the conventional commit format (`type(scope): description`), map them to changelog sections:

| Commit Type | Changelog Section | Notes |
|-------------|------------------|-------|
| `feat:` | Added | New features |
| `fix:` | Fixed | Bug fixes |
| `perf:` | Changed | Performance improvements |
| `refactor:` | — | Usually omit (internal change) |
| `docs:` | — | Omit unless user-facing doc changes |
| `chore:` | — | Omit |
| `ci:` | — | Omit |
| `test:` | — | Omit |
| `build:` | — | Omit unless it affects the user (e.g., new platform support) |
| `BREAKING CHANGE:` | Changed (with callout) | Always include, prominently |

### Breaking changes

A `!` suffix (`feat!:`) or `BREAKING CHANGE:` footer indicates a breaking change. These should be:
- Listed in the `Changed` section
- Prefixed with **BREAKING:** or given their own subsection
- Accompanied by migration instructions when possible

### Scopes

If commits use scopes (`feat(auth): add OAuth2`), group entries by scope or use the scope as context in the entry text: "Add OAuth2 support to authentication module."

---

## Non-Conventional Commit Fallback

When commit messages are unstructured ("fix stuff", "WIP", "updates", "merge branch"):

**Do not generate a changelog from these messages.** The result will be useless or misleading.

Instead, use a diff-based approach:

### Step 1: Identify version boundaries

1. Check for git tags matching `vX.Y.Z` or `X.Y.Z` patterns
2. Check for release branches
3. Check if the manifest version field changed in git history
4. If no version markers exist, treat the entire history as `[Unreleased]`

### Step 2: Analyze changes between versions

For each version boundary, analyze the actual code changes:

- **New files** → likely `Added` (examine to confirm they represent new features)
- **Deleted files** → likely `Removed`
- **Modified files** → `Changed` or `Fixed` (examine the diff to characterize)
- **Dependency changes** → may warrant an entry if they affect the user (e.g., dropping support for an old runtime)

### Step 3: Draft and confirm

1. Group findings by changelog section type
2. Write entries from the user's perspective (what changed for them, not what code changed)
3. Present the draft to the user for review: "Here's what I found. Which of these should appear in the changelog? Are there changes I missed?"
4. Some changes are internal (refactoring, CI updates) and shouldn't appear — let the user decide

---

## Style Guidelines

### Write for the user, not the developer

Bad: "Refactor ThemeProvider component to use context API"
Good: "Add dark mode support"

Bad: "Fix null check in UserService.getById"
Good: "Fix crash when loading a deleted user's profile"

### Use imperative mood

Start each entry with a verb: Add, Fix, Remove, Update, Change, Deprecate, Improve.

### Be specific

Bad: "Fix upload bug"
Good: "Fix crash when uploading files larger than 2GB"

Bad: "Various improvements"
Good: "Improve search results relevance for multi-word queries"

### Group related changes

If three commits all fixed different aspects of the same feature, combine them into one entry:
"Fix several issues with CSV export: handle special characters in fields, correct date formatting, and support files larger than 1GB"

### Omit internal changes

Don't include:
- Dependency bumps (unless they affect minimum runtime version or drop a platform)
- CI/CD changes
- Test additions (unless they indicate a fix)
- Code formatting or linting changes
- Internal refactoring with no user-visible impact

### Breaking changes need migration guidance

Bad: "Remove legacy API endpoint"
Good: "Remove `/api/v1/users` endpoint. Use `/api/v2/users` instead. See [migration guide](docs/migration-v2.md)."

---

## Determining Version Boundaries

When generating a changelog for the first time:

1. **Tags exist**: Ask the user to run `git tag -l 'v*'` and provide the output. Each tag is a version boundary.
2. **No tags, but manifest versions changed**: Ask the user to run `git log --oneline -- package.json` (or the relevant manifest file) to find version bump commits.
3. **No tags, no version changes**: Everything is `[Unreleased]`. Ask the user what version to assign.
4. **GitHub Releases exist**: These often contain release notes that can seed the changelog. Check if the repo uses releases as its primary changelog.

**Note:** This skill does not have Bash access. Git commands listed above require the user to run them and provide the output. When you need commit history or tag information, ask the user to run the relevant git command rather than attempting to execute it directly.
