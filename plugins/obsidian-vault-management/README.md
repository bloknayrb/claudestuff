# Obsidian Vault Management Plugin

Comprehensive Claude Code skills for maintaining large Obsidian vaults with Windows/PowerShell optimization.

## Overview

This plugin provides intelligent, adaptive skills for managing complex Obsidian vaults with thousands of files. Each skill uses parallel agent architecture with Quick/Standard/Deep adaptive paths to optimize performance based on context.

## Skills Included

### 1. Vault Sweeping (v1.0.0)

Comprehensive vault organization analysis with 5 parallel agents scanning for:
- File organization issues (Type property vs folder location)
- Template compliance violations
- Project status updates needed
- Metadata validation problems
- Cleanup opportunities

**Usage**: Claude automatically invokes when you describe maintenance needs
**Performance**: 30-120 seconds depending on scope
**Output**: Prioritized findings (Critical → Important → Recommendations)

**Adaptive Paths**:
- **Quick** (30s): Modified files only, critical issues
- **Standard** (60s): Full validation suite, comprehensive report
- **Deep** (120s): Historical analysis, detailed recommendations

### Coming Soon

- **Email Triaging** (v1.1.0): Intelligent email prioritization across clients
- **Update Tracking** (v1.2.0): Background awareness intelligence
- **Timesheet Generation** (v2.0.0): Weekly billing timesheet automation

## Installation

### From GitHub

```bash
cd ~/Documents/GitHub/claudestuff
git pull
# Plugin auto-available in Claude Code
```

### Manual Installation

1. Clone or download this repository
2. Place in your Claude Code plugins directory
3. Restart Claude Code or reload plugins

## Requirements

- **Platform**: Windows (PowerShell required for temporal filtering)
- **Tools**: Read, Grep, Glob, Bash
- **Obsidian Vault**: YAML frontmatter with Type property
- **Claude Code**: Latest version recommended

## Configuration

No configuration required. Skills auto-activate based on context and user intent.

## Usage

Simply describe what you need naturally:
- "Sweep the vault for organization issues"
- "Check for misplaced files"
- "Run weekly maintenance"
- "Find files missing metadata"

Claude will automatically invoke the appropriate skill with the optimal adaptive path.

## Performance

All skills designed for large vaults (25,000+ files):
- Parallel agent architecture for speed
- Adaptive paths reduce unnecessary processing
- PowerShell temporal filtering for efficiency
- Token-optimized progressive disclosure

## Backward Compatibility

Existing commands (`/vault-sweep`, etc.) remain functional as thin wrappers calling these skills.

## Development

### Adding New Skills

1. Create skill directory in `skills/[skill-name]/`
2. Write `SKILL.md` with required YAML frontmatter
3. Add supporting files as needed
4. Update `plugin.json` version
5. Document in CHANGELOG.md

### Skill Structure Template

```
skills/
└── skill-name/
    ├── SKILL.md              # Required: Main definition
    ├── agent-specifications.md
    └── supporting-files.md
```

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## License

MIT License - See [LICENSE](LICENSE) for details

## Author

Bryan Kolb - RK&K Transportation Solutions

## Support

For issues or questions:
- Open an issue in the repository
- Contact via RK&K internal channels

---

**Note**: This plugin is optimized for Windows environments with PowerShell. Cross-platform support may be added in future versions.