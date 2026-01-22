---
name: time-tracking
description: Time capture patterns and multi-source aggregation for timesheet generation
version: 1.0.0
tags: [time-tracking, productivity, timesheet, billing]
---

# Time Tracking

## Overview

Patterns for capturing and aggregating time from multiple sources to generate accurate timesheets with minimal manual entry.

## Time Sources

### 1. Calendar Events

**Primary source for scheduled time.**

**Extraction:**
```
Event: "Project Alpha - Weekly Sync"
Start: 2025-01-22 10:00
End: 2025-01-22 11:00
Duration: 1.0 hours
Project: Project Alpha (from title or category)
```

**Filtering rules:**
- Include: Work meetings, client calls, focused work blocks
- Exclude: Personal events, lunch, commute, all-day events (unless work)
- Map: Calendar categories → Projects

### 2. Meeting Notes

**Validated time with context.**

Meeting notes often capture actual duration vs. scheduled:

```yaml
---
date: 2025-01-22
start: 10:00
end: 11:15  # Actual end (went over)
attendees: [Client A, Manager]
project: Project Alpha
---
```

**Priority:** Meeting notes override calendar when both exist (actual > scheduled).

### 3. TaskNote Time Logged

**Task-specific time tracking.**

TaskNotes may include time logged:

```yaml
---
time_logged:
  - date: 2025-01-22
    hours: 2.5
    description: "Analysis work"
---
```

**Aggregation:** Sum time_logged entries per project.

### 4. Daily Note Entries

**Manual capture via /capture-time.**

Daily notes contain time entries:

```markdown
## Time Log

- 09:00-10:00 | Project Alpha | Email review and responses
- 10:00-11:15 | Project Alpha | Weekly sync (ran over)
- 11:15-12:00 | Project Beta | Document review
- 13:00-15:30 | Project Alpha | Analysis work
- 15:30-16:00 | Admin | Timesheet review
```

**Parsing:** Time range + Project + Description

### 5. Manual Entry (/capture-time)

**End-of-day capture when other sources insufficient.**

Prompt user for:
1. What did you work on today?
2. Which projects?
3. Approximate time per activity?

Write to daily note in standard format.

## Aggregation Algorithm

```
FOR each day in week:

  1. LOAD calendar events
     - Filter to work events
     - Map to projects
     - Calculate durations

  2. LOAD meeting notes for day
     - Override calendar duration if exists
     - Use actual start/end times

  3. LOAD TaskNote time_logged
     - Sum entries by project

  4. LOAD daily note time entries
     - Parse time log section
     - Add to project totals

  5. DEDUPLICATE
     - Meeting notes win over calendar
     - Explicit entries win over inferred
     - Flag conflicts for review

  6. CALCULATE daily totals by project

AGGREGATE to weekly totals by project
```

## Project Mapping

### From Calendar

| Calendar Category | Project |
|-------------------|---------|
| "Client A" | Project Alpha |
| "Client B" | Project Beta |
| "Internal" | Admin |
| "Training" | Professional Development |

### From Meeting Titles

```
"Project Alpha - *" → Project Alpha
"[Client B] *" → Project Beta
"1:1 with *" → Admin (unless project specified)
"Training: *" → Professional Development
```

### From Tags/Properties

If using Obsidian properties:
```yaml
project: Project Alpha
client: Client A
```

## Output Format

### Daily Breakdown

```
**Monday, January 20** - Total: 8.5 hours

Project Alpha (5.0 hours)
  • 09:00-10:00 Email review
  • 10:00-11:15 Weekly sync
  • 13:00-15:30 Analysis work
  • 15:45-16:00 Status update

Project Beta (2.5 hours)
  • 11:15-12:00 Document review
  • 14:00-15:30 Client call

Admin (1.0 hours)
  • 16:00-17:00 Timesheet and planning
```

### Weekly Summary

```
HOURS BY PROJECT:
┌─────────────────────────┬──────────┐
│ Project                 │ Hours    │
├─────────────────────────┼──────────┤
│ Project Alpha           │ 24.5     │
│ Project Beta            │ 12.0     │
│ Admin                   │ 3.5      │
├─────────────────────────┼──────────┤
│ TOTAL                   │ 40.0     │
└─────────────────────────┴──────────┘

HOURS BY DAY:
Mon: 8.5 | Tue: 8.0 | Wed: 7.5 | Thu: 8.0 | Fri: 8.0
```

## Confidence Scoring

Rate data quality:

| Confidence | Criteria |
|------------|----------|
| **High (90%+)** | Meeting notes with times, manual entries |
| **Medium (70%)** | Calendar events, TaskNote logging |
| **Low (50%)** | Inferred from context, estimated |

Overall confidence = weighted average of sources used.

Report confidence in output:
```
Data confidence: 85%
Sources: Calendar (60%), Meeting notes (30%), Manual (10%)
```

## Gap Detection

Identify unaccounted time:

```
Expected work hours: 8.0
Logged hours: 6.5
Gap: 1.5 hours

Possible explanations:
- No events 11:00-12:00 (lunch?)
- No events 16:00-17:00 (admin work?)

Recommend: Run /capture-time for missing periods
```

## /capture-time Flow

1. **Show today's logged time**
   ```
   Today (Jan 22) - Currently logged: 5.5 hours

   • 09:00-10:00 | Project Alpha | Email
   • 10:00-11:15 | Project Alpha | Meeting
   • 13:00-15:30 | Project Beta | Analysis
   ```

2. **Identify gaps**
   ```
   Gaps detected:
   • 11:15-12:00 (45 min)
   • 15:30-17:00 (1.5 hours)
   ```

3. **Prompt for each gap**
   ```
   What did you do 11:15-12:00?
   > [User: Lunch]

   What did you do 15:30-17:00?
   > [User: Worked on Project Alpha documentation]
   ```

4. **Update daily note**
   ```
   Added to time log:
   - 15:30-17:00 | Project Alpha | Documentation work

   New total: 7.0 hours (excluding lunch)
   ```

## Integration with /timesheet

/timesheet command should:

1. Determine week boundaries (Mon-Fri or Sun-Sat)
2. Run aggregation algorithm for each day
3. Handle partial weeks (current week through today)
4. Generate daily breakdown + weekly summary
5. Report confidence score
6. Flag days with low coverage for follow-up

## Error Handling

| Issue | Handling |
|-------|----------|
| Calendar unavailable | Proceed with other sources, flag low confidence |
| No data for day | Flag as gap, recommend /capture-time |
| Conflicting entries | Prefer explicit (meeting notes) over inferred (calendar) |
| Overlapping times | Flag for review, don't double-count |
| Project not recognized | Default to "General" or prompt user |
