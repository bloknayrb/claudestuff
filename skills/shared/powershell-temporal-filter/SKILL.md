---
name: powershell-temporal-filter
description: Standard PowerShell patterns for reliable timestamp-based file filtering on Windows
version: 1.0.0
tags: [windows, powershell, filtering, patterns]
---

# PowerShell Temporal Filtering Standard

## Critical Requirement

**ALWAYS use PowerShell for timestamp-based file filtering on Windows. NEVER use CMD commands.**

## Standard Implementation

### Correct Pattern (Use This)
```powershell
powershell -Command "Get-ChildItem 'path/*.md' | Where-Object {$_.LastWriteTime -ge [datetime]'$timestamp'} | Select-Object FullName, LastWriteTime"
```

### Anti-Pattern (Never Use)
```cmd
cmd /c "dir /T:W path/*.md | findstr '2025-10'"
```

## Why This Matters

**CMD Failures**:
- Date filtering fails silently with unpredictable results
- Region-dependent date formatting causes mismatches
- No reliable datetime comparison operators
- `findstr` text matching is error-prone for dates

**PowerShell Benefits**:
- Reliable datetime parsing and comparison
- Consistent behavior across systems
- Explicit filtering logic
- Built-in error handling

## Historical Context

**Case Study: Missed Items Due to CMD Filtering**

CMD's `dir` command formats dates inconsistently (e.g., "10/02/2025") but filtering with ISO patterns like "2025-10" causes silent failures. This has resulted in missed items that existed in files modified within the target date range.

**Root Cause**: CMD's `dir` output formatting doesn't match ISO 8601 patterns.

**Solution**: PowerShell's `Where-Object {$_.LastWriteTime -ge [datetime]'2025-10-01'}` works reliably.

## Validation Checkpoint

After running PowerShell filter, validate results:

1. **Check result count** - If 0 files returned but you expect files, verify:
   - Timestamp is correct
   - Path exists and is accessible
   - Timestamp format is ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)

2. **Fallback strategy** - If suspicious results:
   - Run full scan without timestamp filter
   - Log fallback usage in output
   - **Better to over-scan than miss items**

3. **Timestamp updates** - After successful scan:
   - Update `last_scan_timestamp` in state file
   - Use ISO 8601 format
   - Include timezone if relevant

## Common Patterns

### Pattern 1: Modified Since Timestamp
```powershell
powershell -Command "Get-ChildItem 'Tasks/*.md' | Where-Object {$_.LastWriteTime -ge [datetime]'2025-01-15T08:00:00'}"
```

### Pattern 2: Modified Within Date Range
```powershell
powershell -Command "Get-ChildItem 'Emails/*.md' | Where-Object {$_.LastWriteTime -ge [datetime]'2025-01-01' -and $_.LastWriteTime -le [datetime]'2025-01-31'}"
```

### Pattern 3: Modified in Last N Days
```powershell
powershell -Command "Get-ChildItem 'Meetings/*.md' | Where-Object {$_.LastWriteTime -ge (Get-Date).AddDays(-30)}"
```

### Pattern 4: With Result Formatting
```powershell
powershell -Command "Get-ChildItem 'path/*.md' | Where-Object {$_.LastWriteTime -ge [datetime]'$timestamp'} | Select-Object FullName, LastWriteTime | Format-Table"
```

## Integration with Commands

Commands should reference this skill:

```markdown
## File Filtering
See powershell-temporal-filter skill for required patterns.

**Critical**: Use PowerShell (not CMD) for timestamp-based filtering to prevent silent failures.
```

Then specify only command-specific details:
- Target directory path
- Timestamp source (state file, parameter, calculated)
- Result processing

## Error Handling

If PowerShell command fails:
1. Check path escaping (use double quotes for paths with spaces)
2. Verify timestamp format is valid datetime
3. Ensure PowerShell is available (should be on all modern Windows)
4. Fall back to full scan if necessary
5. Log the error for troubleshooting

## Cross-Platform Note

This pattern is Windows-specific. For cross-platform commands:
- Check platform at runtime
- Use `find` with `-mtime` on Unix/macOS
- Document platform requirements clearly
