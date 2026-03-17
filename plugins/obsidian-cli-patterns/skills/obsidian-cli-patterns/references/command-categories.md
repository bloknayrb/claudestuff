# Command Categories Reference

> Run `obsidian help <command>` for full parameter details. This reference reflects CLI v1.12+ and may lag behind updates.

## Core & System

| Command | Description |
|---------|-------------|
| `obsidian version` | Print CLI and Obsidian version |
| `obsidian info` | Vault metadata (path, file count, plugin list) |
| `obsidian help <command>` | Detailed help for any command |
| `obsidian open` | Open Obsidian or bring to foreground |
| `obsidian open vault=<name>` | Open/switch to a specific vault |

**Tip:** `obsidian version` with a timeout is the standard availability check. If it hangs, Obsidian isn't running or CLI isn't in PATH.

## Daily Notes

| Command | Description |
|---------|-------------|
| `obsidian daily:open` | Open today's daily note (creates if needed) |
| `obsidian daily:open silent` | Open without focusing |
| `obsidian daily:read` | Read today's daily note content |
| `obsidian daily:read date=YYYY-MM-DD` | Read a specific day's note |
| `obsidian daily:append content="..."` | Append text to today's note |
| `obsidian daily:prepend content="..."` | Prepend text to today's note |

**Tip:** Daily note commands respect your daily note settings (folder, format, template). Never hardcode daily note paths — let the CLI resolve them.

## Files

| Command | Description |
|---------|-------------|
| `obsidian file:create name="Note Name"` | Create a new note |
| `obsidian file:create name="..." template="Template"` | Create from template |
| `obsidian file:create name="..." path="Folder"` | Create in specific folder |
| `obsidian file:open file="path/to/note.md"` | Open a file |
| `obsidian file:read file="path/to/note.md"` | Read file content |
| `obsidian file:delete file="path/to/note.md"` | Delete a file |
| `obsidian file:move file="old.md" to="Folder/old.md"` | Move/rename a file |
| `obsidian file:list` | List all files |
| `obsidian file:list path="Folder"` | List files in folder |
| `obsidian file:orphans` | Find orphaned files (no incoming links) |

**Tip:** `file:move` updates all internal links pointing to the moved file — this is a major advantage over direct file rename. Always use CLI for moves when link integrity matters.

## Search

| Command | Description |
|---------|-------------|
| `obsidian search query="search terms"` | Full-text search |
| `obsidian search query="tag:#project"` | Search by tag |
| `obsidian search query="path:Folder"` | Search within folder |
| `obsidian search query="..." format=json` | JSON output for parsing |
| `obsidian search query="..." limit=20` | Limit results |
| `obsidian search query="..." sort=modified` | Sort by modification date |

**Tip:** Search supports Obsidian's full query syntax including boolean operators (`AND`, `OR`, `NOT`), field prefixes (`tag:`, `path:`, `file:`), and quoted phrases. Test complex queries in Obsidian's search pane first, then use the same syntax in CLI.

## Tasks

| Command | Description |
|---------|-------------|
| `obsidian task:list` | List all tasks |
| `obsidian task:list status=incomplete` | Incomplete tasks only |
| `obsidian task:list path="Projects"` | Tasks in folder |
| `obsidian task:list format=json` | JSON output |
| `obsidian task:list limit=50` | Limit results |
| `obsidian task:list tag="#urgent"` | Tasks with specific tag |

**Tip:** Task queries scan the entire vault by default. Always scope with `path=` or `limit=` on large vaults. For recurring task aggregation, consider caching results rather than re-querying.

## Tags & Properties

| Command | Description |
|---------|-------------|
| `obsidian tag:list` | List all tags with counts |
| `obsidian tag:list path="Folder"` | Tags within folder |
| `obsidian tag:list counts` | Include usage counts |
| `obsidian property:get file="note.md"` | Get all properties |
| `obsidian property:get file="note.md" key="status"` | Get specific property |
| `obsidian property:set file="note.md" key="status" value="done"` | Set a property |
| `obsidian property:set file="note.md" key="tags" value="a,b"` | Set multi-value property |

**Tip:** `property:set` handles YAML types correctly — booleans, numbers, arrays, dates. Prefer it over manual frontmatter editing, especially for multi-value fields where YAML list syntax is error-prone.

## Links & Structure

| Command | Description |
|---------|-------------|
| `obsidian link:resolve link="[[Note Name]]"` | Resolve a wikilink to file path |
| `obsidian link:backlinks file="note.md"` | Find all files linking to this note |
| `obsidian link:unresolved` | Find all unresolved links in vault |
| `obsidian link:unresolved path="Folder"` | Unresolved links in folder |
| `obsidian file:orphans` | Files with no incoming links |
| `obsidian file:orphans total` | Count of orphaned files |

**Tip:** Combine `file:orphans`, `link:unresolved`, and `link:backlinks` for comprehensive link audits. The link graph is Obsidian's most valuable index — these commands expose it.

## Bookmarks

| Command | Description |
|---------|-------------|
| `obsidian bookmark:list` | List all bookmarks |
| `obsidian bookmark:add file="note.md"` | Add a bookmark |
| `obsidian bookmark:remove file="note.md"` | Remove a bookmark |
| `obsidian bookmark:add file="note.md" group="Work"` | Add to bookmark group |

**Tip:** Bookmarks are useful for programmatic "favorites" or building navigation structures. Less commonly needed in automation than other commands.

## Templates

| Command | Description |
|---------|-------------|
| `obsidian template:list` | List available templates |
| `obsidian template:apply template="Template" file="note.md"` | Apply template to existing file |

**Tip:** For batch file creation from templates, use `file:create` with `template=` parameter rather than creating then applying — it's a single operation.

## Bases

| Command | Description |
|---------|-------------|
| `obsidian base:list` | List .base files |
| `obsidian base:query file="data.base"` | Execute a base query |
| `obsidian base:query file="data.base" format=json` | JSON output |

**Tip:** `base:query` outputs the current results of a .base file's view. For creating or editing .base files themselves, use the obsidian-bases skill.

## Sync & Publish

| Command | Description |
|---------|-------------|
| `obsidian sync:status` | Check sync status |
| `obsidian sync:start` | Start sync |
| `obsidian publish:list` | List published files |
| `obsidian publish:publish file="note.md"` | Publish a file |

**Tip:** These commands affect shared state. Use with caution in automation — an accidental bulk publish can expose unfinished content.

## Themes & Plugins

| Command | Description |
|---------|-------------|
| `obsidian plugin:list` | List installed plugins |
| `obsidian plugin:enable id="plugin-id"` | Enable a plugin |
| `obsidian plugin:disable id="plugin-id"` | Disable a plugin |
| `obsidian plugin:reload id="plugin-id"` | Reload a plugin (dev) |
| `obsidian theme:list` | List installed themes |
| `obsidian theme:set name="theme-name"` | Switch theme |

**Tip:** `plugin:reload` is the core of the plugin development loop. See the official obsidian-cli skill for the full dev workflow.

## Developer Tools

| Command | Description |
|---------|-------------|
| `obsidian eval code="..."` | Execute JavaScript in Obsidian |
| `obsidian console:read` | Read developer console output |
| `obsidian screenshot` | Capture Obsidian window |
| `obsidian screenshot file="note.md"` | Screenshot specific note |
| `obsidian dom:inspect selector="..."` | Inspect DOM elements |

**Tip:** `eval` has full Obsidian API access — powerful but dangerous. Never pass unsanitized input. For plugin development workflows (reload → check errors → screenshot → inspect), follow the official obsidian-cli skill's detailed guidance.

## Multi-Vault

Most commands accept `vault=<name>` to target a specific vault:

```bash
obsidian search query="todo" vault="Work"
obsidian file:create name="Note" vault="Personal" silent
obsidian file:orphans vault="Archive" total
```

**Tip:** When multiple vaults are open, **always** specify `vault=` for write operations. For read operations, specify it when precision matters. The cost of adding `vault=` is zero; the cost of targeting the wrong vault can be significant.
