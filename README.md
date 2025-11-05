# Claude Code Plugin Marketplace

A curated marketplace for Claude Code plugins, making it easy to discover, install, and manage extensions for Claude Code.

## What is This?

This repository serves as a plugin marketplace for [Claude Code](https://www.anthropic.com/news/claude-code-plugins) - Anthropic's AI-powered coding assistant. Plugin marketplaces allow you to package and distribute collections of:

- **Slash Commands** - Custom commands accessible via `/command-name`
- **Agents** - Specialized AI agents with specific expertise
- **Skills** - Packaged knowledge and capabilities
- **Hooks** - Event-triggered automation
- **MCP Servers** - Model Context Protocol integrations

## Using This Marketplace

### Installation

To add this marketplace to your Claude Code installation:

```bash
/plugin marketplace add bloknayrb/claudestuff
```

### Browse Available Plugins

Once added, browse and install plugins using:

```bash
/plugin
```

This opens an interactive menu where you can:
- View all available plugins
- Install plugins with one click
- Manage installed plugins
- Update plugins to latest versions

### Manual Plugin Installation

You can also install a specific plugin directly:

```bash
/plugin install example-plugin
```

## Available Plugins

### Example Plugin

**Description:** An example plugin demonstrating all component types (commands, agents, skills, hooks, MCP)

**Components:**
- `/hello` - A simple greeting command
- Code Reviewer Agent - Reviews code for best practices
- Example Skill - Python coding standards and patterns
- Post-tool execution hook
- Example MCP server configuration

## Creating Your Own Plugins

### Plugin Structure

Each plugin should follow this structure:

```
plugins/your-plugin-name/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── commands/                 # Slash commands (optional)
│   └── command-name.md
├── agents/                   # Specialized agents (optional)
│   └── agent-name.md
├── skills/                   # Knowledge packages (optional)
│   └── skill-name/
│       └── SKILL.md
├── hooks/                    # Event hooks (optional)
│   └── hooks.json
└── .mcp.json                 # MCP servers (optional)
```

### Plugin Manifest (plugin.json)

```json
{
  "name": "your-plugin-name",
  "version": "1.0.0",
  "description": "What your plugin does",
  "author": "Your Name",
  "components": {
    "commands": ["commands/*.md"],
    "agents": ["agents/*.md"],
    "skills": ["skills/**/SKILL.md"],
    "hooks": ["hooks/hooks.json"]
  }
}
```

### Adding Your Plugin to This Marketplace

1. Create your plugin in the `plugins/` directory
2. Add an entry to `.claude-plugin/marketplace.json`:

```json
{
  "name": "your-plugin-name",
  "source": "./plugins/your-plugin-name",
  "description": "Brief description of your plugin"
}
```

3. Test your plugin locally
4. Submit a pull request

## Marketplace Structure

```
.
├── .claude-plugin/
│   └── marketplace.json      # Marketplace manifest
├── plugins/                  # Plugin directory
│   ├── example-plugin/
│   └── your-plugin/
└── README.md                 # This file
```

## Documentation

- [Official Claude Code Plugin Documentation](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces)
- [Creating Commands](https://docs.claude.com/en/docs/claude-code/commands)
- [Creating Agents](https://docs.claude.com/en/docs/claude-code/agents)
- [Creating Skills](https://docs.claude.com/en/docs/claude-code/skills)
- [MCP Servers](https://modelcontextprotocol.io/)

## Contributing

Contributions are welcome! Please:

1. Fork this repository
2. Create your plugin following the structure above
3. Test thoroughly
4. Submit a pull request with:
   - Plugin code
   - Updated marketplace.json
   - Description of what your plugin does

## License

This marketplace and example plugins are provided as-is for the Claude Code community.

## Support

For issues or questions:
- Claude Code documentation: https://docs.claude.com
- File an issue in this repository
- Join the Claude Code community discussions
