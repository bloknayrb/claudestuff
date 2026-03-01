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
| **Patterns** | Reusable architecture anyone can adopt | [skills/shared/](skills/) |
| **Reference Implementations** | Working commands - study the structure | automation, obsidian-vault-management |
| **Domain Tools** | Specialized for specific work | transaction-analysis, toll-consulting, professional-agents |
| **Office Automation** | Document creation and editing | ms-office-suite |
| **Memory Integration** | Context persistence | simplemem-memory |
| **Personal Finance** | Budgeting, investing, financial planning | personal-finance |
| **Career Coaching** | Career exploration, resume review, interview prep | career-coach |
| **Learning** | How plugins work | example-plugin |

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
├── Working on toll projects?
│   └── → toll-consulting (agents + document review skill)
│
├── Building Obsidian automation?
│   ├── Want vault maintenance?
│   │   └── → obsidian-vault-management (sweeping, validation)
│   └── Want task/project tracking?
│       └── → automation (/track, /update-projects)
│
├── Analyzing toll transaction data?
│   └── → transaction-analysis (VDOT, DelDOT, MDTA, DRPA)
│
├── Managing personal finances?
│   └── → personal-finance (budgeting, investing, planning)
│
├── Navigating career decisions?
│   └── → career-coach (exploration, resume review, interview prep)
│
└── Adding memory to Claude Code?
    └── → simplemem-memory (temporal project memory)
```

### Complexity Ratings

| Plugin | Setup | Customization | Best For |
|--------|-------|---------------|----------|
| **example-plugin** | Easy | None needed | Learning plugin structure |
| **professional-agents** | Easy | Low | Adding role-based agents |
| **toll-consulting** | Easy | Low | Toll industry consulting |
| **ms-office-suite** | Medium | Low | Office document automation |
| **simplemem-memory** | Medium | Low | Project context memory |
| **obsidian-vault-management** | Hard | High | Obsidian vault maintenance |
| **automation** | Hard | High | Task tracking patterns |
| **personal-finance** | Easy | Low | Personal finance education |
| **career-coach** | Easy | Low | Career coaching and interview prep |
| **transaction-analysis** | Low | High | Toll industry analysis |

**Complexity Key:**
- **Easy**: Install and use immediately
- **Medium**: Requires some dependencies
- **Hard**: Requires specific vault/file structure

## Plugins

### example-plugin

**What**: Complete example demonstrating all component types

**Components**: `/hello` command, Code Reviewer agent, Example skill, Post-tool hook, MCP config

**Use for**: Learning how plugins work, starting template for new plugins

---

### automation

**What**: Vault scanning and project management for Obsidian

**Components**: `/track`, `/update-projects`

**Use for**: Studying comprehensive task tracking patterns, incremental scanning logic

**Note**: Reference implementation - expects specific vault structure

---

### ms-office-suite

**What**: Office document skills for Claude Code

**Skills**: PPTX, DOCX, Word Styles, XLSX, PDF

**Use for**: Creating and editing Office documents programmatically

**Requires**: Python packages (openpyxl, pypdf, etc.), Node.js, LibreOffice

---

### obsidian-vault-management

**What**: Vault maintenance with parallel agent architecture

**Skills**: Vault sweeping (5 parallel agents), validation rules

**Use for**: Large vault maintenance, template compliance, metadata validation

**Note**: Windows/PowerShell required

---

### professional-agents

**What**: 8 role-based agents for development and project management

**Agents**: Developer, Tech Lead, Product Owner, UX Designer, QA Reviewer, Researcher, Strategic PM, DOCX Editor

**Use for**: Adding specialized personas, understanding agent design patterns

---

### toll-consulting

**What**: Toll industry agents and document review skill

**Agents**: Toll Consultant, Toll Procurement Consultant

**Skills**: Document review (owner's representative perspective)

**Use for**: Toll operations consulting, procurement advisory, project document review

---

### simplemem-memory

**What**: SimpleMem MCP integration for project memory

**Skills**: Temporal memory management, meeting context

**Use for**: Storing project decisions, action items, milestones with date context

**Requires**: SimpleMem MCP server

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

### transaction-analysis

**What**: Toll transaction data analysis with auto client detection

**Components**: `/analyze-transactions`, Transaction Analyst agent, Data Quality Validator agent

**Use for**: VDOT, DelDOT, MDTA, DRPA transaction analysis

**Note**: Domain-specific - valuable as multi-agent pattern reference

## Standalone Skills

Skills in the `skills/` directory work independently of plugins:

| Skill | Purpose |
|-------|---------|
| skill-creation | Guide for creating effective skills |
| testing-best-practices | Unit/integration test patterns |
| api-design | RESTful API design principles |
| security-review | OWASP-based security patterns |
| excel-analysis | Pandas workflows for Excel |
| meeting-prep | Context assembly for meetings |
| memory-router | Smart routing to memory systems |
| semantic-search | Vault search with embeddings |
| task-management | TaskNote creation patterns |
| invoice-timesheet-verification | Timesheet reconciliation |
| boop-scripting | Woop/Boop script API, patterns, and template for Windows text transforms |

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
- Personal context is intentional, not accidental
- Plugins are reference implementations to study
- The value is in patterns and documentation
- Build your own system using these as guides

**What contributions are welcome:**
- Bug fixes
- Documentation improvements
- Pattern extraction to `skills/shared/`

**What's not the goal:**
- Making everything "plug and play"
- Removing personal context
- Support SLAs

## External Resources

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [Creating Commands](https://docs.claude.com/en/docs/claude-code/commands)
- [Creating Agents](https://docs.claude.com/en/docs/claude-code/agents)
- [Creating Skills](https://docs.claude.com/en/docs/claude-code/skills)
- [MCP Protocol](https://modelcontextprotocol.io/)

## License

This marketplace and plugins are provided as-is for the Claude Code community.
