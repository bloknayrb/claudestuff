# Example Plugin

A complete example demonstrating all Claude Code plugin component types: commands, agents, skills, hooks, and MCP servers.

> **Use This For**: Learning plugin structure, testing marketplace installation, and as a starting template for new plugins.

## Components

| Type | Name | Description |
|------|------|-------------|
| Command | `/hello` | Simple greeting with date/time |
| Agent | Code Reviewer | Reviews code for best practices |
| Skill | Example Skill | Python coding standards and patterns |
| Hook | Post-tool | Example hook on tool completion |
| MCP | Example Server | MCP server configuration template |

## File Structure

```
example-plugin/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest (required)
├── commands/
│   └── hello.md              # Slash command definition
├── agents/
│   └── code-reviewer.md      # Agent specification
├── skills/
│   └── example-skill/
│       └── SKILL.md          # Skill knowledge package
├── hooks/
│   └── hooks.json            # Event hook definitions
└── .mcp.json                  # MCP server configuration
```

## Components Explained

### Commands (`/hello`)

Commands are user-invocable actions triggered with `/command-name`.

```markdown
---
description: A simple example command that greets the user
---

# Hello Command

Greet the user with a friendly message and show them the current date and time.

## Instructions

1. Display a friendly greeting
2. Show the current date and time
3. Provide a helpful tip about using Claude Code
```

**Key Elements:**
- YAML frontmatter with `description`
- Clear `## Instructions` section
- Claude follows the instructions when command is invoked

### Agents

Agents are specialized personas with specific expertise and triggering conditions.

**When Claude uses an agent:**
- Task matches the agent's description
- User explicitly requests the agent
- Context suggests the agent's expertise is relevant

### Skills

Skills are packaged knowledge that Claude can reference when relevant context is detected.

**Skill structure:**
- `SKILL.md` - Main skill content
- Supporting files (optional) - Additional reference material

### Hooks

Hooks execute code in response to events (PreToolUse, PostToolUse, etc.).

```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "matcher": { "tool_name": "*" },
      "script": "echo 'Tool completed'"
    }
  ]
}
```

### MCP Servers

MCP (Model Context Protocol) servers extend Claude's capabilities with external integrations.

```json
{
  "servers": {
    "example-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["example-mcp-server"]
    }
  }
}
```

## Testing This Plugin

1. Install the plugin:
   ```bash
   /plugin install example-plugin
   ```

2. Run the hello command:
   ```bash
   /hello
   ```

3. Verify the code reviewer agent appears in available agents

4. Check that the skill is discoverable

## Creating Your Own Plugin

Use this as a template:

1. Copy the directory structure
2. Update `plugin.json` with your plugin name and description
3. Add your commands, agents, skills as needed
4. Remove components you don't need (all are optional)
5. Test locally before submitting

## Minimum Viable Plugin

The only required file is `plugin.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What my plugin does"
}
```

Everything else (commands, agents, skills, hooks, MCP) is optional.
