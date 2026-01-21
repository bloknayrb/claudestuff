---
name: semantic-search
description: "Performs semantic search across the Obsidian vault using model embeddings to find conceptually related content. Use proactively when: (1) Searching for toll-related concepts like IAG, NIOP, CSC, interoperability, transaction patterns, (2) Finding related meeting notes, emails, or documentation across projects, (3) Discovering content that uses different terminology for the same concept, (4) User asks questions about topics that might span multiple files"
version: 1.0.0
tags: [search, semantic, embeddings, obsidian]
allowed-tools: Bash(python:*), Read
---

# Semantic Search

Find conceptually related content across the vault using model embeddings, beyond simple keyword matching.

## When to Use Proactively

**Use semantic search when:**
- User asks about a topic that might be documented across multiple files
- Looking for related meeting notes, emails, or project documents
- Searching for toll industry concepts (acronyms auto-expand)
- Need to find content using different terminology for same concept

**Don't use for:**
- Simple file lookups (use Glob instead)
- Exact text matching (use Grep instead)
- Single known file reads (use Read instead)

## Quick Usage

```bash
# Search a specific client's projects
python ~/Tools/semantic_search.py "query" "./01-Projects/DRPA" --top-k 5

# Search all projects
python ~/Tools/semantic_search.py "interoperability issues" "./01-Projects" --top-k 10

# Search with more context lines
python ~/Tools/semantic_search.py "transaction rejection" "./01-Projects" --top-k 5 --n-lines 15

# Disable toll term expansion (for literal searches)
python ~/Tools/semantic_search.py "IAG" "./01-Projects" --no-expand
```

## Search Paths by Topic

| Topic | Path |
|-------|------|
| DRPA projects | `./01-Projects/DRPA` |
| VDOT projects | `./01-Projects/VDOT` |
| DelDOT projects | `./01-Projects/DelDOT` |
| MDTA projects | `./01-Projects/MDTA` |
| All client projects | `./01-Projects` |
| Emails | `./Emails` |
| Full vault | `.` |

## Options

| Option | Description |
|--------|-------------|
| `--top-k N` | Number of results (default: 5) |
| `--n-lines N` | Context lines per result (default: 10) |
| `--rebuild` | Force cache rebuild |
| `--stats` | Show cache statistics |
| `--no-expand` | Disable toll terminology expansion |
| `--no-cache` | Disable caching |

## Toll Terminology Expansion

The tool automatically expands these terms for better semantic matching:
- **Acronyms**: IAG, NIOP, CSC, ETC, ATC, OBU, RSU, ALPR, LPR, VToll, AET, OTC, BOS, HOST, ICD, SDD, SDDD, RTM
- **Agencies**: VDOT, DRPA, MDTA, DelDOT, NJTA, NTTA, TransCore, Conduent
- **Transaction types**: AVI, violation, rejection, posting, settlement, reciprocity

Use `--no-expand` to search literally without expansion.

## Performance

- First search: ~12 seconds (indexes files)
- Subsequent: ~3-4 seconds (uses cached embeddings)
- Cache auto-updates when files change
- Cache location: `~/.cache/semantic_search/indexes/`

## Cache Management

```bash
# Show cache stats for a directory
python ~/Tools/semantic_search.py --stats "./01-Projects/VDOT"

# Force rebuild cache
python ~/Tools/semantic_search.py "query" "./01-Projects" --rebuild

# Clear cache for a directory
python ~/Tools/semantic_search.py --clear "./01-Projects/VDOT"
```

## Result Interpretation

Results show:
- **Similarity score** [0.0-1.0]: Higher is more relevant
- **File path**: Location of matching file
- **Context-aware snippet**: Most relevant section (not just file start)

Scores above 0.4 are typically good matches; above 0.6 are strong matches.
