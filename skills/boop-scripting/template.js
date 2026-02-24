// Woop script template — copy this file and fill in the fields below.
//
// The metadata block MUST be a single-line comment starting with "// "
// followed by a valid JSON object. Multi-line metadata is not supported.
//
// icon:"" — Woop's accepted icon values are undocumented; omit or leave empty.
// author  — not supported in Woop (exists in original macOS Boop only).
//
//  { api:1, name:"Script Name", description:"What this script does",
//    icon:"", tags:"tag1, tag2", bias:0.0 }

function main(state) {
  // state.text           — active selection if present, otherwise the full document (read/write)
  // state.selection      — selected text only (read/write)
  // state.fullText       — entire document regardless of selection (read/write)
  // state.isSelection    — true if user has an active selection (read-only, Woop only)
  // state.insert(str)    — insert str at caret / replace selection
  // state.postInfo(str)  — show informational message in the toolbar
  // state.postError(str) — show error message and abort the text change

  // ── Read input ────────────────────────────────────────────────────────────
  const input = state.text;  // use state.fullText if you always need the whole doc

  // ── Guard: validate before transforming ───────────────────────────────────
  if (!input.trim()) {
    state.postError("No text to transform.");
    return;
  }

  // ── Transform ─────────────────────────────────────────────────────────────
  const output = input; // replace with your transformation

  // ── Write output ──────────────────────────────────────────────────────────
  state.text = output;

  // Optional: show a feedback message (does NOT prevent the text change)
  // state.postInfo("Done.");
}
