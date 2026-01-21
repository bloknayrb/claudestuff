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

### SimpleMem Memory

**Description:** SimpleMem MCP integration for project-specific temporal memory - stores meeting decisions, action items, project milestones, and status changes with date context

**Components:**
- Project Memory Skill - Temporal memory management for project context
- MCP server configuration for SimpleMem integration

**Features:**
- Store and retrieve project-specific facts with date context
- Track meeting decisions and action items
- Maintain project milestone history
- Query context for meeting preparation

**Requirements:**
- SimpleMem MCP server installed and running
- MCP configuration in Claude Code

### Professional Agents

**Description:** Professional role-based agents for software development, consulting, and domain expertise

**Agents:**
- **Developer** - Code implementation, debugging, and feature development (sonnet)
- **Tech Lead** - Architecture decisions and technical planning (sonnet)
- **Product Owner** - Requirements analysis and user story refinement (sonnet)
- **UX Designer** - User interface design and user experience planning (sonnet)
- **QA Reviewer** - Code quality review and security analysis (haiku)
- **Researcher** - Technology research and competitive analysis (sonnet)
- **Strategic PM** - Project planning and delivery risk assessment (sonnet)
- **Toll Consultant** - Tolling operations, systems, and policy expertise (sonnet)
- **Toll Procurement Consultant** - RFP development and vendor evaluation (sonnet)
- **DOCX Editor** - Word document XML structure manipulation (sonnet)

**Use Cases:**
- Proactive agent invocation based on task type
- Specialized domain expertise for consulting projects
- Role-based response formatting and guidelines

### Automation

**Description:** Vault scanning and project management commands for Obsidian

**Commands:**
- `/track` - Comprehensive task tracking with smart scanning of TaskNotes, meetings, Teams chats, and emails
- `/update-projects` - Weekly project overview updates with parallel agent analysis

**Features:**
- Automatic TaskNote creation from detected commitments
- Incremental scanning with timestamp-based filtering
- Cross-project dependency tracking
- Health score calculation per project
- Interactive and unattended execution modes

**Requirements:**
- Obsidian vault with specific folder structure
- TaskNotes format for task management
- Claude-State tracking files

### MS Office Suite

**Description:** Office document creation and editing skills for Claude Code - PPTX, DOCX, XLSX, and PDF workflows with automation support

**Components:**
- **PPTX Skill** - PowerPoint presentation creation and editing with html2pptx workflow, template-based generation, and OOXML direct editing
- **DOCX Skill** - Word document workflows with tracked changes, redlining, comments, and format preservation
- **Word Styles Skill** - Style-based document design with paragraph/character/linked styles, inheritance patterns, theme colors, and utility scripts
- **XLSX Skill** - Excel spreadsheet operations with formulas, financial modeling standards, and zero-error validation
- **PDF Skill** - PDF manipulation including text/table extraction, merging, splitting, form filling, and conversion

**Features:**

*PowerPoint (PPTX):*
- HTML to PowerPoint conversion with design palette selection
- Template-based presentation generation with inventory extraction
- Slide rearrangement, duplication, and text replacement
- Visual thumbnail grids for review
- Direct OOXML editing for advanced customization

*Word (DOCX):*
- Document creation with docx-js library
- Professional redlining workflow for collaborative editing
- Tracked changes and comment management
- Conversion to images via LibreOffice

*Word Styles:*
- Style-based document formatting (paragraph, character, linked, table styles)
- Style hierarchy and inheritance (based-on relationships)
- List and numbering style definitions with multi-level lists
- Theme colors and fonts integration
- Paragraph formatting (spacing, indentation, pagination control)
- Character formatting (fonts, effects, colors)
- Direct formatting to styles conversion
- Utility scripts: inspect_styles.py (dump all styles), apply_style_template.py (copy styles between documents)
- Troubleshooting style conflicts and inheritance issues

*Excel (XLSX):*
- Formula-based spreadsheets (no hardcoded values)
- Financial model standards (color coding, formatting conventions)
- Automatic formula recalculation and error detection
- Zero-tolerance error validation (#REF!, #DIV/0!, #VALUE!, #N/A, #NAME?)

*PDF:*
- Text and table extraction with layout preservation
- Document merging, splitting, and rotation
- Form filling and field validation
- OCR for scanned documents
- Password protection and watermarking

**Requirements:**
- Python packages: markitdown, pandoc, openpyxl, pypdf, pdfplumber, reportlab
- Node.js for html2pptx conversion
- LibreOffice for document conversion
- Poppler utilities for PDF operations

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

### Excel Analysis
Analyze Excel spreadsheets, create pivot tables, generate charts, and perform data analysis. Includes pandas workflows for reading, writing, cleaning, merging, and visualizing Excel data.

### Meeting Prep
Proactive meeting preparation with three adaptive paths (Quick/Standard/Comprehensive). Assembles context from previous meetings, emails, tasks, and project status. Generates talking points, questions, and decision matrices.

### Memory Router
Smart memory routing to SimpleMem or OpenMemory systems. Automatically detects and stores temporal facts, preferences, lessons learned, procedural knowledge, and relationship context. Auto-invokes on detection triggers.

### Semantic Search
Semantic search across Obsidian vaults using model embeddings. Finds conceptually related content beyond keyword matching. Includes toll terminology auto-expansion and caching for performance.

### Task Management
Proactive task creation for Obsidian vault TaskNotes. Detects explicit and implicit task triggers from conversations, emails, and meeting notes. Includes duplicate prevention, SimpleMem integration, and related note tagging.

### Invoice Timesheet Verification
Update monthly progress report invoices by cross-referencing timesheet data. Prioritizes accuracy over completeness - only includes activities directly verifiable from source documents. Includes client value filtering and systematic verification workflow.

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
│   ├── excel-analysis/
│   ├── meeting-prep/
│   ├── memory-router/
│   ├── semantic-search/
│   ├── task-management/
│   ├── invoice-timesheet-verification/
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
