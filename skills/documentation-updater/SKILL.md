---
name: documentation-updater
description: >-
  This skill should be used when the user asks to "update documentation",
  "generate README", "audit docs", "add CHANGELOG", "fix outdated docs",
  "create CONTRIBUTING.md", "add API documentation", "check documentation
  coverage", or mentions documentation gaps, stale docs, or missing project
  documentation. Detects project type from manifest files, scores existing
  documentation quality, generates or updates README, CHANGELOG, CONTRIBUTING,
  and code documentation for any repository type.
version: 1.0.0
tags: [documentation, readme, changelog, contributing, api-docs, audit]
allowed-tools:
  - Read
  - Glob
  - Grep
  - Edit
  - Write
---

# Documentation Updater

Full-lifecycle documentation management for any repository. Detects project type, audits existing documentation quality, generates missing docs, updates stale content, and validates consistency.

## Intent Detection

Before starting any workflow, classify the user's request into one of three modes:

### Targeted Mode
The user names a specific document: "generate a README", "update my CHANGELOG", "add a CONTRIBUTING.md".
- Skip the full audit
- Detect project archetype (Stage 1, steps 1-4 only)
- Jump directly to Stage 2 for that single document type
- Still confirm before writing new files

### Audit-Only Mode
The user asks to check, review, or assess: "audit my docs", "what documentation am I missing", "check doc coverage".
- Run Stage 1 in full
- Output the gap report
- Stop — do not write anything unless the user asks to proceed

### Full Lifecycle Mode
The user asks to fix, update, or improve all docs: "fix my documentation", "update all docs", "bring docs up to date".
- Run Stage 1 → present gap report → get user confirmation → Stage 2 → Stage 3

---

## Stage 1: Discover and Assess

### Step 1: Detect Project Archetype

Glob for manifest files at the repository root:
- `package.json`, `pyproject.toml`, `setup.py`, `setup.cfg`
- `Cargo.toml`, `go.mod`, `go.sum`
- `pom.xml`, `build.gradle`, `build.gradle.kts`
- `*.csproj`, `*.fsproj`, `*.sln`
- `Gemfile`, `*.gemspec`
- `mix.exs`
- `composer.json`
- `Package.swift`
- `pubspec.yaml`

Read detected manifests to extract: project name, description, version, license, dependencies, scripts/commands, entry points.

**If no manifest found:** Fall back to file-extension scan. Glob for dominant file types (`*.py`, `*.js`, `*.ts`, `*.rs`, `*.go`, `*.java`, `*.rb`, `*.ex`, `*.php`, `*.swift`, `*.sh`, `*.tf`). Classify based on the dominant extension. If ambiguous or mixed, classify as "multi-language."

**If still ambiguous:** Ask the user: "I can't determine the project type automatically. What kind of project is this?" Proceed with a generic documentation audit — skip archetype-specific guidance.

For detailed detection logic, sub-archetype classification (data science, monorepo, CLI tool), and manifest field mappings, see [[PROJECT-DETECTION.md]].

### Step 2: Detect Documentation Frameworks

Check for documentation framework configuration files:
- `mkdocs.yml` → MkDocs
- `conf.py` (in `docs/` or root) → Sphinx
- `docusaurus.config.js`, `docusaurus.config.ts` → Docusaurus
- `_config.yml` (with Jekyll markers) → Jekyll
- `book.toml` → mdBook
- `.vitepress/` → VitePress

**If a doc framework is detected:** Warn the user that these frameworks manage their own documentation structure. This skill will not modify framework-managed files. It will still audit and update standalone files (README.md, CHANGELOG.md, CONTRIBUTING.md at the repo root).

### Step 3: Detect Non-English Documentation

If existing documentation files contain predominantly non-English text, confirm language preference with the user before proceeding: "Your existing docs appear to be in [language]. Should I continue in that language or switch to English?"

### Step 4: Inventory Existing Documentation

Glob for standard documentation files:
- `README*` (any extension or case variation)
- `CHANGELOG*`, `HISTORY*`, `CHANGES*`
- `CONTRIBUTING*`
- `LICENSE*`, `LICENCE*`
- `CODE_OF_CONDUCT*`
- `docs/` directory
- `.github/` directory (templates, workflows)

### Step 5: Score Documentation Quality

Score each doc type using the audit rubric (see Audit Rubric section below). Record scores and specific issues found.

### Step 6: Check Consistency

Run binary pass/fail checks:
- Install commands match the detected package manager
- Listed scripts/commands exist in the project manifest
- Internal documentation links resolve to existing files
- Referenced directories exist
- Badge URLs use the correct package/repo name

### Step 7: Output Gap Report

Present findings as a structured table:

```
| #  | Doc Type        | Status  | Score | Issue                              |
|----|-----------------|---------|-------|------------------------------------|
| 1  | README.md       | Stale   | 2b    | Install section references old PM  |
| 2  | CHANGELOG.md    | Missing | 0     | No changelog found                 |
| 3  | CONTRIBUTING.md | Stub    | 1     | Generic boilerplate, no specifics  |
| 4  | Code docs       | Partial | 2     | 60% of public API undocumented     |
```

**Consistency issues:**
```
| Check                  | Status | Detail                          |
|------------------------|--------|---------------------------------|
| Install command        | FAIL   | Says pip, project uses uv       |
| Scripts match manifest | PASS   |                                 |
| Internal links         | FAIL   | CONTRIBUTING.md → missing file  |
```

In full lifecycle mode, follow with: "Which items should I address? (Enter numbers, or 'all')"

Single confirmation checkpoint — not per-document interruptions.

---

## Stage 2: Address Gaps

Work through selected items. For each, load the relevant reference file per-section (not the whole file):
- README issues → read [[README-GUIDE.md]]
- CHANGELOG issues → read [[CHANGELOG-GUIDE.md]]
- CONTRIBUTING issues → read [[CONTRIBUTING-GUIDE.md]]
- Code doc issues → read [[CODE-DOCS-GUIDE.md]]

For archetype-specific expectations, read the relevant section from [[DOC-EXPECTATIONS.md]].

### Creating New Documentation

When generating a doc that doesn't exist yet:

1. **Always confirm** with the user before writing a new file, even in targeted mode
2. **Check manifest data quality.** If the project description is empty or a placeholder, ask the user for key details rather than inventing content
3. **Read actual source code** to produce meaningful content — entry points, exported functions, CLI argument parsing, configuration schemas. Never generate placeholder text like "Run `npm start` to start the application" without verifying this is accurate
4. **Follow archetype conventions** from the loaded guide — section ordering, badge format, install commands
5. **Keep it honest.** If you can't determine something from the code (e.g., deployment instructions), note it as a TODO for the user rather than guessing

### Updating Existing Documentation

When modifying docs that already exist:

1. **Use Edit, not Write.** Make targeted changes to specific sections. Never overwrite an entire file unless the user explicitly requests a full rewrite
2. **Preserve unrecognized sections.** If the document has custom sections (Architecture, Deployment, FAQ, etc.) that don't appear in the guide templates, keep them in place untouched
3. **Match existing style.** Observe the document's heading style, list format, tone (formal vs casual), and line length. Maintain consistency with the author's voice
4. **Identify specific staleness:**
   - APIs or functions referenced in docs but removed from code
   - Package manager commands that don't match the current setup
   - Version numbers or dependency references that are outdated
   - Links to files or URLs that no longer exist
5. **Scope changes narrowly.** Fix what's flagged. Don't restructure or rewrite sections that aren't broken

### Fixing Consistency Issues

For pass/fail consistency checks that failed:
- Fix the specific mismatch using Edit (wrong badge URL, incorrect install command, broken link)
- These are surgical fixes, not rewrites

---

## Stage 3: Verify

After all changes are applied:

1. **Re-score** changed docs using the audit rubric
2. **Report improvements** with before/after scores: "README: 1→3, CHANGELOG: 0→2, CONTRIBUTING: 1→3"
3. **Check for new issues** introduced by changes — broken internal links, inconsistent references between docs
4. **Flag items needing human review** — accuracy of technical claims, tone appropriateness, completeness of API documentation

---

## Audit Rubric

Scoring is archetype-aware. Different project types have different "complete" criteria.

### README.md

| Score | Criteria |
|-------|----------|
| 0 | Missing |
| 1 | Stub: fewer than 20 lines, no install or usage sections |
| 2a | Structurally incomplete: missing key sections for this archetype |
| 2b | Structurally sound but content is stale or inaccurate |
| 3 | Complete for archetype |

Score 3 varies by project type:
- **Library**: overview, installation, API reference or link, usage examples, contributing link, license
- **CLI tool**: overview, installation, usage with command/flag reference, examples with output, contributing link
- **Application**: overview, prerequisites, setup/installation, configuration, running, deployment notes
- **Data science**: overview, methodology, dataset description, reproducibility instructions, results

### CHANGELOG.md

| Score | Criteria |
|-------|----------|
| 0 | Missing |
| 1 | Exists but unformatted: raw git log dump, unstructured prose notes |
| 2 | Follows a recognized format but incomplete or stale (last entry > 2 versions behind current) |
| 3 | Current, properly formatted (Keep a Changelog or equivalent), covers recent versions |

### CONTRIBUTING.md

| Score | Criteria |
|-------|----------|
| 0 | Missing |
| 1 | Generic boilerplate with no project-specific details |
| 2 | Has dev setup instructions but missing testing, PR workflow, or code style guidance |
| 3 | Complete: prerequisites, dev setup, testing, linting/formatting, PR process, code style |

### Code Documentation

| Score | Criteria |
|-------|----------|
| 0 | No documentation on public API surfaces |
| 1 | Sporadic: less than ~30% of public interfaces documented |
| 2 | Partial coverage or inconsistent style across documented items |
| 3 | Consistent documentation on all public interfaces following language conventions |

### Consistency Checks (Pass/Fail)

| Check | How to Verify |
|-------|---------------|
| Install commands | Compare doc instructions against detected package manager and manifest scripts |
| Script references | Verify each script/command mentioned in docs exists in the project manifest |
| Internal links | Follow every relative link in docs to confirm the target file exists |
| File/directory refs | Check that referenced paths (src/, docs/, etc.) exist in the repo |
| Badge accuracy | Verify package name and repo path in badge URLs match actual values |

---

## Usage Instructions

When this skill is active, follow these rules:

**Workflow discipline:**
- Always detect intent before starting. Do not force a full audit when the user asked for a specific document
- In audit-only mode, produce the report and stop. Do not write files unless asked
- Present a single confirmation checkpoint (the gap report table). Do not interrupt per-document

**Progressive disclosure:**
- Load reference files per-section, not in full. Read only the archetype-relevant section of DOC-EXPECTATIONS.md, only the language-relevant section of CODE-DOCS-GUIDE.md
- Load a reference file only when the workflow reaches a step that needs it

**File safety:**
- For existing files, always use Edit over Write
- Preserve custom sections in existing documents — do not remove sections just because they're not in the guide template
- Never write a new file without user confirmation
- If manifest data is sparse, ask the user for details rather than generating placeholder content

**Framework awareness:**
- If a documentation framework (Sphinx, MkDocs, Docusaurus, Jekyll, mdBook, VitePress) is detected, do not modify its managed files
- Still audit and update standalone root-level files (README, CHANGELOG, CONTRIBUTING)

**Language sensitivity:**
- If existing docs are non-English, confirm language preference before generating or updating content

**Scope discipline:**
- Fix what's flagged. Do not restructure or "improve" sections that weren't identified as problems
- Code doc generation is supported for Python, JavaScript/TypeScript, Go, Rust, and Java. For other languages (Ruby, Elixir, C#, PHP, Swift), flag undocumented APIs in the audit but do not generate stubs
- If the audit finds all docs at score 3 with no consistency failures, report that documentation is in good shape and exit. Do not suggest changes for the sake of making changes
