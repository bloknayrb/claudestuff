---
description: Learn a user's writing style through guided prompts or sample analysis, then save as a named voice profile
---

## Learn My Style

You are running an interactive style-learning session to build a voice profile for the user. Follow these steps in order.

### Step 1: Profile Name

Ask the user: "What would you like to name this voice profile?"

Rules for the name: lowercase letters and hyphens only, max 32 characters. If the input doesn't match, ask again with an example. Examples: `professional`, `blog-voice`, `casual-email`.

### Step 2: Check for an Existing Profile

Use Bash to check whether the profile already exists:

```bash
ls ~/.claude/ghostwriter-profiles/{name}.json 2>/dev/null
```

If the file exists, ask: "A profile named **{name}** already exists. Would you like to:
- **(A) Add new samples and re-analyze** — keeps any existing sample excerpts and folds in new ones
- **(B) Start fresh and replace it** — discards the old profile entirely"

If the file does not exist, continue to Step 3.

### Step 3: Choose Input Mode

Ask: "How would you like me to learn your voice?"

- **(A) Guided prompts** — "I'll give you 5 short writing prompts designed to reveal your style efficiently. Takes about 10 minutes."
- **(B) Provide samples** — "Paste text, give me file paths, or point me at any source. Aim for at least 500 words total."
- **(C) Both** — "Start with your existing samples, then I'll fill in gaps with targeted prompts."

### Step 4: Collect Samples

**If guided prompts (A or C):**

Present the prompts one at a time. After the user responds to each prompt, share ONE concrete observation about their style before presenting the next prompt. Keep observations specific and grounded in what they actually wrote — for example: "I can see you favor short, punchy sentences and avoid semicolons entirely" or "You tend to anchor abstract points with a concrete anecdote right away."

The 5 prompts (present them in order, one at a time):

1. "Pick something you know well — a concept, a process, a hobby — and explain it to someone encountering it for the first time. Write 2-4 paragraphs."
2. "Take a position on something you feel strongly about — in your field, in life, wherever. Argue for it. What would you say to someone who disagrees? 2-4 paragraphs."
3. "Tell me about a time you learned something the hard way. Include enough detail that I can picture it. 2-4 paragraphs."
4. "Summarize what you do for a living — or your biggest current project — in exactly 2-3 sentences."
5. "Pick something in your field that most people get wrong, or that frustrates you. What's wrong with it and what would you do instead? 2-4 paragraphs."

The user may stop after any prompt. Even a single response of 150+ words is enough to produce a draft profile.

**If providing samples (B or C):**

Accept pasted text or file paths. For file paths, read each file with the Read tool. If the user is updating an existing profile (chose A in Step 2), read the existing profile JSON and extract its `sample_excerpts` array — you will combine those with the new samples before analysis.

### Step 5: Quick Profile Check

After collecting samples, estimate the total word count across everything gathered. Use this to set the confidence level you will store in the profile:

- **< 500 words** → confidence: `draft` — tell the user: "This is a draft profile — usable, but a bit thin. You can add more samples later to strengthen it."
- **500–1500 words** → confidence: `standard` — solid baseline.
- **1500+ words** → confidence: `high` — reliable fingerprint.

If the user wants to stop collecting samples, honor that at any point after 150 words.

### Step 6: Run Analysis

Concatenate all collected text into a single string and run the style metrics script:

```bash
printf '%s' "$COMBINED_TEXT" | uv run ${CLAUDE_PLUGIN_ROOT}/skills/style-analysis/scripts/style_metrics.py --json
```

Parse the JSON output. The script returns a metrics object you will embed in the profile.

### Step 7: Synthesize the Metavoice

Write a 200–400 word narrative in second person, addressed to Claude as instructions. This metavoice is the most important part of the profile — it is what the ghostwriter agent reads to reproduce the voice.

Requirements:
- Begin with "You write with..." or similar direct address to Claude
- Cover all six style dimensions (lexical, syntactic, punctuation, micro-patterns, tone, paragraph) but emphasize what is most distinctive about this writer
- Include specific examples drawn from the samples where possible (a phrase, a sentence pattern, a structural habit)
- State prohibitions explicitly: "You never use...", "Avoid..."
- Capture attitude and personality, not just mechanics
- Be concrete enough that another AI could reproduce this voice without seeing the original samples

### Step 8: Present the Profile for Review

Show the user:
- Profile name and confidence level
- A brief metrics summary (2–4 standout numbers or observations)
- The full metavoice text

Ask: "Does this capture your voice? I can adjust specific aspects if something feels off."

Revise the metavoice based on their feedback. Repeat until they confirm it's accurate, or they explicitly say to move on.

### Step 9: Save the Profile

Create the directory if it doesn't exist:

```bash
mkdir -p ~/.claude/ghostwriter-profiles
```

Build the profile JSON with this structure:

```json
{
  "schema_version": 1,
  "name": "{name}",
  "confidence": "{draft|standard|high}",
  "created": "{ISO-8601 timestamp}",
  "updated": "{ISO-8601 timestamp}",
  "sample_word_count": 0,
  "sample_count": 0,
  "metrics": {},
  "metavoice": "",
  "sample_excerpts": []
}
```

Field notes:
- `created`: use the current date/time; if updating an existing profile, keep the original `created` value and update only `updated`
- `sample_excerpts`: up to 10 excerpts, each approximately 50 words, drawn from different parts of the samples
- `metrics`: the parsed JSON output from the style metrics script

Write the file to `~/.claude/ghostwriter-profiles/{name}.json` using the Write tool.

### Step 10: Next Steps

Tell the user: "Your **{name}** profile is ready. You can now use it with the ghostwriter agent — ask me to draft, rewrite, critique, or tone-shift anything in your **{name}** voice. Type `/ghostwrite` for a quick start."

### PII Note

If the samples the user provided appear to contain sensitive content (personal details, private communications, confidential work), mention: "Note: short excerpts from your samples are stored in the profile file at `~/.claude/ghostwriter-profiles/`. The guided prompts are designed to avoid sensitive data, but if you provided existing documents, check whether they contain anything you'd rather not store."
