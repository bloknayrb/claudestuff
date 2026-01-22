---
Type: Email
**CRITICAL**: Use PowerShell (not CMD) for all timestamp-based filtering to prevent silent failures.
**Fallback Rule**: If PowerShell returns 0 emails but files exist → scan ALL emails for that client. Better to triage extra emails than miss critical client requests.
---
## Parallel Agent Architecture

See `99-System/shared/parallel-agent-pattern.md` for deployment strategy.

**Agent Configuration**: 4 agents scanning by client priority for 50-60% faster execution.

### Agent Responsibilities

**Agent 1: Critical Client Scanner** (general-purpose)
- Scan: DRPA (#email-drpa) and VDOT (#email-vdot)
- Time window: Last 3 days
- Urgency keywords: "deadline", "due", "urgent", "ASAP", "response needed"
- Output: Prioritized list with category, urgency, estimated time

**Agent 2: High Priority Scanner** (general-purpose)
- Scan: NJ EZPass (#email-njezpass), MDTA (#email-mdta), DelDOT (#email-deldot)
- Time window: Last 7 days
- Focus: Active project coordination, deliverable requests
- Output: Prioritized list with context

**Agent 3: Internal & Administrative Scanner** (general-purpose)
- Scan: Internal communications, administrative items
- Tags: #email-internal, #email-admin, #email-personal
- Time window: Last 7 days
- Output: Lower priority items for time-permitting review

**Agent 4: Cross-Project Synthesizer** (general-purpose)
- Aggregate results from Agents 1-3
- Remove duplicates and thread consolidation
- Apply final prioritization logic
- Generate formatted triage report
- Output: Comprehensive prioritized email list

### Execution Workflow

```
Phase 1: Parallel Agent Deployment (single message, 4 Task calls)
├─ Launch all agents simultaneously
└─ Each scans specific client priority tier

Phase 2: Result Collection
├─ Gather findings from Agents 1-3
└─ Feed to Agent 4 for synthesis

Phase 3: Output Generation
├─ Apply final prioritization
├─ Format with visual hierarchy
└─ Generate triage dashboard
```

---

## Classification Logic

### Urgency Levels

**IMMEDIATE (24 hours)**:
- Explicit same-day or next-day deadlines
- "Urgent", "ASAP", "today", "tomorrow" in subject/body
- Client requests for meetings within 48 hours
- Critical questions blocking client work

**URGENT (3 days)**:
- Deadlines within 3 days
- "This week" or specific dates within 3 days
- Review requests with context suggesting urgency
- Follow-up on overdue items

**HIGH (This week)**:
- Deadlines within current week
- Important but not time-critical questions
- Deliverable reviews without immediate deadline
- Project coordination needing attention

**MEDIUM (Next week)**:
- Upcoming deadlines (next week)
- Routine project updates
- Non-urgent information requests

**LOW (Time permitting)**:
- No specific deadline
- FYI items, newsletters, announcements
- Administrative notices

### Action Category Detection

**Response Required**:
- Direct questions ("Can you...?", "What is...?", "When will...?")
- Requests for input or decision
- Meeting scheduling requests

**Review Needed**:
- Attachments with request for comments
- "Please review", "feedback requested"
- Draft documents, reports, specifications

**Follow-up**:
- "Following up on...", "Any update on...?"
- Previous email threads awaiting your action
- Status check requests

**Time-Sensitive**:
- Explicit deadlines in subject or body
- Meeting coordination (dates/times)
- Client urgency indicators

---

## Output Format

See `99-System/shared/output-templates.md` (TRIAGE_TEMPLATE) for structure.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                      📧 EMAIL TRIAGE - [DATE]                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

🔴 IMMEDIATE ACTION REQUIRED (24 hours) - [N] emails
┌──────────────────────────────────────────────────────────────────────────────┐
│ DRPA: [Subject Line]                                                         │
│ From: [Sender] | Received: [Date/Time] | Est. Time: [Duration]              │
│ Category: [Response/Review/Follow-up] | Deadline: [Specific date if known]  │
├─ [Brief description of what's needed]                                       │
├─ Action: [Specific next step]                                               │
└─ [[Email-Link]]                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

🟡 URGENT (This Week) - [N] emails
┌──────────────────────────────────────────────────────────────────────────────┐
│ VDOT: [Subject]                                                              │
│ [Key info]                                                                   │
└──────────────────────────────────────────────────────────────────────────────┘

🟢 MEDIUM (Next Week) - [N] emails
• [Brief listings]

📊 TRIAGE SUMMARY
═══════════════════════════════════════════════════════════════════════════════
Immediate action: [N] emails
Urgent (this week): [N] emails
Medium priority: [N] emails
Total reviewed: [N] emails from last [X] days

Estimated triage time: [Total minutes] ([breakdown by priority])
```

---

## Project Tag Mapping

See `99-System/shared/project-keywords.md` for keyword patterns.

**Email Tags** (flat email system):
- `#email-drpa` - DRPA Oversight emails
- `#email-vdot` - VDOT Operations emails
- `#email-njezpass` - NJ EZPass ICD 1.6 emails
- `#email-mdta` - MDTA ETC 4G emails
- `#email-deldot` - DelDOT emails
- `#email-internal - Internal company communications
- `#email-admin` - Administrative items
- `#email-personal` - Personal correspondence

---

## Time Estimation Guidelines

**Quick (5-10 minutes)**:
- Simple yes/no responses
- Brief status updates
- Calendar confirmations

**Medium (30 minutes)**:
- Detailed responses requiring context
- Document reviews (shorter documents)
- Meeting preparation

**Extended (1+ hour)**:
- Comprehensive document reviews
- Detailed technical responses
- Complex coordination emails

Include estimated time in triage output to help with workload planning.

---

## Error Handling

See `99-System/shared/error-handling-protocols.md` for standard responses.

**Missing Tags**: Skip emails without project tags, log for manual review

**PowerShell Failure**: Fall back to full email scan, log fallback usage

**Agent Timeout**: Continue with available results, flag incomplete coverage

---

## Context Integration

- Reference CLAUDE.md for active projects and client priorities
- Use flat email system tags for classification
- Eastern Time zone (user preference)

## Key Behaviors

1. **Client Priority First**: Always prioritize DRPA and VDOT (primary clients)
2. **Parallel Execution**: Launch 4 agents in single message for optimal speed
3. **PowerShell Filtering**: Use PowerShell for temporal filtering (see shared/powershell-temporal-filter.md)
4. **Time Windows**: Focus on last 3 days for critical clients, 7 days for others
5. **Actionable Output**: Provide specific next steps, not just lists
6. **Time Estimates**: Include effort estimates to help with prioritization

Generate prioritized email action list organized by urgency and client priority.
