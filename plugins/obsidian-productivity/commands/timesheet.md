---
Type: Command
created: 2025-10-15
updated: 2026-01-21
version: 3.0
---

# Timesheet Command

Generate weekly timesheet by aggregating Time Log sections from daily notes.

**Architecture Change (v3.0)**: This command now reads pre-populated Time Log sections from daily notes instead of scanning all vault activity. Daily time capture happens automatically at 11:45 PM or manually via `/capture-time`.

---

## Date Range Determination

**CRITICAL**: This command generates timesheets for the CURRENT work week (Monday through today).

**Execution Steps**:

1. **Calculate Current Work Week**:
   - Today's date: [Get from system/environment]
   - Day of week: [Calculate using proper date math]
   - Work week start: Monday of the current week
   - Work week end: Today (or Friday if complete week)
   - Time zone: Eastern Time (user preference)

2. **Date Validation**:
   - Verify day-of-week calculations are accurate
   - Each date must have correct day-of-week label

3. **Example Calculations**:
   - If today is **Friday, Jan 24, 2026**: Range is Mon Jan 20 - Fri Jan 24
   - If today is **Wednesday, Jan 22, 2026**: Range is Mon Jan 20 - Wed Jan 22
   - If today is **Monday, Jan 20, 2026**: Range is Mon Jan 20 only

---

## User Confirmation (REQUIRED)

**BEFORE processing**, present date range and get user confirmation:

```
═══════════════════════════════════════════════════════
TIMESHEET GENERATION
═══════════════════════════════════════════════════════

Work Week: Monday, [Month Day] - [Day], [Month Day], [Year]

Days to include:
  • MONDAY, [MM/DD/YYYY]
  • TUESDAY, [MM/DD/YYYY]
  [... list each day through today ...]

Total work days: [N]
Week status: [Complete work week / Partial week (through [Day])]
Time zone: Eastern Time

═══════════════════════════════════════════════════════
Is this the correct date range for your timesheet?
```

---

## Phase 1: Collect Daily Time Logs

For each work day in the range:

### 1.1 Locate Daily Note

**Check paths** (in order):
1. `02-Daily Notes/DN_YYYY-MM-DD.md`
2. `02-Daily Notes/YYYY-MM-DD.md`

### 1.2 Extract Time Log Section

**Parse the `# Time Log` section**:

```markdown
# Time Log

*Auto-generated: 2026-01-21 23:45 ET*

| Project | Activity | Duration | Evidence |
|---------|----------|----------|----------|
| VDOT | CSC Cost Estimate Meeting | 1.5h | Transcript 09:30-11:00 |
| DRPA | Progress report update | 1.0h | Excel file modified |

**Daily Total: 2.5 hours**
```

**Extract into structured data**:
```
{
  date: "2026-01-21",
  entries: [
    { project: "VDOT", activity: "CSC Cost Estimate Meeting", duration: 1.5, evidence: "Transcript 09:30-11:00" },
    { project: "DRPA", activity: "Progress report update", duration: 1.0, evidence: "Excel file modified" }
  ],
  daily_total: 2.5
}
```

### 1.3 Handle Missing Time Logs

**If daily note exists but no Time Log section**:
- Flag day as "⚠️ Not captured"
- Offer to run `/capture-time YYYY-MM-DD` for that day

**If daily note doesn't exist**:
- Flag day as "📭 No daily note"
- Note as gap in timesheet

**If today and Time Log empty**:
- Automatically run time capture logic for current day
- Include results in weekly aggregation

---

## Phase 2: Aggregate by Project

Sum hours across all days by project code:

```
VDOT: Mon 2.5h + Tue 3.0h + Wed 1.5h = 7.0h
DRPA: Mon 1.0h + Wed 2.0h = 3.0h
Admin: Tue 0.5h + Wed 0.25h = 0.75h
```

**Project Codes**:
| Code | Full Name |
|------|-----------|
| DRPA | Delaware River Port Authority |
| VDOT | Virginia DOT |
| MDTA | Maryland Transportation Authority |
| DelDOT | Delaware DOT |
| Admin | Administrative / Internal |

---

## Phase 3: Generate Timesheet Output

```
═══════════════════════════════════════════════════════════
WEEKLY TIMESHEET - [Date Range]
Generated: [Today's Date]
═══════════════════════════════════════════════════════════

MONDAY [MM/DD]
├─ [Time] │ [Activity]                    │ [Hours] │ [Evidence]
├─ 09:00  │ VDOT CSC Meeting              │ 1.5h    │ Transcript
├─ 11:00  │ DRPA Progress Report          │ 1.0h    │ File modified
└─ DAILY TOTAL: 2.5 hours

TUESDAY [MM/DD]
├─ 08:30  │ VDOT Documentation            │ 3.0h    │ Files created
├─ 14:00  │ Admin Email Triage            │ 0.5h    │ Estimate
└─ DAILY TOTAL: 3.5 hours

[Continue for each day...]

⚠️ DAYS REQUIRING ATTENTION
├─ Wednesday: Time Log not captured (run /capture-time 2026-01-22)
└─ [List any other issues]

PROJECT SUMMARY [Week Total: XX.X hours]
┌────────────────────────┬──────────┬─────────────┐
│ Project                │   Hours  │ % of Week   │
├────────────────────────┼──────────┼─────────────┤
│ VDOT                   │    12.0  │ 48%         │
│ DRPA                   │     8.5  │ 34%         │
│ MDTA                   │     2.0  │ 8%          │
│ DelDOT                 │     1.5  │ 6%          │
│ Administrative         │     1.0  │ 4%          │
├────────────────────────┼──────────┼─────────────┤
│ TOTAL                  │    25.0  │ 100%        │
└────────────────────────┴──────────┴─────────────┘

Evidence Sources:
- Meeting transcripts: [N]
- Document timestamps: [N]
- Task completions: [N]
- Estimates: [N]
```

---

## Fallback: Same-Day Capture

**If running on a day where Time Log is empty**, use these data sources:

### Meeting Transcripts
- **Location**: `06-Career/Transcripts/`
- **Pattern**: Files with today's date
- **Extract**: Meeting duration from timestamps

### Meeting Notes
- **Location**: `01-Projects/*/Meetings/`
- **Pattern**: Files created/modified today
- **Extract**: Documentation time from file timestamps

### TaskNotes
- **Location**: `TaskNotes/*.md`
- **Filter**: `updated` or `completedDate` = today
- **Extract**: Task work with deliverables

### Documents
- **Location**: `01-Projects/*/Documents/`
- **Pattern**: Files created/modified today
- **Extract**: Document creation/editing time

---

## Evidence Quality Hierarchy

When evaluating time entries (for same-day capture or validation):

| Rank | Evidence Type | Confidence |
|------|--------------|------------|
| 1 | **Transcript duration** | Highest - actual meeting length |
| 2 | **File timestamps** | High - created→modified delta |
| 3 | **TaskNotes with work logs** | Medium-High |
| 4 | **Deliverables created** | Medium-High |
| 5 | **Calendar event** | Low - often padded |
| 6 | **Estimate** | Lowest - flag clearly |

---

## Gap Handling

**Undocumented time**:
- Flag gaps clearly: "⚠️ GAP - [X]h undocumented"
- Ask user: "What did you work on [Day]?" rather than estimating
- Mark estimated hours with asterisk (*) and note "user input needed"

**DO NOT fabricate time entries to fill gaps**

---

## Key Behaviors

1. **Daily-First Architecture**: Primary source is Time Log sections from daily notes
2. **Automatic Today Capture**: If today's Time Log is empty, capture before aggregating
3. **Evidence Preservation**: Carry through evidence column from daily captures
4. **Gap Transparency**: Flag missing days rather than hiding them
5. **Project Aggregation**: Sum hours by project code across the week

---

## Context Integration

- Reference CLAUDE.md project structure for project classifications
- Daily notes use Obsidian Daily Notes plugin format
- Time Log section standardized across all daily notes
- Eastern Time zone (user preference)
