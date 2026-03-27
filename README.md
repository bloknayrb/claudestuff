# claudestuff

> Plugins and skills I've built for Claude Code. Install what's useful, study the patterns, build your own.

## Quick Start

```bash
# Add the marketplace
/plugin marketplace add bloknayrb/claudestuff

# Browse and install plugins
/plugin
```

## What's Here

| Category | Description | Plugins |
|----------|-------------|---------|
| **Learning** | How plugins work | example-plugin |
| **Developer Tools** | Role-based agents, code quality, docs | professional-agents, anti-slop, documentation-updater |
| **Office Automation** | Document creation and editing | ms-office-suite |
| **Personal Finance** | Budgeting, investing, financial planning | personal-finance |
| **Career Coaching** | Career exploration, resume review, interview prep | career-coach |
| **Android Development** | Jetpack Compose, Kotlin, architecture, publishing | android-dev |
| **Image Generation** | AI image prompting for Nano Banana MCP | nanobanana |
| **Writing** | Learn your style, write in your voice | ghostwriter |
| **Focus** | Executive function support | focus-tools |

## Plugins at a Glance

### Which Plugin Should I Look At?

```
Are you...
├── Learning how plugins work?
│   └── → example-plugin (shows all component types)
│
├── Building office document automation?
│   └── → ms-office-suite (PPTX, DOCX, XLSX, PDF skills)
│
├── Looking for agent design patterns?
│   └── → professional-agents (8 role-based agents)
│
├── Managing personal finances?
│   └── → personal-finance (budgeting, investing, planning)
│
├── Navigating career decisions?
│   └── → career-coach (exploration, resume review, interview prep)
│
├── Building an Android app?
│   └── → android-dev (Compose, Kotlin, architecture, publishing)
│
├── Updating repo documentation?
│   └── → documentation-updater (skill: audit, generate, update docs)
│
├── Generating images with Nano Banana?
│   └── → nanobanana (model selection, prompt engineering, visual grounding)
│
├── Writing in your own voice?
│   └── → ghostwriter (learn style, draft, rewrite, critique)
│
├── Auditing a branch before PR?
│   └── → anti-slop (pre-PR quality audit)
│
└── Overwhelmed and need to focus?
    └── → focus-tools (identify ONE next action)
```

### Complexity Ratings

| Plugin | Setup | Customization | Best For |
|--------|-------|---------------|----------|
| **example-plugin** | Easy | None needed | Learning plugin structure |
| **professional-agents** | Easy | Low | Adding role-based agents |
| **ms-office-suite** | Medium | Low | Office document automation |
| **personal-finance** | Easy | Low | Personal finance education |
| **career-coach** | Easy | Low | Career coaching and interview prep |
| **android-dev** | Easy | Low | Android app development guidance |
| **nanobanana** | Easy | Medium | Image generation prompting |
| **ghostwriter** | Easy | Low | Writing in your voice |
| **anti-slop** | Easy | Low | Pre-PR branch quality audit |
| **focus-tools** | Medium | Medium | Executive function support |

**Complexity Key:**
- **Easy**: Install and use immediately
- **Medium**: Requires some configuration or dependencies

## Plugins

### example-plugin

**What**: Complete example demonstrating all component types

**Components**: `/hello` command, Code Reviewer agent, Example skill, Post-tool hook, MCP config

**Use for**: Learning how plugins work, starting template for new plugins

---

### ms-office-suite

**What**: Office document skills for Claude Code

**Skills**: PPTX, DOCX, Word Styles, XLSX, PDF

**Use for**: Creating and editing Office documents programmatically

**Requires**: Python packages (openpyxl, pypdf, etc.), Node.js, LibreOffice

---

### professional-agents

**What**: 8 role-based agents for development and project management

**Agents**: Developer, Tech Lead, Product Owner, UX Designer, QA Reviewer, Researcher, Strategic PM, DOCX Editor

**Use for**: Adding specialized personas, understanding agent design patterns

---

### personal-finance

**What**: Personal finance education — budgeting, investing, and financial planning

**Skills**: Budgeting (spending analysis, debt payoff), Investing (three-fund portfolio, tax-advantaged accounts), Financial Planning (priority ladder, net worth, goal projection)

**Agents**: Budget Analyst, Portfolio Analyzer

**Use for**: Budget creation, transaction categorization, portfolio analysis, debt payoff comparison, retirement planning

---

### career-coach

**What**: Career development coaching — exploration, resume optimization, and interview preparation

**Skills**: Career Development (GROW model, RIASEC, career ladders), Job Search (ATS optimization, resume writing, networking), Interview Prep (STAR method, mock interviews, salary negotiation)

**Agents**: Career Coach (orchestrator), Resume Reviewer, Mock Interviewer

**Use for**: Career direction, resume review, ATS optimization, behavioral interview practice, salary negotiation, offer comparison

---

### android-dev

**What**: Android app development — project setup, Compose UI, architecture, testing, publishing

**Skills**: Android Architecture (MVVM, Hilt, project setup), Compose UI (components, state, navigation), Android Platform (permissions, platform APIs, troubleshooting), Build/Test/Publish (testing pyramid, Gradle, Play Store)

**Agents**: Android Dev (routing agent for all Android tasks)

**Use for**: Building Android apps with Kotlin and Jetpack Compose, from first project to Play Store

---

### nanobanana

**What**: Image generation prompting skill for the Nano Banana MCP server

**Skills**: Image Generation (model selection, prompt engineering, visual grounding, cost optimization)

**Use for**: AI image generation with Gemini models — crafting effective prompts, choosing the right model tier, multi-image editing workflows

**Requires**: Nano Banana MCP server configured and running

---

### ghostwriter

**What**: Writing style learning and voice profile ghostwriting

**Commands**: `/learn-my-style`, `/ghostwrite`

**Agents**: Ghostwriter (draft, rewrite, critique, tone shift, analyze)

**Skills**: Style Analysis (six dimensions, metavoice synthesis, quantitative metrics)

**Use for**: Learning your writing style from samples, drafting in your voice, rewriting text to match your style, comparing writing against your profile

---

### anti-slop

**What**: Pre-PR branch quality audit

**Agents**: anti-slop auditor (checks description-diff alignment, commit hygiene, template compliance)

**Use for**: Catching lazy PRs before they hit review — mismatched descriptions, missing Closes #N, bad commit messages

---

### focus-tools

**What**: Executive function support for getting unstuck

**Commands**: `/sos`

**Skills**: executive-function-support

**Use for**: Cutting through overwhelm and identifying ONE next action

**Note**: Reference implementation — expects a task state file. Adapt paths for your setup.

## Standalone Skills

Skills in the `skills/` directory work independently of plugins:

| Skill | Purpose |
|-------|---------|
| skill-creation | Guide for creating effective skills |
| testing-best-practices | Unit/integration test patterns |
| api-design | RESTful API design principles |
| security-review | OWASP-based security patterns |
| documentation-updater | Full-lifecycle doc management: audit, generate, update README/CHANGELOG/CONTRIBUTING/code docs |

## Creating Your Own

### Minimum Viable Plugin

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
└── README.md
```

```json
// plugin.json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What my plugin does"
}
```

### Adding Components

| Component | Location | File Format |
|-----------|----------|-------------|
| Commands | `commands/` | `name.md` with YAML frontmatter |
| Agents | `agents/` | `name.md` with YAML frontmatter |
| Skills | `skills/name/` | `SKILL.md` |
| Hooks | `hooks/` | `hooks.json` |
| MCP | root | `.mcp.json` |

See [example-plugin](plugins/example-plugin/) for a complete reference.

## Documentation

| Document | Purpose |
|----------|---------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute, showcase philosophy |
| [SECURITY.md](SECURITY.md) | Security considerations for plugins |
| [CHANGELOG.md](CHANGELOG.md) | Version history and roadmap |
| [docs/test-protocol.md](docs/test-protocol.md) | How to test plugins |

## Philosophy

This repository is a **showcase**, not a product.

**What that means:**
- Plugins are reference implementations to study
- The value is in patterns and documentation
- Build your own system using these as guides

**What contributions are welcome:**
- Bug fixes
- Documentation improvements

**What's not the goal:**
- Making everything "plug and play"
- Support SLAs

## External Resources

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [Creating Commands](https://docs.claude.com/en/docs/claude-code/commands)
- [Creating Agents](https://docs.claude.com/en/docs/claude-code/agents)
- [Creating Skills](https://docs.claude.com/en/docs/claude-code/skills)
- [MCP Protocol](https://modelcontextprotocol.io/)

## License

This marketplace and plugins are provided as-is for the Claude Code community.
