# Profile Format Reference

Full documentation for the voice profile JSON schema. Profiles are stored at
`~/.claude/ghostwriter-profiles/{name}.json`.

---

## Full Schema Example

```json
{
  "schema_version": 1,
  "name": "profile-name",
  "confidence": "standard",
  "created": "2026-03-24T14:30:00Z",
  "updated": "2026-03-24T14:30:00Z",
  "sample_word_count": 2500,
  "sample_count": 5,
  "metrics": {
    "sentence_length_mean": 26.4,
    "sentence_length_median": 23.0,
    "sentence_length_std": 12.1,
    "sentence_length_min": 4,
    "sentence_length_max": 68,
    "mattr": 0.72,
    "contraction_rate": 3.2,
    "passive_voice_heuristic": 14.0,
    "formality_score": 7.1,
    "punctuation": {
      "semicolons": 2.1,
      "em_dashes": 4.3,
      "ellipses": 0.4,
      "parentheticals": 3.0,
      "exclamation_marks": 0.0,
      "question_marks": 1.7
    },
    "paragraph_length_sentences": 3.2,
    "paragraph_length_words": 84.0,
    "self_reference_rate": 2.1
  },
  "metavoice": "You write with precision and economy...",
  "sample_excerpts": [
    "Fifty-word excerpt from the most recent sample...",
    "Fifty-word excerpt from an earlier sample..."
  ]
}
```

---

## Field Documentation

### `schema_version`
Integer. Currently `1`. Increment on backward-incompatible schema changes.
Consumers should check this field before parsing.

### `name`
String. Lowercase, hyphens only, max 32 characters. Must match the filename
(`{name}.json`). Examples: `professional`, `blog-voice`, `casual-email`.

### `confidence`
Enum: `"draft"`, `"standard"`, or `"high"`.
- `draft`: fewer than 500 words of sample. Metrics are directional; metavoice should hedge.
- `standard`: 500-1500 words. Reliable for most ghostwriting tasks.
- `high`: 1500+ words. Sufficient for high-stakes or stylistically demanding work.

Set automatically based on `sample_word_count`.

### `created`
ISO-8601 datetime string (UTC). Set at profile creation; never updated.

### `updated`
ISO-8601 datetime string (UTC). Updated every time the profile is regenerated.

### `sample_word_count`
Integer. Total word count across all samples used. Cumulative — increases as
new samples are added. Determines `confidence`.

### `sample_count`
Integer. Number of distinct writing samples included. Starts at 1.

### `metrics`
Object containing all quantitative measurements. All values are numeric.

**Sentence length fields:**
- `sentence_length_mean` — float, words per sentence
- `sentence_length_median` — float, words per sentence
- `sentence_length_std` — float, standard deviation
- `sentence_length_min` — integer, shortest sentence
- `sentence_length_max` — integer, longest sentence

**Lexical fields:**
- `mattr` — float, 0.0-1.0, moving average type-token ratio
- `contraction_rate` — float, contractions per 100 words
- `passive_voice_heuristic` — float, percentage of sentences with passive construction
- `formality_score` — float, 0.0-10.0
- `self_reference_rate` — float, first-person pronouns per 100 words

**Punctuation fields** (all float, per 1000 words):
- `punctuation.semicolons`
- `punctuation.em_dashes`
- `punctuation.ellipses`
- `punctuation.parentheticals`
- `punctuation.exclamation_marks`
- `punctuation.question_marks`

**Paragraph fields:**
- `paragraph_length_sentences` — float, mean sentences per paragraph
- `paragraph_length_words` — float, mean words per paragraph

### `metavoice`
String. The synthesized voice narrative, 200-400 words, second person.
This is the primary artifact used by ghostwriting agents.

### `sample_excerpts`
Array of strings. Up to 10 entries, each ~50 words. Newest first.
When the array reaches 10 entries, drop the oldest on update.

---

## Update Strategy

When adding new samples to an existing profile:

1. Combine new sample text with all previous sample text
2. Re-run `style_metrics.py` on the combined corpus
3. Regenerate the metavoice from the full analysis
4. Increment `sample_count`
5. Add a new excerpt; drop the oldest if array exceeds 10
6. Update `sample_word_count` with the cumulative total
7. Recalculate `confidence` from the new word count
8. Update `updated` timestamp; leave `created` unchanged

If the new sample produces significantly different metrics, note the shift
in the metavoice. Separate profiles are appropriate for genuinely different
registers (e.g., `bryan-technical` vs. `bryan-newsletter`).

---

## Validation Rules

A profile is valid when:
- JSON is well-formed
- `name` matches the filename (without `.json` extension)
- `confidence` is one of `"draft"`, `"standard"`, `"high"`
- All values under `metrics` are numeric
- `schema_version` is present and is an integer
- `metavoice` is a non-empty string
- `sample_excerpts` has 10 or fewer entries
- `created` and `updated` are parseable ISO-8601 strings

---

## Storage Location

`~/.claude/ghostwriter-profiles/{name}.json`

On Windows, `~` resolves to `C:\Users\{username}`. The directory must be
created on first use if it does not exist.

---

## PII Guidance

`sample_excerpts` stores plaintext from the author's writing. Recommendations:
- Use non-sensitive writing samples where possible
- Avoid samples containing passwords, private communications, or confidential data
- The `~/.claude/` directory is not encrypted by default; treat profiles accordingly
- If the user requests profile deletion, remove the JSON file
