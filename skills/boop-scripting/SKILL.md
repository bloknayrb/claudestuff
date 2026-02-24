---
name: boop-scripting
description: Use when writing or extending Boop/Woop scripts for text manipulation. Covers the ScriptExecution API (state.text, state.selection, state.insert, state.isSelection), metadata block fields, and JavaScript patterns for Woop's V8 sandbox on Windows.
version: 1.1.0
tags: [boop, woop, javascript, text, scripting, manipulation, windows]
---

# Boop Scripting Skill

Woop is a Windows scriptable scratchpad — a C#/UWP port of the macOS Boop app. Users paste text and run scripts to transform it — joining lines, converting formats, sorting, encoding. Scripts are written in JavaScript and execute in Woop's V8 sandbox (via Microsoft ClearScript).

**Invoke this skill when**: writing a new Woop/Boop script, debugging an existing one, or explaining the script API.

---

## Script Anatomy

Every Boop script has two parts: a metadata comment block at the top, and a `main(state)` function.

```javascript
//  { api:1, name:"My Script", description:"Does something useful",
//    tags:"transform, format", bias:0.0 }

function main(state) {
  // your logic here
}
```

### Metadata Fields

| Field | Required | Notes |
|-------|----------|-------|
| `api` | Yes | Always `1` |
| `name` | Yes | Displayed in Woop's script list |
| `description` | Yes | Shown in the script picker tooltip |
| `icon` | No | Icon string — Woop accepted values are undocumented; omit or use `""` (see Icon Reference) |
| `tags` | No | Comma-separated; drives fuzzy search in the script picker |
| `bias` | No | Float. Positive = rank higher, negative = rank lower in results |

> **Note**: The `author` field exists in original macOS Boop but is **not** present in Woop's `ScriptMetadata` — omit it in Woop scripts.

All metadata lives in a **single-line comment** starting with `// ` followed by a JSON object. Multi-line metadata is not supported.

---

## ScriptExecution API

The `state` argument passed to `main(state)` is a `ScriptExecution` instance.

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `state.text` | string (read/write) | The active selection if one exists, otherwise the full document. Writing sets the selection or full document. |
| `state.selection` | string (read/write) | The selected text only. Writing replaces the selection. |
| `state.fullText` | string (read/write) | The entire document, regardless of selection. Writing replaces the whole document. |
| `state.isSelection` | bool (read-only) | `true` if the user has an active selection, `false` otherwise. Useful for conditional logic. (Woop extension — not in original Boop.) |
| `state.insert(str)` | method | Inserts `str` at the caret position, or replaces the current selection. |
| `state.postInfo(str)` | method | Displays an informational message in the Woop toolbar. |
| `state.postError(str)` | method | Displays an error message in the Woop toolbar and aborts changes. |

### Which property to use

- **Default transform** — read and write `state.text`. Works correctly whether or not the user has a selection.
- **Selection-only transform** — read `state.selection`, write back to `state.selection`.
- **Full document always** — use `state.fullText` when the transform needs whole-document context (e.g. counting all lines).
- **Caret insert** — use `state.insert(str)` when you're generating new content to inject, not transforming existing text.

---

## Common Patterns

### 1. Simple text transform

Trim whitespace from each line.

```javascript
//  { api:1, name:"Trim Lines", description:"Remove leading/trailing whitespace from each line",
//    tags:"trim, whitespace, lines" }

function main(state) {
  state.text = state.text
    .split("\n")
    .map(line => line.trim())
    .join("\n");
}
```

### 2. Split / sort / join

Sort lines alphabetically.

```javascript
//  { api:1, name:"Sort Lines", description:"Sort lines alphabetically (case-insensitive)",
//    tags:"sort, lines, alphabetical" }

function main(state) {
  const lines = state.text.split("\n");
  lines.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  state.text = lines.join("\n");
}
```

### 3. Feedback with postInfo

Count lines and report without modifying text.

```javascript
//  { api:1, name:"Count Lines", description:"Report number of lines without changing text",
//    tags:"count, lines, stats" }

function main(state) {
  const lines = state.fullText.split("\n");
  const nonEmpty = lines.filter(l => l.trim().length > 0).length;
  state.postInfo(`${lines.length} lines (${nonEmpty} non-empty)`);
}
```

### 4. Format conversion with error guard

Convert CSV to a Markdown table. Use `postError` for invalid input.

```javascript
//  { api:1, name:"CSV to Markdown Table", description:"Convert CSV text to a Markdown table",
//    tags:"csv, markdown, table, convert" }

function main(state) {
  const rows = state.text.trim().split("\n").map(r => r.split(","));

  if (rows.length < 2) {
    state.postError("Need at least a header row and one data row.");
    return;
  }

  const header = rows[0];
  const separator = header.map(() => "---");
  const body = rows.slice(1);

  const toRow = cells => "| " + cells.map(c => c.trim()).join(" | ") + " |";

  state.text = [
    toRow(header),
    toRow(separator),
    ...body.map(toRow)
  ].join("\n");
}
```

---

## Sandbox Constraints

Woop scripts run in **V8** via `Microsoft.ClearScript.V8` — Google's JavaScript engine, the same engine used by Node.js and Chrome. ES6+ syntax is fully supported.

### What's unavailable

| API | Status |
|-----|--------|
| `window` | Not available |
| `document` / DOM | Not available |
| `fetch` / `XMLHttpRequest` | Not available |
| `process` | Not available |
| `import` (ES modules) | Not available |
| `Crypto` | Not available |
| `setTimeout` / `setInterval` | Not available |
| UI presentation (alerts, dialogs) | Not available |

### What works

- All ES6+ language features: arrow functions, destructuring, template literals, `const`/`let`, spread, optional chaining
- Built-in globals: `JSON`, `Math`, `Date`, `RegExp`, `Array`, `Object`, `String`, `Number`
- `atob` / `btoa` for base64 — reliably available in V8
- **`require()`** — Woop ships a RequireLoader (Require.js bundled in assets); CommonJS-style `require()` is available

### Best practices

- **Prefer vanilla JS for simple transforms** — `require()` is available but adds complexity; built-in JS methods cover most text manipulation needs.
- **Use `postError` to abort** — calling `state.postError(msg)` prevents the text change from being applied and shows the message to the user.
- **Use `state.isSelection`** — check `state.isSelection` when you want different behavior for selection vs. full document, rather than inferring from `state.text`.

---

## Icon Reference

The `icon` metadata field is a string, but **Woop's accepted icon values are not documented**. Unlike the original macOS Boop (which uses SF Symbols and xcassets), Woop does not support SF Symbol names.

**Recommendation**: omit the `icon` field entirely, or set it to an empty string (`icon:""`). The script will function normally without an icon.

```javascript
//  { api:1, name:"My Script", description:"Does something useful",
//    icon:"", tags:"tag1, tag2" }
```

> **macOS Boop note**: If you're targeting the original Boop on macOS, icons use SF Symbol names (e.g. `"wand.and.stars"`) or xcassets bundle names. These are macOS-only and have no equivalent in Woop.

---

## Template

When generating a new Boop script, start from `template.js` in this skill's directory for a ready-to-copy starter with inline comments.
