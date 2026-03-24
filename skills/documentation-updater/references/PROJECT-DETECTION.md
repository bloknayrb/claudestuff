# Project Detection Reference

This reference provides detection logic for identifying project archetypes during documentation audits. The skill loads this file when it needs to determine what kind of project it is analyzing.

Detection runs in three tiers: manifest-based (most reliable), file-extension fallback, and sub-archetype refinement. After primary detection, check for documentation frameworks that restrict what files the skill may modify.

---

## Tier 1: Manifest-Based Detection

Manifest files are the most reliable signal. When found at the project root, they indicate both the archetype and which fields to extract for documentation content.

| Manifest | Archetype | Key Fields to Extract |
|---|---|---|
| `package.json` | Node | `name`, `description`, `version`, `license`, `scripts`, `main`/`exports`, `dependencies`, `devDependencies` |
| `pyproject.toml` / `setup.py` / `setup.cfg` | Python | `project.name`, `project.description`, `project.version`, `project.license`, `project.scripts`, `build-system` |
| `Cargo.toml` | Rust | `package.name`, `package.description`, `package.version`, `package.license`, `package.edition` |
| `go.mod` | Go | module path, go version |
| `pom.xml` / `build.gradle` / `build.gradle.kts` | JVM | `groupId`, `artifactId`, `version`, `dependencies` |
| `*.csproj` / `*.fsproj` / `*.sln` | .NET | `PropertyGroup`: `TargetFramework`, `Version`, `Description` |
| `Gemfile` + `*.gemspec` | Ruby | `spec.name`, `spec.summary`, `spec.version` |
| `mix.exs` | Elixir | `project[:app]`, `project[:version]`, `project[:description]` |
| `composer.json` | PHP | `name`, `description`, `version`, `require` |
| `Package.swift` | Swift | `name`, `products`, `dependencies`, `platforms` |
| `pubspec.yaml` | Flutter/Dart | `name`, `description`, `version`, `dependencies` |

### Archetype Notes

**Node** — `package.json` is definitive. Check whether `bin` is present (CLI tool) vs. `main`/`exports` only (library) vs. neither (app/service). The `scripts` field reveals build and test tooling to mention in CONTRIBUTING.

**Python** — prefer `pyproject.toml` if present; `setup.py` and `setup.cfg` are legacy equivalents. The `build-system` table identifies the build backend (setuptools, flit, hatch, poetry). Look for `console_scripts` entry points to distinguish library from CLI.

**Rust** — `Cargo.toml` is always present. Check for `[lib]` vs. `[[bin]]` sections to determine library vs. binary. Workspace detection lives here too (`[workspace]` with `members`).

**Go** — `go.mod` is authoritative but minimal. Check for a `main` package in `main.go` or a `cmd/` directory to distinguish library from binary. The module path is often the import path users need for documentation.

**JVM** — Maven (`pom.xml`) and Gradle (`build.gradle` / `build.gradle.kts`) are equivalent signals. Both are sometimes present during a migration; prefer the one with more complete metadata.

**.NET** — project files (`*.csproj`, `*.fsproj`) are definitive. A `*.sln` solution file alongside multiple `*.csproj` files signals a monorepo-style layout. Extract `PackageId`, `Version`, and `Description` from `<PropertyGroup>`.

**Ruby** — `Gemfile` handles dependencies; `*.gemspec` holds metadata. A project with only a `Gemfile` and no gemspec is likely an app (Rails, Sinatra) rather than a gem. Gemspec presence signals a distributable library.

**Elixir** — `mix.exs` is always present. Check `application: [mod: ...]` to distinguish an OTP application from a plain library mix project.

---

## Tier 2: File-Extension Fallback

When no manifest is found at the root, scan source files and tally extensions. If one extension accounts for more than 60% of non-config, non-hidden files, treat it as the dominant language.

| Extension(s) | Archetype |
|---|---|
| `*.py` | Python |
| `*.js`, `*.ts`, `*.jsx`, `*.tsx` | Node/JavaScript |
| `*.rs` | Rust |
| `*.go` | Go |
| `*.java`, `*.kt` | JVM |
| `*.cs`, `*.fs` | .NET |
| `*.rb` | Ruby |
| `*.ex`, `*.exs` | Elixir |
| `*.php` | PHP |
| `*.swift` | Swift |
| `*.dart` | Flutter/Dart |
| `*.sh`, `*.bash` | Shell/Scripts |
| `*.tf`, `*.bicep` | Infrastructure as Code |

If no single extension dominates (nothing exceeds 60%), classify as **multi-language** and note which extensions were present. Apply a generic documentation audit rather than archetype-specific expectations.

Extension fallback is less reliable than manifest detection — proceed with lower confidence and flag the uncertainty in any output.

---

## Tier 3: Sub-Archetype Detection

After identifying the primary archetype, check for sub-archetypes. These refine what documentation the project needs without changing the primary language classification.

### Data Science (sub-archetype of Python)

**Signals:**
- `*.ipynb` files present anywhere in the repository
- Any of these in dependencies: `pandas`, `numpy`, `scipy`, `sklearn` / `scikit-learn`, `tensorflow`, `pytorch`, `torch`, `matplotlib`, `seaborn`, `xgboost`, `lightgbm`

**Doc impact:** README should include methodology, dataset description, and reproducibility instructions (environment setup, random seeds, data download steps). Standard API reference is less important than explaining what the project analyzes and how to replicate results.

### Monorepo (any archetype)

**Signals:**
- `workspaces` field in `package.json`
- `packages/` or `apps/` directories at root
- `lerna.json` or `pnpm-workspace.yaml` present
- `[workspace]` with `members` in `Cargo.toml`
- Multiple `*.csproj` files alongside a `*.sln`

**Doc impact:** Needs a root-level README that describes the repository structure and indexes each package or app. Each package also needs its own README. The audit should check both levels and flag missing per-package documentation.

### CLI Tool (any archetype)

**Signals:**
- `bin` field in `package.json`
- `console_scripts` in `pyproject.toml` or `setup.cfg`
- `[[bin]]` section in `Cargo.toml`
- `main` package with flag parsing imports (`cobra`, `clap`, `argparse`, `click`, `urfave/cli`)

**Doc impact:** README should lead with installation instructions and usage examples showing real invocations with flags and arguments. API reference is less relevant than a commands/flags reference. CONTRIBUTING should explain how to run the tool locally during development.

### Library (any archetype)

**Signals:**
- `main`/`exports` in `package.json` with no `bin` field
- `[lib]` in `Cargo.toml` with no `[[bin]]`
- No `console_scripts` in Python package metadata
- Package name matches an importable module name

**Doc impact:** README should prioritize installation as a dependency, a quick-start usage example showing import and basic usage, and a link to full API reference. CONTRIBUTING should explain how to run the test suite and what the PR process looks like for external contributors.

### Static Site / Documentation Site

**Signals:**
- `content/` or `posts/` directories containing markdown files
- Presence of static site generator config: `mkdocs.yml`, `docusaurus.config.js`, `eleventy.config.js`, `next.config.js` with a `pages/` or `app/` directory of markdown
- `_posts/` directory (Jekyll convention)

**Doc impact:** The site itself is the documentation product. The README should explain how to run, build, and contribute to the site — not document a software library. Don't score the project down for missing CHANGELOG or API docs; those don't apply here.

---

## Documentation Framework Detection

Some projects use frameworks that own their documentation directories. Do not modify framework-managed files — doing so risks breaking the site build or introducing content the framework will overwrite.

| Config File | Framework | Managed Directories / Files |
|---|---|---|
| `mkdocs.yml` | MkDocs | `docs/` directory |
| `conf.py` (in `docs/` or root) | Sphinx | `docs/` directory, `*.rst` files |
| `docusaurus.config.js` / `docusaurus.config.ts` | Docusaurus | `docs/`, `blog/` directories |
| `_config.yml` with Jekyll markers | Jekyll | `_posts/`, `_layouts/`, standalone pages |
| `book.toml` | mdBook | `src/` markdown files |
| `.vitepress/` directory | VitePress | `docs/` directory |

**When a framework is detected:**
1. Warn the user that framework-managed content is out of scope for this audit.
2. Do not read, score, or propose changes to managed directories.
3. Still audit standalone root-level files: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`. These are not framework-managed and are fair game.
4. Note in the audit output which directories were excluded and why.

---

## Multiple Manifests at Root

When more than one manifest is present (e.g., `package.json` AND `pyproject.toml`):

1. **Check for a clear primary.** The primary manifest has more complete metadata, more dependencies, and is the build entry point. A `pyproject.toml` with only a `[tool.black]` section alongside a detailed `package.json` means Node is primary.

2. **If both are substantive,** classify as multi-language. Note both archetypes in the audit output. A full-stack project with a Python API backend and a TypeScript frontend in the same repo is legitimately multi-language.

3. **Apply documentation expectations** of the primary archetype, but check whether secondary archetype conventions are also warranted (e.g., a separate README in the `frontend/` subdirectory).

---

## No-Match Fallback

If no manifest is found and no dominant file extension is detected:

1. Check for a README at the repository root. If one exists, read it for project purpose and type hints before proceeding.
2. Ask the user: "I can't determine the project type automatically. What kind of project is this?" Wait for the answer before continuing.
3. Proceed with a generic documentation audit:
   - Check for presence of standard doc files (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`)
   - Score using the generic rubric (completeness and clarity) rather than archetype-specific criteria
   - Generate documentation without archetype-specific conventions or field extraction
   - Note in the output that detection failed and results may be less targeted
