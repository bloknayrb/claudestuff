---
name: task-management
description: "Proactive task creation for Obsidian vault TaskNotes. Use this skill when: (1) User asks to 'remind me', 'add a task', 'track this', 'follow up on', (2) Processing emails with action items or deadlines, (3) Reviewing meeting notes with assigned actions, (4) User mentions commitments or deliverables that need tracking, (5) Converting notes or emails into actionable tasks"
version: 1.0.0
tags: [tasks, tasknotes, obsidian, automation]
license: Proprietary
---

# Task Management Skill

Intelligent task routing and creation for Obsidian vault TaskNotes with multi-project support.

## When to Use This Skill

**Proactive triggers** - invoke this skill when you detect:

### Explicit Triggers
- "remind me to...", "add task for...", "I need to..."
- "create a task", "track this", "follow up on..."
- User directly requests task creation

### Implicit Triggers
- Action items in emails (deadlines, requests, commitments)
- Meeting notes with assigned actions or follow-ups
- Notes containing "TODO", "action required", or similar markers
- User discusses deliverables or deadlines that should be tracked

### Context Triggers
- Processing email triage and finding actionable items
- Reviewing meeting transcripts with commitments
- Daily standup revealing work items to track

**Do NOT use when**:
- User is just discussing tasks (no creation intent)
- Task already exists in TaskNotes folder
- Item is purely informational, not actionable
- User explicitly says "don't create a task"

---

## Core Workflow

1. **Parse task** from natural language or context
2. **Select reasoning path** (Quick/Standard/Deep based on complexity)
3. **Detect project** (from keywords or context)
4. **Assess priority** (high/medium/low/normal)
5. **Check duplicates** before creating
6. **Create TaskNote** in vault `TaskNotes/` folder
7. **Tag related notes** with task property
8. **Store to SimpleMem** for context memory
9. **Confirm creation** with summary

---

## Three Adaptive Reasoning Paths

### Path Selection Logic

```
IF task description is simple AND no keywords ambiguous
  -> Use Quick Path (15s)
ELSE IF task needs context/assignee routing OR mentions other people
  -> Use Standard Path (45s)
ELSE IF task spans multiple projects OR has dependencies OR strategic implications
  -> Use Deep Path (90s)
```

### Quick Path (15 seconds)

**Use When**: Task name/description is clear, single project likely

**What It Does**:
1. Scan task description for project keywords
2. Identify primary project folder
3. Return project path and basic info

**Token Budget**: 1.5K

### Standard Path (45 seconds)

**Use When**: Task needs assignee routing, multi-project check, priority assessment

**What It Does**:
1. Detect project + urgency
2. Identify primary assignee (user vs others)
3. Assess priority (high/medium/low)
4. Check for secondary project impacts
5. Suggest folder structure within project
6. Identify related existing tasks
7. Build TaskNote metadata ready for creation

**Token Budget**: 3.5K

### Deep Path (90 seconds)

**Use When**: Complex task, multi-project impacts, dependency analysis needed

**What It Does**:
1. Detect primary + secondary projects
2. Analyze dependencies with other ongoing tasks
3. Identify stakeholders across projects
4. Flag cross-project impacts
5. Assess root cause / context
6. Build comprehensive TaskNote with dependency tracking
7. Suggest priority based on vault activity analysis
8. Identify potential blockers or resource conflicts

**Token Budget**: 6K

---

## Priority Assessment

| Priority | Indicators |
|----------|------------|
| **High** | "urgent", "ASAP", "critical", "deadline", overdue items, high-impact decisions |
| **Medium** | "important", "review", "meeting", specific due dates, client deliverables |
| **Low** | "when time permits", "future", "research", "nice to have", general admin |
| **Normal** | Default if no priority indicators |

---

## Duplicate Prevention

Before creating, check `TaskNotes/` folder for existing tasks with:
- Same client
- Same action verb
- 70%+ keyword overlap
- Created within same week

If potential duplicate found:
1. Show existing task to user
2. Ask: "This may duplicate [existing task]. Create anyway?"
3. Only create if user confirms

---

## TaskNote Template

Create files following TaskNotes specification (https://callumalpass.github.io/tasknotes/):

```markdown
---
Type: Task
task: [task description]
status: open
priority: [high/medium/low/normal]
created: [ISO timestamp]
updated: [ISO timestamp]
title: [kebab-case filename]
due: [YYYY-MM-DD] (if provided)
scheduled: [YYYY-MM-DD] (if different from due)
projects: ["[[project folder name]]"]
contexts: [context array]
tags:
  - task
  - [project tags]
  - [priority tags]
---

[Extended task description if needed]

[Source references or context]

> Justification excerpt:
> [If created from email or meeting, include relevant quote]
```

### Status Options
- **open**: Default for new tasks
- **in-progress**: If task is already being worked on
- **done**: For completed tasks
- **cancelled**: For cancelled tasks
- **waiting**: Blocked on external input (use with `waitingOn` field)
- **someday**: Low-priority future task, backlog

### Context Detection
- **work**: Professional/client-related tasks
- **admin**: Administrative and internal tasks
- **research**: Analysis and investigation tasks
- **communication**: Email, calls, meetings
- **review**: Document and deliverable reviews
- **urgent**: Time-sensitive items

---

## File Naming Convention

Generate filename using kebab-case format:
- Remove articles (a, an, the)
- Replace spaces with hyphens
- Convert to lowercase
- Limit length to reasonable size

**Examples**:
- "Review Host ICD comments" -> `Review-Host-ICD-comments.md`
- "Follow up with Jeremy about cost estimate" -> `Follow-up-with-Jeremy-about-cost-estimate.md`

---

## Due Date Processing

Parse natural language dates:
- "tomorrow" -> next day's date
- "Friday" -> next Friday's date
- "end of week" -> coming Friday
- "next week" -> following Monday
- "September 15" -> YYYY-09-15 (current year assumed)

---

## Source Integration

If task created from:
- **Email**: Link to source email file and include excerpt
- **Meeting**: Reference meeting note and include context
- **Existing Task**: Create as subtask or related item
- **Quick Note**: Link back to originating note

---

## SimpleMem Integration

**Purpose**: Build queryable corpus of task creation context for future meeting prep and project history queries.

### Pre-check: SimpleMem Availability
1. Try: `mcp__simplemem__get_all_memories()` with 3-second timeout
2. If timeout/error: Log "SimpleMem unavailable - skipping context storage" and continue
3. If available: Proceed with storage

### Quality Gate - Skip storage if:
- Task description < 50 characters
- No meaningful context (no source, no assigner, generic description)

### Process (after TaskNote created successfully):
1. Construct dialogue entry with attribution:
   - Speaker: Source attribution (e.g., "Email from [sender]", "Meeting: [meeting name]", "User", "System")
   - Content: Structured fact including:
     - Task title
     - Client and Project
     - Source context (email subject, meeting topic, etc.)
     - Due date if present
     - Priority level and rationale
   - Timestamp: ISO 8601 format of task creation time

2. Call `mcp__simplemem__add_dialogue()` with the constructed entry

3. Call `mcp__simplemem__finalize()` once after dialogue added

**Example Dialogue Entry**:
```
Speaker: "Email from Jeremy"
Content: "Task created: Review Host ICD comments. Client: DRPA. Project: DRPA Oversight. Source: Email 'FW: Host ICD Review'. Due: 2025-09-15. Priority: High (deadline-driven)."
Timestamp: "2026-01-20T21:15:00"
```

**Fallback**: If SimpleMem unavailable or times out, skip silently - continue normally

**Latency Budget**: 3 seconds maximum for SimpleMem operations

---

## Tag Related Notes

After creating the TaskNote, tag directly related notes with the `task` property.

### Search Scope (focused - same project/client)
1. **Project folder**: `01-Projects/[Client]/[Project]/` - meetings, documents
2. **Emails**: Filter by client tag (#email-drpa, #email-vdot, etc.)
3. **Recent only**: Notes from last 30 days

### Match Criteria
- Keywords from task title/description appearing in note title or content
- Notes in same project folder with related subject matter
- Source email/meeting if task was created from one

### Tagging Process
1. Add `task: "[TaskNote-filename-without-extension]"` to YAML frontmatter
2. If note already has `task` property with different value, skip (don't overwrite)
3. Maximum 10 notes tagged per task creation

---

## Output Confirmation

After creating TaskNote, provide summary:

```
Task Created Successfully

Task: Review Host ICD comments
Due: 2025-09-15
Priority: Medium
Project: DRPA Oversight
Status: Open
File: TaskNotes/Review-Host-ICD-comments.md

Related Items:
- [[Review-Host-ICD-Preliminary-Draft]]
- Email: FW_ EXTERNAL - Host ICD Review

Related Notes Tagged: 3
   - Meeting Note-Chapter-Review_2025-12-01.md
   - Email: Ch 28 Final Draft Comments.md
   - Chapter-Review-Status.md

Next Steps: Task is now tracked in your TaskNotes system and will appear in /tasks dashboard
```

---

## Error Handling

### Ambiguous Project Detection
**Situation**: Task mentions multiple projects equally
**Handling**:
- Return as multi-project (Deep Path)
- Flag as "ambiguous primary"
- Suggest user explicitly state primary project
- Still create with both projects listed

### Missing Due Date
**Situation**: Task has no explicit due date
**Handling**:
- Set `due: null` in metadata
- Flag in output: "No due date provided"
- Suggest user add due date before creating
- Allow creation without due date if user confirms

### No Project Detected
**Situation**: Task has no clear project keywords
**Handling**:
- Default to "Personal" project
- Flag: "No project keywords detected, using Personal"
- Ask user: "Is this correct?"
- Allow change before creation

---

## Batch Task Creation

Support creating multiple related tasks:

**Input**: "Create tasks for cost estimate review: 1) Prepare materials for Jeremy meeting 2) Review BLS wage data 3) Update staffing calculations"

**Output**: Three separate TaskNote files with shared project assignment and cross-references

---

## Vault Integration

- **Save Location**: `TaskNotes/` folder in vault root
- **Respect Vault Architecture**: Follow established patterns
- **Maintain Consistency**: Use same metadata format as existing TaskNotes
- **Enable Discovery**: Proper tagging for search and filtering
- **Support Workflow**: Compatible with /tasks dashboard and other commands

---

## Performance Targets

| Path | Target Time | Output | Token Budget |
|------|-------------|--------|--------------|
| Quick | 15s | Project only | 1.5K |
| Standard | 45s | Project + assignee + priority + related | 3.5K |
| Deep | 90s | All above + dependencies + cross-projects | 6K |
