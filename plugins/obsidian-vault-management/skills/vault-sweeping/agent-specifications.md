# Agent Specifications - Vault Sweeping

Detailed specifications for the 5 parallel agents that power vault-sweeping skill.

## Deployment Strategy

**Launch Pattern**: All agents deployed in parallel using single message with multiple Task tool calls.

**Timing**:
- Quick Path: 3 agents (Org, Template, Metadata)
- Standard Path: 5 agents (all)
- Deep Path: 5 agents with extended prompts

**Coordination**: Agents operate independently, results synthesized after completion.

---

## Agent 1: File Organization Scanner

### Mission
Detect files where Type property doesn't match folder location, violating vault organization standards.

### Subagent Type
`general-purpose`

### Task Prompt (Standard Path)

```
MISSION: Scan vault for file organization violations

SCOPE:
- Files: Modified in last 7 days (from PowerShell filter)
- Focus: Type property vs folder location mismatches
- Vault: C:\Users\bkolb\OneDrive - RK&K\Obsidian\Obsidian

DETECTION RULES:

1. Contact Files
   - Type: Contact → MUST be in 03-Contacts/
   - Violation: Type: Contact anywhere else
   - Priority: MEDIUM

2. Project Files
   - Type: Project → MUST be in 01-Projects/[Client]/[Project]/ OR 04-Projects/
   - Violation: Type: Project in root, Inbox, Fleeting, etc.
   - Priority: HIGH (affects project navigation)

3. Email Files
   - Type: Email → MUST be in Emails/
   - Violation: Type: Email anywhere else
   - Priority: HIGH (breaks flat email system)

4. Meeting Files
   - Filename pattern: MeetingNotes-*
   - MUST be in 02-Meetings/ OR project subfolder
   - Priority: MEDIUM

5. Files Without Type
   - In numbered folders (00-Inbox through 99-System)
   - Should have Type property
   - Priority: LOW (recommendation, not violation)

SEARCH STRATEGY:

Step 1: Use Grep to find Type: Contact, Type: Project, Type: Email
Step 2: Check if file path matches expected location
Step 3: Use Grep to find MeetingNotes-* pattern
Step 4: Check if in correct meeting folder

REQUIRED OUTPUT:

For each violation:
```
- [ ] **[filename]**: Type "[type]" but located in [current-folder]/
  - Recommended: Move to [correct-folder]/
  - Impact: [HIGH/MEDIUM/LOW]
  - Confidence: [HIGH/MEDIUM/LOW]
```

Group by violation type (Contact misplaced, Project misplaced, etc.)

Only report files from the scanned set (modified in time window).

ERROR HANDLING:
- If Type property missing → Note as "No Type property" (separate section)
- If folder doesn't exist → Recommend creation
- If access denied → Log and skip

PERFORMANCE TARGET: Complete in 15-20 seconds
```

### Task Prompt (Quick Path)

Same as Standard but:
- Scope: Files from Quick Path filter (last sweep timestamp)
- Report: CRITICAL only (HIGH priority violations)
- Skip: Recommendations section

### Task Prompt (Deep Path)

Same as Standard but:
- Scope: ALL files (no temporal filter)
- Add: Historical pattern analysis (recurring violators)
- Add: Confidence scoring based on file age and activity
- Add: Migration recommendations for bulk moves

---

## Agent 2: Template Compliance Checker

### Mission
Validate YAML frontmatter against template requirements for each file type.

### Subagent Type
`general-purpose`

### Task Prompt (Standard Path)

```
MISSION: Validate template compliance across file types

SCOPE:
- Files: Modified in last 7 days
- Check: Required YAML frontmatter fields per template type

TEMPLATE REQUIREMENTS:

1. Contact Template (Type: Contact)
   REQUIRED:
   - email (string)
   - company (string)
   - role (string)
   OPTIONAL:
   - phone (string)
   - last_contact (date)

2. Project Template (Type: Project)
   REQUIRED:
   - client (string)
   - status (Active/On Hold/Completed)
   - type (string: Project Overview, Project, etc.)
   OPTIONAL:
   - start_date (date)
   - end_date (date)

3. Meeting Template (MeetingNotes-* files)
   REQUIRED:
   - date (date, YYYY-MM-DD format)
   - attendees (list)
   - project (wikilink or string)
   OPTIONAL:
   - action_items (list)

4. TaskNote Template (in TaskNotes/ folder)
   REQUIRED:
   - status (Todo/In Progress/Done/Cancelled)
   - priority (High/Medium/Low)
   - project (wikilink)
   OPTIONAL:
   - due_date (date)
   - effort (string)

DETECTION STRATEGY:

Step 1: Read file YAML frontmatter
Step 2: Determine template type from Type property or file location
Step 3: Check for required fields
Step 4: Validate field formats (dates as YYYY-MM-DD, etc.)

REQUIRED OUTPUT:

For each violation:
```
- [ ] **[filename]**: Missing required field "[field-name]"
  - Template: [template-type]
  - Impact: MEDIUM
  - Recommendation: Add field with appropriate value
```

Group by template type.

VALIDATION RULES:
- Empty string counts as missing
- Date format must be YYYY-MM-DD or YYYY-MM-DDTHH:MM
- Status values must match allowed values exactly

ERROR HANDLING:
- If YAML malformed → Flag as "YAML Parse Error" (CRITICAL)
- If Type property missing → Skip template validation
- If template unknown → Report as "No template match"

PERFORMANCE TARGET: Complete in 15-20 seconds
```

### Task Prompt (Quick Path)

Same as Standard but:
- Scope: Quick Path file list
- Report: Only files with CRITICAL issues (malformed YAML, missing multiple required fields)

### Task Prompt (Deep Path)

Same as Standard but:
- Scope: ALL files
- Add: Template drift detection (files modified from original template structure)
- Add: Field value validation (beyond presence, check reasonableness)
- Add: Cross-reference validation (project links exist, attendees are real contacts)

---

## Agent 3: Project Status Updater

### Mission
Identify projects with status inconsistencies based on recent activity.

### Subagent Type
`general-purpose`

### Task Prompt (Standard Path)

```
MISSION: Detect project status inconsistencies

SCOPE:
- Folders: 01-Projects/[Client]/[Project]/
- Focus: Status property vs actual activity mismatch

DETECTION RULES:

1. Active Projects with No Recent Activity
   - Status: Active
   - No files modified in last 30 days
   - Priority: MEDIUM
   - Recommendation: Review if should be "On Hold"

2. Completed Projects with Recent Activity
   - Status: Completed
   - Files modified in last 14 days
   - Priority: HIGH
   - Recommendation: Either set to Active or verify completion date

3. On Hold Projects with Activity
   - Status: On Hold
   - Files modified in last 7 days
   - Priority: MEDIUM
   - Recommendation: Update status if reactivated

4. Projects Missing Status
   - Project Overview file exists
   - No status property in YAML
   - Priority: LOW
   - Recommendation: Add status property

SEARCH STRATEGY:

Step 1: Use Glob to find all [Client].md and [Project].md files in 01-Projects/
Step 2: Read YAML frontmatter for status property
Step 3: Use PowerShell to check last modification time of files in project folder
Step 4: Compare status vs activity pattern

REQUIRED OUTPUT:

For each inconsistency:
```
- [ ] **[Project Name]** ([Client]): Status "[current-status]" but [activity-pattern]
  - Last Activity: [date]
  - Recommendation: [specific action]
  - Impact: MEDIUM
```

Group by Client.

ACTIVITY PATTERNS:
- "No activity in 45 days" → Suggest On Hold or Completed
- "Active with recent changes" → Verify status is Active
- "Completed but modified 3 days ago" → Investigate

ERROR HANDLING:
- If project folder empty → Note as "Empty project"
- If status property missing → Report separately
- If can't determine activity → Skip with note

PERFORMANCE TARGET: Complete in 15-20 seconds
```

### Task Prompt (Quick Path)

Same as Standard but:
- Scope: Only projects with files in Quick Path filter
- Report: HIGH priority only (Completed with activity)

### Task Prompt (Deep Path)

Same as Standard but:
- Scope: ALL projects
- Add: Activity timeline analysis (trend over 3/6 months)
- Add: Recommendation engine (confidence-scored suggestions)
- Add: Cross-project comparisons (similar projects, different statuses)

---

## Agent 4: Metadata Validator

### Mission
Validate timestamp integrity, date formats, and wikilink validity.

### Subagent Type
`general-purpose`

### Task Prompt (Standard Path)

```
MISSION: Validate metadata quality across vault

SCOPE:
- Files: Modified in last 7 days
- Check: Timestamps, dates, tags, wikilinks

VALIDATION RULES:

1. Timestamp Presence
   - created (date)
   - updated (date)
   - Priority if missing: LOW

2. Timestamp Format
   - Must be: YYYY-MM-DD or YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS
   - Invalid examples: MM/DD/YYYY, "Nov 13, 2025"
   - Priority if invalid: MEDIUM

3. Timestamp Logic
   - created <= updated
   - Both <= today's date
   - Priority if violated: LOW

4. Wikilink Validity
   - Pattern: [[link]] or [[link|alias]]
   - Target file must exist in vault
   - Priority if broken: MEDIUM

5. Required Tags (by Type)
   - Email files: Should have #email-[client] tag
   - Meeting files: Should have project tag
   - Priority if missing: LOW (recommendation)

DETECTION STRATEGY:

Step 1: Read YAML frontmatter
Step 2: Check timestamp presence and format
Step 3: Extract wikilinks with regex: \[\[([^\]]+)\]\]
Step 4: Verify link targets exist
Step 5: Check tags for Type-specific patterns

REQUIRED OUTPUT:

For each issue:
```
- [ ] **[filename]**: [Issue description]
  - Current: [current-value]
  - Expected: [expected-format]
  - Impact: [HIGH/MEDIUM/LOW]
  - Recommendation: [fix]
```

Group by issue type (Timestamps, Wikilinks, Tags).

WIKILINK VALIDATION:
- Extract target from [[Target]] or [[Target|Alias]]
- Check if Target.md exists anywhere in vault
- If not found, report as broken link

ERROR HANDLING:
- If YAML missing → Skip timestamp validation
- If regex fails → Note as parse error
- If excessive broken links (>20) → Sample and report count

PERFORMANCE TARGET: Complete in 15-20 seconds
```

### Task Prompt (Quick Path)

Same as Standard but:
- Scope: Quick Path files
- Report: MEDIUM+ priority only (broken links, invalid timestamps)
- Skip: Tag recommendations

### Task Prompt (Deep Path)

Same as Standard but:
- Scope: ALL files
- Add: Tag consistency analysis (similar files, different tags)
- Add: Link graph analysis (orphaned notes with no inbound links)
- Add: Timestamp drift detection (files with created > updated)

---

## Agent 5: Cleanup Coordinator

### Mission
Identify cleanup opportunities and stale content.

### Subagent Type
`general-purpose`

### Task Prompt (Standard Path)

```
MISSION: Find cleanup opportunities across vault

SCOPE:
- Focus: Temporary folders and stale content
- Suggest: Files to review, move, or archive

CLEANUP PATTERNS:

1. Stale Inbox Files
   - Location: 00-Inbox/
   - Threshold: >30 days old
   - Priority: MEDIUM
   - Action: Move to appropriate project or archive

2. Old Fleeting Notes
   - Location: 01-Fleeting/
   - Threshold: >14 days old
   - Priority: LOW
   - Action: Process into permanent notes or delete

3. Empty Folders
   - Any folder with no files or subfolders
   - Priority: LOW
   - Action: Remove if not needed for structure

4. Duplicate File Detection (Deep Path only)
   - Files with identical or very similar names
   - Check content similarity
   - Priority: LOW
   - Action: Review and consolidate

5. Orphaned Attachments
   - Files in Attachments/ not referenced anywhere
   - Priority: LOW
   - Action: Archive or delete

DETECTION STRATEGY:

Step 1: Use PowerShell to find files by age in specific folders
```powershell
# Inbox >30 days
Get-ChildItem '00-Inbox\*.md' | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-30)}

# Fleeting >14 days
Get-ChildItem '01-Fleeting\*.md' | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-14)}
```

Step 2: Use Glob to find empty directories
Step 3: For duplicates (Deep Path): Compare file names and content

REQUIRED OUTPUT:

By category:
```
### Stale Inbox Files ([count])
- **[filename]**: [age] days old
  - Last modified: [date]
  - Recommendation: Review for project assignment or archive

### Old Fleeting Notes ([count])
- **[filename]**: [age] days old
  - Recommendation: Process or delete

### Empty Folders ([count])
- [folder-path]/
  - Recommendation: Remove if not structurally required
```

Provide count summaries and oldest/newest examples.

ERROR HANDLING:
- If folder doesn't exist → Skip that category
- If access denied → Log and skip
- If threshold calculation fails → Use defaults

PERFORMANCE TARGET: Complete in 15-20 seconds
```

### Task Prompt (Quick Path)

Same as Standard but:
- Scope: Only check folders that had activity in Quick Path window
- Report: Only items >60 days (extremely stale)
- Skip: Empty folders, duplicates

### Task Prompt (Deep Path)

Same as Standard but:
- Scope: ALL folders
- Add: Duplicate file detection with content comparison
- Add: Orphaned attachment detection
- Add: Archive recommendations with size estimates
- Add: Historical cleanup patterns (folders that consistently accumulate)

---

## Agent Coordination

### Parallel Deployment

**Implementation**:
```
Launch all agents in SINGLE message with multiple Task calls:
- Task 1: Agent 1 (File Org Scanner)
- Task 2: Agent 2 (Template Checker)
- Task 3: Agent 3 (Project Status)
- Task 4: Agent 4 (Metadata Validator)
- Task 5: Agent 5 (Cleanup Coordinator)
```

**Benefits**:
- Parallel execution (fastest performance)
- Independent operation (no dependencies)
- Concurrent scanning (minimal overhead)

### Result Synthesis

After all agents complete:

1. **Collect Results**: Gather findings from all 5 agents
2. **Categorize Priority**:
   - Critical: HIGH priority violations
   - Important: MEDIUM priority issues
   - Recommendations: LOW priority improvements
3. **Remove Duplicates**: Same issue found by multiple agents
4. **Cross-Validate**: Ensure findings are consistent
5. **Format Output**: Use MAINTENANCE template
6. **Update Log**: Record metrics in sweep log

### Error Recovery

If any agent fails:
- Continue with remaining agents
- Report partial results
- Note which domain wasn't scanned
- Suggest re-run if critical agent failed

---

## Performance Optimization

### Token Budgets

**Per Agent** (Standard Path):
- Agent prompts: ~500 tokens each
- File reads: Variable (depends on count)
- Results: ~300-500 tokens each
- **Total per agent**: ~1,000-1,500 tokens

**All 5 Agents**: ~5,000-7,500 tokens (within Standard Path budget)

### Speed Targets

**Agent Completion Times** (Standard Path):
- Agent 1 (Org): 12-15 seconds
- Agent 2 (Template): 15-18 seconds
- Agent 3 (Status): 10-12 seconds
- Agent 4 (Metadata): 15-20 seconds
- Agent 5 (Cleanup): 12-15 seconds

**Parallel Total**: ~20 seconds (agents run concurrently)
**Synthesis**: ~5 seconds
**Output Formatting**: ~3 seconds
**Total Standard Path**: ~30 seconds (well under 60s target)

---

## Testing Agent Specifications

### Unit Test Approach

Test each agent independently:

1. **Agent 1 Test**:
   - Create misplaced Contact file
   - Run Agent 1 only
   - Verify detection and recommendation

2. **Agent 2 Test**:
   - Create Contact missing required field
   - Run Agent 2 only
   - Verify template validation

3. **Agent 3 Test**:
   - Create Active project with no activity
   - Run Agent 3 only
   - Verify status inconsistency detected

4. **Agent 4 Test**:
   - Create file with broken wikilink
   - Run Agent 4 only
   - Verify link validation

5. **Agent 5 Test**:
   - Create old file in Inbox
   - Run Agent 5 only
   - Verify stale detection

### Integration Test

Run all 5 agents in parallel:
- Verify no conflicts
- Check result synthesis quality
- Validate performance targets
- Confirm output formatting

---

## Agent Evolution

### Version History

**v1.0.0**: Initial agent specifications
- 5 agents with clear separation of concerns
- Parallel deployment pattern
- Standard/Quick/Deep path variations

### Future Enhancements

- **Agent 6**: Link quality analyzer (graph metrics)
- **Agent 7**: Content quality checker (readability, completeness)
- **Enhanced Agent 3**: Predictive project status (ML-based)
- **Enhanced Agent 5**: Smart archival (intelligent retention)

---

These agent specifications ensure comprehensive, efficient vault maintenance through parallel, specialized analysis.