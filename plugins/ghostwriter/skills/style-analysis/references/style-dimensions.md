# Style Dimensions Reference

Deep-dive documentation for all six analytical dimensions used in style analysis.
Quantitative metrics include significance thresholds used by the `--compare` flag.

---

## Dimension 1: Lexical

Captures vocabulary richness, register formality, and self-referential patterns.

### MATTR (Moving Average Type-Token Ratio)

**What it is.** MATTR measures lexical diversity by computing the type-token ratio
(unique words / total words) over a sliding 100-word window, then averaging across
all windows. Unlike raw TTR, MATTR does not penalize longer texts — a 2000-word
sample and a 200-word sample are directly comparable.

**Why 100 words.** Shorter windows amplify noise from local repetition; longer windows
mask vocabulary patterns. 100 words captures a writer's natural phrase-length while
remaining robust across documents of different lengths.

**Expected range.** 0.60-0.90 for most prose. Technical writing with heavy terminology
repetition tends toward 0.60-0.70. Literary prose with deliberate variety tends toward
0.80-0.90. Values below 0.55 suggest heavy jargon or formulaic language.

**Significance threshold.** +/-0.08.

**Fallback behavior.** On texts under 100 words, MATTR falls back to raw TTR. Flag this
in any comparison output — the values are not comparable across the threshold.

---

### Contraction Rate

**What it is.** Number of contractions (don't, can't, it's, they're, etc.) per 100 words.

**Interpretation scale:**
- 0.0 — essentially formal; no contractions
- 0.5-1.5 — lightly formal; occasional contractions
- 1.5-3.0 — conversational professional register
- 3.0-5.0 — casual; consistent contractions
- 5.0+ — very casual or deliberately informal

**Significance threshold.** +/-1.5 per 100 words.

---

### Formality Score

**What it is.** A composite 0-10 score where 10 is maximally formal. Computed as:

```
formality = 10
           - (contraction_rate * 0.8)
           - (self_reference_rate * 0.5)
           + (1.0 if sentence_mean > 20 else 0)
           + (0.5 if passive_voice > 15 else 0)
clamped to [0, 10]
```

**Interpretation:**
- 8-10: Academic, legal, or corporate formal writing
- 6-8: Professional prose with personality
- 4-6: Conversational professional (most business writing)
- 2-4: Casual; blog or social register
- 0-2: Deliberately informal or colloquial

**Significance threshold.** +/-1.5.

---

### Self-Reference Rate

**What it is.** First-person pronouns (I, me, my, mine, myself, we, us, our, ours, ourselves)
per 100 words.

**What it reveals.** Low self-reference (under 1.0) suggests the writer deflects attention
from themselves — common in technical, analytical, or authority-positioning writing.
High self-reference (3.0+) suggests an intimate, personal, or confessional register.

**Significance threshold.** +/-1.5 per 100 words.

---

## Dimension 2: Syntactic

Captures sentence construction patterns and passive voice tendency.

### Sentence Length

Four statistics are tracked: mean, median, standard deviation, and range (min/max).

**Mean** reveals the writer's natural sentence weight. Under 15 words: punchy, declarative.
15-25 words: standard expository. Over 25 words: complex, elaborative.

**Median** is more robust than mean for writers who mix very short and very long sentences.
When mean and median diverge by more than 8 words, the writer likely uses deliberate
rhythm variation — short sentences for impact, long sentences for elaboration.

**Standard deviation** captures sentence rhythm. Low std (under 8): uniform, consistent
sentence length. High std (over 15): dynamic, highly varied rhythm. This is often more
distinctive than mean length alone.

**Range** (min and max) flags whether the writer uses extreme sentence variation as a
rhetorical tool — one-word sentences for emphasis, multi-clause sentences for complexity.

**Significance thresholds:**
- `sentence_length_mean`: +/-5 words
- `sentence_length_median`: +/-5 words

Standard deviation and range are reported but do not have comparison thresholds —
they are contextual signals, not pass/fail measurements.

---

### Passive Voice Heuristic

**What it is.** Percentage of sentences containing at least one passive construction,
detected by matching `(was|were|is|are|been|being) + past participle` patterns.

**Known limitations.** This heuristic catches true passives ("the report was written
by the team") and filters known adjectival participles ("she was exhausted", "he was
interested"), but false positives remain. Expect 20-40% error rate depending on text type.

**What to look for.** Under 10%: strongly active-voice writer. 10-20%: moderate passive
use, typical of professional prose. Over 25%: either deliberately formal/academic or
false positives inflating the score — check qualitatively.

**Significance threshold.** +/-10 percentage points.

---

## Dimension 3: Punctuation

Per-1000-word rates for six marks. Punctuation habits are highly distinctive and
remarkably stable across contexts — a reliable fingerprinting dimension.

### Semicolons
**Significance threshold: +/-2.0 per 1000 words**

0: Writer avoids semicolons entirely. 1-3: Occasional use. 3+: Deliberate semicolon user.
High semicolon rate often correlates with longer sentences and higher formality.

### Em Dashes
**Significance threshold: +/-2.0 per 1000 words**

Detected as unicode em dash or `--`. One of the most personality-laden punctuation choices.
0: Dash-averse. 1-3: Occasional emphasis. 4+: Habitual dash user.

### Ellipses
**Significance threshold: +/-1.0 per 1000 words**

Detected as `...` or unicode ellipsis. 0: Decisive endings. 1-2: Occasional trailing thought.
3+: Ellipses as rhetorical device.

### Parentheticals
**Significance threshold: +/-2.0 per 1000 words**

Counts opening parentheses. 0: Avoids parentheses. 1-3: Occasional clarification.
4+: Habitual parenthetical thinker; treats asides as essential structure.

### Exclamation Marks
**Significance threshold: +/-1.0 per 1000 words**

0: Flat affect in punctuation — itself a strong voice signal. 0.5-2: Occasional enthusiasm.
2+: Energetic or casual register.

### Question Marks
**Significance threshold: +/-1.5 per 1000 words**

0-1: Rare questions; declarative framing. 1-3: Moderate rhetorical questions.
3+: Frequent questions; pedagogical or dialogic style.

---

## Dimension 4: Micro-patterns

**This dimension is qualitative and assessed by Claude, not the script.**

Micro-patterns are recurring structural and rhetorical habits too idiosyncratic
to measure statistically but too consistent to miss on careful reading.

Look for:
- **Signature phrases** — words or constructions the writer reaches for repeatedly
- **Rhetorical questions** — does the writer open paragraphs with questions? Use them as transitions?
- **Parenthetical asides** — beyond counting, what role do parentheses play? Humor? Qualification?
- **Self-reference patterns** — "I" freely or avoided? "We" for inclusion? Experience as evidence?
- **Opening patterns** — how do paragraphs begin? Claim? Question? Concession? Example?
- **Closing patterns** — summary statement? Forward-looking gesture? Punchline?

Document micro-patterns in the metavoice as behavioral instructions.

---

## Dimension 5: Tone

**This dimension is qualitative and assessed by Claude, not the script.**

Tone captures the writer's relationship to their reader and material.

- **Authority level** — expert, peer, guide, or curious observer?
- **Audience distance** — intimate vs. professional vs. formal
- **Emotional register** — flat/analytical vs. engaged/warm vs. urgent/passionate
- **Humor style** — dry understatement? Self-deprecating? Observational? Absent?

Humor is highly distinctive and should be called out explicitly in the metavoice.

---

## Dimension 6: Paragraph

Captures structural rhythm at the paragraph level.

### Paragraph Length

Two statistics: mean length in sentences and mean length in words.

**Sentences per paragraph.** 1-2: Punchy, journalistic. 2-4: Standard expository. 4+: Dense, elaborative.

**Words per paragraph.** Under 50: Clipped. 50-100: Standard. 100-200: Dense analytical. Over 200: Academic.

**Significance thresholds:**
- `paragraph_length_sentences`: +/-1.5 sentences
- `paragraph_length_words`: +/-20 words
