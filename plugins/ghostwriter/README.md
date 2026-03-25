# Ghostwriter

Learn a user's writing style from samples, store named voice profiles, then draft, rewrite, critique, and tone-shift in that voice.

## Quick Start

```
/learn-my-style          # Build a voice profile (guided prompts or your own samples)
/ghostwrite              # Draft, rewrite, critique, or manage profiles
```

Or just talk to the ghostwriter agent directly: "Draft a project update email in my professional voice."

## Components

### Commands

| Command | Purpose |
|---------|---------|
| `/learn-my-style` | Guided style learning — 5 targeted writing prompts or bring your own samples |
| `/ghostwrite` | Quick-start menu — pick a profile, choose an action, manage profiles |

### Agent

**ghostwriter** — Writes in your voice. Five modes:

- **Draft** — Generate new content in a saved voice profile
- **Rewrite** — Transform existing text to match your voice
- **Critique** — Compare any text against your profile with quantitative metrics
- **Tone Shift** — Adjust register (formal/casual) while keeping your voice
- **Analyze** — Describe any text's writing style (no profile needed)

### Skill

**style-analysis** — Analytical framework for writing style. Covers six dimensions (lexical, syntactic, punctuation, micro-patterns, tone, paragraph), metavoice synthesis, and profile format.

### Script

**style_metrics.py** — Quantitative style engine (pure stdlib Python). Computes MATTR, sentence length stats, contraction rate, punctuation signature, passive voice heuristic, formality score, and more.

## How It Works

1. **Learn**: `/learn-my-style` walks you through 5 writing prompts (or you provide existing samples). Each prompt is designed to reveal different aspects of your voice — from how you explain things to how you argue and tell stories.

2. **Profile**: Your writing is analyzed quantitatively (sentence length, vocabulary richness, punctuation habits) and qualitatively (a "metavoice" narrative that describes your style as instructions). Both are saved as a named profile.

3. **Write**: The ghostwriter agent loads your profile and applies it — matching your sentence rhythm, vocabulary choices, punctuation patterns, and personality.

## Profile Storage

Profiles are saved as JSON at `~/.claude/ghostwriter-profiles/{name}.json`. They persist across sessions and projects.

### Confidence Levels

| Level | Sample Size | Quality |
|-------|------------|---------|
| **draft** | < 500 words | Usable but thin — add more samples to improve |
| **standard** | 500-1500 words | Solid baseline for most writing tasks |
| **high** | 1500+ words | Reliable fingerprint across all dimensions |

## Requirements

- Python 3.12+ (for `style_metrics.py`)
- `uv` (Python package runner)
