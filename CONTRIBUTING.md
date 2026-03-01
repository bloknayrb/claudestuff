# Contributing to claudestuff

Before contributing, understand what this repository is and isn't.

## What This Repository Is

Plugins and skills I've built for Claude Code. Install what's useful, study the patterns, build your own.

Most plugins here are reference implementations — they show how something can be built, not a drop-in solution for everyone.

| Content Type | What You'll Find | How to Use It |
|--------------|------------------|---------------|
| **Patterns** | Reusable architecture (parallel agents, error handling) | Adopt directly |
| **Reference Implementations** | Working commands with full context | Study structure, adapt for your needs |
| **Domain Tools** | Specialized for specific work (toll analysis) | Fork and customize |

## What Contributions Are Welcome

### Yes, Please!

- **Bug fixes** - If something doesn't work as documented, fix it
- **Documentation improvements** - Clarify confusing sections, fix typos, add examples
- **Pattern extraction** - Identify reusable patterns and document them in `skills/shared/`
- **Test protocol improvements** - Better verification processes

### Maybe (Discuss First)

- **New plugins** - Open an issue first to discuss fit with the showcase philosophy
- **Significant refactoring** - Explain the benefit before making changes
- **New features in existing plugins** - These are reference implementations, not products

### Probably Not

- **"Genericization" efforts** - The personal context is intentional
- **Breaking changes to support other platforms** - Windows/Obsidian focus is by design
- **Support requests** - This isn't a product with support SLAs

## How to Test Plugins Locally

Before submitting any changes, verify they work:

### 1. Fresh Session Test

```bash
# Start a fresh Claude Code session (no plugins loaded)
claude --no-plugins

# Add the marketplace from your local fork
/plugin marketplace add /path/to/your/claudestuff

# Install the plugin you modified
/plugin install [plugin-name]
```

### 2. Verify Discovery

```bash
# Check if commands appear
/help

# Check if skills are available
# (Skills show up when Claude detects relevant context)
```

### 3. Basic Execution

- Run the primary command with minimal inputs
- Verify no import errors or missing dependencies
- Check that expected output format matches documentation

### 4. Document Expected Errors

Some plugins expect specific vault structures or state files. If your plugin fails without these, **document the expected error** in the README so users understand what's needed.

## Pull Request Checklist

Before submitting a PR, verify:

```markdown
## PR Checklist

- [ ] I've read the showcase philosophy and my contribution fits
- [ ] I've tested in a fresh Claude Code session
- [ ] Plugin installs without errors
- [ ] Primary command executes (even if it fails due to missing context)
- [ ] README accurately describes what the plugin does
- [ ] README clearly states any requirements or dependencies
- [ ] No sensitive data or personal information included
- [ ] Commit messages are descriptive
```

## Code Style

### Markdown Files (Commands, Skills)

- Use YAML frontmatter for metadata
- Include clear descriptions of what the command/skill does
- Document any dependencies or requirements
- Show example invocations where helpful

### plugin.json

```json
{
  "name": "lowercase-with-dashes",
  "version": "semver",
  "description": "Clear, concise description",
  "author": "Your Name or GitHub username"
}
```

### Agent Definitions

- Include clear triggering conditions
- Specify appropriate model (haiku for quick tasks, sonnet for complex)
- Document what tools the agent needs access to

## File Organization

```
plugins/your-plugin/
├── plugin.json           # Required: Plugin manifest
├── README.md             # Required: Plugin documentation
├── commands/             # Optional: Slash commands
│   └── command-name.md
├── agents/               # Optional: Specialized agents
│   └── agent-name.md
├── skills/               # Optional: Knowledge packages
│   └── skill-name/
│       └── SKILL.md
├── hooks/                # Optional: Event hooks
│   └── hooks.json
└── .mcp.json             # Optional: MCP servers
```

## Questions?

- **General questions**: Open a GitHub Discussion
- **Bug reports**: Use the bug report issue template
- **Feature ideas**: Use the feature request issue template

This is a showcase, not a product. The most useful thing you can do with it is take the patterns and build your own.
