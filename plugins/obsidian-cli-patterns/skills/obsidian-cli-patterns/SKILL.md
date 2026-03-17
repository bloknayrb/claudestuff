---
name: obsidian-cli-patterns
description: >-
  Use when deciding whether to use Obsidian CLI vs direct file operations,
  building multi-step vault automation workflows, or troubleshooting CLI
  behavior. Provides decision frameworks, workflow recipes, and common pitfalls.
  For command syntax, use the obsidian-cli skill or run obsidian help.
version: 1.0.0
tags: [obsidian, cli, automation, vault, workflows]
allowed-tools: [Bash, Read]
---

# Obsidian CLI Patterns

This skill teaches **when and how** to use the Obsidian CLI effectively. It does not duplicate command syntax — for that, use the `obsidian-cli` skill (from the official obsidian-skills plugin) or run `obsidian help <command>`.

What this skill adds:
- Decision frameworks for CLI vs direct file operations
- Workflow recipes combining CLI with other tools
- Common pitfalls and how to avoid them
- Integration guidance with other Obsidian skills

## When to Use CLI vs Direct File Operations

The Obsidian CLI communicates with a running Obsidian instance over IPC. This gives it access to Obsidian's live index — resolved links, backlinks, tags, properties, search — but it also means **Obsidian must be running** for CLI commands to work.

### CLI Required

These operations depend on Obsidian's internal index and cannot be replicated with direct file operations:

- **Orphan detection** (`file:orphans`) — requires the full link graph
- **Unresolved link detection** (`link:unresolved`) — needs link resolution against all files
- **Backlink queries** (`link:backlinks`) — reverse link graph lookup
- **Search** (`search`) — uses Obsidian's indexed search, including content and metadata
- **Task queries** (`task:list`) — parses task syntax across the vault with filters
- **Base queries** (`base:query`) — executes .base file queries against live data

### CLI Preferred

These can be done with direct file ops, but CLI is more reliable or convenient:

- **Property operations** (`property:get`, `property:set`) — CLI handles YAML frontmatter parsing correctly, avoids edge cases with multi-value properties, aliases, and type coercion
- **Link resolution** (`link:resolve`) — CLI uses Obsidian's resolution rules (shortest path, aliases, display names)
- **File creation from templates** (`file:create` with `template=`) — applies template variables and triggers Obsidian's post-creation hooks
- **Daily note operations** (`daily:open`, `daily:read`) — respects daily note settings (format, folder, template) without you needing to replicate the config
- **Tag listing** (`tag:list`) — aggregates tags from frontmatter and inline, with counts

### Direct File Ops Preferred

Use Read/Write/Edit/Glob/Grep directly when:

- **Obsidian is not running** — CLI will fail silently or error
- **Bulk content editing** — reading file content, regex replacements, restructuring sections
- **File manipulation** — renaming, moving, or deleting files outside Obsidian's awareness (note: Obsidian will re-index on next focus)
- **Performance-critical batch operations** — direct I/O is faster than IPC for hundreds of files
- **Content that doesn't need Obsidian features** — plain text manipulation, frontmatter you'll parse yourself

### Combined Approaches

Many workflows benefit from mixing both:

1. **CLI for discovery, direct ops for transformation** — use `search` or `file:orphans` to find targets, then Read/Edit the files directly
2. **Direct ops for creation, CLI for verification** — write files with Write tool, then use `link:unresolved` to verify no broken links
3. **CLI for metadata, direct ops for content** — use `property:get` to read frontmatter, then Edit for content changes

### Indexing Lag Caveat

Files created or modified in the last ~60 seconds may not appear in CLI query results. Obsidian's indexer runs asynchronously, so there's a window where newly created files exist on disk but aren't in the search index, link graph, or tag aggregation.

**Workaround:** When a workflow creates files then queries them, insert a brief delay or split into two passes — create all files first, then run queries in a separate step.

### Multi-Vault Awareness

When multiple vaults are open in Obsidian, CLI commands default to the most recently focused vault. This is a silent default — there's no warning if you're targeting the wrong vault.

**Rule:** Always pass `vault=<vault-name>` as the first parameter for any destructive or write operation (`move`, `delete`, `property:set`, `file:create`). For read-only queries, omitting `vault=` is acceptable if you verify the output matches expectations.

## Universal Parameters

These parameters work across most CLI commands. Understanding *when* to use each matters more than knowing they exist.

### Output Control

- **`silent`** — Prevents Obsidian from opening/focusing files during the operation. **Essential for batch operations** — without it, each `file:create` or `file:open` will steal focus and flash files on screen. Always use in loops.
- **`format=json`** — Returns structured JSON instead of human-readable text. Use when you need to parse the output programmatically. Skip it for quick manual checks — the overhead of JSON parsing isn't worth it for one-off queries.
- **`total`** — Returns only the count, not the items. Useful for health checks ("how many orphans?") without dumping hundreds of lines.

### Performance Control

- **`limit=N`** — Caps the number of results. **Critical on large vaults** — commands like `search`, `file:list`, or `tag:list` can return thousands of results. Always set a limit for exploratory queries; remove it only when you need exhaustive results.
- **`sort=<field>`** — Sorts results server-side. More efficient than sorting after retrieval.

### Filtering

- **`path=<folder>`** — Restricts operations to a folder subtree. Use for scoped searches, per-project sweeps, or avoiding accidental changes outside the target area.
- **`verbose`** — Adds extra detail (paths, dates, sizes) to output. Useful for debugging but noisy for production workflows.

### Clipboard

- **`--copy`** — Copies the result to the system clipboard. Handy for one-off queries where you need the output in another app, but don't use in scripts — it overwrites the clipboard on each call.

## Command Categories

Each category below describes *when to reach for it*. For actual command signatures and parameters, see `references/command-categories.md`.

### Core & System
System health, vault info, version checks. Reach for these when verifying CLI availability, checking vault state, or scripting availability-first automation.

### Daily Notes
Creating, reading, and appending to daily notes. Use when automating daily workflows — task rollover, log entries, standup prep — without needing to know the daily note path/format.

### Files
File CRUD operations. Use when creating from templates, moving/renaming with link updates (CLI updates internal links automatically), or listing files with metadata.

### Search
Full-text and metadata search. The primary discovery mechanism — use before any bulk operation to identify targets. Supports Obsidian's full query syntax including `tag:`, `path:`, `file:`, boolean operators.

### Tasks
Task listing and filtering. Use for task aggregation across the vault, status checks, and feeding task data into reports or daily notes.

### Tags & Properties
Tag aggregation and frontmatter property operations. Use for metadata audits, bulk property updates, and tag-based filtering. Property operations handle YAML parsing correctly — prefer over manual frontmatter editing.

### Links & Structure
Link resolution, backlinks, orphan detection, unresolved links. The analytical powerhouse — use for vault health checks, link audits, and understanding document relationships.

### Bookmarks
Bookmark management. Niche but useful for programmatic bookmark organization and building navigation structures.

### Templates
Template listing and application. Use when creating files from templates programmatically, especially in batch operations.

### Bases
Query .base files for structured data. Use when extracting tabular data from vault content for analysis or export.

### Sync & Publish
Sync and publish operations. Use sparingly — these affect shared state. Useful for scripted publish workflows.

### Themes & Plugins
Plugin and theme management. Primarily for plugin development: reload, inspect, toggle.

### Developer Tools
Console access, screenshots, DOM inspection, JavaScript execution. For plugin development and debugging. See the official `obsidian-cli` skill for detailed plugin development workflows — it covers the reload-errors-screenshot-console cycle thoroughly.

## Workflow Patterns

These are brief sketches of common multi-step workflows. For complete step-by-step recipes with code, see `references/workflow-recipes.md`.

### Vault Health Check
Combine `file:orphans`, `link:unresolved`, and search for empty files to generate a vault health report. Use `total` for summary counts, full output for actionable lists.

### Bulk Property Update
Search for target files by tag, path, or content → iterate results → `property:set` with `silent` on each. Always preview the search results before running the update loop.

### Content Migration
Search old location → read each file → create in new location with `silent` → verify link integrity with `link:unresolved` → delete originals. Run in two phases: create-then-verify, delete only after verification.

### Search-and-Transform
Search with `format=json` → parse results → read each file → apply transformation → write back. Use for bulk reformatting, content standardization, or metadata extraction.

### Link Audit
Combine `link:backlinks` (for each key file), `file:orphans`, `link:unresolved`, and search for dead external links → structured report. Useful as a periodic maintenance task.

### Daily Note Rollover
Read yesterday's daily note → extract incomplete tasks → create/open today's note → append tasks. The CLI handles daily note path resolution, so you don't need to compute date-based paths.

### Template Batch Creation
Loop over a list of names/parameters → `file:create` with `template=` and `silent` → `property:set` for custom properties on each. Useful for project setup, meeting series, or content scaffolding.

### Availability-First Automation
Check CLI availability with `obsidian version` (with timeout) → if available, use CLI path → if not, fall back to direct file operations. Pattern from vault-sweeping's dual-mode detection.

## Common Pitfalls

### 1. Forgetting `silent` in Batch Operations
Every `file:create`, `file:open`, or `daily:open` without `silent` will open/focus the file in Obsidian. In a loop of 50 files, this means 50 focus steals. Always add `silent` to batch operations.

### 2. `file=` vs `path=` Confusion
`file=` takes a file name or path relative to vault root (e.g., `file=Projects/todo.md`). `path=` is a filter parameter restricting scope to a folder. Mixing them up produces empty results or targets wrong files. When in doubt: `file=` for specific files, `path=` for folder scope.

### 3. CLI When Obsidian Isn't Running
The CLI communicates over IPC with a running Obsidian instance. If Obsidian isn't running, commands either hang, return empty results, or error — the behavior is inconsistent. Always verify with a quick `obsidian version` (with a 3-second timeout) before starting CLI-dependent workflows.

### 4. Skipping `format=json` for Parsed Output
Human-readable output is convenient for eyeballing but fragile for parsing — format changes between versions, and edge cases (file names with special characters, multi-line properties) break naive string splitting. Use `format=json` whenever you'll process the output programmatically.

### 5. Expensive Commands Without `limit` on Large Vaults
Commands like `search`, `file:list`, `tag:list`, and `task:list` scan the entire vault. On a 10,000+ note vault, this can take seconds and produce massive output. Always set `limit` for exploratory queries. Remove it only for exhaustive operations where you've already scoped with `path=`.

### 6. `move` Needs Full Target Path
`file:move` requires the complete destination path including the `.md` extension: `file:move file=old.md to=NewFolder/old.md`. Omitting the extension or providing only a folder path will fail or produce unexpected results.

### 7. Indexing Lag After File Creation
Files created in the last ~60 seconds may not appear in search results, orphan detection, or link resolution. If you create files then immediately query them, you'll get stale results. Split create and query into separate phases or add a brief pause.

### 8. Wrong Vault Targeting
When multiple vaults are open, CLI defaults to the most recently focused vault with no warning. Destructive operations (`move`, `delete`, `property:set`) on the wrong vault are difficult to undo. Always pass `vault=<name>` for write operations when multiple vaults may be open.

### 9. `eval` Security
`obsidian eval` executes arbitrary JavaScript with full access to the Obsidian API, vault data, and (via Node integration) the file system. Treat it with the same caution as shell access. Never pass unsanitized user input to `eval`. Never use it for operations that can be done with safer CLI commands.

## Integration with Other Skills

### Official obsidian-skills Plugin (kepano)

This skill complements, not replaces, the skills in the official obsidian-skills plugin:

- **obsidian-cli** — Covers command syntax and parameters. Use it for "how do I call this command?" Use *this* skill for "should I use the CLI for this, and what workflow pattern fits?"
- **obsidian-bases** — Teaches .base file creation and configuration. CLI `base:query` outputs data from existing bases; the obsidian-bases skill teaches how to build them. They complement — design bases with the skill, query them with CLI.
- **json-canvas** — Teaches .canvas file structure. CLI can open and create canvas files, but the json-canvas skill is the reference for node/edge format.
- **obsidian-markdown** — Covers Obsidian-flavored markdown syntax. CLI handles files containing this syntax but doesn't teach it.

> **Note:** These skills are from the official obsidian-skills plugin (kepano) and may not be installed. Check skill availability before referencing them in guidance.

### Vault Management Skills (this marketplace)

- **vault-sweeping** — Runs its own CLI availability check at sweep start and uses a dual-mode approach (CLI when available, direct ops as fallback). Use vault-sweeping directly for maintenance rather than replicating its detection logic. The indexing lag caveat documented here originated from vault-sweeping's implementation experience.
- **obsidian-productivity** — Task tracking and timesheet skills that can consume CLI output (task lists, daily note content) as input.

## Platform Notes

### macOS and Windows
Obsidian adds the `obsidian` command to PATH automatically on both platforms. No additional setup needed.

### Linux
Obsidian on Linux may not add `obsidian` to PATH. Common workaround: create a wrapper script at `/usr/local/bin/obsidian` that invokes the AppImage or Snap binary. Verify with `which obsidian` before running CLI workflows.

### IPC Requirement
All CLI commands require a running Obsidian instance. The CLI communicates via IPC (Inter-Process Communication), not by reading vault files directly. If Obsidian is closed, the CLI cannot function.

### Version Check Pattern
Use this pattern to verify CLI availability before starting a workflow:

```bash
timeout 3 obsidian version 2>/dev/null
```

If this returns a version string, the CLI is available. If it times out or errors, fall back to direct file operations.

## File and Vault Targeting

The official obsidian-cli skill covers `file=` vs `path=` syntax in detail. The key behavioral addition:

When multiple vaults are open, always pass `vault=` as the **first** parameter for destructive operations (`move`, `delete`, `property:set`) to avoid silently targeting the wrong vault. For read-only queries, omitting `vault=` is acceptable if you verify the output matches expectations — but adding it costs nothing and prevents surprises.

## References

- `references/command-categories.md` — Command signatures organized by category with behavioral tips
- `references/workflow-recipes.md` — Complete multi-step workflow recipes with code
