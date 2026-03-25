---
description: Quick-start ghostwriting — draft, rewrite, critique, analyze, or manage voice profiles
---

## Ghostwrite

You are the entry point for the ghostwriter plugin. Run these steps in order.

### Step 1: Check for Profiles

Use Bash to list any saved voice profiles:

```bash
ls ~/.claude/ghostwriter-profiles/*.json 2>/dev/null
```

### Step 2: Display Available Profiles

**If profiles exist:** For each `.json` file found, read it with the Read tool, then display a single line showing:
- The profile name (from the `name` field)
- The confidence level (from the `confidence` field)
- The first sentence of the metavoice (from the `metavoice` field)

Example display format:
```
• blog-voice (high) — You write with a casual, conversational tone that never wastes words.
• professional (standard) — You favor measured, evidence-first arguments.
```

**If no profiles exist:** Say: "No voice profiles found. Run `/learn-my-style` to create one, or paste some text here and I can analyze your writing style right now."

### Step 3: Offer Actions

Present the following options:

- **Draft** — Write something new in a voice profile
- **Rewrite** — Rewrite existing text in a voice profile
- **Critique** — Compare text against a voice profile and identify where it drifts
- **Analyze** — Analyze any text's writing style (no profile needed)
- **Manage profiles** — Inspect, delete, or get details about your profiles

### Step 4: Route Based on Choice

**Draft:**
If multiple profiles exist, ask which one to use. Ask what to write and any relevant context or constraints. Then draft the piece with the chosen profile's metavoice as your primary style instruction. Read the full profile JSON before drafting to load the metavoice and metrics.

**Rewrite:**
If multiple profiles exist, ask which one to use. Ask for the text to rewrite (accept pasted text or a file path; read files with the Read tool). Then rewrite, preserving the original meaning while bringing the output into alignment with the profile's metavoice. If the rewrite changes the substance or cuts content, note what changed and why.

**Critique:**
If multiple profiles exist, ask which one to use. Ask for the text to critique (pasted or file path). Read the profile. Compare the text against the metavoice and metrics — identify 3–5 specific places where the text diverges from the profile voice, with concrete suggestions for each. Also note what the text gets right.

**Analyze:**
Ask the user to paste the text they want analyzed (or provide a file path; read with the Read tool). Run the style metrics script:

```bash
printf '%s' "$TEXT" | uv run ${CLAUDE_PLUGIN_ROOT}/skills/style-analysis/scripts/style_metrics.py --json
```

Present a plain-language summary of the style: sentence rhythm, vocabulary register, structural patterns, tone, and anything distinctive. Do not require a profile — this is a standalone analysis.

**Manage profiles:**

Ask which profile they want to work with (display the list again if needed), then ask what they want to do:

- **Inspect**: Read the full profile JSON and display all fields in a readable format — name, confidence, created/updated dates, word count, metavoice in full, and all metrics with brief labels explaining what each means.
- **Delete**: Confirm the deletion by name ("Are you sure you want to delete the **{name}** profile? This cannot be undone."). If confirmed, run:
  ```bash
  rm ~/.claude/ghostwriter-profiles/{name}.json
  ```
  Then confirm: "Profile **{name}** deleted."
