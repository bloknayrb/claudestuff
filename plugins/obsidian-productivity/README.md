# Obsidian Productivity Plugin

Complete productivity stack for Obsidian: task tracking, email triage, daily standups, and timesheet generation.

> **Reference Implementation**: This is my complete working system, built over months of real use. It expects a specific vault structure. Study it, borrow ideas, or adapt the whole system.

## What's Included

| Command | Purpose | Complexity |
|---------|---------|------------|
| `/track` | Comprehensive task tracking with smart scanning | High |
| `/email-triage` | Parallel email prioritization by client/urgency | Medium |
| `/daily-standup` | Multi-layer daily dashboard | Medium |
| `/timesheet` | Weekly time tracking rollup | Medium |
| `/capture-time` | Manual daily time entry | Low |

| Skill | Purpose |
|-------|---------|
| email-classification | Email categorization and priority logic |
| time-tracking | Time capture patterns and sources |

## The System at a Glance

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   /track        │────→│ Claude-State-    │←────│  /daily-standup │
│ (comprehensive  │     │ Tracking.md      │     │  (reads state,  │
│  scanning)      │     │ (central state)  │     │   generates     │
└─────────────────┘     └──────────────────┘     │   dashboard)    │
        │                       ↑                └─────────────────┘
        │                       │
        ↓                       │
┌─────────────────┐     ┌──────────────────┐
│  TaskNotes/     │     │  /email-triage   │
│  (task files)   │     │  (prioritizes    │
└─────────────────┘     │   inbox)         │
                        └──────────────────┘

┌─────────────────┐     ┌──────────────────┐
│  /timesheet     │────→│  Weekly rollup   │
│  (aggregates    │     │  by project      │
│   time data)    │     └──────────────────┘
└─────────────────┘
        ↑
        │
┌─────────────────┐
│  /capture-time  │
│  (manual entry) │
└─────────────────┘
```

## Commands

### /track

The heavyweight - comprehensive task tracking with smart scanning.

**What it does:**
1. Scans TaskNotes for status changes
2. Scans meeting notes for action items
3. Scans emails for commitments
4. Scans Teams chats for items
5. Auto-creates TaskNotes from detected commitments
6. Updates Claude-State-Tracking.md

**Key features:**
- Incremental scanning (timestamp-based filtering)
- Cross-project dependency tracking
- Interactive and unattended modes
- Uses parallel agents for comprehensive coverage

**Output:** ASCII dashboard with task breakdown by project

### /email-triage

Prioritize emails by client and urgency.

**What it does:**
1. Scans recent emails
2. Classifies by urgency (immediate/important/routine)
3. Groups by client
4. Outputs prioritized action list

**Output:** Triage dashboard with recommended actions

### /daily-standup

Multi-layer daily status dashboard.

**What it does:**
1. Reads state from Claude-State-Tracking.md
2. Checks calendar for today's meetings
3. Identifies focus items
4. Generates daily dashboard

**Output:** Morning briefing with priorities and schedule

### /timesheet

Weekly time tracking rollup.

**What it does:**
1. Aggregates time data from multiple sources
2. Groups by project
3. Calculates daily and weekly totals
4. Generates timesheet report

**Output:** Weekly timesheet with project breakdown

### /capture-time

Manual daily time entry.

**What it does:**
1. Prompts for day's activities
2. Captures time by project
3. Writes to daily note

**Output:** Time entries in daily note

## Requirements

### Platform
- **Windows** (PowerShell required for temporal filtering)

### Vault Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for complete structure. Key folders:

```
/
├── TaskNotes/              # Task files (TaskNotes format)
├── Emails/                 # Email markdown files (flat structure)
├── TeamsChats/messages/    # Teams message exports
├── 06-Career/
│   └── Transcripts/
│       └── Completed Notes/  # Meeting notes
├── 99-System/
│   └── Claude-State-Tracking.md  # Central state file
└── Daily Notes/            # Daily note files (optional)
```

### State Files

The system uses state files to track scan timestamps and task status:

- `Claude-State-Tracking.md` - Main state (tasks, dependencies, scan timestamps)

See `state-files/` for example structures.

### Task Format

Tasks use the [TaskNotes](https://tasknotes.dev/) format:

```yaml
---
status: open | in-progress | waiting | done | cancelled
priority: high | medium | low
due: 2025-01-15
project: Project Name
waitingOn: Person Name  # if status is waiting
---

# Task Title

Task description and notes...
```

## Complexity Rating

| Aspect | Rating | Notes |
|--------|--------|-------|
| Setup Difficulty | High | Requires specific vault structure |
| Customization Needed | High | Paths, projects, clients need adaptation |
| Value as Reference | Very High | Complete productivity system |

## Adaptation Guide

### If You Want the Whole System

1. Set up the vault structure per ARCHITECTURE.md
2. Install the plugin
3. Modify paths in commands to match your vault
4. Create initial state files
5. Run `/track` to initialize

### If You Want Specific Parts

Each command can be studied independently:

- **Task tracking pattern**: Study `/track` for incremental scanning, state management
- **Email classification**: Study `/email-triage` for prioritization logic
- **Dashboard generation**: Study `/daily-standup` for multi-source aggregation
- **Time tracking**: Study `/timesheet` and `/capture-time` for time capture patterns

### Key Customization Points

1. **Project/client names**: Search for project references, update to yours
2. **Folder paths**: Update paths like `TaskNotes/`, `Emails/`, etc.
3. **State file location**: Change `99-System/` path
4. **Priority rules**: Adjust urgency classification logic
5. **Output format**: Modify ASCII templates if desired

## Skills

### email-classification

Email categorization logic:
- Urgency detection (deadlines, keywords, sender importance)
- Client detection from tags and content
- Action classification (requires response, FYI, etc.)

### time-tracking

Time capture patterns:
- Calendar event parsing
- Meeting note time extraction
- Manual entry prompts
- Multi-source aggregation

## File Structure

```
obsidian-productivity/
├── plugin.json
├── README.md
├── ARCHITECTURE.md
├── commands/
│   ├── track.md          # Comprehensive tracking
│   ├── email-triage.md   # Email prioritization
│   ├── daily-standup.md  # Daily dashboard
│   ├── timesheet.md      # Weekly rollup
│   └── capture-time.md   # Manual time entry
├── state-files/
│   └── Claude-State-Tracking-example.md
└── skills/
    ├── email-classification/
    │   └── SKILL.md
    └── time-tracking/
        └── SKILL.md
```

## Why This System Exists

This grew from real productivity challenges:

1. **Task tracking** - Too many places tasks hide (emails, meetings, chats)
2. **Email overload** - Need systematic triage, not inbox zero guilt
3. **Time tracking** - Required for billing, painful to do manually
4. **Daily focus** - Easy to lose the thread without a morning ritual

The commands work together but each solves a specific problem.

## Related

- **parallel-agent-pattern** - Architecture `/track` uses
- **error-handling-protocols** - Error handling in commands
- **output-templates** - Dashboard formatting
- **powershell-temporal-filter** - File filtering patterns
