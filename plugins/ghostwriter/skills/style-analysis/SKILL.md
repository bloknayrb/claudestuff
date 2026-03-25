---
name: style-analysis
description: >-
  Analytical framework for writing style analysis and voice profile construction.
  Use when analyzing writing samples, building voice profiles, comparing styles,
  synthesizing metavoice descriptions, or understanding stylistic dimensions.
  Triggers on "analyze style", "style profile", "voice analysis", "writing fingerprint",
  "metavoice", "style comparison", "what makes my writing distinctive".
version: 1.0.0
tags: [writing, style, voice, analysis, profile]
allowed-tools:
  - Read
  - Bash
---

## Overview

Style analysis is the process of decomposing a writer's prose into measurable and observable dimensions, then synthesizing those observations into an actionable voice profile. The goal is not description for its own sake — it is to produce a profile precise enough that another writer (or Claude) could produce work the author would recognize as their own.

Analysis operates across six dimensions. Four have quantitative signals measured by `style_metrics.py`; two are qualitative and assessed by Claude during metavoice synthesis. Together they form a complete fingerprint.

## The Six Dimensions

| Dimension | What It Captures | How Measured | Reference |
|-----------|-----------------|--------------|-----------|
| **Lexical** | Vocabulary richness, formality, self-reference | MATTR, contraction rate, formality score, self-reference rate — script | style-dimensions.md |
| **Syntactic** | Sentence length patterns and passive voice tendency | Mean/median/std sentence length, passive voice heuristic — script | style-dimensions.md |
| **Punctuation** | Rhetorical punctuation signature | Per-1000-word rates for 6 marks — script | style-dimensions.md |
| **Micro-patterns** | Signature phrases, rhetorical tics, parenthetical habits | Qualitative — Claude assessment during metavoice synthesis | style-dimensions.md |
| **Tone** | Authority level, audience distance, emotional register | Qualitative — Claude assessment during metavoice synthesis | style-dimensions.md |
| **Paragraph** | Structural rhythm and density | Mean paragraph length in sentences and words — script | style-dimensions.md |

Read `references/style-dimensions.md` for full definitions, expected ranges, significance thresholds, and known measurement limitations for each dimension.

## Metavoice Synthesis

The metavoice is a 200-400 word narrative description of the author's voice, written in second person. It is the most important output of style analysis — it is what gets embedded in the profile and used to condition all ghostwriting.

**Structure requirements:**
- Opens with the author's dominant voice characteristic ("You write with X...")
- Covers all six dimensions, even if briefly
- Emphasizes what is distinctive, not what is merely present
- Cites specific examples from the analyzed samples ("You often open paragraphs with a question before answering it")
- Specifies prohibitions explicitly ("You never use exclamation marks. You avoid adverbs.")
- Captures personality and intellectual register, not just mechanics

**Second-person register is mandatory.** The metavoice is an instruction to an impersonator, not a description to a third party. "You tend toward long sentences with multiple subordinate clauses" is correct. "The author tends toward..." is wrong.

**When samples are thin** (draft confidence, < 500 words), the metavoice should be shorter and hedged: "Based on limited samples, you appear to..." Upgrade confidence and metavoice as more samples accumulate.

## Profile Format

Voice profiles are stored as JSON at `~/.claude/ghostwriter-profiles/{name}.json`. The schema tracks:

- Identity fields: `name`, `schema_version`, `confidence`, timestamps
- Sample provenance: `sample_word_count`, `sample_count`, `sample_excerpts`
- Quantitative metrics: all script-measured values under `metrics`
- Qualitative synthesis: `metavoice` narrative

Confidence levels:
- `draft` — fewer than 500 words of sample
- `standard` — 500-1500 words
- `high` — 1500+ words

Read `references/profile-format.md` for the full JSON schema with field-by-field documentation, validation rules, update strategy, and PII guidance.

## Elicitation Strategy

When a user has insufficient writing samples for analysis, use the five guided prompts to gather material. The prompts are designed to elicit stylistically distinct responses that reveal different dimensions of the author's voice.

**The five prompt types:**
1. **Explanation** — reveals vocabulary, formality, pedagogical tone
2. **Persuasion** — reveals rhetoric, conviction, emotional register
3. **Narrative** — reveals intimacy, detail level, humor, temporal structure
4. **Compression** — reveals what survives under constraint
5. **Critique** — reveals directness, critical voice, how they position alternatives

Not all five are always necessary. If the user has 500+ words from other sources, standard confidence may already be achievable. See `references/elicitation-prompts.md` for the exact prompt text, what each reveals, and guidance on the progressive reward approach (share one concrete observation after each response to sustain engagement).

## Script Usage

`style_metrics.py` produces quantitative metrics from a writing sample using Python stdlib only. It requires no dependencies beyond what ships with Python.

**Standard usage — text via stdin:**
```bash
printf '%s' "$TEXT" | uv run ${CLAUDE_PLUGIN_ROOT}/skills/style-analysis/scripts/style_metrics.py --json
```

**Compare new text against an existing profile:**
```bash
printf '%s' "$TEXT" | uv run ${CLAUDE_PLUGIN_ROOT}/skills/style-analysis/scripts/style_metrics.py --json --compare ~/.claude/ghostwriter-profiles/name.json
```

**Analyze a text file directly:**
```bash
uv run ${CLAUDE_PLUGIN_ROOT}/skills/style-analysis/scripts/style_metrics.py --file path/to/sample.txt --json
```

Without `--json`, the script outputs a human-readable report. With `--json`, it outputs a machine-readable object suitable for embedding in or comparing against a profile. The `--compare` flag outputs a comparison with deltas and significance flags for metrics that fall outside their thresholds.

## Known Limitations

The script uses Python stdlib only — no spaCy, no NLTK. This means some measurements are heuristic-grade.

**Sentence splitting** uses punctuation patterns and may misfire on unusual abbreviations not in the built-in list — producing falsely short or long sentence length readings. Common abbreviations (Dr., Mr., vs., e.g., etc.) are handled.

**Passive voice heuristic** matches `was/were/is/are/been/being + past participle` patterns but cannot always distinguish true passive constructions from adjectival participles ("she was tired", "the door was open"). An exclusion list mitigates common false positives, but expect a 20-40% error rate. Treat passive voice percentage as directional, not precise.

**MATTR** uses a 100-word sliding window and falls back to raw TTR on texts shorter than 100 words. Profiles built from very short samples will show less reliable MATTR values.

**Formality score** is a composite heuristic — it reflects contraction rate, self-reference, sentence length, and passive voice, but cannot capture register shifts, irony, or audience-aware code-switching. Use it as a starting signal, not a definitive measurement.
