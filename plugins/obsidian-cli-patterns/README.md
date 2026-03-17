# obsidian-cli-patterns

Behavioral patterns for the Obsidian CLI — decision frameworks, workflow recipes, and common pitfalls for vault automation.

## Relationship to Official obsidian-cli Skill

This plugin **complements** the official `obsidian-cli` skill (from kepano's obsidian-skills plugin). The official skill covers command syntax and parameters — *what* commands exist and how to call them. This plugin teaches *when* and *how* to use them effectively:

- When to use CLI vs direct file operations
- Multi-step workflow recipes (health checks, bulk updates, migrations)
- Common pitfalls that waste time (focus stealing, indexing lag, wrong vault)
- Integration patterns with other Obsidian skills

## Prerequisites

- **Obsidian 1.12+** with CLI enabled (Settings → General → CLI)
- `obsidian` command in PATH (automatic on macOS/Windows; Linux may need a wrapper script)
- Obsidian must be **running** for CLI commands to work (IPC-based)

## What's Included

| Component | Description |
|-----------|-------------|
| **SKILL.md** | Decision frameworks, pitfalls, integration guidance |
| **references/command-categories.md** | Command signatures organized by category |
| **references/workflow-recipes.md** | 8 complete multi-step workflow recipes |

## Installation

```bash
# Via marketplace
/plugin marketplace add bloknayrb/claudestuff
/plugin install obsidian-cli-patterns

# Or directly
/plugin install bloknayrb/claudestuff/plugins/obsidian-cli-patterns
```
