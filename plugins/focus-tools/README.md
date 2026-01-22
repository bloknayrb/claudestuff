# Focus Tools Plugin

Executive function support for getting unstuck - cut through overwhelm and identify ONE next action.

> **Reference Implementation**: This plugin showcases a pattern for executive function support. It expects a specific state file structure. Study the pattern, adapt for your needs.

## What This Does

When you're overwhelmed and can't figure out what to do next, `/sos` cuts through the noise:

1. **Quick state check** - Reads current task state (30 seconds max)
2. **Identifies THE ONE thing** - Applies a priority filter, picks ONE task
3. **Breaks it down** - Smallest possible first action
4. **Guides you through** - Step by step until done

## The Philosophy

This isn't a task manager. It's a **focus tool** for moments when executive function is failing.

**Core principles:**
- No overwhelm - never shows full task lists
- No options - makes the decision for you
- No judgment - calling `/sos` takes effort, honor it
- Momentum > perfection - a mediocre task done beats paralysis
- Small wins compound - each step builds momentum

## Components

| Type | Name | Description |
|------|------|-------------|
| Command | `/sos` | Activates SOS mode for immediate focus support |
| Skill | executive-function-support | The framework and principles behind the approach |

## Usage

```
/sos
```

**Output:**
```
🆘 SOS MODE

Right now, do this ONE thing:
→ [Specific action with exact file/link]

Why this one: [One sentence reason]

First tiny step: [2-minute starter action]

When you've done that, say "done" or "next" and I'll give you the next step.
```

**Follow-up commands:**
- `done` or `next` - Get the next step
- `stuck` or `can't` - Pivot to smaller step or different task
- `break` - Take a break, Claude waits

## Requirements

This plugin expects:

1. **State file** - A file containing current task state (the plugin looks for `Claude-State-Tracking.md` in a `99-System/` folder)
2. **Task data** - Tasks with due dates, priorities, and status
3. **Priority markers** - `#urgent` tags or overdue dates for priority detection

### Adapting for Your Setup

If you don't have this exact structure, you'll need to modify `commands/sos.md`:

1. Change the state file path to your task source
2. Adjust the priority filter logic for your task format
3. Update file references in examples

## How It Works

See [HOW-IT-WORKS.md](HOW-IT-WORKS.md) for a deep dive into:
- The 5-step framework
- Priority filter logic
- Follow-up loop handling
- Design decisions

## Why This Pattern Is Valuable

Even if you don't use this exact implementation, the pattern is worth studying:

1. **Constrained output** - SOS mode deliberately limits information
2. **Decision-making for user** - Removes choice paralysis
3. **Iterative guidance** - Step-by-step rather than all-at-once
4. **Graceful pivoting** - Handles "stuck" and "can't" without judgment
5. **Tone awareness** - Direct, warm, zero fluff

## Complexity Rating

| Aspect | Rating | Notes |
|--------|--------|-------|
| Setup Difficulty | Medium | Needs task state file structure |
| Customization Needed | Medium | Paths and priority logic may need adjustment |
| Value as Reference | High | Executive function support is broadly applicable |

## Related

- **executive-function-support skill** - The principles and framework
- **parallel-agent-pattern** - What `/sos` deliberately avoids (comprehensive scanning)
