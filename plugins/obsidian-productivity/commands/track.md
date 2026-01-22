---
Type: Email
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
2. Read all TaskNotes with `status` NOT equal to `done` or `cancelled`
3. Extract YAML frontmatter from active TaskNotes
4. Check for status changes or external updates since last scan
5. Identify new action items added to existing TaskNotes

**Purpose**: Detect external changes to TaskNotes (manual edits, status updates), sync understanding.

**Approach**: Full scan of active TaskNotes is fast and reliable. Completed tasks are stable and don't need re-scanning.

**Note**: TaskNote *creation* for new items happens in Steps 2-5 (discovery). This step only detects changes to *existing* TaskNotes.

---

### Step 2: Scan Meeting Notes (Actions & Dependencies)

**Paths**:
- `01-Projects/*/Meetings/Transcripts/2025/*.md`
- `06-Career/Transcripts/Completed Notes/*.md`

**Process**:
1. Use Glob to find meeting notes matching current month pattern (e.g., `*2025-11-*.md`)
2. Read meeting notes from current and previous month (2-month window)
3. Find "ACTION ITEMS" section (case-insensitive)
4. Parse action items using classification logic (see shared/meeting-action-parser.md)
5. Track which meetings have been processed in Claude-State to avoid re-scanning

**Approach**: Focus on recent 2-month window for meeting discovery. Meeting notes are rarely modified after creation, so this is efficient and reliable.

**Classification** (see `99-System/shared/meeting-action-parser.md`):
- **Direct Tasks**: `**{Your Name}**: [action]` → Create TaskNote
- **Managed Dependencies**: `**Other Person**: [action] - Bryan needs output` → Track in Claude-State
- **Background Awareness**: External parties, no Bryan impact → Skip (handled by /update-tracking)

**TaskNote Creation**:
- Title: `[Project]: [Action description]`
- Source reference: Link to meeting note
- Due date: Extract from action item ("by [date]", "due [date]")
- Project: Infer from meeting title/location

---

### Step 3: Scan Teams Chats (Actions & Commitments)

**Paths** (scan both):
- `TeamsChats/messages/*.md` — V2 per-message files (primary)
- `TeamsChats/TeamsChat_*.md` — Legacy V1 conversation files

**V2 File Format** (per-message):
```yaml
---
Type: TeamsChat
conversationId: "19:..."
messageId: "1766072064363"
sender: "{Your Name}"
timestamp: 2025-12-18T15:34:24.363Z
conversation: "{Manager Name}"
teamsLink: "https://teams.microsoft.com/l/message/..."
tags:
  - teams
---

Message content here
```

**Incremental Scanning (V2)**:
1. Use Glob: `TeamsChats/messages/*.md`
2. For each file, read YAML frontmatter `timestamp` field
3. Compare `timestamp` vs `last_scan_timestamp`
   - If `timestamp` > `last_scan_timestamp` → process this file
   - If not → skip (already scanned)

**Incremental Scanning (V1 Legacy)**:
1. Use Glob: `TeamsChats/TeamsChat_*.md`
2. Compare file's `updated` field vs `last_scan_timestamp`
3. Within scanned files, parse inline message timestamps

**First Run Behavior**: If no `last_scan_timestamp` exists, scan messages from last 30 days.

**Message Parsing by Format**:

*V2 Files* (messages/ folder):
- Sender: YAML `sender` field
- Timestamp: YAML `timestamp` field
- Conversation: YAML `conversation` field
- Content: Everything after YAML closing `---`

*V1 Legacy Files* (TeamsChat_*.md):
- Format: `##### [[Name]] | [YYYY-MM-DD HH:MM](url)` or `##### [[Name]] | YYYY-MM-DD HH:MM`
- Regex: `##### \[?\[?([^\]|]+)\]?\]? \| \[?(\d{4}-\d{2}-\d{2} \d{2}:\d{2})`
- Group 1: Speaker name, Group 2: Timestamp
- Fallback: If timestamp unparseable, use file's YAML `updated` date

**Chat Type Detection**:
- 1:1 chat: `conversationID` contains `@unq.gbl.spaces`
- Group chat: `conversationID` contains `@thread.v2`

**Task Detection Patterns**:

**A. Requests TO Bryan** (from others):
- High confidence: `Bryan[,:]?\s*(can you|please|could you|ASAP|need you to)`
- High confidence: `@Bryan\s+`
- Medium confidence (1:1 chats only): Questions ending in `?` directed at Bryan
- Contextual: In 1:1 chat, requests without explicit name → assume directed at Bryan

**B. Bryan's Commitments** (from Bryan):
- High confidence: `^(I will|I'll|I can|I'm going to)\s+`
- High confidence: `(will do|can do|on it|i'll get|i'll send)`
- High confidence with deadline: `by (EOD|Friday|tomorrow|\d+\/\d+)`
- Medium confidence: `(let me|i should|i need to|i'll try|i'll look)`

**Exclusion Patterns** (skip even if matches commitment language):
- Past tense: `(i thought|i didn't|i wasn't|sorry|my bad)`
- Questions about past: `(what did|where did|how did|when did)`

**Classification Decision Tree**:
```
Is message from Bryan?
├─ YES → Contains commitment language?
│        ├─ High confidence → Create TaskNote (Direct Task)
│        ├─ Medium confidence → Create TaskNote with #needs-review tag
│        └─ NO → Skip
└─ NO → Is 1:1 chat OR has explicit "Bryan" mention?
        ├─ YES → Contains request/question language?
        │        ├─ YES → Create TaskNote (Request to Bryan)
        │        └─ NO → Skip
        └─ NO (Group chat, no Bryan mention) → Skip
```

**Project Detection** (priority order):
1. YAML `tags` array: `[VDOT, RFP]` → Client: VDOT
2. YAML `conversation` field: "DRPA RDRR Review" → Client: DRPA
3. YAML `sender` field: Use for context when conversation field is "UnknownChat"
4. Filename pattern (V1 legacy): `TeamsChat_VDOT_CSC_OPS_RFP.md` → Client: VDOT
5. Content keywords (see `99-System/shared/project-keywords.md`)
6. Fallback: `client: "General"`, add `#needs-project-assignment` tag

> **V3 Note (Jan 2026):** V3 filenames use conversationId format (e.g., `19_aed84597...@unq.gbl.spaces-2026-01-05T14_20_44.336Z.md`) which is not human-readable. Rely on YAML `conversation` and `sender` fields for project detection.

**TaskNote Creation for Teams Items**:
- Follow existing template in Step 4 (TaskNote Auto-Creation)
- Add to frontmatter: `source_type: teams`
- Add to frontmatter (V3): `source_message: "[[19_aed84597...@unq.gbl.spaces-2026-01-05T14_20_44.336Z]]"` (link to specific message file)
- Add to frontmatter (V1 legacy): `source_chat: "[[TeamsChat_DisplayName]]"`
- In "Source Context" section: Include original message text
- In "Source Context" section (V1 only): Include 2-3 surrounding messages for context
- Requestor field: Person who made request (for requests TO Bryan)

**Duplicate Prevention**:
- Before creating TaskNote, search `TaskNotes/*.md` for similar action descriptions
- If >80% keyword overlap with existing open task → skip creation, log as duplicate
- Check same project/client scope first for efficiency

---

### Step 4: Scan Email Communications (Commitments)

**Path**: `Emails/*.md`

**Process**:
1. Use Glob pattern for current month: `Emails/*2026-01*.md`
2. Read emails from current and previous month (2-month window)
3. Check frontmatter for `from: {Your Name}` (outgoing emails)
4. Scan for commitment language patterns (similar to Teams)
5. Extract commitments with recipient and context

**Focus**: Only Bryan's outgoing commitments.

**Approach**: 2-month window captures recent commitments. Older emails are stable and rarely need re-scanning.

**Classification**:
- Direct commitments → Create TaskNote
- Follow-up dependencies → Managed Dependency if impacts Bryan's work

---

### Step 4.1: Scan Incoming Emails for Action-Required Items

**Purpose**: Capture deliverables and review requests in incoming emails that require Bryan's action.

**Path**: `Emails/*.md`

**Reference**: See `99-System/shared/incoming-email-action-parser.md` for full detection patterns.

**Process**:
1. Use Glob pattern for current month: `Emails/*2026-01*.md`
2. Read emails from current and previous month (2-month window)
3. Filter for INCOMING emails where Bryan is addressee:
   - `from:` does NOT contain "{Your Name}" or "{your.email@company.com}"
   - `to:` OR `cc:` contains "{your.email@company.com}"
4. Apply action-required detection patterns (see incoming-email-action-parser.md)
5. Cross-reference detected items with existing TaskNotes
6. Create/update TaskNotes for confirmed action items

**Detection Patterns** (High Confidence):

| Pattern | Example | Action |
|---------|---------|--------|
| Subject: "RDRR" + attachments | "DRPA Weekly Discussion: January RDRRs" | Link to `*RDRR*.md` TaskNote |
| Subject: "Submittal" + attachments | "SDDD Chapter 5 Submittal" | Link to review TaskNote |
| Subject: "for Review" / "Draft" | "Updated Cost Estimate for Review" | Flag for TaskNote creation |
| Body: "Bryan, please [action]" | "Bryan, please review by Friday" | Create Direct Task |
| Attachment name matches RDRR # | "1134 Finance Transaction RDRR.docx" | Link to RDRR TaskNote |

**Cross-Reference Logic**:
1. Extract `Project:` tag from email frontmatter
2. Search `TaskNotes/*.md` for matching client/project + keywords
3. If match found with score >= 5: Link email to existing TaskNote
4. If no match: Create new TaskNote OR flag with `#needs-classification`

**TaskNote Update** (when linking to existing):
- Add email reference to TaskNote's "Related Items" section
- Update TaskNote `updated:` timestamp
- Add note: "New deliverable received: [attachment names]"

**TaskNote Creation** (for new action items):
- Follow template in Step 4 (TaskNote Auto-Creation)
- Add `source_type: incoming_email`
- Set `discovery: incoming-email-action-parser`

**Metrics** (add to source_summary):
```json
"incoming_action_emails_scanned": [count],
"incoming_actions_detected": [count],
"tasknotes_updated_from_incoming": [count],
"tasknotes_created_from_incoming": [count]
```

---

### Step 4.2: Detect Task Completions from Sent Emails

**Purpose**: Detect when sent emails indicate task completion and auto-mark TaskNotes as done.

**Path**: `Emails/*.md`

**Process**:
1. For each OUTGOING email (from: {Your Name}) in last 7 days:
   - Extract: subject, recipients, body content, attachment names
   - Filter: Skip emails already processed in previous scans

2. For each OPEN TaskNote:
   - Calculate completion match score against sent email:

**Completion Detection Scoring**:

| Pattern | Points | Description |
|---------|--------|-------------|
| Subject contains TaskNote keywords | +3 | Direct subject correlation |
| Recipient matches TaskNote assignedBy/contact | +2 | Task fulfilled to requestor |
| Body contains delivery language | +2 | "attached", "completed", "here is", "updated" |
| TaskNote has matching project/client | +2 | Same project context |
| Email attachment matches TaskNote deliverable | +3 | Deliverable actually sent |
| Email date >= TaskNote due date | +1 | Deadline met or passed |

**Delivery Language Patterns** (High Confidence):
- "attached is the [keyword]"
- "here is the updated [keyword]"
- "please find [keyword] attached"
- "I've updated [keyword]"
- "completed [keyword]"
- "finished [keyword]"

3. **Score Thresholds**:
   - **Score >= 6**: Auto-mark TaskNote as `status: done`
     - Add `completedDate: [email sent date]`
     - Add completion note: `Completed via [[Email-filename]] (auto-detected)`
     - Log to source_summary: `tasks_auto_completed`
   - **Score 4-5**: Flag for review
     - Add `#completion-candidate` tag to TaskNote
     - Don't auto-complete (medium confidence)
   - **Score < 4**: Skip (no match)

**Example Match - DRPA Progress Report**:

```
Sent Email:
- Subject: "DRPA Progress Report"
- To: David Raines
- Body: "David, I updated my section of the progress report..."

Open TaskNote: Update-DRPA-Progress-Report-Invoice-24.md
- task: "Update DRPA Progress Report for Invoice 24"
- Assigned by: David Raines
- project: DRPA Oversight

Match Score:
- Subject contains "Progress Report": +3
- Recipient is David Raines (assignedBy): +2
- Body has "updated": +2
- Project match (DRPA): +2
- Total: 9 → AUTO-COMPLETE ✓
```

**Auto-Completion Actions**:
1. Update TaskNote frontmatter:
   ```yaml
   status: done
   completedDate: [email date YYYY-MM-DD]
   ```
2. Mark all checklist items as complete
3. Add completion note to Notes section:
   ```markdown
   **[date]**: Completed via [[Email-filename]] (auto-detected)
   ```
4. Update Claude-State-Tracking.md:
   - Move from `active_tasknotes` to `recently_completed`
   - Decrement `direct_tasks` and `overdue_direct_tasks` counts
   - Increment `completed_tasks`

**Skip Conditions**:
- TaskNote status already `done` or `cancelled`
- Email already linked to TaskNote (duplicate detection)
- Email is reply/forward chain (check subject prefix "RE:", "FW:")

**Metrics** (add to source_summary):
```json
{
  "sent_emails_scanned": [count],
  "tasks_auto_completed": [count],
  "completion_candidates_flagged": [count]
}
```

---

### Step 4.5: Tag Related Notes for New TaskNotes

When a TaskNote is created during this scan (from meetings, Teams, or emails):

1. **Tag the source note**: Add `task: "[TaskNote-filename]"` to the meeting/email that triggered creation
2. **Find related notes** in same project (last 30 days):
   - Other meeting notes on same topic
   - Emails with related subject line
   - Project documents with matching keywords
3. **Add task property** to discovered notes (max 10 per TaskNote)
4. **Track in source_summary**: Add `notes_tagged: [count]` to output

This ensures newly auto-created TaskNotes are immediately connected to their context.

---

### Step 4.6: Extract Stated Priorities from Recent {Manager} Meetings

**Purpose**: Capture priorities as {Manager} stated them (not just deadline-inferred), enabling discussion-driven priority tracking.

**Process**:
1. Scan meeting notes from last 7 days matching pattern: `*{Manager}*Siviter*.md`
2. Extract explicit priority statements and acknowledged blocked items
3. Update `stated_priorities` structure in Claude-State-Tracking.md
4. Preserve current priorities until new discussion occurs

**Priority Detection Patterns** (High Confidence):
- "top priority" / "focus on" / "before anything else"
- "this is what I need from you this week"
- Numbered lists in action items (implies ranking)
- Deadline proximity mentioned explicitly: "before Monday", "by end of week"
- "most important" / "primary focus"

**Blocked Items Detection**:
- "waiting on [person]" / "pending [person] review"
- "can't proceed until" / "blocked by"
- "acknowledged pending" / "in your queue"

**Output Structure**:
```json
{
  "stated_priorities": {
    "last_priority_discussion": "[ISO timestamp of meeting]",
    "source_meeting": "[Meeting note filename]",
    "priorities": [
      {
        "rank": 1,
        "task": "[Task description]",
        "tasknote": "[TaskNote filename if exists]",
        "deadline": "[ISO date if specified]",
        "context": "[Additional context from discussion]",
        "stated_by": "{Manager Name}"
      }
    ],
    "blocked_items_acknowledged": [
      "[Item description] - [blocker/reason]"
    ],
    "priority_valid_until": "[Date - typically 7 days from discussion or next meeting]",
    "notes": "[Key context: availability, upcoming meetings, constraints]"
  }
}
```

**Cross-Reference Logic**:
1. For each detected priority, search `TaskNotes/*.md` for matching task
2. If match found → populate `tasknote` field with filename
3. If no match → leave `tasknote` as null (priority exists but no TaskNote yet)

**Priority Refresh Rules**:
- If new {Manager} meeting found with priority discussion → REPLACE entire `stated_priorities`
- If no new meeting but `last_priority_discussion` < 7 days → KEEP current priorities
- If `last_priority_discussion` > 7 days → Flag as stale (handled by /daily-standup)

**Staleness Detection**:
- Calculate days since `last_priority_discussion`
- If > 7 days: priorities are considered stale
- /daily-standup will display warning to refresh with {Manager}

---

### Step 4.7: Auto-Update Related TaskNotes

**Purpose**: Keep TaskNote files current by automatically appending context from related emails, meetings, and Teams chats discovered during scanning.

**Problem Solved**: Currently, new context goes to Claude-State-Tracking.md but individual TaskNote files become stale. This step ensures TaskNotes serve as comprehensive, up-to-date records.

**Process**:

1. **Collect Update Candidates**:
   - Gather all sources processed in Steps 2-4.1 (meetings, Teams, emails)
   - For each source: filename, type, client, key content, timestamp

2. **For Each Source**:
   - Calculate relevance score against ALL active TaskNotes
   - Score >= 6: Auto-update TaskNote's `## Notes` section
   - Score 4-5: Add to Related Items only (if not present)
   - Score < 4: Skip (tangential mention)

3. **Deduplication**:
   - Check if source link already exists in TaskNote
   - Skip if duplicate to prevent redundant entries

4. **Bidirectional Linking**:
   - Add `task: "TaskNote-filename"` to source note's frontmatter
   - Creates queryable relationship from both directions

**Relevance Scoring Algorithm**:

```
DEFINITIVE MATCH (score = 10):
- Source has task: property matching TaskNote filename
- Source contains [[TaskNote-filename]] wikilink

SEMANTIC MATCHING:
- Same client: +3 points
- Keyword overlap (task description vs content): +1 per keyword (max +4)
- Deliverable type match (RDRR, Submittal, ICD): +2
- Recent TaskNote activity (<7 days): +2
- Deadline proximity (<3 days): +1
- Attachment matches TaskNote pattern: +2

THRESHOLDS:
- >= 6: Update Notes section
- 4-5: Add to Related Items only
- < 4: Skip (tangential)
```

**Update Entry Format**:

Append to existing `## Notes` section:
```markdown
**[YYYY-MM-DD]**: [Summary] — [[Source-Note-Link]] (auto-detected)
```

**Examples**:
```markdown
**2026-01-14**: January RDRR batch delivered (1134, 1270, 5654) — [[DRPA Weekly Discussion_ January RDRRs]] (auto-detected)
**2026-01-14**: Meeting confirmed ops costing review scheduled Monday — [[Meeting Note-{Manager Name}-2026-01-14_15-06]] (auto-detected)
**2026-01-15**: Bryan committed to send outreach emails by 01/16 — [[19_aed84597@thread.v2-2026-01-15]] (auto-detected)
```

**Content Extraction by Source Type**:

| Source Type | Extract |
|-------------|---------|
| **Meetings** | Action items, status changes, deadline updates, decisions |
| **Emails** | Attachment names (deliverables), requests, deadline mentions |
| **Teams** | Bryan's commitments, requests to Bryan, status updates |

**Auto-Add Checklist Items**:

When a meeting specifies new sub-tasks for an existing TaskNote:

- **Detection**: Action item references existing TaskNote topic, is specific enough to be a sub-task
- **Format**: `- [ ] [New action] — added from [[Meeting-Note]] (auto-detected)`
- **Deduplication**: Skip if >70% keyword overlap with existing checklist item

**Skip Conditions**:
- TaskNote status is `done` or `cancelled`
- Source already in Notes or Related Items (dedup)
- Source older than TaskNote creation date
- TaskNote has `auto-update: false` in frontmatter (opt-out)
- Score < 4 (tangential mention only)

**Metrics** (add to source_summary):
```json
{
  "tasknotes_auto_updated": [count],
  "update_entries_added": [count],
  "related_items_added": [count],
  "duplicate_updates_skipped": [count]
}
```

---

### Step 5: Update Claude State

**Process**:
1. Read current `99-System/Claude-State-Tracking.md`
2. Calculate execution time (start to finish)
3. Update `comprehensive_tracking` section (always):
   ```json
   {
     "comprehensive_tracking": {
       "last_scan_timestamp": "[current_timestamp]",
       "direct_tasks": [count],
       "managed_dependencies": [count],
       "overdue_direct_tasks": [count],
       "due_today": [count],
       "due_this_week": [count],
       "active_tasknotes": [
         {
           "filename": "Review-DRPA-Chapter-28.md",
           "task": "Review DRPA Chapter 28 Cash Management",
           "status": "in-progress",
           "due": "2025-12-05",
           "days_overdue": 0,
           "client": "DRPA",
           "project": "DRPA Oversight",
           "priority": "high",
           "source": "[[MeetingNotes-DRPA-Status_2025-12-01]]"
         }
       ],
       "current_priorities": {
         "critically_overdue": "[narrative]",
         "immediate_focus": "[narrative]",
         "this_week": "[narrative]",
         "monitoring": "[narrative]"
       },
       "dashboard_generated": "[timestamp]",
       "source_summary": {
         "meetings_scanned": [count],
         "teams_chats_scanned": [count],
         "emails_scanned": [count],
         "incoming_action_emails_scanned": [count],
         "incoming_actions_detected": [count],
         "tasknotes_checked": [count],
         "tasknotes_created": [count],
         "tasknotes_updated_from_incoming": [count],
         "dependencies_tracked": [count]
       }
     }
   }
   ```

   **IMPORTANT**: The `active_tasknotes` array MUST contain ALL TaskNotes where status is NOT 'done' or 'cancelled'. This enables /daily-standup to display actual task list.
4. If **Unattended Mode**: Also update `automated_commands.track_status`:
   ```json
   {
     "automated_commands": {
       "track_status": {
         "last_run": "[ISO-8601-timestamp]",
         "status": "success|partial|failure",
         "execution_time_seconds": [decimal],
         "direct_tasks": [count],
         "managed_dependencies": [count],
         "errors": [count]
       }
     }
   }
   ```
5. Write updated state back to file
6. Generate summary output (format depends on mode)

---

## Pattern Matching

### Action Item Patterns
See `99-System/shared/meeting-action-parser.md` for classification decision tree.

**Assignee Detection**:
- `**Name**:` format in action items
- Normalize variants: "Bryan", "{Your Name}", "BK" → all map to Bryan

**Deadline Extraction**:
- "by Friday" → calculate date
- "by EOW" → end of current week
- "by 2025-11-15" → explicit date
- No deadline → null

### Commitment Language
**High Confidence**:
- "I will [action] by [date]"
- "I'll send [deliverable]"
- "I can complete [task]"

**Medium Confidence**:
- "Let me [action]"
- "I should be able to [action]"
- "I'll look into [topic]"

**Skip** (too vague):
- "I think we should..."
- "Maybe we could..."
- "Someone should..."

---

## Project Detection

See `99-System/shared/project-keywords.md` for keyword patterns.

**Inference from Context**:
- Meeting location path (`01-Projects/DRPA/...`)
- Email tags (`#email-drpa`, `#email-vdot`)
- Teams chat title
- Content keywords (DRPA, VDOT, IAG, etc.)

**Ambiguous cases**: Default to "General" or flag for manual project assignment.

---

## TaskNote Auto-Creation

**CRITICAL**: When /track discovers a new action item for Bryan, it MUST create a TaskNote file.

### Step 1: Action Item Detection

**Sources Scanned**:
- Meeting notes: Look for `**{Your Name}**:` or `**Bryan**:` in ACTION ITEMS section
- Emails: Look for commitment language ("I will", "I'll send", "I can complete")
- Teams chats: Look for Bryan's commitments

**Classification**:
- Direct assignment to Bryan → CREATE TASKNOTE
- Someone else's action that Bryan needs output from → Track as Managed Dependency (no TaskNote)
- Background awareness only → Skip (handled by /update-tracking)

### Step 2: Context Extraction

Before creating the TaskNote, extract:

| Field | Source | Example |
|-------|--------|---------|
| Client | Path, tags, content keywords | `DRPA`, `VDOT`, `MDTA`, `DelDOT` |
| Project | Path or explicit mention | `DRPA Oversight`, `CSC RFP` |
| Due Date | "by Friday", "due 12/5", "EOW" | Calculate actual date |
| Priority | "urgent", "critical", "ASAP" = high | `high`, `normal`, `low` |
| Source | Meeting note or email filename | `[[MeetingNotes-DRPA-Status_2025-12-03]]` |
| Related | Other mentioned notes, emails, docs | List of `[[wikilinks]]` |

**Client Detection** (in priority order):
1. Meeting path: `01-Projects/DRPA/...` → Client: DRPA
2. Email tags: `#email-vdot` → Client: VDOT
3. Content keywords: "MDTA", "DelDOT", "IAG" → Match to client
4. Ambiguous → Client: General (flag for manual assignment)

### Step 3: Duplicate Check

Before creating TaskNote:
1. Search `TaskNotes/*.md` for similar action description
2. Compare key phrases (task verbs + objects)
3. If >80% similarity to existing open task → SKIP creation, log as duplicate
4. If similar task exists but is `done` → Consider if this is a new instance

### Step 4: Create TaskNote File

**Filename**: `[Action-Description-Kebab-Case].md`
- Max 50 characters
- Remove articles (a, an, the)
- Example: `Review-DRPA-Chapter-28-Cash-Management.md`

**Full Template**:
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
client: [Client folder name - DRPA, VDOT, MDTA, DelDOT, Personal]
tags:
  - [client-lowercase]
  - [project-keyword]
  - task
  - auto-created
title: [Filename without .md]
contexts: []
projects:
  - "[[Project Folder Note]]"
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

### Step 5: Update State

After creating TaskNote(s):
1. Increment `new_tasknotes_discovered` count in Claude-State-Tracking.md
2. Add to `source_summary.tasknotes_created` list
3. Log TaskNote filename in summary output

---

## Validation & Quality Control

**Duplicate Prevention**:
- Before creating TaskNote, check if similar task already exists
- Search TaskNotes folder for matching keywords from action description
- If match found >80% similarity, skip creation (log as "duplicate prevented")

**Cross-Reference Check**:
- Verify managed dependencies aren't already TaskNotes
- Check if dependency is actually Bryan's direct responsibility (reclassify if so)

**Confidence Thresholds**:
- High confidence (explicit assignment, clear deadline) → Auto-create TaskNote
- Medium confidence (implicit assignment) → Create with flag for review
- Low confidence (ambiguous) → Log for manual review, don't auto-create

---

## Error Handling

See `99-System/shared/error-handling-protocols.md` for standard responses.

**Missing State File**: If Claude-State-Tracking.md doesn't exist, create with default structure.

**Glob Returns No Files**: Normal for months with no activity. Log and continue.

**Parse Errors**: Skip file with error, log issue, continue scanning.

**Write Failures**: Log error, attempt retry once, escalate if fails.

---

## Context Integration

- Reference CLAUDE.md for project structure and active projects
- Use flat email system tags for project identification
- Respect TaskNotes format from https://callumalpass.github.io/tasknotes/
- Meeting note format: `MeetingNotes-[Description]_YYYY-MM-DD_HH-MM.md`
- Eastern Time zone (user preference)

## Key Behaviors

1. **Smart Scanning**: Use 2-month window for meetings/emails, full scan for active TaskNotes
2. **Glob-Based Discovery**: Reliable file pattern matching, no PowerShell timestamp filtering
3. **Prudent Strategy**: When in doubt, read more files (over-scan vs miss commitments)
4. **Auto-Create TaskNotes**: For high-confidence direct tasks only
5. **Track Dependencies**: Store managed dependencies in Claude-State-Tracking.md
6. **Update State**: Always update last_scan_timestamp after successful scan
7. **Duplicate Prevention**: Check for existing tasks before creating new ones
8. **Incoming Email Detection**: Scan incoming emails for action-required deliverables (RDRRs, Submittals, review requests) using patterns in incoming-email-action-parser.md
9. **Sent Email Completion Detection**: Scan Bryan's sent emails to detect task completions - auto-mark TaskNotes as done when email matches task criteria (score >= 6)

## Scanning Efficiency

**Fast Scans** (< 50 files typically):
- Active TaskNotes only (skip completed/cancelled)
- 2-month meeting window (current + previous month)
- 2-month email window for outgoing commitments
- 2-month email window for incoming action-required items
- 7-day sent email window for completion detection
- Full Teams chat scan (small file count)

**Why This Works**:
- TaskNotes status changes are infrequent once created
- Meeting notes are immutable after creation
- Email commitments are recent or already captured
- Incoming action emails filtered by pattern matching (fast)
- Sent emails for completion detection only need 7-day window (task fulfillment is recent)
- Focuses on where new actions actually emerge

Generate concise discovery summary showing items processed and actions taken.

---

### Step 6: Store Snapshot to OpenMemory

**Purpose**: Persist tracking state across Claude Code sessions for cross-session awareness and semantic search.

**Process**:
1. After Claude-State-Tracking.md is updated, store a concise snapshot to OpenMemory
2. Use `mcp__openmemory__openmemory_store` tool
3. Content should be ~500-1000 tokens (concise summary, not full state)

**Storage Format**:
```
/track Snapshot - [TIMESTAMP]

SCAN SUMMARY:
- Direct tasks: [count] ([overdue count] overdue)
- Managed dependencies: [count]
- Completed since last: [count]

PRIORITIES:
- Critical: [top 1-2 items with dates]
- Overdue: [list items with days overdue]
- Due this week: [list items with dates]

KEY FINDINGS:
- [Bullet list of 3-5 most important discoveries or status changes]

HEALTH SCORES:
- [Project]: [Red/Yellow/Green]
- [Repeat for active projects]

Next focus: [Brief statement of immediate priorities]
```

**Tags**: `["tracking-snapshot", "track-command", "[YYYY-MM-DD]"]`

**When to Skip**: If scan found zero changes and no new items, skip OpenMemory storage to avoid redundant entries.

---

### Step 6.5: Store Temporal Facts to SimpleMem

**Purpose**: Store project-specific temporal facts to SimpleMem for queryable project history and timeline reconstruction.

**When to Run**: After Step 6 (OpenMemory snapshot), if SimpleMem MCP is available.

**Tool Check**: Use `mcp__simplemem__get_stats` to verify SimpleMem is available. If unavailable, skip this step silently.

**Process**:
1. For each **new TaskNote created** during this scan:
   - Store: `add_dialogue(speaker="System", content="TaskNote created: [TaskNote title] - [Brief description]. Source: [meeting/email/chat]. Due: [date if present].", timestamp="[current ISO timestamp]")`

2. For each **status change detected** (Step 1):
   - Store: `add_dialogue(speaker="System", content="TaskNote [filename] status changed from [old_status] to [new_status].", timestamp="[current ISO timestamp]")`

3. For **stated priorities from meetings** (discovered in Step 2):
   - Store: `add_dialogue(speaker="[Person who stated priority]", content="[Priority statement or decision from meeting]", timestamp="[meeting date]")`

4. **Finalize**: Call `mcp__simplemem__finalize` to process all buffered dialogues into searchable memory.

**Example Storage**:
```
add_dialogue("System", "TaskNote created: DRPA Chapter Review - Review SDDD chapters 12-15. Source: MeetingNotes-DRPA-Weekly-2026-01-20. Due: 2026-01-27.", "2026-01-20T16:30:00")
add_dialogue("{Manager}", "DRPA cutover date confirmed as April 15, 2026 - no further changes expected.", "2026-01-20")
add_dialogue("System", "TaskNote Review-VDOT-Documentation status changed from open to in-progress.", "2026-01-20T16:35:00")
finalize()
```

**Domain Separation Reminder**:
- SimpleMem: Temporal facts with dates (what happened when)
- OpenMemory: Persistent context (preferences, lessons learned)

**When to Skip**: If SimpleMem MCP is unavailable, skip silently. This step is additive and should not block tracking.

---

### Step 6.7: Index Teams Messages to SimpleMem (Optional)

**Purpose**: Index Teams messages with windowed context for enhanced semantic search across conversations.

**Note**: This complements Step 6.5 (temporal facts). Step 6.5 stores discrete facts about what was discovered. This step indexes raw message content for semantic querying ("What did {Manager} say about reviews?").

**Pre-checks**:
1. Verify file exists: `{TOOLS_PATH}/SimpleMem/teams_indexer.py`
2. Verify directory exists: `TeamsChats/messages/`

**Process**:
1. Run incremental indexing with timeout:
   ```bash
   timeout 60 python {TOOLS_PATH}/SimpleMem/teams_indexer.py
   ```
2. Parse stdout for metrics
3. Log results to source_summary

**Output Metrics** (add to source_summary):
```json
{
  "teams_indexer": {
    "threads_processed": "[count]",
    "messages_indexed": "[count]",
    "skipped_already_indexed": "[count]",
    "execution_time_seconds": "[decimal]"
  }
}
```

**Error Handling**:
- If pre-check fails: Log warning, skip step, continue
- If execution fails: Log error, record failure in metrics, continue
- If timeout (>60 sec): Kill process, log warning, continue
- This step is ADDITIVE - failures never block /track completion

**Skip Conditions**:
- If SimpleMem is unavailable (no Ollama running)
- If teams_indexer.py not found
