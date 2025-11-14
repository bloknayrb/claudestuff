# Error Handling Protocols - Shared Infrastructure

Standard error handling patterns for all vault management skills.

## Overview

Robust error handling ensures skills gracefully handle edge cases, missing data, and unexpected conditions without failing completely. These protocols apply across all skills in the plugin.

## Error Categories

### 1. Missing Data Errors

**Scenario**: Expected files, folders, or metadata not found

**Handling**:
- Continue with available data
- Flag missing items in output
- Provide specific recommendations

**Example**:
```markdown
⚠️ Warning: Unable to read last sweep timestamp from Vault Sweep Log.md
→ Defaulting to 7-day scan window
→ Recommendation: Create log file at 99-System/Vault Sweep Log.md
```

---

### 2. Permission Errors

**Scenario**: Unable to read or access certain files/folders

**Handling**:
- Skip inaccessible items
- Log paths that failed
- Continue with accessible items
- Report summary at end

**Example**:
```markdown
⚠️ Access Denied: 3 files could not be read
- 01-Projects/DRPA/Confidential/file.md
- [... list others ...]
→ Continuing with accessible files
→ Recommendation: Check file permissions or exclusions
```

---

### 3. Format Errors

**Scenario**: YAML frontmatter malformed or missing expected fields

**Handling**:
- Parse what's readable
- Flag formatting issues
- Provide fix recommendations

**Example**:
```markdown
⚠️ YAML Parse Error: 03-Contacts/John Doe.md
→ Missing closing '---' in frontmatter
→ Recommendation: Add closing delimiter and re-run validation
→ Continuing with other files...
```

---

### 4. Threshold Exceeded Errors

**Scenario**: Too many files to process efficiently

**Handling**:
- Warn user about performance
- Suggest narrower scope or Deep Path
- Offer to continue or abort

**Example**:
```markdown
⚠️ Large Volume Detected: 5,432 files modified since last sweep
→ Quick Path designed for <50 files
→ Recommendation: Use Standard Path (300 files) or Deep Path (full scan)
→ Would you like to proceed with Standard Path? [Y/n]
```

---

### 5. Dependency Errors

**Scenario**: Required shared files or external resources unavailable

**Handling**:
- Check for required dependencies
- Provide clear error message
- Offer workaround if possible

**Example**:
```markdown
❌ Error: PowerShell not available
→ Required for temporal filtering (Pattern 1)
→ Current Platform: [detected-platform]
→ Recommendation: This plugin requires Windows with PowerShell
→ Alternative: Run Deep Path (no temporal filtering needed)
```

---

## Error Handling Patterns

### Pattern 1: Graceful Degradation

**Principle**: Partial success better than complete failure

**Implementation**:
```markdown
TRY:
  1. Attempt optimal path (Quick with temporal filter)
CATCH FileNotFound (last sweep log):
  2. Degrade to 7-day default window
  3. Warn user
  4. Continue processing
CATCH AccessDenied:
  5. Skip inaccessible files
  6. Log skipped items
  7. Continue with accessible
FINALLY:
  8. Report what was accomplished
  9. Report what was skipped
```

**Example Output**:
```markdown
# Vault Maintenance Report (Partial)
✓ Processed: 2,341 files
⚠️ Skipped: 12 files (access denied)
⚠️ Errors: 3 files (YAML parse errors)

See Errors section below for details.
```

---

### Pattern 2: Validation Before Processing

**Principle**: Check prerequisites before expensive operations

**Implementation**:
```markdown
BEFORE launching agents:
1. Validate vault path exists
2. Check for required permissions
3. Verify PowerShell available (Windows check)
4. Confirm file count within reasonable range
5. Test read access to sample files

IF validation fails:
  - Report specific issue
  - Suggest fix
  - Abort gracefully
ELSE:
  - Proceed with processing
```

**Example**:
```markdown
Validating prerequisites...
✓ Vault path exists
✓ Read permissions confirmed
✓ PowerShell available
⚠️ File count: 5,432 (recommend Standard or Deep Path)
→ Proceeding with user confirmation...
```

---

### Pattern 3: Fallback Strategies

**Principle**: Multiple approaches for critical operations

**Strategy Chain**:
```markdown
ATTEMPT 1: Read last sweep timestamp from log
  ↓ FAIL
ATTEMPT 2: Use file modification time of log
  ↓ FAIL
ATTEMPT 3: Default to 7-day window
  ↓ FAIL (no files found)
ATTEMPT 4: Prompt user for time range
  ↓ SUCCESS
PROCEED with processing
```

---

### Pattern 4: Error Accumulation

**Principle**: Don't stop at first error; collect all issues

**Implementation**:
```markdown
errors = []
warnings = []

FOR EACH file in scope:
  TRY:
    Process file
  CATCH Error:
    Add to errors[]
    Continue to next file

AFTER processing:
  IF errors.length > 0:
    Report all errors in dedicated section
  IF warnings.length > 0:
    Report all warnings
```

**Example Output**:
```markdown
## Errors Encountered (3)

### YAML Parse Errors (2 files)
- 03-Contacts/Jane Smith.md: Missing closing ---
- 01-Projects/DRPA/note.md: Invalid date format in created field

### Access Denied (1 file)
- 01-Projects/Confidential/secret.md: Insufficient permissions

## Warnings (5)

[... list warnings ...]
```

---

## Skill-Specific Error Handling

### Vault-Sweeping Skill

**Common Errors**:
- Missing Type property (expected for validation)
- Folder structure doesn't exist (project moved/deleted)
- YAML frontmatter incomplete
- File referenced in wikilinks doesn't exist

**Handling**:
- Type property missing → Flag as "No Type property" (not error)
- Folder missing → Flag as "Orphaned file" (Critical)
- YAML incomplete → Flag per field (Important)
- Broken wikilink → Flag as "Broken link" (Important)

---

### Email-Triaging Skill

**Common Errors**:
- Email folder empty (no emails in time window)
- Unable to parse date from filename
- Tags missing or malformed

**Handling**:
- Empty result → "No emails found in [window]" (informational)
- Date parse error → Use file modification time (warning)
- Tags missing → Flag as "Needs tagging" (recommendation)

---

### Update-Tracking Skill

**Common Errors**:
- Overlap with /track items (boundary violation)
- External source unavailable (Teams, SharePoint)
- Status update can't be determined

**Handling**:
- Overlap detected → Defer to /track, exclude from this skill
- External source down → Skip that source, note in report
- Unclear status → Flag as "Manual review needed"

---

### Timesheet-Generation Skill

**Common Errors**:
- ICS calendar event missing date
- Task effort estimate missing
- Date preservation failure (day-shifting bug)
- Time gaps >4 hours

**Handling**:
- Missing date → Critical error, abort that entry
- Missing effort → Use default estimate (warning)
- Day-shifting → Validate dates strictly, fail if detected
- Time gaps → Flag for manual review

---

## Error Reporting Format

### Critical Errors (Processing Stopped)

```markdown
❌ CRITICAL ERROR: [Error description]

**Context**: [What was being attempted]
**Cause**: [Why it failed]
**Impact**: Processing aborted for [scope]

**Recommendation**: [Specific fix steps]

**Workaround**: [Alternative approach if available]
```

### Warnings (Processing Continued)

```markdown
⚠️ WARNING: [Issue description]

**Context**: [What was affected]
**Action Taken**: [How it was handled]
**Recommendation**: [How to prevent in future]
```

### Informational

```markdown
ℹ️ INFO: [Observation]

**Details**: [Additional context]
```

---

## Error Recovery Procedures

### Recovery 1: Restart with Different Path

```markdown
IF Quick Path fails (too many files):
  → Suggest Standard Path
IF Standard Path fails (timeout or too complex):
  → Suggest Deep Path with time warning
```

### Recovery 2: Manual Intervention

```markdown
IF automatic classification fails:
  → Flag items for manual categorization
  → Provide classification guidance
  → Continue with classifiable items
```

### Recovery 3: Partial Results

```markdown
IF processing incomplete:
  → Report what WAS completed
  → Clearly mark what was SKIPPED
  → Provide path to retry just skipped items
```

---

## Testing Error Conditions

### Test Scenarios

1. **Missing log file**: Delete Vault Sweep Log.md, run sweep
2. **Permission denied**: Create read-protected file, include in scan
3. **Malformed YAML**: Create file with broken frontmatter
4. **Empty folder**: Run on folder with no matching files
5. **Huge volume**: Attempt Quick Path with >1000 files
6. **Broken wikilinks**: Create links to non-existent files
7. **Missing Type property**: File without Type field
8. **Date parse failure**: Filename with invalid date format

### Expected Behavior

Each scenario should:
- Not crash the skill
- Provide clear error message
- Continue processing what's possible
- Report summary of issues
- Suggest remediation

---

## Error Logging

### Log Format

Store detailed errors in: `99-System/Claude-Error-Log.md`

```markdown
## [Timestamp] - [Skill Name] Error

**Error Type**: [Category]
**Severity**: [Critical/Warning/Info]
**Context**: [What was being done]
**Details**: [Error specifics]
**Resolution**: [How it was handled]
**User Action**: [What user should do, if any]

---
```

### When to Log

- Critical errors that stop processing
- Repeated warnings (>5 of same type)
- Unexpected conditions
- Performance issues (timeout, memory)

### Log Rotation

- Keep last 30 days of logs
- Archive older logs to 99-System/Archives/
- Summarize patterns monthly

---

## Best Practices

1. **Fail Gracefully**: Partial success > complete failure
2. **Be Specific**: "File X missing field Y" > "Error"
3. **Provide Context**: Why did it fail? What was attempted?
4. **Offer Solutions**: Always include recommendation
5. **Continue When Possible**: Don't stop at first error
6. **Report Completely**: Show what worked AND what didn't
7. **Log Appropriately**: Track patterns without noise

---

## Integration with Skills

Skills reference this file for error handling patterns:

```markdown
## Error Handling

See shared/error-handling.md for standard protocols.

**This skill uses**:
- Pattern 1: Graceful Degradation
- Pattern 2: Validation Before Processing
- Pattern 4: Error Accumulation

**Skill-specific errors**: [documented in skill]
```

---

This infrastructure ensures consistent, user-friendly error handling across all vault management skills.