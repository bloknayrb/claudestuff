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

### Transaction Analysis

**Description:** Comprehensive toll transaction data analysis with automatic client detection (VDOT, DelDOT, MDTA, DRPA), specialized agents, and integrated reporting

**Components:**
- `/analyze-transactions` - Full analysis workflow with validation and reporting
- Transaction Analyst Agent - Main analysis agent with client detection and framework selection
- Data Quality Validator Agent - Pre-analysis validation and quality checks
- Analyzing Transactions Skill - Complete transaction analysis knowledge base with client-specific frameworks
- Post-tool execution hook - Progress indicators for analysis steps

**Features:**
- Automatic client type detection from dataset characteristics
- Data quality validation before analysis
- Client-specific analysis frameworks (VDOT, DelDOT, MDTA, DRPA)
- Collection rate, reject rate, at-risk rate calculations
- Pattern recognition and anomaly detection
- Root cause analysis (system vs data vs equipment)
- Technical and executive report generation
- OpenMemory integration for pattern storage

### Obsidian Vault Management

**Description:** Comprehensive vault management skills for Obsidian with adaptive performance paths and parallel agent architecture

**Components:**
- Vault Sweeping Skill - 5 parallel agents for comprehensive vault analysis
- Agent specifications and detection patterns
- Validation rules and error handling
- PowerShell temporal filtering support

**Features:**
- File organization analysis (Type property vs folder location)
- Template compliance validation
- Project status update detection
- Metadata validation
- Cleanup opportunity identification
- Adaptive paths: Quick (30s) / Standard (60s) / Deep (120s)
- Optimized for large vaults (25,000+ files)
- Windows/PowerShell support

**Requirements:**
- Windows platform (PowerShell required)
- Obsidian vault with YAML frontmatter

## Available Skills

Standalone skills that can be used independently or as part of plugins:

### Skill Creation
Expert guidance for creating efficient, comprehensive, and well-structured Claude Code skills. Covers progressive disclosure principles, YAML frontmatter best practices, content organization, code examples, validation checklists, and common mistakes to avoid. Essential for skill authors.

### Testing Best Practices
Comprehensive testing strategies including unit tests, integration tests, test patterns (AAA, mocks, stubs), and coverage guidelines.

### API Design
RESTful API design principles covering resource-oriented design, HTTP methods, status codes, versioning, pagination, security, and performance.

### Security Review
Security vulnerability detection and secure coding practices based on OWASP Top 10, including injection prevention, authentication, encryption, and security headers.

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
├── skills/                   # Standalone skills directory
│   ├── skill-creation/
│   ├── testing-best-practices/
│   ├── api-design/
│   ├── security-review/
│   └── your-skill/
└── README.md                 # This file
```

### Skills Directory

The `skills/` directory contains standalone skills - packaged knowledge and capabilities that can be:
- Used independently through the `/skill` command
- Included in plugins
- Shared across multiple plugins

Each skill is a directory containing a `SKILL.md` file with structured knowledge, patterns, and best practices.

## Documentation

- [Official Claude Code Plugin Documentation](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces)
- [Creating Commands](https://docs.claude.com/en/docs/claude-code/commands)
- [Creating Agents](https://docs.claude.com/en/docs/claude-code/agents)
- [Creating Skills](https://docs.claude.com/en/docs/claude-code/skills)
- [MCP Servers](https://modelcontextprotocol.io/)

## Contributing

Contributions are welcome! Please:

### Adding Plugins

1. Fork this repository
2. Create your plugin following the structure above
3. Test thoroughly
4. Submit a pull request with:
   - Plugin code
   - Updated marketplace.json
   - Description of what your plugin does

### Adding Skills

1. Create a new directory in `skills/` with a descriptive name
2. Add a `SKILL.md` file following the skill format:
   ```markdown
   ---
   name: skill-name
   description: Brief description
   version: 1.0.0
   tags: [tag1, tag2]
   ---

   # Skill Name

   [Your skill content with knowledge, patterns, examples]
   ```
3. Test your skill
4. Submit a pull request with:
   - Skill directory and SKILL.md
   - Updated README listing the new skill
   - Clear description of the knowledge/capabilities provided

## License

This marketplace and example plugins are provided as-is for the Claude Code community.

## Support

For issues or questions:
- Claude Code documentation: https://docs.claude.com
- File an issue in this repository
- Join the Claude Code community discussions
