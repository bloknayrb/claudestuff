# Changelog

All notable changes to the claudestuff marketplace will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-22

First stable release with complete documentation and validation tooling.

### Added

#### v1.0.0 - Quality Enforcement
- `scripts/validate-plugin.py` - Plugin validation (JSON syntax, required fields, YAML frontmatter, directory structure, broken links)
- `.github/workflows/validate.yml` - GitHub Actions for PR validation
- Updated `marketplace.json` to v1.0.0 with all plugins

#### v0.5.0 - Obsidian Productivity Plugin
- **obsidian-productivity** plugin with complete productivity stack:
  - `/track` - Comprehensive task tracking with parallel agents
  - `/email-triage` - Email prioritization by client/urgency
  - `/daily-standup` - Multi-layer daily dashboard
  - `/timesheet` - Weekly time tracking rollup
  - `/capture-time` - Manual daily time entry
- `ARCHITECTURE.md` - System overview, data flow, vault structure
- `state-files/` - Example state file structure
- `skills/email-classification/` - Email categorization and priority logic
- `skills/time-tracking/` - Multi-source time aggregation patterns

#### v0.4.0 - Focus Tools Plugin
- **focus-tools** plugin for executive function support:
  - `/sos` command - Cut through overwhelm, identify ONE next action
  - `HOW-IT-WORKS.md` - Deep dive into the 5-step framework
  - `skills/executive-function-support/` - Framework and principles

#### v0.3.0 - Shared Patterns Extraction
- `skills/shared/parallel-agent-pattern/` - Multi-agent deployment strategy
- `skills/shared/powershell-temporal-filter/` - Reliable timestamp filtering on Windows
- `skills/shared/error-handling-protocols/` - Standard error handling, graceful failures
- `skills/shared/output-templates/` - ASCII-bordered output formatting templates

#### v0.2.0 - Infrastructure Baseline
- `CONTRIBUTING.md` with showcase philosophy and local testing workflow
- `SECURITY.md` documenting MCP and data handling considerations
- `CHANGELOG.md` (this file)
- GitHub issue templates (bug report, feature request)
- GitHub pull request template
- `docs/test-protocol.md` with pre-merge and pre-release checklists
- README files for 5 plugins (automation, example-plugin, ms-office-suite, professional-agents, transaction-analysis)

### Changed
- Main README.md restructured with quick start, showcase philosophy, complexity ratings, and decision tree
- marketplace.json updated with new plugins and v1.0.0 version

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

## Philosophy Note

This repository is a **showcase**, not a product. The personal context is intentional - these are reference implementations showing how Claude Code plugins can be built for real productivity workflows.

Study the patterns, understand the architecture, then build your own system with Claude's help.
