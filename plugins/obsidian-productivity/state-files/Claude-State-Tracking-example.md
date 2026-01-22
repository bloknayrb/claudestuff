---
# Tracking State - Example Structure
# This shows the expected format for Claude-State-Tracking.md

comprehensive_tracking:
  last_scan_timestamp: "2025-01-22T10:30:00"
  direct_tasks_count: 15
  managed_dependencies_count: 8
  background_awareness_count: 12

scan_sources:
  tasknotes:
    last_scan: "2025-01-22T10:30:00"
    active_count: 15
    overdue_count: 3
  meetings:
    last_scan: "2025-01-22T10:30:00"
    scanned_count: 24
    actions_found: 8
  emails:
    last_scan: "2025-01-22T10:30:00"
    scanned_count: 156
    commitments_found: 4
  teams:
    last_scan: "2025-01-22T10:30:00"
    chats_scanned: 12
    items_found: 2

tasks_by_project:
  - project: "Project Alpha"
    active: 5
    overdue: 2
    waiting: 1
  - project: "Project Beta"
    active: 10
    overdue: 1
    waiting: 3
  - project: "General"
    active: 0
    overdue: 0
    waiting: 0

waiting_on:
  - person: "Manager Name"
    items:
      - description: "Budget approval for Q2"
        since: "2025-01-15"
        urgency: "high"
      - description: "Review of proposal draft"
        since: "2025-01-18"
        urgency: "medium"
  - person: "Client Contact"
    items:
      - description: "Feedback on deliverable"
        since: "2025-01-10"
        urgency: "high"

managed_dependencies:
  - assignee: "Team Member A"
    description: "Complete data analysis"
    needed_for: "Final report"
    due: "2025-01-25"
    source: "[[MeetingNotes-Project-Review_2025-01-15]]"
  - assignee: "External Vendor"
    description: "Deliver API documentation"
    needed_for: "Integration work"
    due: "2025-01-28"
    source: "[[email-vendor-update-2025-01-12]]"
---

# Tracking State

Last updated by `/track` on 2025-01-22 at 10:30 AM Eastern.

## Summary

- **Direct Tasks**: 15 active, 3 overdue
- **Managed Dependencies**: 8 items
- **Waiting On**: 3 people

## Notes

This section can contain human-readable notes and context that
the commands can reference but don't parse programmatically.

### Recent Priority Changes

- 2025-01-20: Manager prioritized Project Alpha deliverable
- 2025-01-18: Client requested expedited timeline

### Known Issues

- Task "Legacy system update" may need re-scoping
- Waiting on external dependency for Project Beta
