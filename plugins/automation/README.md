# Automation Plugin

Vault scanning and project management commands for Obsidian-based productivity workflows.

> **Reference Implementation**: This plugin is a working example from a specific Obsidian vault setup. Study the structure and adapt for your own workflow.

## Components

| Type | Name | Description |
|------|------|-------------|
| Command | `/track` | Comprehensive task tracking with smart scanning |
| Command | `/update-projects` | Weekly project overview updates |

## Commands

### /track

Comprehensive task tracking with smart scanning of TaskNotes, meetings, Teams chats, and emails. Auto-creates TaskNotes from detected commitments.

**What It Does:**
- Scans TaskNotes for status changes
- Parses meeting notes for action items
- Monitors Teams chats for commitments
- Reviews emails for deadlines
- Auto-creates TaskNotes from detected obligations
- Updates tracking state for incremental scanning

**Execution Modes:**
- **Interactive** (default): Verbose ASCII dashboard for user review
- **Unattended**: JSON output for scheduled automation

**Key Concepts:**
- **Direct Tasks**: Actions assigned to you → TaskNote created
- **Managed Dependencies**: Others' actions you depend on → Tracked separately
- **Background Awareness**: External activity for context only

### /update-projects

Weekly project overview updates with parallel agent analysis.

**What It Does:**
- Scans project folders for recent activity
- Calculates project health scores
- Updates project overview notes
- Identifies stale or at-risk projects

## Requirements

This plugin expects a specific vault structure:

```
Obsidian Vault/
├── TaskNotes/                    # Task management files
├── 06-Career/
│   └── Transcripts/
│       └── Completed Notes/      # Meeting notes
├── Emails/                       # Flat email archive
├── TeamsChats/
│   └── messages/                 # Teams message imports
├── 01-Projects/
│   └── [Client]/
│       └── [Project]/            # Project folders
└── 99-System/
    └── Claude-State-Tracking.md  # State persistence
```

**Dependencies:**
- Obsidian vault with YAML frontmatter conventions
- TaskNotes format (https://tasknotes.dev/)
- Claude Code state files for incremental scanning

## How It Works

### Incremental Scanning

The `/track` command uses timestamp-based filtering to avoid re-processing:

1. Reads `last_scan_timestamp` from state file
2. Filters files by modification date
3. Processes only new/changed content
4. Updates timestamp after completion

### Action Item Classification

Meeting notes are parsed using a three-tier classification:

| Type | Pattern | Result |
|------|---------|--------|
| Direct | `**Your Name**: [action]` | Creates TaskNote |
| Dependency | `**Other Person**: [action] - you need output` | Tracks in state |
| Background | External parties, no impact on you | Skipped |

### State Persistence

Tracking state is stored in `Claude-State-Tracking.md`:

```yaml
comprehensive_tracking:
  last_scan_timestamp: "2025-12-20T08:00:00"
  managed_dependencies:
    - source: "Weekly Sync 2025-12-19"
      owner: "Jane Doe"
      action: "Send updated requirements"
      waiting_since: "2025-12-19"
```

## Adapting for Your Vault

1. **Study the command structure** - Understand the scanning logic
2. **Map your folder paths** - Update paths to match your vault
3. **Adjust classification patterns** - Customize name detection
4. **Create state files** - Initialize `Claude-State-Tracking.md`

## Complexity Rating

| Aspect | Rating | Notes |
|--------|--------|-------|
| Setup Difficulty | High | Requires specific vault structure |
| Customization Needed | High | Paths and patterns are vault-specific |
| Value as Reference | High | Shows comprehensive scanning patterns |

## Related Plugins

- **obsidian-vault-management** - Vault maintenance and sweeping
- **simplemem-memory** - Memory storage for meeting context
