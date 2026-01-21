Execute a comprehensive weekly scan to update all project overview pages with recent activity, current status, tasks, dependencies, risks, and priorities.

## Command Purpose

This weekly maintenance command performs a thorough analysis of all active projects and updates their folder note overviews with:
- Recent activity summaries (last 30-60 days)
- Current task and deliverable status
- Active dependencies and blockers
- Risk assessments and health scores
- Communication summaries (meetings and emails)
- Forward-looking priorities and next steps

## Execution Flow

1. **Load Current State**: Read Claude-State.md for baseline tracking data
2. **Frequency Check**: Verify last run was >5 days ago (can override with confirmation)
3. **Deploy 5 Parallel Agents**: Gather comprehensive project intelligence
4. **Synthesize Findings**: Build complete project profiles from agent reports
5. **Update Project Pages**: Edit each project folder note with new structured content
6. **Update State**: Record execution timestamp in Claude-State.md
7. **Generate Report**: Provide summary of updates and key insights

## Performance Targets

- **Execution Time**: 5-7 minutes
- **Token Budget**: 15,000-20,000 tokens
- **Projects Updated**: All active projects
- **Frequency**: Weekly (enforced with warning, overridable)

---

## AGENT 1: TaskNotes Project Analyzer

**MISSION**: Analyze TaskNotes folder to extract per-project task metrics, completion rates, and deliverable schedules.

**SCOPE**:
- Path: `TaskNotes/*.md`
- All TaskNotes regardless of status (for completion analysis)
- Time window: Full history for completion metrics, focus on last 60 days for activity

**DATA TO EXTRACT**:

For each project:
1. **Active Tasks**: Count where status is `open` or `in-progress` (case-insensitive)
2. **Recently Completed**: Count where status is `done` or `completed` from last 30 days (case-insensitive)
3. **Overdue Tasks**: Active tasks with due date < today
4. **Upcoming Tasks**: Tasks due in next 30 days
5. **Task Velocity**: Completed tasks per week (trend analysis)
6. **Priority Distribution**: High/Medium/Low breakdown
7. **Deliverable Schedule**: List of tasks with due dates in next 30 days

---

## AGENT 2: Meeting Intelligence Agent

**MISSION**: Analyze meeting notes from last 60 days to extract key decisions, action items, dependencies, meeting patterns, and stakeholder engagement for each project.

**SCOPE**:
- **Path**: `06-Career/Transcripts/Completed Notes/*.md` (or configured meeting notes path)
- Time window: Last 60 days only

**DATA TO EXTRACT** (per meeting):
1. **Meeting Metadata**: Date, title, attendees, project association
2. **Key Decisions**: From Discussion sections - look for "decided", "agreed", "approved"
3. **Action Items**: From Action Items sections with assignee and due dates
4. **Dependencies Mentioned**: Cross-project or external dependencies discussed
5. **Risks Flagged**: Issues, blockers, concerns raised
6. **Meeting Cadence**: Calculate frequency (weekly, biweekly, monthly, ad-hoc)

---

## AGENT 3: Email Communications Analyzer

**MISSION**: Analyze email communications by project to identify critical client interactions, commitments, urgent requests, and stakeholder engagement patterns.

**SCOPE**:
- Path: `Emails/*.md`
- Filter by tags for project identification
- Time window: Last 60 days
- Focus: Action-required, urgent, commitments, client requests

**COMMITMENT DETECTION PATTERNS**:
- "I will [action] by [date]"
- "I'll [action]"
- "[Name] to [action] by [date]"
- "Can you provide [X] by [date]"
- "Need your [X] by [date]"
- "Due [date]", "deadline [date]"

---

## AGENT 4: Deliverables & Documents Scanner

**MISSION**: Scan project Documents folders to identify recent completions, work in progress, deliverable patterns, and upcoming milestone documentation.

**SCOPE**:
- Paths (per project):
  - `01-Projects/[Project]/Documents/Deliverables/`
  - `01-Projects/[Project]/Documents/Reports/`
  - `01-Projects/[Project]/Documents/` (if deliverables not in subfolders)
- Time window: Last 60 days for recency, full history for pattern analysis
- File types: .md, .pdf, .docx, .xlsx, .pptx

---

## AGENT 5: Risk & Dependency Cross-Project Analyzer

**MISSION**: Analyze tracking state and cross-project data to identify systemic risks, resource conflicts, shared dependencies, and calculate project health scores.

**HEALTH SCORE CALCULATION** (per project):

**Green (Healthy)**:
- 0 overdue tasks
- <3 high-priority active tasks
- Regular meeting cadence maintained
- No critical blockers
- Resources adequate

**Yellow (Caution)**:
- 1-2 overdue tasks OR
- 3-5 high-priority active tasks OR
- Irregular meeting cadence OR
- 1-2 medium blockers OR
- Resource constraints noted

**Red (At Risk)**:
- 3+ overdue tasks OR
- 5+ high-priority active tasks OR
- No meetings in 30+ days OR
- Critical blocker present OR
- Severe resource constraints

---

## SYNTHESIS & PROJECT UPDATE PHASE

After all 5 agents complete, synthesize findings into comprehensive project profiles and update each project folder note.

### Per-Project Update Process:

1. **Read Current Project Folder Note**: `01-Projects/[Project]/[Project].md`

2. **Build Updated Sections** using agent data:
   - **Quick Status Dashboard**: Health score, active tasks, last activity, next milestone, at-risk items
   - **Recent Updates**: Week-by-week activity summary for last 30 days
   - **Active Work Streams**: Current initiatives with status
   - **Tasks & Deliverables**: In progress, completed, upcoming tables
   - **Dependencies & Blockers**: Critical dependencies and active blockers
   - **Resource Status**: Team availability and capacity
   - **Risk Register**: Identified risks with mitigation
   - **Recent Decisions & Actions**: From meetings
   - **Communication Summary**: Meetings and emails
   - **Next Steps**: Prioritized actions for next 30 days

3. **Preserve Existing Content**:
   - Keep all YAML frontmatter (update only `updated:` timestamp)
   - Keep all dataview queries (usually at bottom of file)
   - Keep any manually-added narrative sections
   - Keep project-specific sections not in standard template

---

## OUTPUT TO USER

After all updates complete, generate comprehensive summary report with:
- Project health summary for each project
- Cross-project insights and attention items
- Metrics for the period (tasks completed, meetings held, emails processed)
- Execution summary (duration, tokens, files scanned)
- Recommendations for immediate focus

---

## ERROR HANDLING

### Frequency Check Warning

If command run <5 days ago, warn user and ask for confirmation before proceeding.

### Missing Data Graceful Degradation

- **No TaskNotes for project**: Mark section "No active tasks currently tracked"
- **No recent meetings**: Mark section "No meetings in last 60 days"
- **No email activity**: Mark section "Minimal email activity"
- **No documents**: Mark section "No recent deliverables"

### File Write Errors

If cannot write to project folder note:
- Log error with file path
- Continue with other projects
- Report failed updates in summary
- Suggest manual review

---

## COMMAND INVOCATION

User runs: `/update-projects`

Optional future parameters:
- `/update-projects --project="Project Name"` (single project)
- `/update-projects --window=30d` (custom time window)
- `/update-projects --force` (skip frequency check)
- `/update-projects --summary-only` (generate summary without updating files)
