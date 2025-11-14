# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is a Claude Code plugin marketplace repository that serves as a central hub for distributing plugins, skills, agents, and commands to the Claude Code community. Users can install the entire marketplace with `/plugin marketplace add bloknayrb/claudestuff` or browse individual plugins via `/plugin`.

## Repository Structure

```
.
├── .claude-plugin/
│   └── marketplace.json       # Marketplace manifest listing all plugins
├── plugins/                   # Plugin packages directory
│   └── example-plugin/
│       ├── .claude-plugin/plugin.json
│       ├── commands/         # Slash commands (*.md)
│       ├── agents/           # Specialized agents (*.md)
│       ├── skills/           # Plugin-specific skills (**/SKILL.md)
│       ├── hooks/            # Event hooks (hooks.json)
│       └── .mcp.json        # MCP server configuration
├── skills/                   # Standalone skills directory
│   ├── skill-creation/       # Meta-skill for creating other skills
│   ├── analyzing-transactions/  # Domain-specific transaction analysis
│   ├── api-design/
│   ├── security-review/
│   └── testing-best-practices/
├── .github/workflows/        # GitHub Actions for Claude Code integration
└── README.md                 # User-facing documentation
```

## Key Architectural Concepts

### Plugin System Architecture

**Plugins** are distributable packages that can contain any combination of:
- **Commands**: Slash commands invoked via `/command-name` (stored as markdown files)
- **Agents**: Specialized AI agents with domain expertise (stored as markdown prompts)
- **Skills**: Packaged knowledge bases that expand Claude's capabilities (stored as SKILL.md)
- **Hooks**: Event-triggered automation (stored in hooks.json)
- **MCP Servers**: Model Context Protocol integrations (configured in .mcp.json)

Each plugin has a `plugin.json` manifest. **Important**: Standard component locations are auto-discovered and should NOT be declared in the manifest.

### Auto-Discovery of Standard Locations

Claude Code automatically discovers components in standard directories:
- `commands/` - All `*.md` files are auto-loaded as slash commands
- `agents/` - All `*.md` files are auto-loaded as specialized agents
- `hooks/hooks.json` - Automatically loaded if present
- `skills/` - All `**/SKILL.md` files are auto-loaded as skills

**Critical**: The manifest fields (`commands`, `agents`, `hooks`, `skills`) should ONLY be used to reference *additional* non-standard locations. If you use standard directories, leave these fields out of plugin.json entirely.

#### Minimal plugin.json Example (Standard Locations)
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": {
    "name": "Your Name"
  }
}
```

#### Extended plugin.json Example (Additional Locations)
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Plugin with custom locations",
  "author": {
    "name": "Your Name"
  },
  "commands": ["./custom-commands/*.md"],
  "hooks": "./extra-hooks/additional-hooks.json"
}
```

**Common Error**: Specifying standard locations in the manifest causes "duplicate file" or "path not found" errors because the system tries to load them twice.

### Skills vs Agents vs Commands

- **Skills** are persistent knowledge packages loaded when needed. They expand Claude's domain expertise (e.g., transaction analysis, API design patterns). Skills use progressive disclosure: metadata (name/description) is always loaded, SKILL.md body loads on invocation, and additional resources load on-demand.

- **Agents** are specialized sub-instances of Claude with specific roles and limited tool access (e.g., code-reviewer, product-owner). They run independently and return results.

- **Commands** are custom prompts that expand inline when typed (e.g., `/hello` expands to the contents of hello.md). They're shortcuts for common workflows.

### Standalone Skills Directory

Skills in the root `skills/` directory are **standalone** and can be:
- Used independently via the Skill tool
- Referenced or included in multiple plugins
- Installed system-wide without requiring a plugin

This differs from plugin-specific skills in `plugins/*/skills/` which are bundled with their parent plugin.

### Marketplace.json Structure

The `.claude-plugin/marketplace.json` file is the single source of truth for all plugins in this marketplace. It lists:
- Marketplace metadata (name, version, description)
- Plugin entries with name, source path, and description

When users run `/plugin`, Claude Code reads this file to display available plugins.

## Working with This Repository

### Adding a New Plugin

1. Create plugin directory structure in `plugins/your-plugin-name/`
2. Create `.claude-plugin/plugin.json` with metadata only (name, version, description, author)
3. Add plugin components to standard directories:
   - `commands/` for slash commands (*.md)
   - `agents/` for specialized agents (*.md)
   - `hooks/hooks.json` for event hooks
   - `skills/` for plugin-specific skills (**/SKILL.md)
4. Add entry to `.claude-plugin/marketplace.json`
5. Update README.md to list the new plugin
6. Test locally before committing

**Important**: Do NOT add `commands`, `agents`, `hooks`, or `skills` fields to plugin.json unless using non-standard locations. Standard directories are auto-discovered.

### Adding a Standalone Skill

1. Create directory in `skills/your-skill-name/`
2. Create `SKILL.md` with YAML frontmatter (name, description, version, tags)
3. Follow progressive disclosure principle: keep SKILL.md under 500 lines
4. Use `references/`, `scripts/`, or `assets/` subdirectories for extended content
5. Update README.md to list the new skill
6. Test the skill by invoking it via the Skill tool

### Skill Creation Best Practices

Reference the `skill-creation` skill for comprehensive guidance, but key principles:
- **YAML frontmatter is mandatory**: name, description, version, tags
- **Progressive disclosure**: Metadata → SKILL.md body → Additional resources
- **Concise descriptions**: Max 1024 chars, trigger words, third-person voice
- **Line limit**: Keep SKILL.md under 500 lines; extract longer content to references/
- **Naming**: lowercase, hyphens only, match directory name, max 64 chars

### GitHub Actions Integration

This repository has Claude Code GitHub Actions configured:
- `claude.yml`: Responds to @claude mentions in issues, PRs, and comments
- `claude-code-review.yml`: Automated PR reviews

Claude Code GitHub Actions require:
- `CLAUDE_CODE_OAUTH_TOKEN` secret configured
- Appropriate permissions (contents:read, pull-requests:read, issues:read, etc.)

## Domain-Specific Knowledge

### Transaction Analysis Skill

The `analyzing-transactions` skill is highly specialized for toll transaction data analysis across multiple client systems (VDOT, DelDOT, MDTA, DRPA). It:
- Auto-detects client type from dataset characteristics
- Applies client-specific analysis frameworks
- Calculates collection rates, rejection patterns, disposition lifecycles
- Generates both technical and executive reports

This skill demonstrates advanced skill architecture with multiple supporting documents:
- `CLIENT-DETECTION.md`: Decision logic for identifying data sources
- `DECISION-TREES.md`: Root cause analysis flowcharts
- `EXTRACTION-GUIDE.md`: Script development guidance

When working with transaction data or similar domain-specific analysis tasks, reference this skill as an exemplar of comprehensive knowledge packaging.

## Testing and Validation

When making changes:
- Test plugin installation: `/plugin install <plugin-name>` (locally)
- Test skill invocation: Use the Skill tool to verify skill loads correctly
- Test commands: Invoke slash commands to verify prompt expansion
- Validate JSON: Ensure all `.json` files are valid (plugin.json, marketplace.json, hooks.json)
- Check YAML frontmatter: Verify all SKILL.md files have valid frontmatter

## Important Notes

- Do NOT modify the `.git/` directory or repository history
- Plugin and skill names must match their containing directory names
- All paths in marketplace.json should use forward slashes (even on Windows)
- Skills should never exceed 500 lines in SKILL.md (use references/ for additional content)
- The marketplace.json file determines what shows in `/plugin` - it's the source of truth
