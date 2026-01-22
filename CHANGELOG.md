# Changelog

All notable changes to the claudestuff marketplace will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CONTRIBUTING.md with showcase philosophy and local testing workflow
- SECURITY.md documenting MCP and data handling considerations
- CHANGELOG.md (this file)
- GitHub issue templates (bug report, feature request)
- GitHub pull request template
- Test protocol documentation in docs/test-protocol.md
- README files for 5 plugins (automation, example-plugin, ms-office-suite, professional-agents, transaction-analysis)

### Changed
- Main README.md restructured with quick start, complexity ratings, and decision tree

## [0.1.0] - 2024-11-14

### Added
- Initial marketplace structure
- Example plugin demonstrating all component types
- Transaction analysis plugin for toll data
- Obsidian vault management plugin
- SimpleMem memory integration plugin
- Professional agents collection
- MS Office Suite skills (PPTX, DOCX, XLSX, PDF)
- Automation commands (/track, /update-projects)
- Standalone skills:
  - Skill creation guide
  - Testing best practices
  - API design
  - Security review
  - Excel analysis
  - Meeting prep
  - Memory router
  - Semantic search
  - Task management
  - Invoice timesheet verification

### Infrastructure
- marketplace.json configuration
- Basic GitHub workflows for Claude Code integration

---

## Version Roadmap

### v0.2.0 - Infrastructure Baseline (Current)
Focus on documentation and professional foundation.

### v0.3.0 - Shared Patterns Extraction
Publish reusable patterns from `skills/shared/`:
- parallel-agent-pattern
- output-templates
- error-handling-protocols
- powershell-temporal-filter

### v0.4.0 - Focus Tools Plugin
New plugin showcasing executive function support patterns:
- `/sos` command
- Executive function support skill

### v0.5.0 - Obsidian Productivity Plugin
Complete productivity system reference implementation:
- `/track`, `/email-triage`, `/daily-standup`, `/timesheet`, `/capture-time`
- Architecture documentation
- Example state files

### v1.0.0 - Quality Enforcement
Production-ready release with validation tooling:
- Plugin validation script
- GitHub Actions for PR validation
- Comprehensive example plugin
