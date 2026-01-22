# Professional Agents Plugin

Role-based agents for software development, consulting, and domain expertise. These agents provide specialized personas with appropriate expertise, tools, and response styles.

> **Design Philosophy**: Each agent has a clear domain, triggering conditions, and recommended model. Claude proactively invokes these agents based on task context.

## Agents

| Agent | Model | Domain |
|-------|-------|--------|
| Developer | sonnet | Code implementation, debugging, feature development |
| Tech Lead | sonnet | Architecture decisions, technical planning |
| Product Owner | sonnet | Requirements analysis, user stories |
| UX Designer | sonnet | Interface design, user experience |
| QA Reviewer | haiku | Code quality, security analysis |
| Researcher | sonnet | Technology research, competitive analysis |
| Strategic PM | sonnet | Project planning, delivery risk |
| Toll Consultant | sonnet | Tolling operations and systems |
| Toll Procurement | sonnet | RFP development, vendor evaluation |
| DOCX Editor | sonnet | Word document XML manipulation |

## Agent Details

### Developer
**Use for**: Code implementation, feature development, debugging, refactoring

**Triggering conditions**:
- User asks to write or implement code
- Bug fixing or debugging requested
- Code refactoring tasks

**Tools**: read, write, bash

### Tech Lead
**Use for**: Architecture decisions, technology stack selection, system design

**Triggering conditions**:
- Evaluating technical approaches
- Making architecture decisions
- Implementation planning

**Tools**: read, write, bash

### Product Owner
**Use for**: User story analysis, requirements clarification, feature prioritization

**Triggering conditions**:
- Analyzing requirements or user stories
- Acceptance criteria review
- Stakeholder requirement translation

**Tools**: read, write

### UX Designer
**Use for**: Interface design, UX flows, design systems, accessibility

**Triggering conditions**:
- UI design decisions
- User journey mapping
- Design pattern selection

**Tools**: read, write, web_search

### QA Reviewer
**Use for**: Code quality review, security analysis, bug detection

**Model**: haiku (fast, focused reviews)

**Triggering conditions**:
- Reviewing existing code
- Analyzing code quality
- Security vulnerability detection

**Tools**: read

### Researcher
**Use for**: Technology research, competitive analysis, best practices

**Triggering conditions**:
- Research, compare, or investigate requests
- Framework comparisons
- Market analysis

**Tools**: read, write, web_search, web_fetch

### Strategic PM
**Use for**: Project planning, sprint planning, delivery risk assessment

**Triggering conditions**:
- Project timelines
- Team capacity planning
- Delivery planning

**Tools**: read, write

### Toll Consultant
**Use for**: Tolling operations, CSC systems, interoperability, enforcement

**Triggering conditions**:
- Toll road planning
- Electronic toll collection
- Regulatory frameworks

**Domain expertise**:
- CSC and roadside systems
- Revenue operations
- ETC interoperability (IAG, NIOP)
- Enforcement models

### Toll Procurement Consultant
**Use for**: RFP development, vendor evaluation, proposal analysis

**Triggering conditions**:
- Procurement planning
- Vendor selection
- Contract negotiation

**Domain expertise**:
- Technical requirements development
- Evaluation criteria
- Pricing models

### DOCX Editor
**Use for**: Word document XML structure manipulation

**Triggering conditions**:
- Working with unpacked .docx files
- Direct XML editing of Word documents
- Preserving formatting while editing content

**Tools**: All tools

## Proactive Invocation

These agents are designed to be invoked **proactively** - Claude should use them automatically based on task context, not just when explicitly requested.

**Example**: When a user asks "Help me implement a user authentication feature", Claude should automatically invoke the Developer agent.

## File Structure

```
professional-agents/
├── .claude-plugin/
│   └── plugin.json
└── agents/
    ├── developer.md
    ├── tech-lead.md
    ├── product-owner.md
    ├── ux-designer.md
    ├── qa-reviewer.md
    ├── researcher.md
    ├── strategic-pm.md
    ├── toll-consultant.md
    ├── toll-procurement-consultant.md
    └── docx-editor.md
```

## Agent Definition Format

```markdown
---
name: agent-name
description: When and why to use this agent
model: sonnet|opus|haiku
tools: [list, of, tools]
---

# Agent Name

## System Prompt

[The persona, expertise, and behavior instructions]

## Triggering Conditions

[When Claude should invoke this agent]

## Examples

[Sample interactions showing appropriate use]
```

## Customization

To adapt these agents:

1. **Add domain expertise** - Include industry-specific knowledge
2. **Adjust model selection** - haiku for speed, opus for complexity
3. **Modify tool access** - Restrict or expand based on use case
4. **Update triggering conditions** - Match your workflow patterns

## Complexity Rating

| Aspect | Rating | Notes |
|--------|--------|-------|
| Setup Difficulty | Low | No dependencies, just agent definitions |
| Customization Needed | Medium | Toll consultants are domain-specific |
| Value as Reference | High | Shows agent design patterns |
