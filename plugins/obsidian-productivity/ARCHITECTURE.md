# Obsidian Productivity Architecture

How the commands fit together and what vault structure they expect.

## System Overview

```
                              ┌─────────────────────────┐
                              │   User Interaction      │
                              │   (/command invocation) │
                              └───────────┬─────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
            ▼                             ▼                             ▼
    ┌───────────────┐           ┌───────────────┐             ┌───────────────┐
    │   /track      │           │ /email-triage │             │  /timesheet   │
    │ (heavyweight  │           │ (inbox        │             │  (time        │
    │  scanner)     │           │  processor)   │             │   aggregator) │
    └───────┬───────┘           └───────┬───────┘             └───────┬───────┘
            │                           │                             │
            │    ┌──────────────────────┤                             │
            │    │                      │                             │
            ▼    ▼                      ▼                             ▼
    ┌───────────────────┐      ┌───────────────┐             ┌───────────────┐
    │ Claude-State-     │      │   Emails/     │             │  Daily Notes/ │
    │ Tracking.md       │◀─────│   (flat       │             │  Calendar     │
    │ (central state)   │      │    folder)    │             │  Meetings     │
    └─────────┬─────────┘      └───────────────┘             └───────────────┘
              │
              │ read by
              ▼
    ┌───────────────────┐
    │  /daily-standup   │
    │  (morning         │
    │   dashboard)      │
    └───────────────────┘
```

## State Management

### Central State File

`99-System/Claude-State-Tracking.md` holds:

```yaml
---
comprehensive_tracking:
  last_scan_timestamp: 2025-01-22T10:30:00
  direct_tasks_count: 15
  managed_dependencies_count: 8

tasks_by_project:
  - project: DRPA
    count: 5
    overdue: 2
  - project: VDOT
    count: 10
    overdue: 1

waiting_on:
  - person: {Manager Name}
    items:
      - description: Review approval
        since: 2025-01-15
---

# Tracking State

Human-readable notes and context...
```

### State Flow

1. `/track` **writes** to state file after scanning
2. `/daily-standup` **reads** state file for dashboard
3. `/email-triage` **reads** emails directly (doesn't use state)
4. `/timesheet` **reads** multiple sources, doesn't update state

## Expected Vault Structure

```
vault-root/
│
├── TaskNotes/                    # All task files
│   ├── TaskNote-*.md            # Individual tasks
│   └── (flat structure)
│
├── Emails/                       # All emails (FLAT - no subfolders!)
│   ├── email-*.md               # Email files
│   └── (tagged with #email-clientname)
│
├── TeamsChats/
│   └── messages/                 # Teams exports
│       └── TeamsChat_*.md
│
├── 01-Projects/                  # Project folders
│   ├── ClientA/
│   │   └── ProjectName/
│   │       ├── Documents/
│   │       └── Meetings/
│   └── ClientB/
│       └── ...
│
├── 06-Career/
│   └── Transcripts/
│       └── Completed Notes/      # All meeting notes (single folder)
│           └── MeetingNotes-*.md
│
├── 99-System/
│   ├── Claude-State-Tracking.md  # Central state
│   ├── Claude-State-Automation.md # Automation status
│   └── shared/                   # Shared patterns
│
└── Daily Notes/                  # Daily note files
    └── YYYY-MM-DD.md
```

### Critical: Flat Email Structure

**Emails MUST be in `/Emails/` folder - no subfolders.**

- Client identification via tags (`#email-drpa`, `#email-vdot`)
- Dataview queries handle filtering
- Avoids path length issues on Windows

## Command Dependencies

### /track Dependencies

**Reads:**
- `99-System/Claude-State-Tracking.md` (last scan timestamp)
- `TaskNotes/*.md` (active tasks)
- `06-Career/Transcripts/Completed Notes/*.md` (meeting actions)
- `Emails/*.md` (email commitments)
- `TeamsChats/messages/*.md` (chat items)

**Writes:**
- `99-System/Claude-State-Tracking.md` (updated state)
- `TaskNotes/*.md` (new TaskNotes from detected commitments)

### /email-triage Dependencies

**Reads:**
- `Emails/*.md` (recent emails)

**Writes:**
- None (read-only analysis)

### /daily-standup Dependencies

**Reads:**
- `99-System/Claude-State-Tracking.md` (task state)
- Calendar (ICS or API)
- `Daily Notes/YYYY-MM-DD.md` (today's note if exists)

**Writes:**
- Console output (dashboard)

### /timesheet Dependencies

**Reads:**
- Calendar events
- `06-Career/Transcripts/Completed Notes/*.md` (meeting times)
- `Daily Notes/*.md` (captured time)
- `TaskNotes/*.md` (time logged)

**Writes:**
- Console output (timesheet report)

### /capture-time Dependencies

**Reads:**
- Calendar (today's events)
- User input (manual entries)

**Writes:**
- `Daily Notes/YYYY-MM-DD.md` (time entries)

## Data Flow: /track Deep Dive

```
┌─────────────────────────────────────────────────────────────────────┐
│                           /track execution                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐           ┌───────────────┐
│ Step 0:       │         │ Step 1:       │           │ Step 2:       │
│ Read last     │         │ Scan          │           │ Scan          │
│ scan time     │         │ TaskNotes     │           │ Meetings      │
└───────┬───────┘         └───────┬───────┘           └───────┬───────┘
        │                         │                           │
        │                         ▼                           ▼
        │                 ┌───────────────┐           ┌───────────────┐
        │                 │ Detect status │           │ Extract       │
        │                 │ changes       │           │ action items  │
        │                 └───────────────┘           └───────┬───────┘
        │                                                     │
        │         ┌───────────────────────────────────────────┘
        │         │
        │         ▼
        │ ┌───────────────┐         ┌───────────────┐
        │ │ Step 3:       │         │ Step 4:       │
        │ │ Scan          │         │ Scan          │
        │ │ Emails        │         │ Teams         │
        │ └───────┬───────┘         └───────┬───────┘
        │         │                         │
        │         ▼                         ▼
        │ ┌───────────────┐         ┌───────────────┐
        │ │ Detect        │         │ Detect        │
        │ │ commitments   │         │ items         │
        │ └───────┬───────┘         └───────┬───────┘
        │         │                         │
        │         └────────────┬────────────┘
        │                      │
        │                      ▼
        │              ┌───────────────┐
        │              │ Step 5:       │
        │              │ Classification│
        │              │ & TaskNote    │
        │              │ creation      │
        │              └───────┬───────┘
        │                      │
        │                      ▼
        │              ┌───────────────┐
        │              │ Step 6:       │
        │              │ Update state  │
        │              │ file          │
        └─────────────▶│               │
                       └───────┬───────┘
                               │
                               ▼
                       ┌───────────────┐
                       │ Step 7:       │
                       │ Generate      │
                       │ dashboard     │
                       └───────────────┘
```

## Task Classification

/track classifies items into three tiers:

| Tier | Description | Example | Action |
|------|-------------|---------|--------|
| **Direct Tasks** | User is responsible | "{User}: Draft proposal" | Create TaskNote |
| **Managed Dependencies** | Others responsible, user needs output | "{Manager}: Approve budget ({User} needs for planning)" | Track in state |
| **Background Awareness** | External, no user impact | "Sarah: Update vendor list" | Skip (handled by /update-tracking) |

## Time Tracking Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Calendar        │     │ Meeting Notes   │     │ Manual Entry    │
│ Events          │     │ (duration)      │     │ (/capture-time) │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   /timesheet    │
                        │   (aggregator)  │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Weekly Rollup   │
                        │ by Project      │
                        └─────────────────┘
```

**Time sources (in priority order):**
1. Meeting notes with explicit time/duration
2. Calendar events (filtered for work items)
3. Manual entries in daily notes
4. TaskNote time logged

## Error Handling

Commands follow error-handling-protocols skill:

| Error Type | Handling |
|------------|----------|
| Missing state file | Fail with instruction to run /track first |
| Stale state (>7 days) | Warn but continue |
| PowerShell failure | Fall back to full scan |
| Missing folder | Fail with path guidance |
| Agent timeout | Continue with partial results |

## Performance Considerations

### /track (heavy operation)
- Uses timestamp filtering to limit scope
- Parallel agents for different data sources
- Full TaskNotes scan (active only)
- 2-month window for meetings

### /email-triage (medium)
- Recent emails only (configurable window)
- Parallel classification

### /daily-standup (light)
- Reads state file (already computed)
- Calendar lookup
- No scanning

### /timesheet (medium)
- Aggregates from multiple sources
- Week-bounded queries

## Customization Points

| Component | Location | What to Change |
|-----------|----------|----------------|
| Project names | Throughout commands | Replace client/project references |
| Folder paths | Command headers | Update path constants |
| State file location | Commands | Change `99-System/` references |
| Priority rules | email-triage, track | Modify urgency detection |
| Output templates | All commands | Adjust ASCII formatting |
| Scan windows | track, email-triage | Modify date ranges |
