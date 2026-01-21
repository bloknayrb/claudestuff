# SimpleMem Memory Plugin

A Claude Code plugin that integrates SimpleMem for project-specific temporal memory storage. This complements OpenMemory by focusing on facts with date/time context rather than persistent preferences.

## Purpose

SimpleMem stores **temporal, project-specific facts**:
- Meeting decisions with specific dates
- Action item commitments
- Project deadlines and milestones
- Status change history

OpenMemory continues to handle **persistent, personal context**:
- User preferences
- Working style
- Lessons learned
- Communication patterns

## Prerequisites

1. **Ollama** running locally with `qwen3-embedding:0.6b` model
2. **Node.js** v18+
3. **Python** 3.11+

## Installation

The plugin expects SimpleMem to be installed at:
- SimpleMem core: `C:\Users\bkolb\Tools\SimpleMem`
- SimpleMem-MCP: `C:\Users\bkolb\Tools\SimpleMem-MCP`

## MCP Tools

| Tool | Purpose |
|------|---------|
| `add_dialogue` | Store single fact with speaker/content/timestamp |
| `add_dialogues` | Batch store multiple facts |
| `finalize` | Process buffer into searchable memory (REQUIRED) |
| `ask` | Semantic query with synthesis |
| `search_memories` | Raw semantic/keyword search |
| `get_all_memories` | Debug: export all memories |
| `clear_memories` | CAUTION: wipe database |

## Workflow

```
1. Store facts: add_dialogue(speaker, content, timestamp?)
2. Repeat as needed
3. ALWAYS finalize() to process into memory
4. Query with ask() or search_memories()
```

## Example

```
# Store a meeting decision
add_dialogue("Jeremy", "DRPA cutover moved to April 15", "2026-01-15")
finalize()

# Query later
ask("When is the DRPA cutover?")
```

## Architecture

- **SimpleMem Core**: Python library with LanceDB for vector storage
- **SimpleMem-MCP**: Node.js MCP server wrapper
- **Ollama**: Local embedding generation (no HuggingFace download needed)
