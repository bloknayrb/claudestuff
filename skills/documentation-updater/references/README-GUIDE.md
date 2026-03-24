# README Conventions by Archetype

This reference provides per-archetype guidance for generating and updating README.md files. Read only the sections relevant to the detected archetype.

---

## Section Ordering by Ecosystem

Different ecosystems have established README conventions. Follow the ordering that users of that ecosystem expect.

**Node**: Badges → Description → Installation → Usage → API → Scripts → Contributing → License

**Python**: Badges → Description → Features → Installation → Quick Start → Usage → Docs link → Contributing → License

**Rust**: Badges → Description → MSRV → Installation → Usage → Feature Flags → Contributing → License

**Go**: Description → Installation → Usage → Docs link → Contributing → License (badges less common inline)

**JVM**: Description → Requirements → Installation (Maven + Gradle) → Usage → API docs link → Contributing → License

**CLI tools**: Description → Installation (multiple methods) → Quick Start → Usage → Commands Reference → Configuration → Examples → Contributing

**Data science**: Overview → Methodology → Dataset → Reproducibility → Results → Project Structure → Citation → License

---

## Badge Conventions

Use shields.io format. Include only badges that are actively maintained and meaningful.

**Per registry:**
- **npm**: `![npm version](https://img.shields.io/npm/v/PACKAGE)` + downloads, license
- **PyPI**: `![PyPI version](https://img.shields.io/pypi/v/PACKAGE)` + python versions, license
- **crates.io**: `![crates.io](https://img.shields.io/crates/v/CRATE)` + docs.rs link
- **pkg.go.dev**: `![Go Reference](https://pkg.go.dev/badge/MODULE.svg)](https://pkg.go.dev/MODULE)`
- **Maven Central**: `![Maven Central](https://img.shields.io/maven-central/v/GROUP/ARTIFACT)`
- **NuGet**: `![NuGet](https://img.shields.io/nuget/v/PACKAGE)`
- **Packagist**: `![Packagist Version](https://img.shields.io/packagist/v/VENDOR/PACKAGE)`

**Common cross-ecosystem badges:**
- CI status (GitHub Actions, GitLab CI)
- Test coverage (Codecov, Coveralls)
- License

Don't include badges that aren't set up (broken badge images are worse than no badges).

---

## Installation Instructions

Show the correct command for the detected package manager. Be specific — don't guess.

| Ecosystem | Command | Notes |
|-----------|---------|-------|
| npm | `npm install package-name` | Add `--save-dev` for dev deps |
| yarn | `yarn add package-name` | |
| pnpm | `pnpm add package-name` | |
| pip | `pip install package-name` | |
| uv | `uv add package-name` | Preferred for Python if `uv.lock` present |
| cargo | `cargo add crate-name` | Note feature flags if applicable |
| go get | `go get module/path` | `go install` for binaries |
| Maven | `<dependency>` XML block | Full XML snippet with groupId/artifactId/version |
| Gradle | `implementation("group:artifact:version")` | |
| Composer | `composer require vendor/package` | |

For CLI tools, include multiple installation methods: package manager, binary download from releases, and build from source.

---

## Usage Examples

The usage section is where most READMEs fail. The goal is to show someone how to use the project within 30 seconds of reading.

**For libraries:**
```
import { createClient } from 'my-library';

const client = createClient({ apiKey: process.env.API_KEY });
const result = await client.query('hello');
console.log(result.text);
```

**For CLI tools:**
```bash
$ my-tool init my-project
Created project at ./my-project

$ my-tool build --output dist/
Building... done (2.3s)
Output: dist/bundle.js (42kb)
```

**For APIs:**
```bash
curl -X POST https://api.example.com/v1/query \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text": "hello"}'
```

### Rules for good examples

- Show import/require and initialization — don't start mid-flow
- Use realistic but simple data (not `foo`/`bar`/`baz`)
- Include expected output where helpful (especially for CLIs)
- At minimum: one "hello world" example and one slightly more complex one
- If configuration is required, show a minimal config example
- If the project has multiple modes/features, show one example per major feature

---

## When to Inline API Reference vs Link

**Inline in README** when:
- Small surface area (fewer than 10 public functions/methods)
- Simple signatures without complex types
- The README is the only documentation

**Link to docs site** when:
- Large surface area (the API section would exceed ~100 lines)
- Complex types or generics that need detailed explanation
- Auto-generated docs exist (docs.rs, TypeDoc, Javadoc, Sphinx)
- The project has a dedicated documentation site

Use a format like: "For full API documentation, see [docs.example.com](https://docs.example.com)."

---

## Anti-Patterns

### Don't restate the manifest description

Bad:
```markdown
# my-package
A utility for processing data.
```

Good:
```markdown
# my-package
Process streaming CSV data with automatic type detection and configurable output formats. Built for pipelines that need to handle malformed rows without crashing.
```

The README description should add context, motivation, or a concrete example that the one-line manifest description can't convey.

### Don't include empty placeholder sections

Bad:
```markdown
## API

TODO

## Configuration

TODO
```

If a section isn't ready, don't include it. Empty sections make the README look abandoned.

### Don't write generic usage examples

Bad:
```markdown
## Usage
Run `npm start` to start the application.
```

Good:
```markdown
## Usage

Start the development server:
```bash
npm run dev
```

The server starts at `http://localhost:3000`. API endpoints are available at `/api/v1/`.

To run in production mode:
```bash
npm run build && npm start
```
```

### Don't hardcode version numbers

Bad: `npm install my-package@3.2.1`

Good: `npm install my-package`

Unless showing a specific version is the point (e.g., "requires v3+"), let the user get the latest.

### Don't add a Table of Contents for short READMEs

A ToC is useful for READMEs over ~200 lines. For shorter READMEs, it's just noise before the content.

### Don't duplicate content between README and docs site

If a docs site exists, the README should link to it for detailed content. The README covers: what it is, how to install it, a quick usage example, and where to find more. The docs site covers everything else.
