---
name: memory-router
description: "Smart memory routing to SimpleMem or OpenMemory. Use when: (1) User states temporal fact with date ('cutover is April 15'), (2) User expresses preference ('I prefer morning meetings'), (3) User records lesson learned, (4) User shares procedural knowledge. Auto-store and confirm - local memory systems have no privacy concerns."
version: 1.0.0
---

# Memory Router Skill

## Proactive Invocation Mode: AUTO-INVOKE

**CRITICAL**: This skill uses auto-invoke mode. When you detect memory-worthy content, store it immediately and confirm. Since OpenMemory and SimpleMem run locally, there are no privacy concerns that require user confirmation before storage.

### Detection Triggers

Invoke this skill's auto-store behavior when you detect:

**Temporal Facts (-> SimpleMem)**:
- "Project cutover is April 15"
- "Jeremy said we should prioritize FAT"
- "Vendor committed to deliver by Friday"
- "Meeting scheduled for next Thursday"
- Any statement with specific dates, deadlines, or commitments

**Preferences (-> OpenMemory)**:
- "I prefer morning meetings"
- "I like bullet points over paragraphs"
- "I don't want reminders before 9am"
- Any statement about working style or personal preferences

**Lessons Learned (-> OpenMemory)**:
- "Lesson learned: always verify before committing"
- "Note to self: check the attachment format first"
- "In the future, we should..."
- Any insight from experience or mistake

**Procedural Knowledge (-> OpenMemory)**:
- "The RFP uses Attachment format"
- "To create a TaskNote, use..."
- "The file format requires..."
- Any how-to or process documentation

**Relationship Context (-> OpenMemory)**:
- "Jeremy is the team manager"
- "John Smith is the vendor POC"
- "Sarah handles client billing"
- Any statement about people and their roles

---

## Auto-Store Behavior

When trigger detected:

1. **Classify** the content (SimpleMem vs OpenMemory)
2. **Store** immediately without asking
3. **Confirm** briefly: "Stored that to [SimpleMem/OpenMemory]."

### Example Interactions

```
User: "The project cutover is confirmed for April 15"
Claude: [Auto-stores to SimpleMem]
Claude: "Stored that date to SimpleMem."
[Continue with whatever else was being discussed]

User: "I prefer receiving status updates in bullet points"
Claude: [Auto-stores to OpenMemory]
Claude: "Noted your preference in OpenMemory."
[Continue conversation]

User: "Lesson learned: always run the build before committing"
Claude: [Auto-stores to OpenMemory reflective sector]
Claude: "Captured that lesson in OpenMemory."
[Continue conversation]
```

---

## Routing Logic

### Route to SimpleMem

**Indicators**:
- Contains specific dates or deadlines
- References meetings or decisions with temporal context
- Names specific people with specific actions
- Project milestone or status information
- Time-bound commitments or changes
- "On [date]", "[Person] said", "[Project] deadline"

**Storage**:
```
mcp__simplemem__add_dialogue(
  speaker="[source - User, System, or named person]",
  content="[the temporal fact]",
  timestamp="[extracted date or current timestamp]"
)
mcp__simplemem__finalize()
```

**Confirm**: "Stored to SimpleMem."

### Route to OpenMemory

**Indicators**:
- Preferences or working style
- Lessons learned (timeless insights)
- Tool or process knowledge
- Communication patterns
- Relationship context
- General guidelines or rules

**Sector Classification**:
| Content Type | Sector |
|--------------|--------|
| Preferences, feelings | emotional |
| Procedures, workflows | procedural |
| Facts, knowledge | semantic |
| Lessons, insights | reflective |
| Past events (non-temporal) | episodic |

**Storage**:
```
mcp__openmemory__openmemory_store(
  content="[the content with context]",
  metadata={"type": "[classification]", "source": "memory-router"},
  tags=["auto-stored", "[relevant tags]"]
)
```

**Confirm**: "Noted in OpenMemory."

---

## Classification Examples

| Content | Destination | Sector | Reason |
|---------|-------------|--------|--------|
| "Project cutover is April 15, 2026" | SimpleMem | - | Specific date/deadline |
| "Jeremy said we should prioritize FAT" | SimpleMem | - | Attributed statement |
| "Vendor committed to deliver by Friday" | SimpleMem | - | Time-bound commitment |
| "I prefer morning meetings" | OpenMemory | emotional | Personal preference |
| "Always verify attachment sequences first" | OpenMemory | procedural | Procedural lesson |
| "Jeremy is the team manager" | OpenMemory | semantic | Relationship context |
| "The RFP uses Attachment format" | OpenMemory | semantic | Persistent knowledge |
| "Learned: check file format before processing" | OpenMemory | reflective | Lesson learned |

---

## Edge Cases

### Ambiguous Content

When content could go to either system, prefer:
1. **SimpleMem** if there's any date/time component
2. **OpenMemory** if it's purely knowledge or preference
3. **Both** if the content has both temporal and timeless aspects

### Storing to Both Systems

Some content benefits from dual storage:

```
User: "Project cutover moved to April 15 - this is the third date change"

Claude: [Stores to SimpleMem: "Project cutover date: April 15, 2026"]
Claude: [Stores to OpenMemory: "Pattern: cutover has changed dates multiple times"]
Claude: "Stored the date to SimpleMem and noted the pattern in OpenMemory."
```

### System Unavailability

**SimpleMem unavailable**:
- Store to OpenMemory instead with tag `fallback-from-simplemem`
- Confirm: "SimpleMem unavailable - stored to OpenMemory instead."

**OpenMemory unavailable**:
- Store to SimpleMem as backup if temporal
- Otherwise: "OpenMemory unavailable - couldn't store that preference."

**Both unavailable**:
- Inform user: "Memory systems aren't available right now."

---

## Integration with Task Creation

When the task-management skill creates a TaskNote, it stores context to SimpleMem. This skill complements that by capturing:
- Non-task temporal facts (dates, decisions, commitments)
- Preferences that affect task handling
- Lessons that inform future task approaches

---

## Why Two Systems?

| System | Optimized For | Query Pattern |
|--------|---------------|---------------|
| SimpleMem | Temporal facts | "What happened with X in January?" |
| OpenMemory | Contextual retrieval | "What are the user's preferences?" |

Using both provides comprehensive memory coverage.

---

## Querying Later

- **SimpleMem**: Use project-history commands or ask "What context do I have about [topic]?"
- **OpenMemory**: Claude retrieves automatically based on conversation context

---

## Performance Notes

- Storage operations are fast (<1 second)
- Confirmation should be brief (single line)
- Don't interrupt conversation flow for storage
- Multiple items can be stored in one turn if detected together

## Constraints

- NEVER store sensitive information (passwords, API keys, credentials)
- NEVER store information the user explicitly asks not to store
- DO store proactively - the value is in capturing context that would otherwise be lost
- Keep confirmations brief - the storage is the point, not the announcement
