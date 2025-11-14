# PowerShell Temporal Filtering Patterns

Windows-specific temporal filtering for vault management skills.

## Overview

PowerShell provides efficient file filtering by modification time, critical for Quick and Standard paths that scan only recent changes. These patterns are optimized for Windows environments.

## Common Patterns

### Pattern 1: Files Modified Since Last Scan

**Use Case**: Quick Path - scan only files changed since last sweep

**PowerShell Command**:
```powershell
$lastSweep = Get-Date "2025-11-01 14:30"
Get-ChildItem -Path "C:\path\to\vault" -Recurse -File |
  Where-Object {$_.LastWriteTime -gt $lastSweep}
```

**In Bash Tool**:
```bash
powershell -Command "Get-ChildItem -Path 'C:\path\to\vault' -Recurse -File | Where-Object {\$_.LastWriteTime -gt (Get-Date '2025-11-01 14:30')}"
```

**Notes**:
- Read last sweep timestamp from Vault Sweep Log.md
- Escape `$` in Bash tool as `\$`
- Returns full file paths

---

### Pattern 2: Files Older Than N Days

**Use Case**: Stale content detection (Inbox >30 days, Fleeting >14 days)

**PowerShell Command**:
```powershell
$threshold = (Get-Date).AddDays(-30)
Get-ChildItem -Path "00-Inbox\*.md" |
  Where-Object {$_.LastWriteTime -lt $threshold}
```

**In Bash Tool**:
```bash
powershell -Command "Get-ChildItem -Path '00-Inbox\*.md' | Where-Object {\$_.LastWriteTime -lt (Get-Date).AddDays(-30)}"
```

**Common Thresholds**:
- Inbox: 30 days
- Fleeting notes: 14 days
- Email triage (Quick): 3 days
- Email triage (Standard): 7 days
- Email triage (Deep): 14 days

---

### Pattern 3: Files Modified in Date Range

**Use Case**: Weekly timesheet - scan specific week's activity

**PowerShell Command**:
```powershell
$start = Get-Date "2025-11-04"
$end = Get-Date "2025-11-10"
Get-ChildItem -Path "C:\path\to\vault" -Recurse -File |
  Where-Object {$_.LastWriteTime -ge $start -and $_.LastWriteTime -le $end}
```

**In Bash Tool**:
```bash
powershell -Command "Get-ChildItem -Path 'C:\path\to\vault' -Recurse -File | Where-Object {\$_.LastWriteTime -ge (Get-Date '2025-11-04') -and \$_.LastWriteTime -le (Get-Date '2025-11-10')}"
```

---

### Pattern 4: Filter by Folder and Time

**Use Case**: Scan specific project folders for recent activity

**PowerShell Command**:
```powershell
$since = (Get-Date).AddDays(-7)
Get-ChildItem -Path "01-Projects\DRPA\*" -Recurse -File |
  Where-Object {$_.LastWriteTime -gt $since}
```

**In Bash Tool**:
```bash
powershell -Command "Get-ChildItem -Path '01-Projects\DRPA\*' -Recurse -File | Where-Object {\$_.LastWriteTime -gt (Get-Date).AddDays(-7)}"
```

---

### Pattern 5: Count Files by Time Period

**Use Case**: Determine adaptive path (Quick vs Standard vs Deep)

**PowerShell Command**:
```powershell
$since = (Get-Date).AddDays(-7)
(Get-ChildItem -Path "C:\path\to\vault" -Recurse -File |
  Where-Object {$_.LastWriteTime -gt $since}).Count
```

**Decision Logic**:
```
IF count < 50 → Quick Path
ELSE IF count < 200 → Standard Path
ELSE → Deep Path
```

---

## Integration with Skills

### Vault-Sweeping Example

**Quick Path Implementation**:
1. Read last sweep timestamp from log
2. Filter files modified since last sweep
3. If count < 50 → proceed with Quick Path
4. If count >= 50 → upgrade to Standard Path

**Command**:
```bash
powershell -Command "\$vault = 'C:\Users\bkolb\OneDrive - RK&K\Obsidian\Obsidian'; \$lastSweep = (Get-Date '2025-11-01 10:00'); (Get-ChildItem -Path \$vault -Recurse -File | Where-Object {\$_.LastWriteTime -gt \$lastSweep}).Count"
```

### Email-Triaging Example

**Quick Path** (3 days, critical clients):
```bash
powershell -Command "\$emails = 'C:\Users\bkolb\OneDrive - RK&K\Obsidian\Obsidian\Emails'; \$threshold = (Get-Date).AddDays(-3); Get-ChildItem -Path \$emails\*.md | Where-Object {\$_.LastWriteTime -gt \$threshold}"
```

**Standard Path** (7 days, all clients):
```bash
powershell -Command "\$emails = 'C:\Users\bkolb\OneDrive - RK&K\Obsidian\Obsidian\Emails'; \$threshold = (Get-Date).AddDays(-7); Get-ChildItem -Path \$emails\*.md | Where-Object {\$_.LastWriteTime -gt \$threshold}"
```

---

## Best Practices

### Performance Optimization

1. **Use Specific Paths**: Filter at folder level before temporal filter
   ```powershell
   # Good: Specific folder
   Get-ChildItem -Path "Emails\*.md" | Where-Object {$_.LastWriteTime -gt $threshold}

   # Avoid: Full vault scan when unnecessary
   Get-ChildItem -Path "C:\vault" -Recurse | Where-Object {$_.LastWriteTime -gt $threshold -and $_.Name -like "*.md"}
   ```

2. **Cache Threshold Dates**: Calculate once, reuse
   ```powershell
   $threshold = (Get-Date).AddDays(-7)  # Calculate once
   # Use $threshold in multiple filters
   ```

3. **Return Only What's Needed**: Use Select-Object for specific properties
   ```powershell
   Get-ChildItem | Where-Object {$_.LastWriteTime -gt $threshold} |
     Select-Object FullName, LastWriteTime
   ```

### Error Handling

**Check for Empty Results**:
```powershell
$files = Get-ChildItem -Path "path" | Where-Object {$_.LastWriteTime -gt $threshold}
if ($files.Count -eq 0) {
    Write-Output "No files modified since threshold"
}
```

**Handle Missing Paths**:
```powershell
if (Test-Path "C:\path\to\folder") {
    Get-ChildItem -Path "C:\path\to\folder" | Where-Object {$_.LastWriteTime -gt $threshold}
} else {
    Write-Output "Path not found"
}
```

---

## Date Format Standards

### ISO 8601 Format (Recommended)

```powershell
$date = Get-Date "2025-11-13T14:30:00"  # ISO format with time
$date = Get-Date "2025-11-13"           # ISO format date only
```

### Common Formats Supported

```powershell
Get-Date "11/13/2025"              # US format
Get-Date "2025-11-13 14:30:00"     # ISO with space
Get-Date "Nov 13, 2025"            # Verbose
```

**Best Practice**: Use ISO 8601 (YYYY-MM-DD) for consistency with vault YAML frontmatter.

---

## Vault-Specific Paths

Common paths in Bryan's vault:

```powershell
$vault = "C:\Users\bkolb\OneDrive - RK&K\Obsidian\Obsidian"
$inbox = "$vault\00-Inbox"
$fleeting = "$vault\01-Fleeting"
$projects = "$vault\01-Projects"
$contacts = "$vault\03-Contacts"
$emails = "$vault\Emails"
$meetings = "$vault\02-Meetings"
$tasks = "$vault\TaskNotes"
$system = "$vault\99-System"
```

---

## Cross-Platform Considerations (Future)

While current implementation is Windows-only, future cross-platform support would use:

**Linux/Mac (bash/find)**:
```bash
# Files modified in last 7 days
find /path/to/vault -type f -mtime -7

# Files older than 30 days
find 00-Inbox -type f -mtime +30
```

**Abstraction Layer** (future v2.0):
```
IF platform == "Windows" THEN
  Use PowerShell Get-ChildItem
ELSE
  Use find with -mtime
```

---

## Temporal Filter Decision Tree

```
Skill Invoked
├─ Quick Path Request?
│   ├─ Yes → Filter: Last 3-7 days OR since last run
│   └─ Determine: Count files in range
│       ├─ < 50 files → Proceed Quick Path
│       └─ >= 50 files → Upgrade to Standard Path
├─ Standard Path Request?
│   ├─ Filter: Last 7-14 days OR modified files
│   └─ Full processing (no further filtering)
└─ Deep Path Request?
    └─ No temporal filter (scan all files)
```

---

## Usage in Skills

### SKILL.md Reference Pattern

```markdown
## Quick Path Logic

1. Calculate threshold date (last sweep or 7 days)
2. Use PowerShell temporal filter (see shared/powershell-temporal-filter.md)
3. Count filtered files
4. If count appropriate, proceed with Quick Path agents
5. Otherwise, upgrade to Standard Path

**PowerShell Pattern**: Pattern 1 (Files Modified Since Last Scan)
```

### Agent Prompt Integration

```markdown
## Agent Task Prompt

TEMPORAL SCOPE:
- Quick Path: Files modified since [last-sweep-date] (~[X] files)
- Standard Path: Files modified in last 7 days (~[Y] files)
- Deep Path: All files in scope

Use PowerShell filtering to get file list before scanning.
See: shared/powershell-temporal-filter.md Pattern [N]
```

---

This shared infrastructure ensures consistent, performant temporal filtering across all vault management skills.