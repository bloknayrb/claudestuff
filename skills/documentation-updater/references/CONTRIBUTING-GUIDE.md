# CONTRIBUTING.md Generation Guide

This reference provides guidance for generating and updating CONTRIBUTING.md files. A good CONTRIBUTING.md gives a new contributor everything they need to go from clone to passing PR.

---

## Standard Sections

Every CONTRIBUTING.md should cover these, adapted to the specific project:

### 1. Prerequisites

What needs to be installed before starting. Be explicit about versions.

Bad: "You need Node.js installed."
Good: "Node.js 18+ (check with `node --version`). We recommend using [nvm](https://github.com/nvm-sh/nvm) to manage versions — the repo includes an `.nvmrc` file."

### 2. Development Setup

Step-by-step from clone to running. Every command should be copy-pasteable.

```markdown
## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/user/repo.git
   cd repo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```
```

Include environment variables, database setup, or external service dependencies if they exist. Don't assume anything is obvious.

### 3. Running Tests

How to run the full suite AND how to run a single test. Contributors always need both.

```markdown
## Running Tests

Run the full test suite:
```bash
npm test
```

Run a specific test file:
```bash
npx vitest run src/utils/__tests__/parser.test.ts
```

Run tests in watch mode during development:
```bash
npx vitest --watch
```
```

### 4. Code Style

Point to config files rather than describing rules in prose.

Bad: "We use 2-space indentation, single quotes, and semicolons."
Good: "We use ESLint and Prettier for code formatting. Run `npm run lint` to check and `npm run lint:fix` to auto-fix. See `.eslintrc` and `.prettierrc` for the full configuration."

If pre-commit hooks exist (husky, pre-commit, lefthook), mention them so contributors aren't surprised.

### 5. Pull Request Process

What a contributor needs to know before submitting:

- Branch naming convention (if any)
- Commit message format (conventional commits, etc.)
- What reviewers look for
- Required CI checks
- Whether squash-merge is used

### 6. Issue Reporting

How to file bugs and feature requests. Link to issue templates if they exist in `.github/ISSUE_TEMPLATE/`.

---

## Per-Archetype Specifics

### Node / JavaScript / TypeScript

- **Prerequisites**: Node version from `.nvmrc`, `package.json` engines, or `.node-version`
- **Package manager**: Detect from lockfile:
  - `package-lock.json` → npm
  - `yarn.lock` → yarn
  - `pnpm-lock.yaml` → pnpm
- **Setup**: `git clone && cd repo && npm install` (substitute correct PM)
- **Testing**: `npm test` — detect framework from devDependencies (jest, vitest, mocha)
- **Linting**: `npm run lint` — check for eslint, prettier in devDependencies
- **Type checking**: `npm run typecheck` or `npx tsc --noEmit` if TypeScript

### Python

- **Prerequisites**: Python version from `pyproject.toml` python-requires or `.python-version`
- **Setup options** (in preference order):
  1. `uv venv && uv sync` (if `uv.lock` exists)
  2. `python -m venv .venv && pip install -e ".[dev]"`
- **Testing**: `pytest` — check for pytest config in `pyproject.toml` or `pytest.ini`
- **Linting**: Check for `ruff`, `flake8`, `black`, `isort` in dev dependencies or config
- **Type checking**: `mypy` or `pyright` if configured
- **Pre-commit**: Note if `.pre-commit-config.yaml` exists

### Rust

- **Prerequisites**: Rust edition from `Cargo.toml`, MSRV if specified
- **Setup**: `git clone && cd repo && cargo build`
- **Testing**: `cargo test` — mention `cargo test -- --nocapture` for seeing output
- **Linting**: `cargo clippy -- -D warnings`
- **Formatting**: `cargo fmt` (non-negotiable in Rust ecosystem)

### Go

- **Prerequisites**: Go version from `go.mod`
- **Setup**: `git clone && cd repo` (Go modules handle deps on build)
- **Testing**: `go test ./...` — mention `-v` flag and `-run TestName` for single tests
- **Linting**: `go vet ./...`, `gofmt`/`goimports`
- **Optional**: `golangci-lint run` if `.golangci.yml` exists

### JVM (Java / Kotlin)

- **Prerequisites**: JDK version, build tool version
- **Setup**: `git clone && cd repo && ./gradlew build` (or `mvn compile`)
- **Testing**: `./gradlew test` (or `mvn test`)
- **Linting**: Checkstyle (Java), ktlint (Kotlin), Spotless (configurable)
- **Note**: If wrapper scripts exist (`gradlew`, `mvnw`), use those instead of global installs

### PHP

- **Prerequisites**: PHP version, required extensions
- **Setup**: `git clone && cd repo && composer install`
- **Testing**: `./vendor/bin/phpunit` or `./vendor/bin/pest`
- **Linting**: PHP CS Fixer or PHP_CodeSniffer for PSR-12 compliance

---

## Anti-Patterns

**Don't include generic "fork and PR" boilerplate without project-specific details.** Every open source repo says "fork, create a branch, submit a PR." That's not helpful. The value of CONTRIBUTING.md is project-specific setup and conventions.

**Don't assume the reader knows the toolchain.** If the project uses pnpm, say so. If there's a specific test runner, name it. A Python developer looking at a Rust project for the first time needs explicit commands.

**Don't skip the "single test" instruction.** `npm test` runs everything. Contributors working on a fix need `npx vitest run path/to/test.ts`. This is the most frequently needed and most frequently omitted instruction.

**Don't describe style rules in prose when a config file exists.** "We follow PSR-12" plus a link to `.php-cs-fixer.php` is better than a page of style rules. The config file is authoritative; prose descriptions go stale.

**Don't include architecture docs unless the project warrants it.** For most projects, a brief note about the directory structure is enough: "Source code is in `src/`, tests mirror the structure in `tests/`." Save full architecture docs for complex projects where a contributor genuinely can't find where to put new code.

---

## When to Include Additional Sections

| Section | Include when... |
|---------|-----------------|
| Architecture Overview | Project has >10 source directories or non-obvious structure |
| Directory Structure | Contributor needs to know where to put new files |
| Commit Conventions | Project uses conventional commits or specific commit rules |
| Release Process | Contributors are involved in cutting releases |
| Code of Conduct | Open source projects with community interaction |
| Security Policy | Project handles sensitive data or has a vulnerability reporting process |
