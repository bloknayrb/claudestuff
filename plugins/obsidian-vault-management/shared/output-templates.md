# Output Templates - Shared Infrastructure

Standard output formats for all vault management skills.

## Template: MAINTENANCE

Used by: vault-sweeping skill

```markdown
# Vault Maintenance Report
Generated: [timestamp]
Scope: [Quick/Standard/Deep Path]
Files Scanned: [count]

## Critical Issues (Immediate Action Required)

[If none: ✓ No critical issues found]

### File Organization
- [ ] **[filename]**: Type property "[type]" but located in [wrong-folder]
  - Recommended: Move to [correct-folder]/
  - Impact: HIGH - Affects project navigation

[... additional critical issues ...]

## Important Issues (Action Recommended)

[If none: ✓ No important issues found]

### Template Compliance
- [ ] **[filename]**: Missing required field "[field-name]"
  - Template: [template-type]
  - Impact: MEDIUM - Affects data completeness

[... additional important issues ...]

## Recommendations (Optional Improvements)

[If none: ✓ No recommendations at this time]

### Cleanup Opportunities
- **Stale Inbox Files**: [count] files older than 30 days
  - Oldest: [filename] ([days] days old)
  - Action: Review and move to appropriate project folders

[... additional recommendations ...]

## Summary

- **Critical**: [count] issues
- **Important**: [count] issues
- **Recommendations**: [count] items
- **Next Sweep**: [suggested-date]

[Quick Path only: Run Standard or Deep path for comprehensive analysis]
[Standard Path: Run Deep path for historical pattern analysis]
[Deep Path: Complete analysis with all available context]
```

---

## Template: TRIAGE

Used by: email-triaging skill (future)

```markdown
# Email Triage Report
Generated: [timestamp]
Scope: Last [N] days, [client-filter]

## Immediate Action Required

[If none: ✓ No immediate actions]

- [ ] **[subject]** from [sender] - [client]
  - Received: [date-time]
  - Action: [Response/Review/Follow-up]
  - Time Est: [X min]
  - Context: [brief-context]

## Urgent (This Week)

[... format similar to Immediate ...]

## High Priority (Next Week)

[... format similar to Immediate ...]

## Summary

- **Immediate**: [count] emails
- **Urgent**: [count] emails
- **High**: [count] emails
- **Total Time**: ~[X] hours estimated

[Quick Path note: Critical clients only - run Standard for all clients]
```

---

## Template: TRACKING

Used by: update-tracking skill (future)

```markdown
# Background Awareness Update
Generated: [timestamp]
Scope: [Quick/Standard/Deep Path]

## New Items Detected

[If none: ✓ No new background items]

### [Client/Project Name]
- **Item**: [description]
  - Source: [meeting/email/Teams]
  - Assigned: [person]
  - Bryan's Role: Awareness only
  - Expected: [date or condition]

## Status Updates

[If none: ✓ No status changes]

### [Client/Project Name]
- **Item**: [description]
  - Previous: [old-status]
  - Current: [new-status]
  - Impact: [None/Low/Medium/High]

## Summary

- **New Items**: [count]
- **Updated Items**: [count]
- **Total Tracked**: [count] background items

[Quick Path: Incremental changes only]
[Standard Path: Comprehensive scan]
[Deep Path: Includes cross-validation and risk assessment]
```

---

## Template: TIMESHEET

Used by: timesheet-generation skill (future)

```markdown
# Weekly Timesheet
Week of: [start-date] to [end-date]
Generated: [timestamp]

## Daily Breakdown

### Monday, [date]
| Time | Duration | Project | Activity | Source |
|------|----------|---------|----------|--------|
| 09:00-10:00 | 1.0 | DRPA Oversight | Weekly standup | ICS Calendar |
| 10:00-12:00 | 2.0 | VDOT CSC | Requirements review | Meeting + TaskNote |
| ... | ... | ... | ... | ... |
**Daily Total**: [X.X] hours

[... repeat for each day ...]

## Project Summary

| Project | Hours | Percentage |
|---------|-------|------------|
| DRPA Oversight | XX.X | XX% |
| VDOT CSC | XX.X | XX% |
| ... | ... | ... |
**Week Total**: [XX.X] hours

## Quality Assessment

- **Confidence**: [High/Medium/Low]
- **Sources**: ICS: XX%, Meetings: XX%, TaskNotes: XX%, Email: XX%
- **Gaps**: [count] gaps >4 hours flagged
- **Validation**: [passed/review-needed]

## Notes

[Any clarifications, anomalies, or manual adjustments needed]

[Quick Path: ICS + TaskNotes only]
[Standard Path: All sources without deep validation]
[Deep Path: Full correlation + confidence scoring]
```

---

## Template: DASHBOARD

Used by: daily-standup command (existing)

```markdown
# Daily Dashboard
[Date]

## Today's Priorities

[Top 3-5 priorities from tracking]

## Active Tasks

[TaskNotes in In Progress status]

## Recent Activity

[Last 24h updates]

## Awareness Items

[Background tracking highlights]
```

---

## Template: SUMMARY

Used by: Multiple skills for executive summaries

```markdown
# [Skill Name] Summary
[Date/Period]

## Key Findings

1. [Most important finding]
2. [Second most important]
3. [Third most important]

## Recommendations

1. **[Action]**: [Rationale]
   - Priority: [High/Medium/Low]
   - Effort: [Low/Medium/High]
   - Impact: [description]

## Next Steps

- [ ] [Actionable step 1]
- [ ] [Actionable step 2]

## Details

[Link to full report or reference to detailed findings]
```

---

## Usage Guidelines

### Template Selection

- **MAINTENANCE**: File/folder/metadata validation reports
- **TRIAGE**: Email or task prioritization
- **TRACKING**: Background awareness and status updates
- **TIMESHEET**: Time tracking and billing
- **DASHBOARD**: Daily summary view
- **SUMMARY**: Executive-level overviews

### Customization

Templates provide structure but should be adapted to:
- Actual findings (remove empty sections)
- User context (add relevant details)
- Skill-specific needs (extend as required)

### Consistency

All templates follow these principles:
- Clear hierarchical structure (## → ### → bullets)
- Actionable items use checkboxes `- [ ]`
- Consistent formatting for dates, times, counts
- Summary section at end
- Path-specific notes when applicable