# Validation Rules - Vault Sweeping

Comprehensive validation rules for detecting vault organization and metadata issues.

## Overview

Validation rules define what constitutes "correct" organization, templates, and metadata in Bryan's Obsidian vault. Each rule includes detection logic, priority, and remediation guidance.

---

## File Organization Rules

### Rule 1: Contact File Location

**Definition**: Files with `Type: Contact` must be in `03-Contacts/` folder.

**Detection**:
```
IF file contains "Type: Contact" in YAML frontmatter
AND file path does NOT contain "03-Contacts/"
THEN violation detected
```

**Priority**: MEDIUM

**Grep Pattern**:
```bash
grep -r "Type: Contact" --include="*.md" | grep -v "03-Contacts/"
```

**Remediation**: Move file to `03-Contacts/`

**Example Violations**:
- `00-Inbox/John Doe.md` with `Type: Contact` → Should be in `03-Contacts/John Doe.md`
- `01-Fleeting/contact-info.md` with `Type: Contact` → Move to Contacts

**False Positives**: Templates or example files (check for "template" in filename)

---

### Rule 2: Project File Location

**Definition**: Files with `Type: Project` must be in `01-Projects/[Client]/[Project]/` or `04-Projects/`.

**Detection**:
```
IF file contains "Type: Project" in YAML
AND file path does NOT match pattern "01-Projects/*/*/" OR "04-Projects/"
THEN violation detected
```

**Priority**: HIGH (affects project navigation)

**Glob Pattern**:
```bash
# Find all Project type files
grep -r "Type: Project" --include="*.md"
# Validate path structure
```

**Remediation**: Move to appropriate project folder

**Example Violations**:
- `00-Inbox/Project Overview.md` → Move to `01-Projects/[Client]/[Project]/`
- `01-Fleeting/drpa-notes.md` with `Type: Project` → Organize into project structure

**Special Cases**:
- Personal projects may be in `04-Projects/` without client subfolder
- Project templates in `99-System/` are exempt

---

### Rule 3: Email File Location

**Definition**: Files with `Type: Email` must be in `Emails/` folder (flat structure).

**Detection**:
```
IF file contains "Type: Email" in YAML
AND file path does NOT contain "Emails/"
THEN violation detected
```

**Priority**: HIGH (breaks flat email system)

**Remediation**: Move to `Emails/`

**Example Violations**:
- `00-Inbox/Email-DRPA-Update.md` → Move to `Emails/`
- `01-Projects/DRPA/email.md` → Move to `Emails/` (use tags for organization)

**Notes**:
- Emails use flat folder with tag-based organization
- Moving to `Emails/` critical for email triage workflow

---

### Rule 4: Meeting File Location

**Definition**: Files matching `MeetingNotes-*` pattern must be in `02-Meetings/` or project subfolders.

**Detection**:
```
IF filename matches "MeetingNotes-*.md"
AND path does NOT contain "02-Meetings/" OR "01-Projects/"
THEN violation detected
```

**Priority**: MEDIUM

**Filename Pattern**: `MeetingNotes-[Description]_YYYY-MM-DD_HH-MM.md`

**Remediation**: Move to `02-Meetings/` or relevant project folder

**Example Violations**:
- `00-Inbox/MeetingNotes-DRPA-Kickoff_2025-11-13_09-00.md` → Move to appropriate folder

**Valid Locations**:
- `02-Meetings/` (general meetings)
- `01-Projects/DRPA/19088.001/Meetings/` (project-specific)

---

### Rule 5: Files Without Type Property

**Definition**: Files in numbered folders should have `Type` property.

**Detection**:
```
IF file is in folders 00-Inbox through 99-System
AND file does NOT contain "Type:" in YAML frontmatter
THEN recommendation (not violation)
```

**Priority**: LOW

**Exceptions**:
- Index files (`00-Inbox.md`, `01-Projects.md`, etc.)
- System configuration files in `99-System/`
- Templates (contain "template" in filename)

**Remediation**: Add appropriate Type property

**Common Types**:
- `Type: Contact`
- `Type: Project`
- `Type: Email`
- `Type: Meeting`
- `Type: Note`
- `Type: Resource`

---

## Template Compliance Rules

### Rule 6: Contact Template Required Fields

**Definition**: Files with `Type: Contact` must have specific YAML fields.

**Required Fields**:
- `email` (string)
- `company` (string)
- `role` (string)

**Optional Fields** (good practice):
- `phone` (string)
- `last_contact` (date)

**Detection**:
```
IF file has "Type: Contact"
AND YAML frontmatter missing any of: email, company, role
THEN violation detected
```

**Priority**: MEDIUM

**Validation**:
```yaml
---
Type: Contact
email: john.doe@example.com  # REQUIRED
company: ABC Corp            # REQUIRED
role: Project Manager        # REQUIRED
phone: 555-1234             # Optional
last_contact: 2025-11-10    # Optional
---
```

**Remediation**: Add missing required fields

**Empty Values**: Empty string (`email: ""`) counts as missing

---

### Rule 7: Project Template Required Fields

**Definition**: Files with `Type: Project` must have project metadata.

**Required Fields**:
- `client` (string)
- `status` (enumerated: Active, On Hold, Completed)
- `type` (string: "Project Overview", "Project", etc.)

**Optional Fields**:
- `start_date` (date)
- `end_date` (date)
- `budget` (string/number)

**Detection**:
```
IF file has "Type: Project"
AND missing any of: client, status, type
THEN violation detected
```

**Priority**: MEDIUM

**Status Validation**:
- Must be exactly one of: `Active`, `On Hold`, `Completed`
- Case-sensitive
- No other values allowed

**Remediation**: Add missing fields with appropriate values

---

### Rule 8: Meeting Template Required Fields

**Definition**: Meeting notes must have meeting metadata.

**Required Fields**:
- `date` (date, YYYY-MM-DD format)
- `attendees` (list)
- `project` (wikilink or string)

**Optional Fields**:
- `action_items` (list)
- `decisions` (list)

**Detection**:
```
IF filename matches "MeetingNotes-*"
AND missing any of: date, attendees, project
THEN violation detected
```

**Priority**: MEDIUM

**Date Format Validation**:
- Must be `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`
- Examples: `2025-11-13` or `2025-11-13T09:30`

**Attendees Format**:
```yaml
attendees:
  - Bryan Kolb
  - John Doe
  - [[Jane Smith]]  # Wikilink to contact
```

**Remediation**: Add missing metadata

---

### Rule 9: TaskNote Template Required Fields

**Definition**: Files in `TaskNotes/` folder must have task metadata.

**Required Fields**:
- `status` (enumerated: Todo, In Progress, Done, Cancelled)
- `priority` (enumerated: High, Medium, Low)
- `project` (wikilink)

**Optional Fields**:
- `due_date` (date)
- `effort` (string: "1h", "2d", etc.)

**Detection**:
```
IF file in TaskNotes/ folder
AND missing any of: status, priority, project
THEN violation detected
```

**Priority**: MEDIUM

**Status Validation**: Exactly one of `Todo`, `In Progress`, `Done`, `Cancelled`

**Priority Validation**: Exactly one of `High`, `Medium`, `Low`

**Project Validation**: Must be wikilink format `[[Project Name]]`

---

## Metadata Validation Rules

### Rule 10: Timestamp Presence

**Definition**: All files should have `created` and `updated` timestamps.

**Required Fields**:
- `created` (date/datetime)
- `updated` (date/datetime)

**Detection**:
```
IF YAML frontmatter exists
AND missing created OR updated
THEN recommendation (LOW priority)
```

**Priority**: LOW

**Remediation**: Add timestamps with current file metadata

**Auto-population**:
```yaml
created: [file creation time from filesystem]
updated: [file last modified time from filesystem]
```

---

### Rule 11: Timestamp Format

**Definition**: Timestamps must use ISO 8601 format.

**Valid Formats**:
- `YYYY-MM-DD` (date only)
- `YYYY-MM-DDTHH:MM` (date and time)
- `YYYY-MM-DDTHH:MM:SS` (date and time with seconds)

**Invalid Formats** (common mistakes):
- `MM/DD/YYYY` (US format)
- `DD/MM/YYYY` (European format)
- `Nov 13, 2025` (verbose format)
- `2025/11/13` (wrong delimiter)

**Detection**:
```
IF created or updated field exists
AND does NOT match pattern "YYYY-MM-DD*"
THEN violation detected
```

**Priority**: MEDIUM

**Regex Pattern**: `^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$`

**Remediation**: Convert to ISO 8601 format

---

### Rule 12: Timestamp Logic

**Definition**: Timestamps must be logically consistent.

**Logic Rules**:
- `created <= updated` (created can't be after updated)
- Both dates `<= today` (can't be in future)
- If file modified, `updated` should reflect it

**Detection**:
```
IF created > updated
THEN violation (logic error)

IF created > today OR updated > today
THEN violation (future date)
```

**Priority**: LOW

**Remediation**: Correct timestamps based on file metadata

**Exceptions**: Scheduled content (future planning) may have future dates - check context

---

### Rule 13: Wikilink Validity

**Definition**: All wikilinks must point to existing files.

**Link Patterns**:
- `[[Target]]` → Look for `Target.md` anywhere in vault
- `[[Target|Alias]]` → Look for `Target.md`, display as "Alias"
- `[[Folder/Target]]` → Look for `Target.md` in `Folder/`

**Detection**:
```
Extract all wikilinks from file content
FOR EACH link:
  IF target file does NOT exist in vault
  THEN broken link detected
```

**Priority**: MEDIUM

**Regex**: `\[\[([^\]|]+)(?:\|[^\]]+)?\]\]`

**Remediation**:
- Fix typo in link
- Create target file
- Remove broken link

**Exceptions**: Links to sections (`[[File#Section]]`) validate file exists, ignore section

---

### Rule 14: Required Tags by Type

**Definition**: Specific file types should have appropriate tags.

**Email Files** (`Type: Email`):
- Should have `#email-[client]` tag
- Examples: `#email-drpa`, `#email-vdot`, `#email-deldot`
- Priority if missing: LOW (recommendation)

**Meeting Files**:
- Should have project tag or client tag
- Examples: `#drpa`, `#vdot`, `#meeting`
- Priority if missing: LOW

**Detection**:
```
IF Type: Email
AND no tags matching "#email-*"
THEN recommendation
```

**Remediation**: Add appropriate tags based on content

---

## Project Status Rules

### Rule 15: Active Project Activity Check

**Definition**: Projects marked `Active` should have recent activity.

**Activity Threshold**: Files modified in last 30 days

**Detection**:
```
IF project has status: Active
AND NO files in project folder modified in last 30 days
THEN status inconsistency detected
```

**Priority**: MEDIUM

**Remediation**: Review project, consider changing to `On Hold`

**Exceptions**:
- Projects in planning phase (check start_date)
- Monitoring-only projects (check notes)

---

### Rule 16: Completed Project Activity Check

**Definition**: Projects marked `Completed` should not have recent activity.

**Activity Threshold**: Files modified in last 14 days

**Detection**:
```
IF project has status: Completed
AND files in project folder modified in last 14 days
THEN status inconsistency detected
```

**Priority**: HIGH

**Remediation**:
- Change status back to `Active` if project resumed
- Verify completion date is accurate
- Check if activity is just documentation cleanup

---

### Rule 17: On Hold Project Activity Check

**Definition**: Projects `On Hold` with recent activity may need status update.

**Activity Threshold**: Files modified in last 7 days

**Detection**:
```
IF project has status: On Hold
AND files in project folder modified in last 7 days
THEN potential reactivation detected
```

**Priority**: MEDIUM

**Remediation**: Consider changing status to `Active` if project resumed

---

## Cleanup Rules

### Rule 18: Stale Inbox Files

**Definition**: Files in `00-Inbox/` should be processed within 30 days.

**Age Threshold**: 30 days

**Detection**:
```
PowerShell:
Get-ChildItem '00-Inbox\*.md' |
  Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-30)}
```

**Priority**: MEDIUM

**Remediation**: Move to appropriate project folder or archive

**Exceptions**:
- Reference files intentionally kept in Inbox
- Templates (check filename)

---

### Rule 19: Old Fleeting Notes

**Definition**: Fleeting notes in `01-Fleeting/` should be processed within 14 days.

**Age Threshold**: 14 days

**Detection**:
```
PowerShell:
Get-ChildItem '01-Fleeting\*.md' |
  Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-14)}
```

**Priority**: LOW

**Remediation**: Convert to permanent notes or delete

**Philosophy**: Fleeting notes are temporary by nature

---

### Rule 20: Empty Folders

**Definition**: Folders with no files or subfolders serve no purpose.

**Detection**:
```
FOR EACH folder in vault:
  IF folder contains zero files AND zero subfolders
  THEN empty folder detected
```

**Priority**: LOW

**Remediation**: Remove folder unless needed for structure

**Exceptions**:
- Placeholder folders for future use
- Folders required by Obsidian plugins

---

## Validation Priority Matrix

| Rule | Category | Priority | Impact | Frequency |
|------|----------|----------|--------|-----------|
| Contact Location | Organization | MEDIUM | Navigation | Common |
| Project Location | Organization | HIGH | Navigation | Common |
| Email Location | Organization | HIGH | Workflow | Very Common |
| Meeting Location | Organization | MEDIUM | Organization | Common |
| No Type Property | Organization | LOW | Completeness | Rare |
| Contact Fields | Template | MEDIUM | Data Quality | Common |
| Project Fields | Template | MEDIUM | Data Quality | Common |
| Meeting Fields | Template | MEDIUM | Completeness | Rare |
| TaskNote Fields | Template | MEDIUM | Workflow | Rare |
| Timestamp Presence | Metadata | LOW | Completeness | Very Common |
| Timestamp Format | Metadata | MEDIUM | Data Quality | Rare |
| Timestamp Logic | Metadata | LOW | Accuracy | Very Rare |
| Broken Wikilinks | Metadata | MEDIUM | Navigation | Common |
| Missing Tags | Metadata | LOW | Discovery | Common |
| Active No Activity | Status | MEDIUM | Accuracy | Rare |
| Completed With Activity | Status | HIGH | Accuracy | Rare |
| On Hold With Activity | Status | MEDIUM | Accuracy | Rare |
| Stale Inbox | Cleanup | MEDIUM | Organization | Common |
| Old Fleeting | Cleanup | LOW | Hygiene | Rare |
| Empty Folders | Cleanup | LOW | Tidiness | Rare |

---

## Rule Evolution

Rules are living documents that evolve with vault needs:

**v1.0.0**: Initial 20 rules covering core validation
**Future**: Additional rules as patterns emerge

### Proposed Future Rules:
- **Rule 21**: Orphaned files (no inbound wikilinks)
- **Rule 22**: Duplicate content detection
- **Rule 23**: File naming conventions
- **Rule 24**: Maximum file size limits
- **Rule 25**: Tag hierarchy validation

---

These validation rules ensure comprehensive vault quality through systematic, well-defined checks.