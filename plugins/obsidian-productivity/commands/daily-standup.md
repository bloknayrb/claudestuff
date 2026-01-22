---
Type: Email

## Daily Standup Command

**Purpose**: Generate actionable morning dashboard from pre-recorded tracking data

---

## Execution Steps

### Phase 0: Check Overnight Automation Status

**IMPORTANT**: Start every morning standup by checking overnight automation status.

**Process**:
1. Read `99-System/Claude-State-Automation.md`
2. Extract `automated_commands` section
3. Check each command's `last_run` and `status`
4. **SMART DETECTION**: If `automated_commands` shows "not_run" BUT tracking timestamps are recent (< 12 hours), infer automation IS working (scripts just don't log status yet)
5. Report overnight execution results

**Output Format (when logged)**:
```
🤖 Overnight Automation Report
─────────────────────────────
Last run: [timestamp]

✅ auto-tag: Success (487 files, 1.4s)
✅ track: Success (15 tasks, 8 deps, 45s)
✅ update-tracking: Success (6 agents, 12 items, 180s)
✅ update-projects: Success (12 projects, 408s)

Status: ✅ 4/4 commands succeeded
```

**If Failures Detected**:
```
⚠️ Overnight Automation Issues
─────────────────────────────
❌ auto-tag: Aborted (exceeded 500 file limit)
✅ track: Success
⚠️ update-tracking: Partial (5/6 agents succeeded)
✅ update-projects: Success

Status: ⚠️ 2/4 commands had issues - review logs
```

**If automated_commands shows "not_run" but timestamps are recent**:
```
✅ Overnight Automation
─────────────────────────────
Task Scheduler: Running successfully
Last /track: [timestamp] ([X] hours ago)
Last /update-tracking: [timestamp] ([Y] hours ago)

Note: Scripts working but not logging status to Claude-State.md yet
Status: ✅ Tracking data is current
```

**If truly not run (stale timestamps > 12 hours)**:
```
⚠️ Overnight Automation
─────────────────────────────
Task Scheduler: May not be running
Last /track: [timestamp] ([X] hours ago - STALE)
Last /update-tracking: [timestamp] ([Y] hours ago - STALE)

Status: ⚠️ Check Task Scheduler configuration
```

---

### Phase 1: Read Direct Tasks & Dependencies
**Source**: `99-System/Claude-State-Tracking.md`

**Extract from `comprehensive_tracking`**:
- `active_tasknotes[]` - Array of ALL active TaskNotes (status != done/cancelled)
- `direct_tasks` - Count of active tasks
- `overdue_direct_tasks` - Count of overdue tasks
- `due_today` - Count due today
- `due_this_week` - Count due within 7 days
- `current_priorities` - Narrative context

**Display Active TaskNotes List**:
```
┌─ 📋 ACTIVE TASKNOTES ────────────────────────────────────────────────────────┐
│                                                                              │
│  🔴 OVERDUE:                                                                 │
│     • [Task name] — [X days overdue] — [Client]/[Project]                   │
│     • [Task name] — [X days overdue] — [Client]/[Project]                   │
│                                                                              │
│  🟡 DUE TODAY:                                                               │
│     • [Task name] — [Client]/[Project]                                      │
│                                                                              │
│  ⚪ DUE THIS WEEK:                                                           │
│     • [Task name] — Due [date] — [Client]/[Project]                         │
│                                                                              │
│  📝 OPEN (no due date):                                                      │
│     • [Task name] — [Client]/[Project] — [status]                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Sort Order**:
1. Overdue (most days first)
2. Due today
3. Due this week (earliest first)
4. Open tasks (by priority: high → normal → low)

---

### Phase 1.3: Display Jeremy's Stated Priorities

**Purpose**: Surface priorities as Jeremy stated them (not just deadline-inferred), distinguishing discussion-driven focus from system-inferred urgency.

**Source**: `99-System/Claude-State-Tracking.md` → `stated_priorities`

**Process**:
1. Read `stated_priorities` object from Claude-State-Tracking.md
2. Calculate staleness: `days_since = today - last_priority_discussion`
3. If `priorities` array is empty → **skip this section entirely**
4. If `days_since > 7` → display staleness warning
5. Otherwise → display priorities with source meeting and context

**Display Format** (when priorities exist and are fresh):
```
┌─ 🎯 JEREMY'S STATED PRIORITIES ──────────────────────────────────────────────┐
│  Source: [source_meeting] | Valid until: [priority_valid_until]              │
│                                                                              │
│  1. [task description] (Due [deadline])                                      │
│     TaskNote: [tasknote filename or "No TaskNote"]                          │
│     Context: [context]                                                       │
│                                                                              │
│  2. [task description] (Due [deadline])                                      │
│     TaskNote: [tasknote filename or "No TaskNote"]                          │
│     Context: [context]                                                       │
│                                                                              │
│  ⏸️ Acknowledged as blocked: [count] items waiting review                    │
│     • [blocked item 1]                                                       │
│     • [blocked item 2]                                                       │
│                                                                              │
│  📝 Notes: [notes field content]                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Display Format** (when priorities are stale - more than 7 days old):
```
┌─ ⚠️ PRIORITY REFRESH NEEDED ─────────────────────────────────────────────────┐
│                                                                              │
│  Last priority discussion: [last_priority_discussion] ([X] days ago)         │
│  Source: [source_meeting]                                                    │
│                                                                              │
│  Previous priorities may be outdated. Consider checking in with Jeremy       │
│  to confirm current focus areas.                                             │
│                                                                              │
│  Last stated priorities:                                                     │
│  1. [task description] (possibly stale)                                      │
│  2. [task description] (possibly stale)                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Display Format** (when no priorities recorded):
```
[Skip section entirely - no output]
```

**Staleness Calculation**:
```
days_since = (current_date - last_priority_discussion).days
is_stale = days_since > 7
```

**Integration with Task List**:
- Stated priorities section appears BEFORE the Active TaskNotes list
- This ensures Jeremy's direction is seen first, deadline-driven list second
- Items in both lists are not duplicated - stated priorities show source/context

---

### Phase 1.5: Check for New DRPA Documents (SharePoint)
**Source**: `99-System/Claude-State-Tracking.md` → `sharepoint_documents.drpa_submittals`

**Process**:
1. Read `sharepoint_documents.drpa_submittals` from tracking state
2. Check `new_since_last_scan` array
3. Check `generated_tasknotes` array for pending notification tasks
4. If both arrays empty → **skip this section entirely** (no noise when nothing new)
5. If documents found → display notification grouped by category + pending TaskNotes

**Display Format** (only when new documents or pending tasks exist):
```
┌─ 📁 NEW DRPA DOCUMENTS (since [last_scan_timestamp]) ─────────────────────────┐
│                                                                                │
│  📄 [Category folder name] ([X] new)                                          │
│     • [Filename] — [Modified date/time]                                       │
│     • [Filename] — [Modified date/time]                                       │
│                                                                                │
│  📄 [Another category] ([Y] new)                                              │
│     • [Filename] — [Modified date/time]                                       │
│                                                                                │
│  📋 NOTIFICATION TASKS:                                                        │
│     • Notify-DRPA-Team-SDDD-Chapters-2026-01-16.md (3 docs) — 📤 pending      │
│     • Notify-DRPA-Team-RDRRs-2026-01-16.md (2 docs) — 📤 pending              │
│                                                                                │
│  Total: [N] new documents → [M] notification tasks created                     │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Notification Task Status Icons**:
- `📤 pending` - TaskNote created, notification not yet sent
- `✅ sent` - Notification email sent (status updated manually after sending)

**If Only Pending Tasks** (no new documents this scan but pending notifications exist):
```
┌─ 📋 PENDING DRPA NOTIFICATIONS ─────────────────────────────────────────────────┐
│                                                                                  │
│  📤 Notify-DRPA-Team-SDDD-Chapters-2026-01-15.md (3 docs) — created yesterday   │
│  📤 Notify-DRPA-Team-RDRRs-2026-01-15.md (2 docs) — created yesterday           │
│                                                                                  │
│  Action: Review and send notification emails, then mark tasks complete           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Category Mapping** (parent folder → display name):
- `01. Monthly Progress Report` → Monthly Progress Reports
- `02. Schedule` → Schedule Updates
- `03. Meeting Minutes` → Meeting Minutes
- `04. SRS` → System Requirements (SRS)
- `05. SDDD` → System Design (SDDD)
- `06. Reports Design Documents` → RDRRs
- `09. Test Plans` → Test Plans
- Other folders → Use folder name as-is

**Sorting**:
- Categories: alphabetical by folder number prefix
- Files within category: most recent first
- Pending TaskNotes: oldest first (priority to send older notifications)

---

### Phase 2: Read Background Awareness
- CRITICAL: Major milestone, blocking issue, urgent decision
- HIGH: Significant progress, status change, new deliverable
- MEDIUM: Routine update, background progress
### Phase 3: Dashboard Synthesis
**Output Format**: See `99-System/shared/output-templates.md` (DASHBOARD_TEMPLATE)
│ • [Project]: [Task] — Due: [date]                                                │
│ [Icon] [Item]: [Status Update]                                                    │
│   Last Update: [Date] | Owner: [Person/Team]                                      │
│ [Owner/Vendor]: │
│ • [Action/Deliverable] — Due: [date]                                             │
│   Impact: [How it affects Bryan's work]                                           │
│ DRPA Oversight: [X tasks, status from current_priorities]                  │
│ VDOT Operations: [Status from current_priorities]                           │
│ NJ EZPass ICD 1.6: [Status from current_priorities]                           │
│ DelDOT: [Status if applicable]                                      │
│ MDTA ETC 4G: [Status if applicable]                                      │
│ Personal: [Status if applicable]                                      │
│ 1. [Highest priority: critically_overdue or due_today]                            │
│ Background Tracking Updates (from update log): │
│ • [Date]: [Another highlight]                                                     │
│ Recent Activity Summary: │
│ • Items Updated: [X]  | Items Completed: [Y]  | New Items Added: [Z]             │
Last /track scan: [timestamp from Claude-State-Tracking.md]
Last /update-tracking scan: [timestamp from Background-Tracking.md]
---
## Command Coordination

See `99-System/Command-Details.md` for full coordination logic.

**Upstream Commands** (data providers):
- **`/track`**: Scans vault, writes Claude-State-Tracking.md with comprehensive tracking
- **`/update-tracking`**: Scans vault, writes Background-Tracking.md with background awareness
- **`/update-projects`**: Scans vault, writes Claude-State-Projects.md with health scores

**This Command** (presentation only):
- **Read ONLY** from modularized state files and Background-Tracking.md
- **No vault scanning** - trust upstream commands for accurate state
- **Present** pre-recorded data in actionable morning dashboard format

**Data Flow**:
```
/track → Claude-State-Tracking.md ──────┐
/update-projects → Claude-State-Projects.md ──┼──→ /daily-standup → ASCII Dashboard
/update-tracking → Background-Tracking.md ────┘
Automation status from Claude-State-Automation.md
```

---

## Error Handling

See `99-System/shared/error-handling-protocols.md` for standard responses.

**Missing Tracking File**: If Claude-State-Tracking.md doesn't exist → display error directing user to run `/track`

**Missing Automation File**: If Claude-State-Automation.md doesn't exist → skip Phase 0, continue with tracking

**Missing Projects File**: If Claude-State-Projects.md doesn't exist → skip health scores, continue with tasks

**Stale State**: If `last_scan_timestamp` > 7 days old → display warning that state may be outdated

**Missing Background File**: If Background-Tracking.md doesn't exist → skip background updates section, continue with tasks

---

## Key Behaviors

1. **Pure Presentation Layer** - NO scanning of vault sources (emails, meetings, TaskNotes)
2. **Dependency on Upstream** - Requires `/track` and `/update-tracking` to be run regularly
3. **Stale Data = Stale Dashboard** - By design; users should run upstream commands before daily standup for current view
4. **Single Source of Truth** - Trust state files completely, present data exactly as recorded

Generate actionable morning dashboard to help prioritize the day's work effectively using pre-recorded tracking data.

---

## Canvas Display (Optional)

After generating the CLI dashboard, launch the live standup canvas display:

**Process**:
1. Run in background: `powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Tools\Start-StandupCanvas.ps1"`
2. This spawns a live-updating canvas window if not already running
3. The canvas shows the same data in a persistent dashboard format

**Note**: The canvas auto-updates when state files change (e.g., after running `/track`), so it stays current throughout the day.
