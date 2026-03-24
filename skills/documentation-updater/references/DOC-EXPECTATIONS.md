# Documentation Expectations by Archetype

Each section below is independently loadable. Read only the section matching the detected archetype.

---

## Node / JavaScript / TypeScript

### Files that should exist

| File | Required | Notes |
|------|----------|-------|
| `README.md` | Yes | Primary entry point |
| `CHANGELOG.md` | Recommended | Especially for published packages |
| `CONTRIBUTING.md` | Recommended | For open source; internal projects may skip |
| `LICENSE` | Yes | For public packages |

### README sections (in order)

1. **Badges** — npm version, CI status, coverage, license
2. **Description** — one-paragraph summary of what the package does and why
3. **Installation** — show relevant package managers: `npm install`, `yarn add`, `pnpm add`
4. **Usage** — minimal working code example; syntax-highlighted JS/TS block
5. **API reference** — either inline table of exported functions/classes, or link to generated docs (TypeDoc, etc.)
6. **Scripts** — table of `npm run` commands if the project has a notable set
7. **Contributing** — short blurb + link to `CONTRIBUTING.md`
8. **License**

### CHANGELOG conventions

- Conventional Commits groupings: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`
- Link each version header to the GitHub compare URL
- Unreleased section at the top

### CONTRIBUTING sections

- Node version requirement (`.nvmrc` or `engines` field reference)
- Package manager choice (detect from lockfile: `package-lock.json`→npm, `yarn.lock`→yarn, `pnpm-lock.yaml`→pnpm)
- Setup: `npm install` / `yarn` / `pnpm install`
- Running tests: `npm test` (Jest/Vitest/Mocha)
- Linting: `npm run lint` (ESLint + Prettier)
- PR process and branch conventions

### Code documentation

- **JavaScript**: JSDoc on all exported functions and classes — `@param`, `@returns`, `@throws`, `@example`
- **TypeScript**: Types often replace JSDoc type annotations, but complex functions still benefit from `@example` and descriptions
- Document exported symbols only; internal helpers don't need docs

---

## Python

### Files that should exist

| File | Required | Notes |
|------|----------|-------|
| `README.md` | Yes | Primary entry point |
| `CHANGELOG.md` | Recommended | Especially for PyPI-published packages |
| `CONTRIBUTING.md` | Recommended | For OSS or team projects |
| `LICENSE` | Yes | For public packages |

### README sections (in order)

1. **Badges** — PyPI version, CI status, coverage, Python versions, license
2. **Description** — one-paragraph summary
3. **Installation** — `pip install package-name` and `uv add package-name`; extras if applicable
4. **Quick start** — minimal working example
5. **Usage** — more detailed examples, grouped by feature
6. **API reference** — link to Sphinx/MkDocs site or ReadTheDocs
7. **Contributing** — short blurb + link to `CONTRIBUTING.md`
8. **License**

### CHANGELOG conventions

- Keep a Changelog format (`## [1.2.3] - 2024-01-15`)
- Link version headers to PyPI releases or GitHub compare URLs
- Group under: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`

### CONTRIBUTING sections

- Python version requirement
- Virtual environment setup: `uv venv && uv sync` (preferred) or `python -m venv .venv`
- Editable install: `pip install -e .[dev]` or `uv sync --all-extras`
- Running tests: `pytest` with any relevant flags
- Linting: `ruff check .` and `ruff format .` (or flake8/black)
- Type checking: `mypy` or `pyright` if the project uses types
- PR process

### Code documentation

- Docstrings on all public modules, classes, and functions
- **Default style**: Google style (`Args:`, `Returns:`, `Raises:`)
- **Data science projects**: NumPy style preferred (`Parameters\n----------`)
- `docs/` directory with Sphinx or MkDocs expected for libraries

---

## Rust

### Files that should exist

| File | Required | Notes |
|------|----------|-------|
| `README.md` | Yes | Also shown on crates.io |
| `CHANGELOG.md` | Recommended | Keep a Changelog format |
| `CONTRIBUTING.md` | Recommended | For OSS crates |
| `LICENSE` or `LICENSE-*` | Yes | Dual MIT/Apache-2.0 common |

### README sections (in order)

1. **Badges** — crates.io version, docs.rs, CI, license
2. **Description** — one-paragraph summary
3. **MSRV** — Minimum Supported Rust Version (state explicitly)
4. **Installation** — `cargo add crate-name`; feature flags if applicable
5. **Usage** — code example with `fn main()` block; must compile
6. **Feature flags** — table of optional features and what they enable
7. **Contributing** — link to `CONTRIBUTING.md`
8. **License**

### CHANGELOG conventions

- Keep a Changelog format tied to crate version numbers
- Note any MSRV bumps explicitly under `Changed`
- Breaking changes flagged clearly

### CONTRIBUTING sections

- Rust edition in use
- `cargo build` and `cargo test`
- `cargo clippy -- -D warnings` for linting
- `cargo fmt` required before PR
- PR process

### Code documentation

- `///` doc comments on all public items — structs, enums, traits, functions, type aliases
- `//!` crate-level and module-level documentation at top of `lib.rs` / `mod.rs`
- Code examples in `///` comments are compiled and tested by `cargo test --doc` — keep them valid
- docs.rs auto-generates the API site; README should link to it

---

## Go

### Files that should exist

| File | Required | Notes |
|------|----------|-------|
| `README.md` | Yes | Shown on pkg.go.dev |
| `CONTRIBUTING.md` | Optional | Less common in Go ecosystem |
| `CHANGELOG.md` | Optional | GitHub releases often used instead |
| `LICENSE` | Yes | Required for pkg.go.dev indexing |

### README sections (in order)

1. **Badges** — pkg.go.dev, CI, Go version, license
2. **Description** — one-paragraph summary
3. **Installation** — `go get module/path@version` or `go install` for binaries
4. **Usage** — working code example with correct imports
5. **Package documentation** — link to pkg.go.dev
6. **License**

### CHANGELOG conventions

- GitHub Releases are the dominant pattern in the Go ecosystem
- If a CHANGELOG.md exists, Keep a Changelog format
- Semantic versioning required for module proxy compatibility

### CONTRIBUTING sections (if present)

- Go version requirement
- `go build ./...` and `go test ./...`
- `go vet ./...`
- `gofmt` or `goimports` required
- PR process

### Code documentation

- Package comment on every package (above `package` declaration)
- Exported function/type comments must start with the name: `// FunctionName does X`
- Example functions in `_test.go` files appear on pkg.go.dev
- No external doc tooling required; GoDoc conventions are the standard

---

## JVM (Java / Kotlin / Scala)

### Files that should exist

| File | Required | Notes |
|------|----------|-------|
| `README.md` | Yes | |
| `CHANGELOG.md` | Recommended | GitHub releases common alternative |
| `CONTRIBUTING.md` | Recommended | For OSS |
| `LICENSE` | Yes | |

### README sections (in order)

1. **Badges** — Maven Central version, CI, JDK version, license
2. **Description** — one-paragraph summary
3. **Installation** — Maven `<dependency>` block AND Gradle `implementation()` line (include both)
4. **Usage** — code example in the project's primary language
5. **API documentation** — link to Javadoc/KDoc/ScalaDoc site
6. **Contributing** — link to `CONTRIBUTING.md`
7. **License**

### CONTRIBUTING sections

- JDK version requirement
- Build tool: Maven (`./mvnw`/`mvn`) or Gradle (`./gradlew`)
- Build and test commands
- Code style tooling: Checkstyle (Java), ktlint (Kotlin), Spotless (any)
- PR process

### Code documentation

- **Java**: Javadoc on all public classes and methods; `@param`, `@return`, `@throws`
- **Kotlin**: KDoc on public declarations
- **Scala**: ScalaDoc with similar conventions
- Auto-generated API site expected for libraries

---

## PHP

### Files that should exist

| File | Required | Notes |
|------|----------|-------|
| `README.md` | Yes | Shown on Packagist |
| `CHANGELOG.md` | Recommended | |
| `CONTRIBUTING.md` | Recommended | |
| `LICENSE` | Yes | |

### README sections (in order)

1. **Badges** — Packagist version, CI, PHP version, license
2. **Description** — one-paragraph summary; note any PSR compliance
3. **Requirements** — PHP version and required extensions
4. **Installation** — `composer require vendor/package`
5. **Usage** — code example
6. **Configuration** — if applicable
7. **Contributing** — link to `CONTRIBUTING.md`
8. **License**

### CONTRIBUTING sections

- PHP version requirement
- `composer install` setup
- Running tests: `./vendor/bin/phpunit` or `./vendor/bin/pest`
- Coding standards: PSR-12 enforced via PHP CS Fixer or PHP_CodeSniffer
- PR process

### Code documentation

- PHPDoc blocks on all public classes and methods: `@param`, `@return`, `@throws`
- PSR compliance is a significant expectation in the PHP ecosystem

---

## Data Science (Python sub-archetype)

### Files that should exist

| File | Required | Notes |
|------|----------|-------|
| `README.md` | Yes | |
| `requirements.txt` or `environment.yml` | Yes | Exact reproducibility |
| `CONTRIBUTING.md` | Recommended | |
| `data/README.md` | Recommended | Data provenance and structure |

### README sections (in order)

1. **Project overview** — what question is being answered or what problem is solved
2. **Methodology** — high-level approach, algorithms, or frameworks used
3. **Dataset** — source, size, features, license, download instructions
4. **Reproducibility** — exact steps: environment setup, data download, seed values, run commands
5. **Results / Findings** — key outputs, metrics, or conclusions
6. **Project structure** — directory tree explaining where code, data, notebooks, and outputs live
7. **Citation** — BibTeX block if applicable
8. **License**

### CONTRIBUTING sections

- Environment setup: `uv venv && uv sync` or `conda env create -f environment.yml`
- Data download steps
- Notebook conventions: clear markdown cells, outputs cleared before commit
- How to add new experiments

### Code documentation

- Module and function docstrings for utility code
- Notebooks self-document via markdown cells — each section needs a header explaining intent
- NumPy docstring style preferred for scientific functions

---

## CLI Tools (cross-archetype overlay)

These expectations apply on top of the base language archetype.

### README additions / overrides

- **Installation** — multiple methods: package manager, binary download, build from source
- **Usage** — actual command invocations with real-looking output
- **Command reference** — table or subsection per subcommand with flags, defaults, and examples
- **Configuration** — config file format, location, and keys documented
- **Examples section** — real-world use cases

### CHANGELOG importance

High importance for CLI users. Breaking changes to flags or output format need explicit callouts.

### Code documentation

- `--help` text is the primary user-facing API — keep it accurate and complete
- README command reference and `--help` output must be consistent

---

## Monorepo (cross-archetype overlay)

These expectations apply on top of per-package archetype expectations.

### Root README sections (in order)

1. **Project overview** — what the monorepo contains and why
2. **Package / app index** — table with name, description, status, link to package README
3. **Architecture overview** — how packages relate; dependency graph recommended
4. **Getting started** — which package to look at first
5. **Contributing** — link to root `CONTRIBUTING.md`

### Root CONTRIBUTING sections

- Monorepo tooling (workspaces, Turborepo, Nx, Lerna, Cargo workspaces)
- Root install command
- How packages relate
- Testing strategy: all vs. per-package
- PR scope guidance
- Versioning strategy: independent vs. synchronized

### CHANGELOG conventions

- **Unified**: one file at root — works for small monorepos
- **Per-package**: each package has its own — works for independently versioned packages
- Document which convention is in use

### Per-package expectations

Each package should meet the documentation expectations for its own language archetype.
