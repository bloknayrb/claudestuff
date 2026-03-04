---
name: vault-sweeping
description: Comprehensive vault maintenance with 5 parallel agents scanning file organization, template compliance, project status, metadata validation, and cleanup opportunities. Automatically detects scope and selects optimal path (Quick 30s, Standard 60s, Deep 120s). Use when checking vault health, finding misplaced files, validating templates, or performing weekly maintenance.
version: 1.1.0
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# Vault Sweeping

## Purpose

Maintains large Obsidian vaults through systematic analysis across five maintenance domains: file organization, template compliance, project status, metadata validation, and cleanup opportunities. The skill uses parallel agent architecture with adaptive path selection to optimize performance based on vault changes since last sweep.

Designed for vaults with 25,000+ files where manual maintenance is impractical and systematic validation ensures data quality and discoverability.

## Obsidian CLI Integration (Dual-Mode)

The skill supports **dual-mode execution**: Obsidian CLI commands when available, with automatic fallback to Glob/Grep/PowerShell.

### CLI Availability Check

Run at the start of every sweep, before launching agents:

```bash
obsidian version
```

- **Timeout**: 2 seconds. If the command fails or times out, immediately use fallback mode.
- **No retries**. A failed check means Obsidian isn't running — proceed with file-based detection.
- **Overnight automation**: `overnight-orchestrator.ps1` runs when Obsidian is typically closed. The availability check must fail fast (< 2 seconds) to avoid delaying automated runs.

### CLI-Enhanced Detection

When CLI is available, these commands replace or augment file-based detection:

| CLI Command | Replaces | Used By |
|-------------|----------|---------|
| `obsidian orphans format=json` | Custom link-graph orphan detection | Agent 4 (Rule 21) |
| `obsidian unresolved format=json` | Regex-based broken link scan (Rule 13) | Agent 4 |
| `obsidian properties file="X" format=json` | Manual YAML frontmatter parsing | Agent 2 (Rules 6-9) |
| `obsidian files folder=X format=json` | Glob-based file listing | Agent 1 (Rules 1-4) |

### Fallback Mode

When CLI is unavailable (Obsidian closed, PATH not registered, timeout):
- All agents use existing Glob/Grep/PowerShell patterns — identical to pre-CLI behavior
- No degradation in detection accuracy for file-based rules
- CLI-only detections (orphans via graph) are skipped with a note in the report

### Caveats

- **Obsidian must be running** for CLI commands. Overnight automation always uses fallback.
- **PATH registration required**: CLI binary must be on PATH (Obsidian Settings → General → CLI). If PATH registration fails after an update, all runs silently fall back.
- **Indexing state**: When Obsidian is running but vault is being indexed or syncing, `orphans` and `unresolved` may return stale/partial results. Do not treat CLI results as authoritative for files created in the last 60 seconds.
- **Command verification**: The CLI commands in this document (`orphans`, `unresolved`, `files`, `properties`) use the `param=value` syntax confirmed by Obsidian CLI docs. Verify available commands against `obsidian help` output — the CLI evolves between releases and command names may change.

## When to Use This Skill

Invoke this skill when you need to:
- **Check vault health**: "Sweep the vault for issues"
- **Find misplaced files**: "Are there files in the wrong folders?"
- **Validate templates**: "Check for missing required fields in contacts"
- **Weekly maintenance**: "Run the weekly vault sweep"
- **Post-import cleanup**: "I just imported 50 emails, check organization"
- **Troubleshoot navigation**: "Why can't I find project X files?"
- **Prepare for review**: "Clean up the vault before the meeting"

The skill automatically activates when context suggests vault maintenance needs.

## Adaptive Paths

The skill intelligently selects the optimal path based on vault activity:

### Quick Path (~30 seconds)

**Best For**: Daily or frequent checks, incremental maintenance
**Trigger**: <50 files modified since last sweep
**Token Budget**: ~2,000 tokens

**Process**:
1. Read last sweep timestamp from `99-System/Vault Sweep Log.md`
2. PowerShell filter: Files modified since last sweep
3. Launch 3 agents (File Org, Template, Metadata)
4. Report **Critical issues only**
5. Update sweep log

**Output**: Focused report on immediate problems requiring attention

---

### Standard Path (~60 seconds) **[DEFAULT]**

**Best For**: Weekly maintenance, comprehensive validation
**Trigger**: 50-300 files modified OR explicit request
**Token Budget**: ~5,000 tokens

**Process**:
1. Read last sweep timestamp
2. PowerShell filter: Files modified in last 7 days
3. Launch all 5 agents in parallel
4. Cross-validate findings
5. Prioritize: Critical → Important → Recommendations
6. Generate full maintenance report
7. Update sweep log with metrics

**Output**: Complete maintenance report with all priority levels

---

### Deep Path (~120 seconds)

**Best For**: Full audits, major cleanup, post-migration validation
**Trigger**: >300 files modified OR deep audit requested
**Token Budget**: ~8,000 tokens

**Process**:
1. Scan ALL files (no temporal filter)
2. Launch all 5 agents with extended analysis
3. Historical pattern detection (recurring issues)
4. Confidence scoring for each finding
5. Action plan generation with effort estimates
6. Complete audit trail with trend analysis
7. Detailed metrics in sweep log

**Output**: Comprehensive audit with historical context and actionable roadmap

---

## Agent Architecture

Five parallel agents scan different maintenance domains simultaneously:

### Agent 1: File Organization Scanner
**Mission**: Detect Type property mismatches with folder locations
**Checks**:
- Contacts (Type: Contact) → Must be in `03-Contacts/`
- Projects (Type: Project) → Must be in `01-Projects/[Client]/[Project]/`
- Emails (Type: Email) → Must be in `Emails/`
- Meeting notes → Must be in `02-Meetings/` or project folders
**Output**: Misplaced files with recommended destinations

### Agent 2: Template Compliance Checker
**Mission**: Validate required YAML frontmatter fields per template
**Templates**:
- Contact: email, company, role
- Project: client, status, type
- Meeting: date, attendees, project
- TaskNote: status, priority, project
**Output**: Files missing required fields

### Agent 3: Project Status Updater
**Mission**: Identify projects needing status updates
**Checks**:
- Active projects with no activity >30 days
- Completed projects still marked Active
- On Hold projects with recent activity
**Output**: Projects with status inconsistencies

### Agent 4: Metadata Validator
**Mission**: Validate timestamp and tag integrity
**Checks**:
- Missing `created` or `updated` timestamps
- Invalid date formats
- Broken wikilinks
- Empty required tags
**Output**: Metadata quality issues

### Agent 5: Cleanup Coordinator
**Mission**: Identify cleanup opportunities
**Checks**:
- Inbox files >30 days old
- Fleeting notes >14 days old
- Empty folders
- Duplicate files (same content, different names)
**Output**: Cleanup candidates with recommendations

**See [agent-specifications.md](agent-specifications.md) for detailed agent prompts.**

---

## Validation Rules

Comprehensive validation logic ensures files meet vault standards:

- **File Organization**: Type property must match folder location
- **Template Compliance**: Required fields must be present and correctly formatted
- **Project Status**: Status must reflect actual activity
- **Metadata Integrity**: Timestamps must be valid ISO 8601 format
- **Content Cleanup**: Temporary folders should not accumulate stale content

**See [validation-rules.md](validation-rules.md) for complete rule definitions.**

---

## Detection Patterns

Systematic patterns identify common issues:

- **Stale Content**: Age-based detection (Inbox >30d, Fleeting >14d)
- **Broken Links**: Wiki link targets don't exist
- **Orphaned Files**: No inbound links, not in expected location
- **Template Drift**: Files created from template but modified structure
- **Status Drift**: Project status doesn't match recent activity

**See [detection-patterns.md](detection-patterns.md) for pattern specifications.**

---

## Output Format

Uses **MAINTENANCE template** from shared infrastructure:

```markdown
# Vault Maintenance Report
Generated: [timestamp]
Scope: [Quick/Standard/Deep Path]
Files Scanned: [count]

## Critical Issues (Immediate Action Required)
[Organized by category: File Org, Template, Status, Metadata, Cleanup]

## Important Issues (Action Recommended)
[Same category structure]

## Recommendations (Optional Improvements)
[Same category structure]

## Summary
- Critical: [count]
- Important: [count]
- Recommendations: [count]
- Next Sweep: [date]
```

**See [shared/output-templates.md](../../shared/output-templates.md) for template details.**

---

## Integration Points

### Vault Structure
Works with Bryan's vault organization:
- Numbered folders: `00-Inbox` through `99-System`
- Flat email system: All emails in `Emails/` with tag-based organization
- Project hierarchy: `01-Projects/[Client]/[Project]/`
- Type property required for organization validation

### Sweep Log
Maintains state in `99-System/Vault Sweep Log.md`:
- Last sweep timestamp (for Quick Path filtering)
- Historical metrics (trend analysis for Deep Path)
- Recurring issues tracking

### Commands
Integrates with existing workflow:
- `/vault-sweep` command calls this skill
- Can be invoked standalone via natural language
- Results inform `/track` when action items generated

### OpenMemory
Stores patterns for future reference:
- Recurring organization issues
- Template compliance trends
- Common cleanup patterns

---

## Performance Targets

- **Quick Path**: 20-30 seconds, <50 files
- **Standard Path**: 45-60 seconds, 50-300 files
- **Deep Path**: 90-120 seconds, all files

**Token Usage**:
- Quick: ~2K tokens
- Standard: ~5K tokens
- Deep: ~8K tokens

---

## Error Handling

Follows standard error protocols (see [shared/error-handling.md](../../shared/error-handling.md)):

**Pattern 1: Graceful Degradation**
- Missing sweep log → Default to 7-day window
- Access denied → Skip inaccessible, continue with accessible
- YAML parse error → Flag file, continue validation

**Pattern 2: Validation Before Processing**
- Check vault path exists
- Verify PowerShell available (Windows requirement)
- Confirm reasonable file count
- Test sample file read access

**Pattern 4: Error Accumulation**
- Collect all issues before reporting
- Don't stop at first error
- Provide comprehensive error section in output

**Skill-Specific Handling**:
- Missing Type property → Flag as "No Type" (not error, but noted)
- Folder structure mismatch → Critical (affects navigation)
- Template field missing → Important (affects data quality)
- Broken wikilink → Important (affects linking)

---

## Example Scenarios

### Scenario 1: Morning Check (Quick Path)

**User**: "Quick vault check before I start work"

**Process**:
1. Read last sweep: Yesterday 5:00 PM
2. Filter: 23 files modified since yesterday
3. Launch 3 agents (File Org, Template, Metadata)
4. Find: 2 emails not in Emails/ folder
5. Report Critical issues only

**Output**:
```markdown
# Vault Maintenance Report
Scope: Quick Path
Files Scanned: 23

## Critical Issues
### File Organization
- [ ] email-from-john.md in 00-Inbox/ → Move to Emails/
- [ ] drpa-update.md in 01-Fleeting/ → Move to Emails/

## Summary
- Critical: 2 issues
- Next Sweep: Tonight
```

**Time**: 25 seconds

---

### Scenario 2: Weekly Maintenance (Standard Path)

**User**: "Run weekly vault sweep"

**Process**:
1. Read last sweep: Last Friday
2. Filter: 156 files modified in last 7 days
3. Launch all 5 agents in parallel
4. Cross-validate findings
5. Categorize: 3 Critical, 8 Important, 12 Recommendations

**Output**: Full maintenance report with all categories

**Time**: 58 seconds

---

### Scenario 3: Post-Migration Audit (Deep Path)

**User**: "I just reorganized the DRPA project folders, do a deep sweep to check everything"

**Process**:
1. Scan ALL files in `01-Projects/DRPA/` (no filter)
2. Launch all 5 agents with extended prompts
3. Historical comparison: Before vs after reorganization
4. Detailed validation of new structure
5. Confidence scoring on recommendations

**Output**: Comprehensive audit with trend analysis and migration quality report

**Time**: 115 seconds

---

## Temporal Filtering

Uses PowerShell patterns for efficient file filtering:

**Quick Path**:
```powershell
$lastSweep = Get-Date "2025-11-12 17:00"
Get-ChildItem -Path $vault -Recurse -File |
  Where-Object {$_.LastWriteTime -gt $lastSweep}
```

**Standard Path**:
```powershell
$threshold = (Get-Date).AddDays(-7)
Get-ChildItem -Path $vault -Recurse -File |
  Where-Object {$_.LastWriteTime -gt $threshold}
```

**Deep Path**: No filter, scan all files

**See [shared/powershell-temporal-filter.md](../../shared/powershell-temporal-filter.md) for complete patterns.**

---

## Validation Checklist

Before sweep:
- [ ] Vault path accessible
- [ ] PowerShell available (Windows)
- [ ] Obsidian CLI available (`obsidian version`, 2s timeout) — sets mode for agents
- [ ] Sweep log exists or can be created
- [ ] File count within reasonable range

During sweep:
- [ ] Agents launch successfully
- [ ] Error handling active
- [ ] Progress tracking
- [ ] CLI mid-run failure: confirm per-check fallback without aborting sweep
- [ ] CLI JSON output validated (parse response, not just exit code)

After sweep:
- [ ] All findings categorized
- [ ] Output formatted per template
- [ ] Sweep log updated
- [ ] Action items clear

---

## Success Metrics

Track in sweep log:

- **Coverage**: % of vault scanned
- **Issues Found**: Count by category and priority
- **Resolution Rate**: % of issues fixed since last sweep
- **Performance**: Actual time vs target per path
- **False Positives**: Issues flagged incorrectly (aim for <5%)

---

## Best Practices

1. **Run regularly**: Weekly Standard Path, daily Quick Path for active periods
2. **Address Critical first**: Don't let Critical issues accumulate
3. **Batch Recommendations**: Handle monthly, not immediately
4. **Monitor trends**: Recurring issues suggest process problems
5. **Update log**: Maintain sweep history for pattern analysis
6. **Test after changes**: Deep Path after major reorganizations

---

## Limitations

- **Windows-only**: PowerShell temporal filtering requires Windows
- **Obsidian CLI requires running instance**: CLI commands only work when Obsidian is open. Overnight/automated runs always use fallback mode.
- **Type property dependency**: Organization validation assumes Type property exists
- **YAML frontmatter required**: Metadata validation needs structured frontmatter
- **Performance**: Very large scopes (>10K files) may exceed Deep Path timing
- **Manual review**: Some findings require human judgment (false positives possible)

---

## Future Enhancements

- Cross-platform support (bash/find abstraction)
- Machine learning pattern recognition for recurring issues
- Auto-fix capability for simple issues (with user confirmation)
- ~~Integration with Obsidian plugin API for real-time validation~~ → **Partially achieved** via Obsidian CLI (v1.12.4+). CLI provides runtime access to graph data, properties, and search. Full plugin API integration remains future work.
- Custom validation rule configuration
- CLI-based tag analysis (`obsidian tags sort=count counts`) for Pattern 10
- CLI-based backlink analysis (`obsidian backlinks file="X"`) for link quality metrics

---

This skill ensures vault health through systematic, intelligent maintenance optimized for large-scale Obsidian environments.