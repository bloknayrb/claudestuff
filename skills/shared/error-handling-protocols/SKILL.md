---
name: error-handling-protocols
description: Standard error handling patterns for Claude Code commands - graceful failures, clear messages, recovery guidance
version: 1.0.0
tags: [error-handling, patterns, reliability]
---

# Error Handling Protocols

## Overview

Standard error handling patterns for custom commands. Ensures consistent behavior, helpful error messages, and graceful degradation.

## General Principles

1. **Fail gracefully**: Partial results better than no results
2. **Be explicit**: Clear error messages with actionable guidance
3. **Log failures**: Document what went wrong for troubleshooting
4. **Suggest recovery**: Tell user what to do next
5. **Validate early**: Check prerequisites before expensive operations

## State File Errors

### Missing State File

**Error Condition**: Command requires state file but file doesn't exist.

**Response**:
```markdown
⚠️ **State file not found**: `[filepath]`

This command requires up-to-date state data. Please run the prerequisite command first, then re-run this command.
```

**Handling**:
- Do NOT proceed with command execution
- Exit with helpful message
- Do NOT attempt to create state file (wrong tool's responsibility)

### Stale State File

**Error Condition**: State file exists but last update was >7 days ago.

**Response**:
```markdown
⚠️ **Stale state data**: `[filepath]` last updated [date] ([N] days ago)

State data may be outdated. Recommend running the update command to refresh.

Proceeding with current data, but results may be incomplete.
```

**Handling**:
- Issue warning but continue execution
- Flag results as potentially stale
- Recommend refresh in output

### Corrupted State File

**Error Condition**: State file exists but JSON parsing fails or structure is invalid.

**Response**:
```markdown
❌ **State file corrupted**: `[filepath]`

Cannot parse state data. This may indicate:
- Manual edit introduced syntax errors
- Write operation was interrupted
- File encoding issue

**Recovery**:
1. Backup current file (if any valuable data)
2. Delete corrupted file
3. Run the regeneration command

Details: [specific parsing error]
```

**Handling**:
- Do NOT proceed with command
- Provide specific parsing error for debugging
- Clear recovery steps

## File System Errors

### Path Not Found

**Error Condition**: Target folder doesn't exist.

**Response**:
```markdown
❌ **Path not found**: `[path]`

Expected directory doesn't exist. This may indicate:
- Directory structure has changed
- Command is running from wrong directory
- Folder hasn't been created yet

**Current directory**: [show pwd]
**Expected path**: [show absolute path]

Please verify directory structure.
```

**Handling**:
- Do NOT create missing directories (may be wrong location)
- Show context to help user diagnose
- Exit command

### Permission Denied

**Error Condition**: Cannot read/write file due to permissions.

**Response**:
```markdown
❌ **Permission denied**: `[filepath]`

Cannot access file due to permissions. Please check:
- File is not open in another application
- You have read/write permissions
- File is not set to read-only
- Sync service is not locking file

Try closing other apps accessing the file, then retry.
```

## PowerShell Errors

### PowerShell Not Available

**Error Condition**: PowerShell command fails or not found.

**Response**:
```markdown
❌ **PowerShell not available**

This command requires PowerShell for reliable file filtering.

**Fallback**: Proceeding with full folder scan (slower but reliable).

If PowerShell should be available, please check:
- Running on Windows (PowerShell required)
- PowerShell not blocked by security policy
- Command prompt has access to PowerShell
```

**Handling**:
- Fall back to full scan without temporal filtering
- Log fallback usage
- Continue with command (degraded performance)

### PowerShell Filter Returns Zero Results

**Error Condition**: Timestamp filter returns 0 files, but files likely exist.

**Response**:
```markdown
⚠️ **Suspicious filter result**: PowerShell returned 0 files

Expected files in `[path]` modified since [timestamp], but filter returned nothing.

**Fallback**: Running full folder scan to ensure no items missed.

This may indicate:
- Timestamp filter is too recent
- Path escaping issue
- Datetime parsing error

Proceeding with full scan (better safe than sorry).
```

**Handling**:
- Immediately fall back to full scan
- Log occurrence for pattern detection
- Continue execution

## Agent Errors

### Agent Timeout

**Error Condition**: Task agent doesn't complete within 120 seconds.

**Response**:
```markdown
⚠️ **Agent timeout**: Agent [N] ([name]) didn't complete within 120 seconds

**Impact**: [Describe what data source is missing]

Proceeding with results from [M] other agents. Recommend manual review of:
- [Specific area this agent was scanning]
- [Potential missing information]

If this persists, the scanning scope may need adjustment.
```

**Handling**:
- Continue with available agent results
- Flag incomplete data in output
- Reduce confidence score if critical agent
- Recommend manual spot-check

### Agent Failure

**Error Condition**: Task agent returns error or fails to execute.

**Response**:
```markdown
⚠️ **Agent failure**: Agent [N] ([name]) encountered an error

**Error**: [agent error message]

Proceeding with results from [M] other agents.

**Affected scope**: [describe what wasn't scanned]
**Recommendation**: Manual review of [specific area]
```

**Handling**:
- Continue with available results
- Document which data source failed
- Lower confidence if critical agent
- Consider retry for critical agents only

### Insufficient Agent Results

**Error Condition**: <70% of agents succeeded.

**Response**:
```markdown
❌ **Insufficient data**: Only [N] of [M] agents completed successfully

This falls below the 70% confidence threshold. Results would be incomplete and unreliable.

**Failed agents**:
- Agent [X]: [error]
- Agent [Y]: [error]

**Recommendation**:
1. Check for permission issues
2. Verify paths in command configuration
3. Re-run command
4. If issue persists, check error recovery documentation

Not proceeding with synthesis due to low confidence.
```

**Handling**:
- Do NOT proceed with synthesis
- Document all failures
- Provide troubleshooting guidance
- Exit command

## Data Validation Errors

### Missing Required Property

**Error Condition**: File is missing required metadata property.

**Response**: (Log, don't fail command)
```markdown
⚠️ Skipped file with missing property: `[filepath]`
- Missing: [property name]
- File type: [inferred from location]
- Recommend: Run maintenance command to identify and fix issues
```

**Handling**:
- Skip this file
- Continue processing other files
- Include in output summary ("N files skipped due to missing properties")
- Don't fail entire command

### Invalid Date Format

**Error Condition**: Date in file can't be parsed.

**Response**: (Log, don't fail command)
```markdown
⚠️ Invalid date format in `[filepath]`: "[date string]"
- Property: [property name]
- Expected format: ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
- File included but date may be missing from results
```

**Handling**:
- Include file in results
- Skip date-based filtering for this file
- Flag file for manual correction
- Continue processing

## Output Generation Errors

### Confidence Score Too Low

**Error Condition**: Data quality issues reduce confidence below acceptable threshold.

**Response**:
```markdown
⚠️ **Low confidence**: Results may be incomplete

**Confidence score**: [X]% (threshold: 70%)

**Issues detected**:
- [Issue 1]: [description]
- [Issue 2]: [description]

Proceeding with output but **recommend manual verification** of:
- [Specific areas to double-check]
- [Known gaps in data]
```

**Handling**:
- Proceed with output generation
- Clearly flag low confidence
- Specific areas needing manual review
- Don't hide data quality issues

## Integration with Commands

Commands should reference error protocols:

```markdown
## Error Handling
See error-handling-protocols skill for standard responses.

**Command-Specific Errors**:
- [Any unique error conditions for this command]
- [Special handling requirements]
```

## Logging Best Practices

### What to Log
- Path resolution issues
- Filter fallbacks
- Agent timeouts/failures
- Missing/invalid properties
- State file staleness
- Confidence score reductions

### What NOT to Log
- Normal file processing (would spam output)
- Successful agent completions
- Valid parsing
- Expected empty results

### Log Format
```markdown
[TIMESTAMP] [LEVEL] [COMPONENT]: [MESSAGE]

Example:
2025-11-02T14:23:45 WARN Filter: Fallback to full scan for Tasks/
2025-11-02T14:23:50 ERROR Agent-3: Timeout scanning emails
2025-11-02T14:24:00 INFO Output: Generated with 85% confidence
```

Include logs in command output or separate log section for troubleshooting.
