# Workflow Recipes

Complete multi-step recipes combining Obsidian CLI with other tools. Each recipe includes prerequisites, steps, and notes.

## 1. Vault Health Check

**When to use:** Periodic vault maintenance, before major reorganization, or when vault feels "messy."

**Steps:**

1. Verify CLI availability:
   ```bash
   timeout 3 obsidian version 2>/dev/null || echo "CLI unavailable"
   ```
2. Count orphaned files:
   ```bash
   obsidian file:orphans vault="MyVault" total
   ```
3. Count unresolved links:
   ```bash
   obsidian link:unresolved vault="MyVault" total
   ```
4. Search for empty files:
   ```bash
   obsidian search query="file:/.+/" vault="MyVault" format=json limit=500
   ```
   Then filter results by reading each file and checking for empty/minimal content.
5. Compile into a report with counts and actionable file lists.

**Notes:** Run orphans and unresolved in parallel — they're independent queries. For large vaults, use `limit` on the full listings and `total` for the summary.

## 2. Bulk Property Update

**When to use:** Changing status across many files, adding a new property to a category, migrating metadata schema.

**Steps:**

1. Search for target files:
   ```bash
   obsidian search query="tag:#old-status" vault="MyVault" format=json
   ```
2. Review the results to confirm they match expectations.
3. Loop through results, updating each:
   ```bash
   for file in "${targets[@]}"; do
     obsidian property:set file="$file" key="status" value="new-status" vault="MyVault" silent
   done
   ```
4. Verify with a spot check:
   ```bash
   obsidian property:get file="<sample-file>" key="status" vault="MyVault"
   ```

**Notes:** Always preview search results before running the update loop. Use `silent` to prevent focus stealing. For hundreds of files, consider batching with brief pauses to avoid overwhelming IPC.

## 3. Content Migration

**When to use:** Moving files between folders while preserving links, reorganizing vault structure.

**Steps:**

1. Identify files to migrate:
   ```bash
   obsidian file:list path="OldFolder" vault="MyVault" format=json
   ```
2. For each file, use CLI move (preserves links):
   ```bash
   obsidian file:move file="OldFolder/note.md" to="NewFolder/note.md" vault="MyVault" silent
   ```
3. After all moves, verify no broken links:
   ```bash
   obsidian link:unresolved vault="MyVault" path="NewFolder"
   ```
4. Check for orphans that may have been created:
   ```bash
   obsidian file:orphans vault="MyVault" path="OldFolder"
   ```

**Notes:** CLI `file:move` is strongly preferred over direct file rename because it updates all internal links. Wait ~60 seconds after bulk moves before running verification queries (indexing lag).

## 4. Search-and-Transform

**When to use:** Bulk content standardization, format migration, extracting structured data from notes.

**Steps:**

1. Search for files matching criteria:
   ```bash
   obsidian search query="<pattern>" vault="MyVault" format=json limit=100
   ```
2. Parse the JSON output to extract file paths.
3. For each file, read content:
   ```bash
   obsidian file:read file="<path>" vault="MyVault"
   ```
4. Apply transformation (regex, restructure, extract) using your preferred method.
5. Write the transformed content back using the Edit or Write tool (direct file ops are faster for content changes).
6. Optionally update properties via CLI:
   ```bash
   obsidian property:set file="<path>" key="migrated" value="true" vault="MyVault" silent
   ```

**Notes:** Use CLI for discovery and metadata, direct file ops for content transformation. This hybrid approach is faster and more reliable than doing everything through CLI.

## 5. Link Audit

**When to use:** Preparing a vault for sharing, publishing, or archival. Ensuring structural integrity.

**Steps:**

1. Get unresolved links (broken references):
   ```bash
   obsidian link:unresolved vault="MyVault" format=json
   ```
2. Get orphaned files (disconnected from graph):
   ```bash
   obsidian file:orphans vault="MyVault" format=json
   ```
3. For key files, check who links to them:
   ```bash
   obsidian link:backlinks file="important-note.md" vault="MyVault" format=json
   ```
4. Search for potential dead external links:
   ```bash
   obsidian search query="http" vault="MyVault" format=json limit=200
   ```
   Then validate URLs programmatically.
5. Compile into structured report: unresolved links, orphans, key file connectivity, dead URLs.

**Notes:** This is the most comprehensive vault quality check. Run as a periodic maintenance task (monthly for active vaults). For very large vaults, scope each query with `path=` to process section by section.

## 6. Daily Note Rollover

**When to use:** Morning routine automation — carrying over incomplete tasks from yesterday.

**Steps:**

1. Read yesterday's daily note:
   ```bash
   yesterday=$(date -d "yesterday" +%Y-%m-%d)
   obsidian daily:read date="$yesterday" vault="MyVault"
   ```
2. Extract incomplete tasks (lines matching `- [ ]`) from the output.
3. Open/create today's note:
   ```bash
   obsidian daily:open vault="MyVault" silent
   ```
4. Append rolled-over tasks:
   ```bash
   obsidian daily:append content="## Rolled Over\n$tasks" vault="MyVault"
   ```

**Notes:** Date format in step 1 must match your daily note date format. On Windows, use PowerShell for date arithmetic instead of `date -d`. The CLI handles daily note path resolution automatically — you only need the date.

## 7. Template Batch Creation

**When to use:** Setting up a new project, creating a meeting series, scaffolding content for a course or documentation set.

**Steps:**

1. Define your list of items (file names and any custom properties).
2. For each item, create from template:
   ```bash
   obsidian file:create name="$item_name" template="Project Note" path="Projects/$project" vault="MyVault" silent
   ```
3. Set custom properties on each:
   ```bash
   obsidian property:set file="Projects/$project/$item_name.md" key="owner" value="$owner" vault="MyVault" silent
   obsidian property:set file="Projects/$project/$item_name.md" key="due" value="$due_date" vault="MyVault" silent
   ```
4. After all files are created (and ~60s for indexing), verify:
   ```bash
   obsidian file:list path="Projects/$project" vault="MyVault"
   ```

**Notes:** Always use `silent` in the creation loop. Set properties immediately after creation while you have the file path — don't rely on searching for them later (indexing lag). For large batches (50+ files), add brief pauses between groups of 10.

## 8. Availability-First Automation

**When to use:** Any automation that should work regardless of whether Obsidian is running. Pattern from vault-sweeping's dual-mode detection.

**Steps:**

1. Check CLI availability:
   ```bash
   cli_available=false
   if timeout 3 obsidian version 2>/dev/null; then
     cli_available=true
   fi
   ```
2. Branch on availability:
   - **CLI path:** Use `obsidian` commands for full-featured operations.
   - **Fallback path:** Use Read/Write/Edit/Glob/Grep for direct file operations. You lose access to the link graph, search index, and template resolution, but basic file operations still work.
3. Document which features are degraded in fallback mode so the user knows what they're missing.

**Notes:** The vault-sweeping skill implements this pattern comprehensively — use it directly for maintenance tasks rather than reimplementing. This recipe is for building your own dual-mode automations. The 3-second timeout prevents hanging when Obsidian is closed.
