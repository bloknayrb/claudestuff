---
name: meeting-prep
description: "Proactive meeting preparation. Use when: (1) User mentions upcoming meeting/call ('meeting in 30 minutes', 'call later today'), (2) User asks to prepare for meeting, (3) Processing calendar content. Always OFFER first - never auto-invoke."
version: 1.0.0
---

# Meeting Prep Skill

## Proactive Invocation Mode: OFFER FIRST

**CRITICAL**: This skill uses "offer first" mode. When you detect meeting triggers, OFFER to prepare - do NOT auto-invoke.

### Detection Triggers

Invoke this skill's offer behavior when you detect:
- "I have a [client] meeting in [time]"
- "Call with [person/client] later today"
- "Meeting tomorrow morning"
- "Need to prepare for [meeting name]"
- Calendar content or scheduling emails
- User mentions upcoming meeting timeframe

### Offer Behavior

When trigger detected, respond with:
```
I notice you have a [detected meeting] coming up. Want me to assemble context for it?

Options:
- **Quick prep** (~30 sec): Recent meeting, open tasks, key updates
- **Standard prep** (~90 sec): Full context with history, decisions, talking points
- **Comprehensive** (~3 min): Critical meeting deep dive with stakeholder analysis
```

If user confirms, proceed with skill execution. If user declines, continue without prep.

---

## Role Definition

Meeting preparation specialist for consulting practice, assembling comprehensive context from previous meetings, related emails, open tasks, and project status.

## Core Capabilities

- Gather previous meeting notes (same attendees/topic)
- Identify related emails and open action items
- Assemble project status snapshot
- Generate talking points and questions
- Flag decisions needed and potential issues

## Input Parameters

When invoked, gather these parameters (ask if not provided):

| Parameter | Required | Description |
|-----------|----------|-------------|
| meeting_name | Yes | Meeting description |
| meeting_date | Yes | Scheduled date (YYYY-MM-DD) |
| attendees | No | Expected attendees (improves context) |
| meeting_type | No | Auto-detected from name |
| project | No | Auto-detected from name |
| prep_depth | No | quick/standard/comprehensive (auto-selected) |

## Path Selection

**AUTO-DETECT meeting_type from meeting_name**:
- "Weekly Status", "Friday Call", "Regular" -> routine -> Quick Path
- "Review", "Workshop", "Kickoff" -> review -> Standard Path
- "Board Meeting", "Executive", "Go/No-Go" -> critical -> Comprehensive Path
- New attendee or new topic -> first-time -> Standard Path

---

## Quick Path (Routine Meetings, 30-45 seconds)

**When**: Weekly status calls, regular check-ins, routine updates

**Steps**:
1. Find previous meeting note (same attendees/topic, last 30 days)
2. Check action items from previous meeting - which are complete?
3. Scan TaskNotes for open items related to this project
4. Read last 3 relevant emails (last 7 days, same client tag)
5. Generate prep summary

**Output Format**:
```markdown
# Meeting Prep: [Meeting Name] - [Date]

## Since Last Meeting ([Previous Meeting Date])
- [Change 1]
- [Change 2]

## Action Items Status
**Your Items**:
- [x] [[Task A]] - Completed [date]
- [ ] [[Task B]] - In progress (due [date])

**Others' Items**:
- [ ] [Name]: [Item] - Pending

## Current Project Status
- [Project]: [1-sentence status]
- Open tasks: [count]
- At-risk items: [count]

## Quick Updates to Share
1. [Update 1]
2. [Update 2]

## Questions for the Team
1. [Question 1]
2. [Question 2]
```

---

## Standard Path (Review/First-Time Meetings, 60-90 seconds)

**When**: Workshops, kickoffs, reviews, first meetings with new attendees

**Steps**:
1. Find all related meeting notes (same topic, last 3 months)
2. Query memory systems for meeting context
3. Read related project folder note for status snapshot
4. Identify decisions needed (open questions from previous meetings)
5. Generate comprehensive prep document

**Output Format**:
```markdown
# Meeting Prep: [Meeting Name] - [Date]

## Executive Summary
[2-3 sentence overview of meeting context and what you need from it]

## Meeting History
**Previous Meetings**:
- **[Date]**: [[Meeting Note]] - [Key decision/outcome]
- **[Date]**: [[Meeting Note]] - [Key decision/outcome]

## Current Status
**Project**: [Project Name]
**Phase**: [Current phase]
**Health**: [Red|Yellow|Green]

**Open Tasks** (Yours):
- [[Task A]] - [Status] - Due [date]
- [[Task B]] - [Status] - Due [date]

**Dependencies**:
- [Person/Vendor]: [Deliverable] - Due [date] - Status: [on-track|at-risk|overdue]

## Discussion Topics
1. **[Topic 1]**: [Background] - [Current status] - [Decision needed]
2. **[Topic 2]**: [...]

## Talking Points (Key Messages)
1. [Message 1 - what to emphasize]
2. [Message 2]

## Questions to Ask
1. [Question 1]
2. [Question 2]

## Decisions Needed
- **[Decision 1]**: [Context] - Options: [A, B, C] - Recommendation: [X]

## Potential Issues to Flag
- [Issue 1]: [Description] - [Mitigation]
```

---

## Comprehensive Path (Critical Meetings, 2-3 minutes)

**When**: Board meetings, go/no-go decisions, executive presentations

**Steps**:
1. PARALLEL context assembly using Task tool with 4 agents (general-purpose):
   - Agent 1: Meeting history (all previous meetings, up to 1 year)
   - Agent 2: Email thread analysis (identify stakeholder positions)
   - Agent 3: Project document review (technical specs, requirements)
   - Agent 4: Risk analysis - read state files for tracking intelligence
2. Query memory systems for comprehensive context
3. Synthesize comprehensive meeting brief

**Output Format**:
```markdown
# Meeting Prep Brief: [Meeting Name] - [Date]

## Executive Summary
**Purpose**: [Why this meeting matters]
**At Stake**: [What's being decided or what risk exists]
**Recommendation**: [Your position going into meeting]

## Historical Context
### How We Got Here
[Chronological narrative of key events leading to this meeting]

### Previous Decisions
- **[Date]**: [Decision] - [[Source]]
- **[Date]**: [Decision] - [[Source]]

## Stakeholder Analysis
**[Stakeholder 1]** (Role):
- **Position**: [What they want/need]
- **Concerns**: [What they're worried about]
- **Evidence**: [[Email]], [[Meeting]]

## Technical Details
### Current Specifications
[Relevant technical details needed for meeting]

### Requirements
- [Requirement 1] - Status: [met|partial|unmet]
- [Requirement 2] - ...

### Known Issues
- **[Issue 1]**: [Description] - Impact: [High|Medium|Low]

## Risk Analysis
**Critical Risks**:
1. [Risk 1] - Probability: [%] - Impact: [description] - Mitigation: [action]

**Dependencies at Risk**:
- [Dependency] - Due [date] - Owner: [person]

## Decision Matrix
### Decision: [Main decision to be made]

**Option A**: [Description]
- Pros: [benefit 1], [benefit 2]
- Cons: [drawback 1], [drawback 2]

**Option B**: [...]

**Recommendation**: [Recommended path with rationale]

## Talking Points (Priority Order)
1. **[Key Message 1]**: [What to say] - [Why it matters]
2. **[Key Message 2]**: [...]

## Anticipated Questions & Answers
**Q**: [Likely question from stakeholder]
**A**: [Your response] - **Evidence**: [[Source]]

## Success Criteria
**Minimum Success**: [What MUST be achieved]
**Desired Outcome**: [What you WANT to achieve]

## Post-Meeting Actions
- [ ] Document decisions in meeting note
- [ ] Create TaskNotes for new action items
- [ ] Update tracking for adjusted dependencies

## Reference Materials
**Key Documents**: [[Document 1]], [[Document 2]]
**Related Meetings**: [[Previous Meeting 1]], [[Previous Meeting 2]]
```

---

## Save Location

Save prep document to appropriate meeting folder or location specified by user.

**ALWAYS confirm save location with user before writing.**

---

## Constraints

- Meeting prep must complete before meeting time
- Token budget: Quick=3K, Standard=6K, Comprehensive=10K
- Execution time: Quick=30-45s, Standard=60-90s, Comprehensive=120-180s
- ALWAYS cite sources for claims/decisions
- NEVER fabricate previous decisions or stakeholder positions

## Self-Verification

Before finalizing:
- [ ] All previous meetings cited with [[links]]
- [ ] Stakeholder positions backed by sources
- [ ] Talking points aligned with known positions
- [ ] No fabricated information (all from vault/sources)
