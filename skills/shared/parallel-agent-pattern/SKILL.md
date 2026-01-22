---
name: parallel-agent-pattern
description: Architectural pattern for deploying multiple Claude Code agents simultaneously for comprehensive analysis
version: 1.0.0
tags: [architecture, agents, performance, patterns]
---

# Parallel Agent Deployment Pattern

## Overview

Commands requiring comprehensive analysis should use parallel agent deployment for optimal performance. Launch 3-6 specialized agents simultaneously, then synthesize results.

## Standard Architecture

### Deployment Strategy

**Critical**: Launch ALL agents in a SINGLE message using multiple Task tool calls. Do not wait for agents sequentially.

```markdown
Launch agents in parallel:
1. Agent 1: [Specific scanning task]
2. Agent 2: [Specific scanning task]
3. Agent 3: [Specific scanning task]
4. Agent 4: [Specific scanning task]
5. Agent 5: [Optional - for complex commands]
6. Agent 6: [Optional - for complex commands]
```

### Agent Specification Template

Use this compact format for each agent:

```markdown
#### Agent N: [Descriptive Name]
**Subagent Type**: `general-purpose`
**Task Prompt**:
```
MISSION: [1-2 sentence description of what this agent must accomplish]

SCOPE: [3-5 bullet points defining boundaries]
- Data source: [specific folders/files]
- Time range: [if applicable]
- Filter criteria: [tags, statuses, etc.]

SEARCH CRITERIA:
[Bullet list of specific patterns or keywords to find]

OUTPUT FORMAT:
[2-3 lines describing expected return structure]
```
```

## Execution Workflow

### Phase 1: Parallel Launch
- Launch all agents in single message
- Each agent operates independently
- No sequential dependencies
- Timeout: 120 seconds per agent

### Phase 2: Result Collection
- Gather results as agents complete
- Handle partial failures gracefully
- Minimum 70% confidence threshold
- Flag missing data sources for manual review

### Phase 3: Synthesis
- Cross-reference findings across agents
- Eliminate duplicates
- Apply prioritization logic
- Generate unified output

## Agent Types by Use Case

### Scanning Commands (5-6 agents)
Typical agent distribution for comprehensive scanning:

1. **Active Items Scanner** - Tasks by status
2. **Recent Notes Scanner** - Recent action items
3. **Communication Scanner** - Commitments and priorities
4. **Project Context** - Project-specific documents
5. **History Scanner** - Relevant background
6. **Deep Research** - Optional detailed context

### Triage Commands (3-4 agents)
For focused analysis with faster turnaround:

1. **Priority Classifier** - Urgency/importance assessment
2. **Context Assembler** - Related information gathering
3. **Trend Analyzer** - Pattern detection
4. **Recommendation Generator** - Next actions

### Maintenance Commands (4-5 agents)
For system organization and cleanup:

1. **Consistency Checker** - Tag validation, format compliance
2. **Duplicate Detector** - Redundant content identification
3. **Archive Auditor** - Old/stale content detection
4. **Link Validator** - Broken references
5. **Template Compliance** - Metadata validation

## Error Handling

### Agent Failure Protocol
If agent fails to complete:
1. Continue with available results
2. Flag missing data source in output
3. Recommend manual review of that area
4. Include confidence score in synthesis

### Timeout Handling
- Set 120-second timeout per agent
- Partial results better than no results
- Document incomplete scans in output

### Minimum Viability
- Require 70% of agents to succeed
- Below threshold: Alert user, request re-run
- Critical agents: Mandatory for command execution

## Performance Optimization

### Agent Design Tips
1. **Narrow scope**: Specific folders/date ranges
2. **Clear criteria**: Explicit search patterns
3. **Structured output**: Parseable format
4. **Minimal overlap**: Each agent owns distinct domain

### When to Use Parallel Agents
- ✅ Comprehensive scanning of multiple sources
- ✅ Multiple independent data sources
- ✅ Complex analysis requiring different perspectives
- ✅ Time-sensitive commands needing speed

### When NOT to Use
- ❌ Single data source queries
- ❌ Sequential operations (each depends on previous)
- ❌ Simple display/formatting tasks
- ❌ Reading existing state files

## Integration Example

Commands should reference this pattern:

```markdown
## Parallel Agent Architecture
See parallel-agent-pattern skill for deployment strategy.

**Agent Configuration**: [N] agents scanning [describe domains]
```

Then specify:
- Number of agents needed
- Agent-specific missions/scopes
- Special cross-referencing requirements
- Command-specific synthesis logic

## Example: 5-Agent Task Tracking Scan

```markdown
#### Agent 1: Active Tasks
**Mission**: Scan task folder for open/in-progress items
**Scope**: Status ≠ Done/Cancelled, all projects
**Output**: Task title, status, priority, due date, project

#### Agent 2: Meeting Action Items
**Mission**: Extract action items from meeting notes (last 30 days)
**Scope**: "ACTION ITEMS" sections, user assignee
**Output**: Action description, source meeting, date assigned

#### Agent 3: Email Commitments
**Mission**: Identify commitments in sent emails
**Scope**: Sent emails (last 14 days), commitment language patterns
**Output**: Commitment text, recipient, date, project

#### Agent 4: Dependencies Tracking
**Mission**: Find items assigned to others where user needs output
**Scope**: Meeting actions (non-user), "needs output" indicators
**Output**: Assignee, dependency description, required by date

#### Agent 5: Background Context
**Mission**: Gather relevant project status from recent documents
**Scope**: Project folders, Documents subfolders (last 7 days)
**Output**: Key updates, decisions, blockers by project
```

This configuration provides comprehensive coverage while minimizing overlap and maintaining clear agent boundaries.
