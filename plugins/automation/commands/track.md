---
name: track
description: Comprehensive task tracking with smart scanning of TaskNotes, meetings, Teams chats, and emails. Auto-creates TaskNotes from detected commitments.
Type: Command
**APPROACH**: Use Glob for file discovery, then filter by reading file metadata/timestamps directly. PowerShell timestamp filtering has proven unreliable and is no longer used.
**STRATEGY**: Smart scanning - read recent files (last 7-14 days) for active sources, full TaskNotes scan for status changes. Better to over-scan than miss commitments.

**EXECUTION MODES**:
- **Interactive Mode** (default): Verbose ASCII dashboard output for user review
- **Unattended Mode**: Minimal JSON output, status written to Claude-State-Automation.md for /daily-standup
---

## Mode Detection

**Check for Unattended Execution**:
- If running via wrapper script (Task Scheduler): Use unattended mode
- If running interactively via Claude Code: Use interactive mode

**Unattended Behavior**:
- Suppress verbose ASCII dashboard
- Execute all scanning steps silently
- Write status to `automated_commands.track_status` in Claude-State-Automation.md
- Output minimal JSON summary:
  ```json
  {
    "status": "success",
    "direct_tasks": 15,
    "managed_dependencies": 8,
    "execution_time_seconds": 45,
    "errors": 0
  }
  ```

---

## Execution Workflow

### Step 0: Read Last Scan Timestamp

**Process**:
1. Read `99-System/Claude-State-Tracking.md`
2. Extract `comprehensive_tracking.last_scan_timestamp`
3. If timestamp doesn't exist (first run), set to epoch (process all historical items)
4. Store as `last_scan_timestamp` for filtering
5. Calculate current timestamp for end of scan

**Purpose**: Establish temporal boundary for incremental scanning, avoid re-processing already-scanned items.

---

### Step 1: Scan TaskNotes (Detect External Changes)

**Process**:
1. Use Glob: `TaskNotes/*.md`
2. Read all TaskNotes where `status` is NOT any of (case-insensitive):
   - `done` / `Done`
   - `completed` / `Completed` (legacy variant)
   - `cancelled` / `Cancelled`

   **Include statuses**: `open`, `in-progress`
3. Extract YAML frontmatter from active TaskNotes
4. Check for status changes or external updates since last scan
5. Identify new action items added to existing TaskNotes

**Purpose**: Detect external changes to TaskNotes (manual edits, status updates), sync understanding.

**Approach**: Full scan of active TaskNotes is fast and reliable. Completed tasks are stable and don't need re-scanning.

**Note**: TaskNote *creation* for new items happens in Steps 2-4 (discovery). This step only detects changes to *existing* TaskNotes.

---

### Step 2: Scan Meeting Notes (Actions & Dependencies)

**Path**: `06-Career/Transcripts/Completed Notes/*.md`

**Note**: This is THE single authoritative source for all meeting notes. All processed meeting notes are stored here regardless of project. Do NOT scan project-level meeting folders.

**File Filter**: All `.md` files (not just `MeetingNotes-*` prefix - transcripts use various naming patterns)

**Process**:
1. Use Glob to find meeting notes matching current month pattern (e.g., `*2025-12*`)
2. Read meeting notes from current and previous month (2-month window)
3. Find "ACTION ITEMS" section (case-insensitive)
4. Parse action items using classification logic (see `99-System/shared/meeting-action-parser.md`)
5. Track which meetings have been processed in Claude-State to avoid re-scanning

**Date Window Calculation**:
- Current month: December 2025 -> pattern `*2025-12*`
- Previous month: November 2025 -> pattern `*2025-11*`
- Combined: `*2025-1[12]*` or scan both patterns
- Always use file modification date as fallback for undated files

**Approach**: Focus on recent 2-month window for meeting discovery. Meeting notes are rarely modified after creation, so this is efficient and reliable.

**Classification** (see `99-System/shared/meeting-action-parser.md`):
- **Direct Tasks**: `**Bryan Kolb**: [action]` -> Create TaskNote
- **Managed Dependencies**: `**Other Person**: [action] - Bryan needs output` -> Track in Claude-State
- **Background Awareness**: External parties, no Bryan impact -> Skip (handled by /update-tracking)

**TaskNote Creation**:
- Title: `[Project]: [Action description]`
- Source reference: Link to meeting note
- Due date: Extract from action item ("by [date]", "due [date]")
- Project: Infer from meeting title/location

---

### Step 3: Scan Teams Chats (Actions & Commitments)

**Path**: `TeamsChats/*.md`

**Incremental Scanning**:
1. Use Glob: `TeamsChats/*.md`
2. For each file, read YAML frontmatter
3. Compare `updated` field vs `last_scan_timestamp`
   - If `updated` > `last_scan_timestamp` -> scan this file
   - If not -> skip (no new messages since last scan)
4. Within scanned files, parse message timestamps
5. Only process messages where timestamp > `last_scan_timestamp`

**First Run Behavior**: If no `last_scan_timestamp` exists, scan messages from last 30 days.

**Message Timestamp Parsing**:
- Format: `##### [[Name]] | [YYYY-MM-DD HH:MM](url)` or `##### [[Name]] | YYYY-MM-DD HH:MM`
- Regex: `##### \[?\[?([^\]|]+)\]?\]? \| \[?(\d{4}-\d{2}-\d{2} \d{2}:\d{2})`
- Group 1: Speaker name, Group 2: Timestamp
- Fallback: If timestamp unparseable, use file's YAML `updated` date

**Chat Type Detection**:
- 1:1 chat: `conversationID` contains `@unq.gbl.spaces`
- Group chat: `conversationID` contains `@thread.v2`

**Task Detection Patterns**:

**A. Requests TO User** (from others):
- High confidence: `[Name][,:]?\s*(can you|please|could you|ASAP|need you to)`
- High confidence: `@[Name]\s+`
- Medium confidence (1:1 chats only): Questions ending in `?` directed at user
- Contextual: In 1:1 chat, requests without explicit name -> assume directed at user

**B. User's Commitments** (from user):
- High confidence: `^(I will|I'll|I can|I'm going to)\s+`
- High confidence: `(will do|can do|on it|i'll get|i'll send)`
- High confidence with deadline: `by (EOD|Friday|tomorrow|\d+\/\d+)`
- Medium confidence: `(let me|i should|i need to|i'll try|i'll look)`

**Exclusion Patterns** (skip even if matches commitment language):
- Past tense: `(i thought|i didn't|i wasn't|sorry|my bad)`
- Questions about past: `(what did|where did|how did|when did)`

---

### Step 4: Scan Email Communications (Commitments)

**Path**: `Emails/*.md`

**Process**:
1. Use Glob pattern for current month: `Emails/*YYYY-MM*.md`
2. Read emails from current and previous month (2-month window)
3. Check frontmatter for outgoing emails (from user)
4. Scan for commitment language patterns (similar to Teams)
5. Extract commitments with recipient and context

**Focus**: Only user's outgoing commitments. Incoming requests handled via meetings/Teams.

**Classification**:
- Direct commitments -> Create TaskNote
- Follow-up dependencies -> Managed Dependency if impacts user's work

---

### Step 5: Update Claude State

**Process**:
1. Read current `99-System/Claude-State-Tracking.md`
2. Calculate execution time (start to finish)
3. Update `comprehensive_tracking` section with counts and details
4. If **Unattended Mode**: Also update `automated_commands.track_status`
5. Write updated state back to file
6. Generate summary output (format depends on mode)

---

## TaskNote Auto-Creation

**CRITICAL**: When /track discovers a new action item for the user, it MUST create a TaskNote file.

### Template:
```yaml
---
Type: Task
task: [Full action description from source]
status: open
priority: [high|normal|low]
created: [ISO timestamp YYYY-MM-DDTHH:MM:SS]
due: [ISO date YYYY-MM-DD or null if not specified]
updated: [ISO timestamp]
project: [Project name - use actual folder name]
client: [Client folder name]
tags:
  - [client-lowercase]
  - [project-keyword]
  - task
  - auto-created
title: [Filename without .md]
contexts: []
discovery: auto-created by /track
source_type: [meeting|email|teams]
source_date: [Date of source document]
---

# [Action Description - Title Case]

## Task Description

[Full context from source about what needs to be done]

## Source Context

**Discovered in**: [[Source-Document-Link]]
**Assigned**: [Date from meeting/email]
**Assigned by**: [Person who assigned, if known]
**Original text**: "[Exact quote from source]"

## Required Actions

- [ ] [Primary action item]
- [ ] [Sub-task if applicable]
- [ ] [Follow-up if needed]

## Related Items

- **Source**: [[Meeting or Email link]]
- **Project**: [[Project Overview link]]
- **Related emails**: [[Email links if applicable]]
- **Documents**: [[Referenced documents]]

## Notes

[Additional context, dependencies, or considerations]

---
*Auto-created by /track on [timestamp]*
```

---

## Validation & Quality Control

**Duplicate Prevention**:
- Before creating TaskNote, check if similar task already exists
- Search TaskNotes folder for matching keywords from action description
- If match found >80% similarity, skip creation (log as "duplicate prevented")

**Confidence Thresholds**:
- High confidence (explicit assignment, clear deadline) -> Auto-create TaskNote
- Medium confidence (implicit assignment) -> Create with flag for review
- Low confidence (ambiguous) -> Log for manual review, don't auto-create

---

## Error Handling

**Missing State File**: If Claude-State-Tracking.md doesn't exist, create with default structure.

**Glob Returns No Files**: Normal for months with no activity. Log and continue.

**Parse Errors**: Skip file with error, log issue, continue scanning.

**Write Failures**: Log error, attempt retry once, escalate if fails.

---

## Key Behaviors

1. **Smart Scanning**: Use 2-month window for meetings/emails, full scan for active TaskNotes
2. **Glob-Based Discovery**: Reliable file pattern matching, no PowerShell timestamp filtering
3. **Prudent Strategy**: When in doubt, read more files (over-scan vs miss commitments)
4. **Auto-Create TaskNotes**: For high-confidence direct tasks only
5. **Track Dependencies**: Store managed dependencies in Claude-State-Tracking.md
6. **Update State**: Always update last_scan_timestamp after successful scan
7. **Duplicate Prevention**: Check for existing tasks before creating new ones

Generate concise discovery summary showing items processed and actions taken.
