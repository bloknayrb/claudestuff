---
name: output-templates
description: Standard output formatting templates for Claude Code commands - ASCII borders, visual hierarchy, consistent structure
version: 1.0.0
tags: [formatting, output, templates, ui]
---

# Output Templates

## Overview

Standard output formatting templates for custom commands. Provides consistent visual hierarchy and information architecture.

## Template Principles

1. **ASCII borders**: Professional presentation without emoji overload
2. **Visual hierarchy**: Headers → Sections → Items
3. **Scannable**: Use whitespace, bullets, and formatting
4. **Action-oriented**: Clear next steps and priorities
5. **Consistent structure**: Users know where to find information

## Core Templates

### DASHBOARD_TEMPLATE

Used for: Task displays, daily summaries, status overviews

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        📋 [DASHBOARD TITLE]                                   ║
║                            [Subtitle/Date]                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

[High-level summary paragraph]

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔴 HIGH PRIORITY                                                             │
└──────────────────────────────────────────────────────────────────────────────┘

▸ [Item 1]
  └─ [Details]

▸ [Item 2]
  └─ [Details]

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🟡 MEDIUM PRIORITY                                                           │
└──────────────────────────────────────────────────────────────────────────────┘

▸ [Item]

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📊 SUMMARY                                                                    │
└──────────────────────────────────────────────────────────────────────────────┘

• Metric 1: [value]
• Metric 2: [value]

═══════════════════════════════════════════════════════════════════════════════
```

### TRIAGE_TEMPLATE

Used for: Email processing, inbox triage, priority sorting

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                      📧 EMAIL TRIAGE - [DATE]                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

[Brief overview]

🔴 IMMEDIATE ACTION REQUIRED (24 hours)
┌──────────────────────────────────────────────────────────────────────────────┐
│ [CATEGORY]: [Subject Line]                                                   │
│ From: [Sender] | Received: [Date/Time]                                      │
│ Priority: HIGH | Urgency: [Reason]                                          │
├─ [Brief description of why urgent]                                          │
├─ Suggested action: [What to do]                                             │
└─ [[Link]]                                                                    │
└──────────────────────────────────────────────────────────────────────────────┘

🟡 IMPORTANT (This Week)
┌──────────────────────────────────────────────────────────────────────────────┐
│ [CATEGORY]: [Subject]                                                        │
│ [Key info]                                                                   │
└──────────────────────────────────────────────────────────────────────────────┘

🟢 ROUTINE (Review When Convenient)
• [Brief listing]

📊 TRIAGE SUMMARY
═══════════════════════════════════════════════════════════════════════════════
Immediate action: [N] emails
Important: [N] emails
Routine: [N] emails
Total reviewed: [N] emails from [date] to [date]
```

### TRACKING_TEMPLATE

Used for: Task tracking, dependency management, progress updates

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                   🎯 TASK TRACKING - [DATE]                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

Last scan: [timestamp]
Scanning period: [description]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 DIRECT TASKS ([N] total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[PROJECT NAME]** ([N] tasks)

▸ [Task title]
  ├─ Status: [status] | Priority: [priority]
  ├─ Due: [date]
  ├─ Source: [[Link]]
  └─ [Brief context if needed]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 DEPENDENCIES ([N] total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[PROJECT NAME]**

▸ [Dependency description]
  ├─ Assigned to: [Person]
  ├─ Needed: [Output description]
  ├─ Required by: [Date]
  └─ Source: [[Link]]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 TRACKING SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Direct Tasks: [N] ([breakdown by status])
Dependencies: [N] ([breakdown by status])

By Project:
• PROJECT 1: [N] tasks
• PROJECT 2: [N] tasks

State updated: [state file]
```

### MEETING_PREP_TEMPLATE

Used for: Meeting preparation, context assembly, agenda review

```
╔══════════════════════════════════════════════════════════════════════════════╗
║              📝 MEETING PREPARATION: [Meeting Title]                         ║
║                          [Date/Time]                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

**Context Path**: [Quick/Standard/Comprehensive]

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🎯 KEY INFORMATION                                                            │
└──────────────────────────────────────────────────────────────────────────────┘

**Project**: [Name]
**Participants**: [List]
**Previous meetings**: [Recent related meetings]
**Open actions**: [N] ([link to tracking])

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📋 AGENDA TOPICS                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

1. [Topic]
   └─ [Key points from context]

┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ ITEMS NEEDING ATTENTION                                                    │
└──────────────────────────────────────────────────────────────────────────────┘

• [Item requiring preparation]

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📎 RELEVANT DOCUMENTS                                                         │
└──────────────────────────────────────────────────────────────────────────────┘

• [[Document-Link]] - [Brief description]

════════════════════════════════════════════════════════════════════════════════
```

### MAINTENANCE_TEMPLATE

Used for: System cleanup, validation, auditing

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    🔧 [MAINTENANCE COMMAND] - [DATE]                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

**Scan scope**: [Description]
**Mode**: [Dry-run/Execute]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 ISSUES DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[ISSUE CATEGORY]** ([N] files)

▸ [Filepath]
  └─ Issue: [Description]
  └─ Fix: [What will be changed]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ RECOMMENDED ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. [Action description]
   Files affected: [N]

2. [Action description]
   Files affected: [N]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total files scanned: [N]
Issues found: [N]
Auto-fixable: [N]
Requires manual review: [N]

[Dry-run mode: No changes made]
OR
[Execute mode: [N] files updated]
```

### TIMESHEET_TEMPLATE

Used for: Time tracking, weekly summaries, billing reports

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ⏱️  TIMESHEET - WEEK OF [DATE]                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

**Work Week**: Monday, [Month Day] - [Day], [Month Day], [Year]
**Week Status**: [Complete work week / Partial week (through [Day])]
**Generated**: [Today's Date and Time]
**Data sources**: [List sources]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 DAILY BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[Day of Week], [Date]** - Total: [X.X] hours

PROJECT NAME ([X.X] hours)
  • [HH:MM-HH:MM] [Activity description]
  • [HH:MM-HH:MM] [Activity description]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 WEEKLY SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOURS BY PROJECT:
┌─────────────────────────────┬──────────┐
│ Project                     │ Hours    │
├─────────────────────────────┼──────────┤
│ Project A                   │ XX.X     │
│ Project B                   │ XX.X     │
│ Other                       │ XX.X     │
├─────────────────────────────┼──────────┤
│ TOTAL                       │ XX.X     │
└─────────────────────────────┴──────────┘

HOURS BY DAY:
Mon: XX.X | Tue: XX.X | Wed: XX.X | Thu: XX.X | Fri: XX.X

Data confidence: [XX]%
```

## Usage Guidelines

### Customization
Templates show structure and formatting only. Customize content for each command:
- Adjust section headers as needed
- Add/remove sections based on data
- Maintain visual hierarchy
- Keep ASCII borders consistent

### Visual Elements

**Priority Indicators**:
- 🔴 High/Urgent/Immediate
- 🟡 Medium/Important/This Week
- 🟢 Low/Routine/When Convenient

**Section Icons**:
- 📋 Tasks/Lists
- 📧 Emails
- 📝 Notes/Preparation
- 🔧 Maintenance
- ⏱️  Time/Schedule
- 🎯 Tracking/Goals
- 📊 Summary/Stats
- 📎 Documents/Attachments
- ⚠️  Warnings/Issues
- ✅ Actions/Recommendations

**Structural Elements**:
- `═` Double line: Major separators
- `━` Heavy line: Section dividers
- `─` Light line: Item boundaries
- `▸` Triangle: List items
- `├─`, `└─` Tree branches: Nested details

### Integration with Commands

Reference templates:

```markdown
## Output Format
See output-templates skill for structure.

**Template**: [TEMPLATE_NAME]
**Sections**: [List relevant sections]
**Customizations**: [Command-specific adjustments]
```

## Template Selection Guide

Choose template based on command purpose:

| Command Type | Template | Priority |
|--------------|----------|----------|
| Task display | DASHBOARD_TEMPLATE | High |
| Email processing | TRIAGE_TEMPLATE | High |
| Tracking operations | TRACKING_TEMPLATE | High |
| Meeting preparation | MEETING_PREP_TEMPLATE | Medium |
| System maintenance | MAINTENANCE_TEMPLATE | Medium |
| Time tracking | TIMESHEET_TEMPLATE | High |

## Abbreviated Format

For commands with limited output, use simplified version:

```
[COMMAND TITLE]

[Brief summary]

[Section 1]
• Item
• Item

[Section 2]
• Item

Summary: [key metrics]
```

Only use abbreviated format for:
- Very short result sets (< 10 items)
- Simple status displays
- Quick confirmations
- Error messages

Use full templates for comprehensive reporting.
