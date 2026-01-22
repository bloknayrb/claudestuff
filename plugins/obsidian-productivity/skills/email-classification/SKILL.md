---
name: email-classification
description: Email categorization and priority logic for triage and processing
version: 1.0.0
tags: [email, productivity, triage, classification]
---

# Email Classification

## Overview

Systematic approach to email categorization for triage commands. Classifies emails by urgency, required action, and project/client association.

## Classification Dimensions

### 1. Urgency Level

| Level | Criteria | Response Window |
|-------|----------|-----------------|
| **Immediate** | Explicit deadline within 24h, "urgent" language, escalation | Same day |
| **Important** | Deadline within week, significant decision needed, client request | This week |
| **Routine** | FYI, newsletters, low-stakes items | When convenient |

### 2. Action Type

| Type | Description | Examples |
|------|-------------|----------|
| **Response Required** | Needs reply or answer | Question asked, approval requested |
| **Action Required** | Needs work beyond reply | Document review, task assignment |
| **Decision Required** | Choice needs to be made | Option selection, go/no-go |
| **FYI** | Informational only | Status updates, newsletters |
| **Delegate** | Someone else should handle | Wrong recipient, team task |

### 3. Sender Priority

| Priority | Criteria |
|----------|----------|
| **Critical** | Direct manager, key clients, executives |
| **High** | Team members, project stakeholders |
| **Normal** | Colleagues, regular contacts |
| **Low** | External vendors, newsletters, automated |

## Urgency Detection Patterns

### Immediate Indicators

**Explicit urgency keywords:**
- "urgent", "ASAP", "immediately"
- "by end of day", "by COB"
- "deadline is today"
- "critical", "time-sensitive"

**Contextual urgency:**
- Reply-all chains with escalation
- Multiple follow-ups on same thread
- Meeting in next 2 hours mentioned
- System alerts or failures

### Important Indicators

**Deadline patterns:**
- "by Friday", "by end of week"
- "need by [date within 7 days]"
- "before the meeting on [date]"

**Significance patterns:**
- "decision needed"
- "approval required"
- "please review"
- Client name + request
- Budget/contract/legal mentions

### Routine Indicators

- Newsletter format
- "FYI", "for your information"
- CC'd (not directly addressed)
- Automated notifications
- No explicit ask or deadline

## Client/Project Detection

### From Email Tags

If emails are tagged (e.g., `#email-projectname`):
```
#email-projecta → Project A
#email-clientb → Client B
```

### From Email Content

**Subject line patterns:**
- "[ProjectName]" or "RE: [ProjectName]"
- "Project Alpha:" prefix
- Standard project code references

**Body patterns:**
- Project name mentions
- Client name references
- Contract/PO numbers

**Sender domain:**
- @clientdomain.com → Client association
- Internal → Check subject/body

## Classification Algorithm

```
1. URGENCY ASSESSMENT
   IF contains immediate indicators → IMMEDIATE
   ELSE IF contains important indicators → IMPORTANT
   ELSE → ROUTINE

2. ACTION DETERMINATION
   IF contains question mark + "you" → RESPONSE REQUIRED
   IF contains "review", "approve", "sign" → ACTION REQUIRED
   IF contains "decide", "choose", "option" → DECISION REQUIRED
   IF contains "FYI", "informing you" → FYI
   IF addressed to someone else → DELEGATE

3. SENDER PRIORITY
   IF sender in critical list → CRITICAL
   IF sender in team/stakeholder list → HIGH
   ELSE IF internal domain → NORMAL
   ELSE → LOW

4. FINAL PRIORITY = URGENCY × SENDER PRIORITY
   IMMEDIATE + CRITICAL = TOP (handle now)
   IMMEDIATE + HIGH/NORMAL = URGENT
   IMPORTANT + CRITICAL = URGENT
   IMPORTANT + HIGH = HIGH
   Everything else = NORMAL/LOW
```

## Output Classification

For each email, classification should include:

```yaml
email:
  subject: "RE: Project Alpha deliverable"
  from: "manager@company.com"
  received: "2025-01-22T09:30:00"

  classification:
    urgency: immediate | important | routine
    action: response | action | decision | fyi | delegate
    sender_priority: critical | high | normal | low
    final_priority: top | urgent | high | normal | low

  context:
    project: "Project Alpha"
    deadline: "2025-01-22" # if detected
    key_ask: "Need approval on budget" # extracted action

  recommendation:
    action: "Reply with approval decision"
    timing: "Within 2 hours"
```

## Triage Output Format

Group emails by final priority, then by project:

```
🔴 IMMEDIATE ACTION (handle now)

  [Project Alpha]
  ▸ RE: Budget approval needed - Manager
    Action: Decision required by EOD

🟡 IMPORTANT (this week)

  [Project Alpha]
  ▸ Deliverable review - Client
    Action: Review and respond by Friday

  [Project Beta]
  ▸ Status update request - Stakeholder
    Action: Send progress summary

🟢 ROUTINE (when convenient)

  [General]
  ▸ Weekly newsletter - HR
    Action: FYI only
```

## Integration Notes

### With /email-triage Command

The command should:
1. Scan emails within configured window
2. Apply classification algorithm
3. Group by priority and project
4. Output triage dashboard

### With Task Creation

High-priority emails with action/decision required may warrant TaskNote creation:
- URGENT + ACTION → Consider immediate TaskNote
- HIGH + DEADLINE → Schedule TaskNote with due date

### With /track Command

/track can reference email classifications when:
- Detecting commitments (response sent = potential commitment)
- Identifying dependencies (waiting for response)
- Flagging overdue items (urgent email not addressed)
