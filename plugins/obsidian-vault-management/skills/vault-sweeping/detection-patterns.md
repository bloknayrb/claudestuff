# Detection Patterns - Vault Sweeping

Systematic patterns for identifying issues across the vault.

## Overview

Detection patterns combine search strategies, validation logic, and pattern matching to efficiently identify vault issues. Each pattern includes specific tools, commands, and decision logic.

---

## Pattern 1: Type Property Mismatch Detection

### Purpose
Find files where Type property doesn't match folder location.

### Strategy

**Step 1: Find all files with Type properties**
```bash
grep -r "Type: Contact" --include="*.md" C:\Users\bkolb\OneDrive - RK&K\Obsidian\Obsidian
grep -r "Type: Project" --include="*.md" C:\Users\bkolb\OneDrive - RK&K\Obsidian\Obsidian
grep -r "Type: Email" --include="*.md" C:\Users\bkolb\OneDrive - RK&K\Obsidian\Obsidian
```

**Step 2: Check path against expected location**
```
FOR EACH file with Type: Contact:
  IF path does NOT contain "03-Contacts/"
  THEN mismatch detected
```

**Step 3: Generate recommendations**
```
Extract filename
Generate correct path: 03-Contacts/[filename]
Output: Move [current-path] → [correct-path]
```

### Performance Optimization

**Quick Path**: Filter grep results by file modification time first
```bash
# Get modified files first, then grep only those
powershell -Command "Get-ChildItem -Recurse | Where-Object {$_.LastWriteTime -gt (Get-Date).AddDays(-7)}"
# Then grep only that subset
```

**Standard Path**: Full grep across entire vault

**Deep Path**: Add confidence scoring based on file age and activity

---

## Pattern 2: Template Compliance Scanning

### Purpose
Validate YAML frontmatter against template requirements.

### Strategy

**Step 1: Identify template type**
```
Read YAML frontmatter
IF contains "Type: Contact" → Use Contact template rules
IF contains "Type: Project" → Use Project template rules
IF filename matches "MeetingNotes-*" → Use Meeting template rules
IF path contains "TaskNotes/" → Use TaskNote template rules
```

**Step 2: Extract required fields**
```yaml
Contact Template:
  required: [email, company, role]

Project Template:
  required: [client, status, type]

Meeting Template:
  required: [date, attendees, project]

TaskNote Template:
  required: [status, priority, project]
```

**Step 3: Validate presence and format**
```
FOR EACH required field:
  IF field missing OR field value empty:
    Add to violations list
  IF field present:
    Validate format (date format, enumerated values, etc.)
```

### YAML Parsing Pattern

```regex
# Extract YAML frontmatter
^---\n(.*?)\n---

# Parse individual fields
^([a-zA-Z_]+):\s*(.+)$

# Detect empty values
:\s*$
:\s*""
:\s*''
```

### Validation Checks

**Date Fields**:
```regex
# Valid ISO 8601
^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$

# Invalid formats (flag these)
^\d{1,2}/\d{1,2}/\d{4}$  # MM/DD/YYYY
^[A-Za-z]+\s+\d{1,2},\s+\d{4}$  # Nov 13, 2025
```

**Enumerated Fields**:
```
status: Must be in [Active, On Hold, Completed]
priority: Must be in [High, Medium, Low]
status (TaskNote): Must be in [Todo, In Progress, Done, Cancelled]
```

---

## Pattern 3: Project Status Inconsistency Detection

### Purpose
Find projects where status doesn't match recent activity.

### Strategy

**Step 1: Find all project files**
```bash
# Find project overview files
find 01-Projects -name "*Project*.md" -o -name "*Overview*.md"

# Or use Glob
01-Projects/**/*.md where Type: Project
```

**Step 2: Read status from YAML**
```
Extract status property
Classify as: Active, On Hold, Completed, or Missing
```

**Step 3: Check folder activity**
```powershell
$projectPath = "01-Projects/DRPA/19088.001"
$lastMod = (Get-ChildItem -Path $projectPath -Recurse -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1).LastWriteTime

$daysSinceActivity = ((Get-Date) - $lastMod).Days
```

**Step 4: Apply consistency rules**
```
IF status = "Active" AND daysSinceActivity > 30:
  Flag as "Active project with no recent activity"
  Recommendation: Consider "On Hold"

IF status = "Completed" AND daysSinceActivity < 14:
  Flag as "Completed project with recent activity"
  Recommendation: Verify completion or change to Active

IF status = "On Hold" AND daysSinceActivity < 7:
  Flag as "On Hold project with activity"
  Recommendation: Consider changing to Active
```

### Activity Scoring

```
Activity Score = weighted sum of:
- Files modified (weight: 0.4)
- Files created (weight: 0.3)
- Meeting notes added (weight: 0.2)
- Emails received (weight: 0.1)

IF Activity Score > threshold AND status != "Active":
  Flag inconsistency
```

---

## Pattern 4: Metadata Validation Pattern

### Purpose
Validate timestamp integrity and wikilink validity.

### Timestamp Validation Strategy

**Step 1: Extract timestamps**
```yaml
created: 2025-11-13T10:30
updated: 2025-11-13T14:45
```

**Step 2: Format validation**
```regex
Valid: ^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$
```

**Step 3: Logic validation**
```
created_date = parse(created)
updated_date = parse(updated)
today = current_date()

Violations:
- created_date > updated_date
- created_date > today
- updated_date > today
```

### Wikilink Validation Strategy

**Step 1: Extract all wikilinks**
```regex
Pattern: \[\[([^\]|]+)(?:\|([^\]]+))?\]\]
Capture groups:
  1: Target file
  2: Alias (optional)
```

**Examples**:
- `[[Contact Name]]` → Target: "Contact Name.md"
- `[[Project|Alias]]` → Target: "Project.md", Display: "Alias"
- `[[Folder/File]]` → Target: "File.md" in "Folder/"

**Step 2: Build vault file index**
```bash
# Create index of all .md files
find vault -name "*.md" > vault_index.txt
```

**Step 3: Validate each link**
```
FOR EACH wikilink target:
  Search vault_index for target.md
  IF NOT found:
    Check variations (with/without path, case-insensitive)
  IF still NOT found:
    Flag as broken link
```

**Optimization**: Cache vault index, rebuild only when vault structure changes

---

## Pattern 5: Stale Content Detection

### Purpose
Identify files that should be processed or archived.

### Inbox Stale Detection

**PowerShell Pattern**:
```powershell
$vault = "C:\Users\bkolb\OneDrive - RK&K\Obsidian\Obsidian"
$inboxPath = "$vault\00-Inbox"
$threshold = (Get-Date).AddDays(-30)

$staleFiles = Get-ChildItem -Path "$inboxPath\*.md" |
  Where-Object {
    $_.LastWriteTime -lt $threshold -and
    $_.Name -notlike "*template*"
  } |
  Sort-Object LastWriteTime |
  Select-Object Name, LastWriteTime, @{Name='Age';Expression={(((Get-Date) - $_.LastWriteTime).Days)}}

# Output
foreach ($file in $staleFiles) {
  Write-Output "$($file.Name): $($file.Age) days old"
}
```

**Severity Levels**:
- 30-60 days: Medium priority
- 60-90 days: High priority
- 90+ days: Critical priority

### Fleeting Notes Detection

**PowerShell Pattern**:
```powershell
$fleetingPath = "$vault\01-Fleeting"
$threshold = (Get-Date).AddDays(-14)

$oldFleeting = Get-ChildItem -Path "$fleetingPath\*.md" |
  Where-Object {$_.LastWriteTime -lt $threshold}
```

**Fleeting Notes Philosophy**: Temporary by design, 14-day processing window

---

## Pattern 6: Empty Folder Detection

### Purpose
Find folders with no content.

### Detection Strategy

**Bash Pattern**:
```bash
find vault -type d -empty
```

**PowerShell Pattern**:
```powershell
Get-ChildItem -Path $vault -Recurse -Directory |
  Where-Object {
    (Get-ChildItem -Path $_.FullName -Force | Measure-Object).Count -eq 0
  } |
  Select-Object FullName
```

**Exception Handling**:
```
Skip these folders (structural placeholders):
- .obsidian/
- .git/
- Attachments/ (may be temporarily empty)
- Any folder with ".keep" file
```

### Remediation Logic

```
IF folder empty AND not in exception list:
  IF folder created > 90 days ago:
    Priority: LOW (likely intentional)
  ELSE IF folder created < 7 days ago:
    Priority: SKIP (just created)
  ELSE:
    Priority: LOW
    Recommendation: Remove or add placeholder
```

---

## Pattern 7: Duplicate File Detection (Deep Path Only)

### Purpose
Identify potential duplicate content.

### Detection Strategy

**Phase 1: Name Similarity**
```
Find files with similar names:
- Exact match ignoring case
- Match with different extensions
- Match with trailing numbers (file.md, file 1.md)
- Match with date suffixes
```

**Phase 2: Content Hash**
```bash
# Generate hash for each file
md5sum file1.md
md5sum file2.md

# If hashes match → exact duplicates
# If hashes similar (fuzzy) → potential duplicates
```

**Phase 3: Size Comparison**
```
Group files by size
Files with identical size are candidates for content comparison
```

**Performance**:
- Deep Path only (expensive operation)
- Cache hashes for repeated runs
- Process in batches

### Output Format

```markdown
### Potential Duplicates

**Group 1** (Identical content):
- file1.md (245 bytes, modified 2025-11-01)
- file-copy.md (245 bytes, modified 2025-11-05)
→ Recommendation: Keep newer, archive older

**Group 2** (Similar names):
- DRPA Update.md
- DRPA Update 1.md
→ Recommendation: Review for consolidation
```

---

## Pattern 8: Orphaned File Detection

### Purpose
Find files with no inbound wikilinks (not referenced anywhere).

### Detection Strategy

**Step 1: Build link graph**
```
FOR EACH file in vault:
  Extract all outbound wikilinks
  Build reference map: target → [source files]
```

**Step 2: Find orphans**
```
FOR EACH file in vault:
  IF file NOT in reference map:
    AND file NOT in special folders (Inbox, Templates):
      Flag as orphaned
```

**Exceptions** (not considered orphans):
- Index files (folder.md)
- Templates
- Recently created files (<7 days)
- Files in Inbox (expected to be unlinked)
- System files (99-System/)

### Severity

```
IF orphaned AND >90 days old:
  Priority: MEDIUM (likely abandoned)
IF orphaned AND >365 days old:
  Priority: HIGH (archive candidate)
ELSE:
  Priority: LOW (informational)
```

---

## Pattern 9: Broken Link Chain Detection

### Purpose
Find cascading broken links (A→B→C where B is missing).

### Strategy

```
Build link graph: file → [targets]

FOR EACH link:
  IF target missing:
    Check if target ever existed (git history)
    Find files linking to this broken target

    Output:
    - Broken link
    - Files affected (inbound links)
    - Suggested fix (rename, restore, or remove)
```

---

## Pattern 10: Tag Consistency Detection

### Purpose
Identify missing or inconsistent tags.

### Email Tag Pattern

**Detection**:
```
IF Type: Email
THEN should have tag matching: #email-[client]

Extract client from:
1. Filename (Email-DRPA-Update.md → drpa)
2. Content (mentions of client names)
3. Folder structure (if in project folder)

Suggest appropriate tag:
#email-drpa, #email-vdot, #email-deldot, #email-mdta, etc.
```

**Validation**:
```bash
# Find emails without client tags
grep -r "Type: Email" --include="*.md" |
  while read file; do
    if ! grep -q "#email-" "$file"; then
      echo "$file: Missing email tag"
    fi
  done
```

---

## Pattern Integration Matrix

| Pattern | Quick Path | Standard Path | Deep Path | Performance Cost |
|---------|------------|---------------|-----------|------------------|
| Type Mismatch | ✓ | ✓ | ✓ | LOW |
| Template Compliance | ✓ | ✓ | ✓ | MEDIUM |
| Project Status | - | ✓ | ✓ | MEDIUM |
| Metadata Validation | ✓ | ✓ | ✓ | LOW |
| Stale Content | - | ✓ | ✓ | LOW |
| Empty Folders | - | ✓ | ✓ | LOW |
| Duplicates | - | - | ✓ | HIGH |
| Orphaned Files | - | - | ✓ | HIGH |
| Broken Link Chains | - | ✓ | ✓ | MEDIUM |
| Tag Consistency | - | ✓ | ✓ | LOW |

---

## Detection Optimization Techniques

### 1. Caching

```
Cache vault structure:
- File index (paths, timestamps)
- YAML frontmatter (parsed once)
- Link graph (expensive to rebuild)

Invalidate cache when:
- Vault structure changes
- Deep Path requested
- Cache > 24 hours old
```

### 2. Incremental Detection

```
Quick Path strategy:
- Only scan files in temporal filter
- Use cached results for unchanged files
- Minimal parsing (Type property only)
```

### 3. Parallel Processing

```
Independent patterns can run in parallel:
- Type Mismatch (Agent 1)
- Template Compliance (Agent 2)
- Project Status (Agent 3)
- Metadata Validation (Agent 4)
- Cleanup Detection (Agent 5)
```

### 4. Early Termination

```
Quick Path thresholds:
- Stop after 10 Critical issues found
- Skip Deep analysis if scope too large
- Recommend Standard or Deep Path upgrade
```

---

## Pattern Evolution

**v1.0.0**: 10 core detection patterns

**Future Patterns**:
- Pattern 11: Content quality (readability scores)
- Pattern 12: Link graph metrics (centrality, clustering)
- Pattern 13: File naming conventions
- Pattern 14: Attachment usage validation
- Pattern 15: Cross-reference integrity (TaskNotes ↔ Meetings)

---

These detection patterns ensure comprehensive, efficient issue identification across the vault.