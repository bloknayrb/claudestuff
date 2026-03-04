# Changelog

All notable changes to the Obsidian Vault Management plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-13

### Added
- Initial release of obsidian-vault-management plugin
- **Vault Sweeping skill** with 5 parallel agents:
  - File Organization Scanner
  - Template Compliance Checker
  - Project Status Updater
  - Metadata Validator
  - Cleanup Coordinator
- Adaptive path architecture (Quick/Standard/Deep)
- Progressive disclosure pattern for token optimization
- Windows/PowerShell temporal filtering support
- Shared infrastructure for common patterns
- Plugin documentation (README, CHANGELOG, LICENSE)

### Features
- Automatic context-based skill invocation
- Prioritized output (Critical → Important → Recommendations)
- Backward compatibility with `/vault-sweep` command
- Performance optimized for 25,000+ file vaults
- Token budget management per path

### Requirements
- Windows platform (PowerShell required)
- Claude Code CLI
- Obsidian vault with YAML frontmatter

### Known Limitations
- Windows-only (PowerShell dependency)
- Requires Type property in YAML frontmatter for file organization validation
- No cross-platform support in v1.0.0

### Performance Targets
- Quick Path: ~30 seconds
- Standard Path: ~60 seconds
- Deep Path: ~120 seconds

## [1.1.0] - 2026-03-04

### Added
- **Obsidian CLI dual-mode execution** (v1.12.4+): Vault sweeping now checks for CLI availability and uses runtime commands when Obsidian is running
- **Rule 21: Orphaned File Detection** (CLI-only): Uses `obsidian orphans` for graph-accurate orphan detection with age-based severity tiers
- CLI-based detection patterns added to detection-patterns.md (Patterns 2, 4, 8, 9)
- CLI availability note in shared/powershell-temporal-filter.md
- New "CLI Enhanced" column in Pattern Integration Matrix

### Changed
- **Rule 13: Wikilink Validity** now dual-mode — uses `obsidian unresolved` when CLI available, falls back to regex
- **Agent 1 (File Org Scanner)**: Can use `obsidian files folder=X format=json` for structured file listings
- **Agent 2 (Template Checker)**: Can use `obsidian properties file="X" format=json` for frontmatter reads (eliminates YAML parsing edge cases)
- **Agent 4 (Metadata Validator)**: Major update — CLI-based unresolved link detection and orphan detection, with regex fallback
- Updated allowed-tools to include Agent
- Updated Limitations section with CLI requirement note
- Updated Future Enhancements — marked plugin API integration as partially achieved via CLI

### Notes
- CLI requires a running Obsidian instance — overnight automation always uses fallback mode
- Agents 3 (Project Status) and 5 (Cleanup) unchanged — no CLI equivalent for temporal filtering
- PATH registration required in Obsidian Settings → General → CLI

## [Unreleased]

### Planned for v1.2.0
- Email Triaging skill (4-agent architecture)
- Client priority tier classification
- Urgency detection and action categorization

### Planned for v1.3.0
- Update Tracking skill (5-6 agent architecture)
- Background awareness intelligence
- Integration with /track command boundaries

### Planned for v2.0.0
- Timesheet Generation skill (5-agent architecture)
- ICS calendar event extraction with date preservation
- Evidence correlation across multiple sources
- Billing-grade accuracy validation

### Future Considerations
- Cross-platform support (PowerShell + bash abstraction)
- Additional vault maintenance skills
- Performance optimization for extremely large vaults (>50K files)
- Integration with additional Obsidian plugins

---

## Version History Summary

| Version | Release Date | Key Feature | Status |
|---------|--------------|-------------|--------|
| 1.0.0 | 2025-11-13 | Vault Sweeping skill | ✅ Released |
| 1.1.0 | 2026-03-04 | Obsidian CLI dual-mode + Rule 21 | ✅ Released |
| 1.2.0 | TBD | Email Triaging skill | 📅 Planned |
| 1.3.0 | TBD | Update Tracking skill | 📅 Planned |
| 2.0.0 | TBD | Timesheet Generation skill | 📅 Planned |