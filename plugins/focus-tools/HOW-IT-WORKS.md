# How /sos Works

A deep dive into the executive function support pattern.

## The Problem

Executive function challenges (ADHD, overwhelm, decision fatigue) create a paradox:
- You need to pick a task to make progress
- But picking a task requires the executive function that's failing
- Result: paralysis

Traditional task management makes this worse by showing more options.

## The Solution: Constrained Output

`/sos` deliberately limits what it shows you:

| Traditional | /sos |
|-------------|------|
| Full task list | ONE task |
| Multiple options | ONE recommendation |
| Comprehensive overview | Minimal context |
| "You could..." | "Do this." |

## The 5-Step Framework

### Step 1: Quick State Check (30 seconds max)

**What it does:**
- Reads the state file for current tasks
- Checks for urgent/critical items
- Notes any stated priorities

**What it deliberately skips:**
- Deep scanning
- Processing new emails
- Running comprehensive tracking
- Any operation that takes time

**Why speed matters:** When executive function is failing, every second of waiting is a chance to lose momentum.

### Step 2: Identify THE ONE Thing

**Priority Filter** (stop at first match):

```
1. On fire     → Due TODAY or meeting in next 2 hours
2. Priority    → Most recent stated priority from manager/stakeholder
3. Oldest      → Longest overdue (quick win to clear mental load)
4. Smallest    → If everything feels heavy, find the 5-minute task
```

**Critical rule:** Pick ONE. Not two. ONE.

The filter is designed to remove decision-making entirely. It's deterministic - given the same state, it picks the same task.

### Step 3: Break It Down

Transform vague tasks into **smallest possible first physical action**:

| Vague | Specific |
|-------|----------|
| "Work on the review" | "Open the file and read the first section" |
| "Respond to email" | "Open the email and type the first sentence" |
| "Finish the analysis" | "Open the spreadsheet and look at row 1" |

**Rule:** The action should take less than 2 minutes to START.

This removes the "where do I even begin?" barrier.

### Step 4: Output Format

```
🆘 SOS MODE

Right now, do this ONE thing:
→ [Specific action with exact file/link if applicable]

Why this one: [One sentence - the reason this is the priority]

First tiny step: [The 2-minute starter action]

When you've done that, say "done" or "next" and I'll give you the next step.
```

**Design decisions:**
- 🆘 emoji creates visual anchor
- "Right now" emphasizes immediacy
- Arrow (→) draws eye to action
- "Why this one" provides minimal justification (important for trust)
- "First tiny step" reduces perceived effort
- Call-to-action at end ("say done or next") creates clear next step

### Step 5: Follow-Up Loop

**"done" or "next":**
- Acknowledge briefly ("Good. Next:")
- Give next small step for same task
- Continue until task complete

**"stuck" or "can't":**
- No judgment - just pivot
- Find even smaller step, OR
- Switch to different quick-win task

**"break":**
- Acknowledge ("Taking 5. I'll be here.")
- Wait for return
- Don't lose context

## Key Design Decisions

### Why No Options?

Options feel helpful but add cognitive load. When executive function is failing:
- Each option requires evaluation
- Evaluation requires the executive function that's missing
- More options = more paralysis

### Why Minimal Context?

Context feels helpful but adds overwhelm:
- "You have 47 tasks" triggers anxiety
- "Here's what's overdue" creates shame
- "Consider these factors" adds decisions

Instead: Just the next action.

### Why Warm But Direct?

The tone is intentional:
- **Direct**: No hedging, no "you might want to..."
- **Warm**: Acknowledging that calling /sos took effort
- **Zero fluff**: Every word earns its place

### Why "Done/Next" Instead of Task Complete?

Traditional: Complete whole task, then celebrate
/sos: Complete tiny step, get immediate next step

This creates:
- Faster feedback loops
- More frequent small wins
- Sustained momentum
- Less chance of getting lost mid-task

## What /sos Is NOT

- **Not /track** - No comprehensive scanning
- **Not a standup** - No summaries or planning
- **Not a task manager** - No lists, no organization
- **Not therapy** - Not addressing root causes

/sos is a **focus tool**. One thing. Next step. Go.

## Adapting This Pattern

If building your own executive function support:

1. **Keep it fast** - Speed is critical when executive function is failing
2. **Make decisions** - Don't offload choices to the user
3. **Constrain output** - Less is more
4. **Create momentum** - Small steps, frequent acknowledgment
5. **Handle failure gracefully** - "Stuck" needs a path forward, not judgment

## Technical Notes

### State File Structure Expected

The command expects a state file with:
- Task titles and descriptions
- Due dates
- Priority markers or tags
- Status (to filter completed tasks)

### Customization Points

If adapting for your setup:
1. `Step 1`: Change state file path
2. `Step 2`: Adjust priority filter for your task format
3. `Step 3`: Update example file paths in prompts
4. `Step 5`: Modify follow-up keywords if desired
