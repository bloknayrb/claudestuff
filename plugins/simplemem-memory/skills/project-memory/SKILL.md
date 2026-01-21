---
name: project-memory
description: SimpleMem temporal memory system for storing project-specific facts with date context - meeting decisions, action items, milestones, and status changes. Use proactively when processing meeting notes, creating tasks, or tracking project events.
version: 1.0.0
tags:
  - memory
  - simplemem
  - temporal
  - project-tracking
  - meetings
---

# Project Memory (SimpleMem)

SimpleMem is a semantic lossless compression memory system for storing **temporal, project-specific facts**. It complements OpenMemory by focusing on facts with date/time context rather than persistent preferences.

## Domain Separation

**SimpleMem is for:**
- Meeting decisions with specific dates ("On Jan 15, the team decided to use approach X")
- Action item commitments ("Person A committed to deliver Y by date Z")
- Project deadlines and milestones
- Status change history ("DRPA cutover moved from March to April")
- Attribution: "Person X said Y on date Z"

**OpenMemory is for:**
- User preferences and working style
- Communication patterns
- Lessons learned (timeless)
- Procedural knowledge
- Relationship context

## Available Tools

| Tool | Purpose |
|------|---------|
| `mcp__simplemem__add_dialogue` | Store a single fact with speaker attribution |
| `mcp__simplemem__add_dialogues` | Batch store multiple facts |
| `mcp__simplemem__finalize` | **REQUIRED** - Process buffer into memory |
| `mcp__simplemem__ask` | Query memories with semantic synthesis |
| `mcp__simplemem__search_memories` | Raw keyword/semantic search |
| `mcp__simplemem__get_all_memories` | Export all memories (debugging) |
| `mcp__simplemem__clear_memories` | Wipe database (CAUTION) |

## Critical Workflow

**Always call `finalize` after adding dialogues!** SimpleMem buffers entries and processes them in batches. Without `finalize`, entries won't be searchable.

```
1. add_dialogue (speaker, content, timestamp?)
2. add_dialogue (speaker, content, timestamp?)
3. ...repeat as needed...
4. finalize()  ← REQUIRED for processing
```

## Storing Facts

When storing temporal facts, always include:
1. **Who**: Speaker or source of the information
2. **What**: The specific fact or decision
3. **When**: Date/time context (if known)

### Example: Meeting Decision
```
add_dialogue(
  speaker: "Jeremy",
  content: "The DRPA cutover date has been moved to April 15, 2026 due to TransCore resource constraints.",
  timestamp: "2026-01-15"
)
finalize()
```

### Example: Action Item
```
add_dialogue(
  speaker: "Bryan",
  content: "Bryan committed to complete the VDOT IAG analysis by Friday January 24, 2026.",
  timestamp: "2026-01-20"
)
finalize()
```

### Example: Status Change
```
add_dialogue(
  speaker: "System",
  content: "TaskNote-DRPA-Review status changed from In Progress to Completed.",
  timestamp: "2026-01-20T15:30:00"
)
finalize()
```

## Querying Facts

Use `ask` for semantic questions that synthesize across memories:
```
ask("What decisions were made about DRPA in the last month?")
ask("What did Jeremy say about the timeline?")
ask("What action items are due this week?")
```

Use `search_memories` for raw retrieval when you need specific entries:
```
search_memories("DRPA cutover", top_k=5)
```

## Integration Points

### After Meeting Analysis
When extracting action items or decisions from meeting notes:
1. Extract facts with attribution and dates
2. Call `add_dialogue` for each fact
3. Call `finalize` to process

### After Task Creation
When creating TaskNotes or updating project status:
1. Record the status change with timestamp
2. Call `add_dialogue` with "System" as speaker
3. Call `finalize`

### Before Status Reports
When generating project status or timeline reports:
1. Query SimpleMem for recent project history
2. Use `ask` for synthesized timeline
3. Combine with OpenMemory for persistent context

## Best Practices

1. **Be specific with dates** - Include exact dates when known
2. **Include attribution** - Who said/decided/committed to what
3. **Use descriptive content** - Full context, not just keywords
4. **Finalize promptly** - Don't let buffer grow too large
5. **Prefer ask over search_memories** - Ask provides synthesis, search gives raw results
