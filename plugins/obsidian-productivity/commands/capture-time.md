---
Type: Command
created: 2026-01-21
updated: 2026-01-21
version: 1.0
---

# Capture Time Command

Manually trigger time capture for any date. Analyzes vault activity and generates/updates the Time Log section in the corresponding daily note.

**Usage**: `/capture-time` or `/capture-time 2026-01-20`

---

## Argument Parsing

**If argument provided**: Use as target date (format: YYYY-MM-DD)
**If no argument**: Use today's date

```
$ARGUMENTS → Target Date
empty → Today's date
```

---

## Date Determination

1. Parse the target date
2. Get day of week and formatted strings
3. Locate the daily note:
   - Primary: `02-Daily Notes/DN_YYYY-MM-DD.md`
   - Fallback: `02-Daily Notes/YYYY-MM-DD.md`

**If daily note doesn't exist**: Create minimal daily note with Time Log placeholder

---

## Data Collection Phase

### 1. Meeting Transcripts

**Location**: `06-Career/Transcripts/`
**Pattern**: Files with target date in filename

**Extract**:
- Meeting title from filename
- Actual duration from first → last timestamp in transcript
- Client/project from folder path or content

**Example**: `Transcript-VDOT-CSC-Call_2026-01-21_09-30.md`
- Parse timestamps to get actual meeting duration
- DO NOT use calendar duration (often padded)

### 2. Meeting Notes

**Location**: `01-Projects/*/Meetings/`
**Pattern**: Files created or modified on target date

**Extract**:
- Meeting topic
- Documentation time = file modified - file created
- Project from folder path

**Use PowerShell**:
```powershell
Get-ChildItem '01-Projects/*/Meetings/*.md' -Recurse |
Where-Object { $_.LastWriteTime.Date -eq [datetime]'YYYY-MM-DD' }
```

### 3. TaskNotes

**Location**: `TaskNotes/*.md`
**Filter**: Tasks with `updated` or `completedDate` matching target date

**Extract**:
- Task title and project
- Work performed (from completion notes or checklist items)
- Estimated effort if available

**IMPORTANT - Batch Closure Detection**:
- If multiple tasks completed within 5 minutes → administrative batch closure
- Allocate 0.25-0.5h total for batch, NOT per-task time

### 4. Documents Created/Modified

**Location**: `01-Projects/*/Documents/`
**Pattern**: Files created or modified on target date

**Extract**:
- Document name
- Project from folder path
- Creation vs modification (new work vs revisions)

**Use PowerShell**:
```powershell
Get-ChildItem '01-Projects/*/Documents/*' -Recurse -File |
Where-Object { $_.LastWriteTime.Date -eq [datetime]'YYYY-MM-DD' }
```

### 5. Daily Note Existing Content

**Check target daily note for**:
- Calendar events (ICS imported section)
- ScratchPad notes about work
- Any manual time entries

---

## Project Mapping

| Code | Projects |
|------|----------|
| DRPA | DRPA Oversight, IAG Migration, NJ EZPass ICD 1.6 |
| VDOT | CSC Operations Support, CSC RFP, NIOP Interoperability |
| MDTA | MDTA ETC 4G |
| DelDOT | Toll System Integration, US 301 Analysis |
| Admin | Timesheet, email, administrative tasks |

**Mapping Priority**:
1. Explicit project tag in file (#email-drpa, etc.)
2. Folder path (01-Projects/VDOT/ → VDOT)
3. Content keywords (DRPA, VDOT, etc.)
4. Default to Admin if unclear

---

## Time Calculation Rules

### DO Count:
- Meeting time from transcript timestamps (actual duration)
- Post-meeting documentation time (created → modified delta)
- Task work with deliverables or work logs
- Document creation/editing time (estimate based on complexity)

### DO NOT Count:
- Calendar event duration (unreliable, often padded)
- Batch-closed tasks without deliverables
- Email sync/import time (administrative overhead)

### Estimation Guidelines:
- Short email/document: 0.25h
- Medium document: 0.5h
- Complex document: 1.0h+
- Meeting prep: 0.25-0.5h
- Post-meeting notes: 0.5-1.0h (or use timestamps if available)

### Rounding:
- Round all durations to nearest 0.25h
- Minimum time entry: 0.25h

---

## Time Log Output Format

Generate this exact structure for the daily note:

```markdown
# Time Log

*Auto-generated: YYYY-MM-DD HH:MM ET*

| Project | Activity | Duration | Evidence |
|---------|----------|----------|----------|
| VDOT | CSC Cost Estimate Meeting | 1.5h | Transcript 09:30-11:00 |
| VDOT | Post-meeting documentation | 0.75h | File modified 09:28→10:45 |
| DRPA | Progress report update | 1.0h | Excel file modified |
| Admin | Email triage | 0.5h | Estimate |

**Daily Total: X.X hours**

### Project Summary
- VDOT: X.Xh
- DRPA: X.Xh
- Admin: X.Xh
```

---

## Daily Note Update

**If Time Log section exists**: Replace it with new content
**If no Time Log section**: Append at end of file

**Section detection regex**: `^# Time Log.*?(?=^# |\z)`

---

## Gap Handling

If significant gaps exist between documented work:

```markdown
### Gaps
- Morning (08:00-09:30): 1.5h undocumented
- Afternoon (14:00-17:00): 3.0h undocumented
```

**DO NOT**: Fabricate time entries to fill gaps
**DO**: Flag gaps clearly for manual review

---

## Output to User

After updating daily note:

```
✅ Time captured for [Day], [Date]

📊 Summary:
- Total hours: X.X
- Projects: VDOT (X.Xh), DRPA (X.Xh), Admin (X.Xh)
- Evidence sources: X meetings, X documents, X tasks

📝 Updated: 02-Daily Notes/DN_YYYY-MM-DD.md

⚠️ Gaps flagged: X.X hours undocumented (review manually)
```

---

## Error Handling

**No daily note found**: Create minimal note with Time Log section
**No activity found**: Report "No tracked activity for [date]"
**File read errors**: Log warning, continue with available data
**Weekend date**: Process anyway (user may work weekends)

---

## Context Integration

- Uses same evidence hierarchy as `/timesheet` command
- Writes to same daily note format as Obsidian Daily Notes plugin
- Project codes match `Active-Projects.md` structure
- Time Log section readable by Dataview for weekly aggregation
