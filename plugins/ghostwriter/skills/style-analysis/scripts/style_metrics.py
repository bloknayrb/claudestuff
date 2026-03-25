# /// script
# requires-python = ">=3.12"
# ///
"""Quantitative writing style analysis engine.

Computes stylometric metrics from text input for building and comparing
voice profiles. All metrics use stdlib only — no NLP dependencies.

Usage:
    echo "text" | uv run style_metrics.py [--json] [--compare profile.json]
    uv run style_metrics.py --file path/to/file.txt [--json]
"""

import argparse
import json
import math
import os
import re
import statistics
import sys
from collections import Counter


# --- Sentence splitting ---

# Abbreviations that end with a period but don't end a sentence
ABBREVIATIONS = {
    "dr", "mr", "mrs", "ms", "prof", "sr", "jr", "st",
    "vs", "etc", "inc", "ltd", "corp", "dept", "univ",
    "e.g", "i.e", "et al",
    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    "mon", "tue", "wed", "thu", "fri", "sat", "sun",
    "fig", "eq", "vol", "no", "op", "approx", "est",
    "govt", "assn", "bros", "gen", "rep", "sen", "gov",
}

# Two-letter abbreviations (e.g., U.S., A.M.)
ABBREV_PATTERN = re.compile(r"\b([A-Z]\.){2,}")


def split_sentences(text: str) -> list[str]:
    """Split text into sentences, handling abbreviations and decimals."""
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text.strip())
    if not text:
        return []

    sentences = []
    current = []
    tokens = text.split(" ")

    for i, token in enumerate(tokens):
        current.append(token)

        # Check if token ends with sentence-ending punctuation
        if not re.search(r"[.!?][\"'\u201d\u2019)]*$", token):
            continue

        # Strip trailing quotes/parens to check the core token
        core = re.sub(r"[\"'\u201d\u2019)]+$", "", token)

        # Skip if it's a known abbreviation
        word = core.rstrip(".").lower()
        if word in ABBREVIATIONS:
            continue

        # Skip U.S.-style abbreviations
        if ABBREV_PATTERN.search(core):
            continue

        # Skip decimal numbers (e.g., "3.14")
        if re.match(r"^\d+\.\d+$", core):
            continue

        # Skip single initials (e.g., "J.")
        if re.match(r"^[A-Z]\.$", core):
            continue

        # Skip ellipsis in middle of text (not sentence-ending)
        if core.endswith("...") or core.endswith("\u2026"):
            # Ellipsis ends a sentence only if next token starts with uppercase
            if i + 1 < len(tokens) and tokens[i + 1][0:1].isupper():
                sentences.append(" ".join(current))
                current = []
            continue

        # This looks like a real sentence boundary
        sentences.append(" ".join(current))
        current = []

    # Don't lose trailing text
    if current:
        sentences.append(" ".join(current))

    return [s for s in sentences if s.strip()]


# --- Tokenization ---

def tokenize(text: str) -> list[str]:
    """Extract words from text, lowercased."""
    return re.findall(r"[a-zA-Z'\u2019]+", text.lower())


# --- Metrics ---

def sentence_length_stats(sentences: list[str]) -> dict:
    """Compute sentence length statistics."""
    lengths = [len(tokenize(s)) for s in sentences]
    lengths = [l for l in lengths if l > 0]
    if not lengths:
        return {"mean": 0, "median": 0, "std": 0, "min": 0, "max": 0}
    return {
        "mean": round(statistics.mean(lengths), 1),
        "median": round(statistics.median(lengths), 1),
        "std": round(statistics.stdev(lengths), 1) if len(lengths) > 1 else 0,
        "min": min(lengths),
        "max": max(lengths),
    }


def compute_mattr(words: list[str], window: int = 100) -> float:
    """Moving Average Type-Token Ratio with fixed window.

    Unlike raw TTR, MATTR is length-normalized — it produces comparable
    values regardless of text length.
    """
    if len(words) < window:
        # Fall back to raw TTR for very short texts
        if not words:
            return 0.0
        return round(len(set(words)) / len(words), 3)

    ratios = []
    for i in range(len(words) - window + 1):
        segment = words[i : i + window]
        ratios.append(len(set(segment)) / window)
    return round(statistics.mean(ratios), 3)


CONTRACTIONS = re.compile(
    r"\b("
    r"i'm|i've|i'll|i'd|"
    r"you're|you've|you'll|you'd|"
    r"he's|she's|it's|"
    r"we're|we've|we'll|we'd|"
    r"they're|they've|they'll|they'd|"
    r"that's|there's|here's|who's|what's|"
    r"isn't|aren't|wasn't|weren't|"
    r"don't|doesn't|didn't|"
    r"won't|wouldn't|couldn't|shouldn't|"
    r"can't|couldn't|mightn't|mustn't|"
    r"haven't|hasn't|hadn't|"
    r"let's|"
    r"ain't|"
    r"it'll|that'll|who'll|there'll"
    r")\b",
    re.IGNORECASE,
)


def contraction_rate(text: str, word_count: int) -> float:
    """Contractions per 100 words."""
    if word_count == 0:
        return 0.0
    count = len(CONTRACTIONS.findall(text))
    return round(count / word_count * 100, 1)


# Common irregular past participles for passive voice detection
IRREGULAR_PARTICIPLES = {
    "written", "built", "told", "seen", "made", "given", "taken",
    "found", "known", "shown", "broken", "chosen", "driven", "eaten",
    "fallen", "forgotten", "frozen", "hidden", "ridden", "risen",
    "spoken", "stolen", "sworn", "thrown", "worn", "begun", "blown",
    "drawn", "drunk", "flown", "grown", "held", "kept", "left",
    "lent", "lost", "meant", "met", "paid", "read", "run", "said",
    "sent", "set", "shut", "sold", "sought", "spent", "split",
    "spread", "stood", "struck", "taught", "thought", "understood",
    "won", "wound", "brought", "bought", "caught", "dealt", "dug",
    "fed", "felt", "fought", "got", "gotten", "gone", "hung", "hurt",
    "laid", "led", "lit", "put", "quit", "sang", "sung", "sunk",
    "sat", "slept", "slid", "spun", "stung", "swept", "swum",
    "swung", "torn", "woken", "woven",
}

# Adjectival past participles that look passive but aren't
ADJECTIVAL_PARTICIPLES = {
    "excited", "interested", "bored", "tired", "worried", "concerned",
    "pleased", "surprised", "amazed", "confused", "convinced",
    "disappointed", "satisfied", "embarrassed", "frightened",
    "determined", "devoted", "married", "related", "supposed",
    "complicated", "organized", "experienced", "qualified",
}

PASSIVE_PATTERN = re.compile(
    r"\b(is|are|was|were|been|being|be)\s+(\w+)\b",
    re.IGNORECASE,
)


def passive_voice_heuristic(sentences: list[str]) -> float:
    """Estimate percentage of sentences containing passive voice.

    Known limitations: ~20-40% error rate. Misses passives with
    intervening adverbs and some irregular forms. May false-positive
    on adjectival uses despite the exclusion list.
    """
    if not sentences:
        return 0.0

    passive_count = 0
    for sentence in sentences:
        matches = PASSIVE_PATTERN.finditer(sentence)
        for match in matches:
            participle = match.group(2).lower()
            # Skip known adjectival uses
            if participle in ADJECTIVAL_PARTICIPLES:
                continue
            # Match regular past participles (-ed) or known irregulars
            if participle.endswith("ed") or participle in IRREGULAR_PARTICIPLES:
                passive_count += 1
                break  # Count each sentence only once

    return round(passive_count / len(sentences) * 100, 1)


def punctuation_signature(text: str, word_count: int) -> dict:
    """Punctuation marks per 1000 words."""
    if word_count == 0:
        return {k: 0.0 for k in [
            "semicolons", "em_dashes", "ellipses", "parentheticals",
            "exclamation_marks", "question_marks",
        ]}

    per_k = 1000 / word_count

    return {
        "semicolons": round(text.count(";") * per_k, 1),
        "em_dashes": round((text.count("\u2014") + text.count("--")) * per_k, 1),
        "ellipses": round((text.count("\u2026") + text.count("...")) * per_k, 1),
        "parentheticals": round(text.count("(") * per_k, 1),
        "exclamation_marks": round(text.count("!") * per_k, 1),
        "question_marks": round(text.count("?") * per_k, 1),
    }


def paragraph_stats(text: str) -> dict:
    """Compute paragraph-level statistics."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return {"paragraph_length_sentences": 0, "paragraph_length_words": 0}

    sent_counts = [len(split_sentences(p)) for p in paragraphs]
    word_counts = [len(tokenize(p)) for p in paragraphs]

    return {
        "paragraph_length_sentences": round(statistics.mean(sent_counts), 1) if sent_counts else 0,
        "paragraph_length_words": round(statistics.mean(word_counts), 1) if word_counts else 0,
    }


SELF_REFERENCE = re.compile(
    r"\b(i|me|my|mine|myself|we|us|our|ours|ourselves)\b",
    re.IGNORECASE,
)


def self_reference_rate(text: str, word_count: int) -> float:
    """First-person pronouns per 100 words."""
    if word_count == 0:
        return 0.0
    count = len(SELF_REFERENCE.findall(text))
    return round(count / word_count * 100, 1)


def formality_score(
    contraction_rt: float,
    self_ref_rt: float,
    sent_length_mean: float,
    passive_heuristic: float,
) -> float:
    """Compute formality on a 0-10 scale.

    Higher = more formal. Formula:
    10 - (contraction_rate * 0.8) - (self_reference_rate * 0.5)
       + (1 if mean sentence length > 20 else 0)
       + (0.5 if passive voice > 15% else 0)
    """
    score = 10.0
    score -= contraction_rt * 0.8
    score -= self_ref_rt * 0.5
    if sent_length_mean > 20:
        score += 1.0
    if passive_heuristic > 15:
        score += 0.5
    return round(max(0.0, min(10.0, score)), 1)


# --- Main analysis ---

def analyze(text: str) -> dict:
    """Run all metrics on input text and return results dict."""
    words = tokenize(text)
    word_count = len(words)
    sentences = split_sentences(text)

    sent_stats = sentence_length_stats(sentences)
    mattr = compute_mattr(words)
    contr_rate = contraction_rate(text, word_count)
    passive = passive_voice_heuristic(sentences)
    punct = punctuation_signature(text, word_count)
    para = paragraph_stats(text)
    self_ref = self_reference_rate(text, word_count)
    formal = formality_score(contr_rate, self_ref, sent_stats["mean"], passive)

    return {
        "word_count": word_count,
        "sentence_count": len(sentences),
        "sentence_length_mean": sent_stats["mean"],
        "sentence_length_median": sent_stats["median"],
        "sentence_length_std": sent_stats["std"],
        "sentence_length_min": sent_stats["min"],
        "sentence_length_max": sent_stats["max"],
        "mattr": mattr,
        "contraction_rate": contr_rate,
        "passive_voice_heuristic": passive,
        "formality_score": formal,
        "punctuation": punct,
        "paragraph_length_sentences": para["paragraph_length_sentences"],
        "paragraph_length_words": para["paragraph_length_words"],
        "self_reference_rate": self_ref,
    }


def compare_metrics(input_metrics: dict, profile_path: str) -> dict:
    """Compare input metrics against a saved profile."""
    expanded = os.path.expanduser(profile_path)
    try:
        with open(expanded, encoding="utf-8") as f:
            profile = json.load(f)
    except FileNotFoundError:
        print(f"Error: Profile not found: {expanded}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Malformed profile JSON: {expanded}: {e}", file=sys.stderr)
        sys.exit(1)

    profile_metrics = profile.get("metrics", {})

    # Significance thresholds per metric
    thresholds = {
        "sentence_length_mean": 5.0,
        "sentence_length_median": 5.0,
        "mattr": 0.08,
        "contraction_rate": 1.5,
        "passive_voice_heuristic": 10.0,
        "formality_score": 1.5,
        "paragraph_length_sentences": 1.5,
        "paragraph_length_words": 20.0,
        "self_reference_rate": 1.5,
    }

    # Punctuation thresholds (per 1000 words)
    punct_thresholds = {
        "semicolons": 1.5,
        "em_dashes": 2.0,
        "ellipses": 1.0,
        "parentheticals": 1.5,
        "exclamation_marks": 1.0,
        "question_marks": 1.5,
    }

    dimensions = []
    matches = 0
    deviations = 0
    significant = 0

    # Compare top-level metrics
    for metric, threshold in thresholds.items():
        profile_val = profile_metrics.get(metric)
        input_val = input_metrics.get(metric)
        if profile_val is None or input_val is None:
            continue
        delta = round(input_val - profile_val, 2)
        is_significant = abs(delta) > threshold
        dimensions.append({
            "name": metric,
            "profile": profile_val,
            "input": input_val,
            "delta": delta,
            "significant": is_significant,
        })
        if is_significant:
            significant += 1
            deviations += 1
        elif abs(delta) > threshold * 0.5:
            deviations += 1
        else:
            matches += 1

    # Compare punctuation
    profile_punct = profile_metrics.get("punctuation", {})
    input_punct = input_metrics.get("punctuation", {})
    for metric, threshold in punct_thresholds.items():
        profile_val = profile_punct.get(metric)
        input_val = input_punct.get(metric)
        if profile_val is None or input_val is None:
            continue
        delta = round(input_val - profile_val, 2)
        is_significant = abs(delta) > threshold
        dimensions.append({
            "name": f"punctuation.{metric}",
            "profile": profile_val,
            "input": input_val,
            "delta": delta,
            "significant": is_significant,
        })
        if is_significant:
            significant += 1
            deviations += 1
        elif abs(delta) > threshold * 0.5:
            deviations += 1
        else:
            matches += 1

    return {
        "dimensions": dimensions,
        "summary": {
            "matches": matches,
            "deviations": deviations,
            "significant_deviations": significant,
        },
    }


def format_human_readable(metrics: dict) -> str:
    """Format metrics as a human-readable report."""
    lines = [
        "STYLE METRICS REPORT",
        "=" * 40,
        f"Word count: {metrics['word_count']:,}",
        f"Sentence count: {metrics['sentence_count']}",
        "",
        "LEXICAL",
        f"  MATTR (100-word window): {metrics['mattr']}",
        f"  Contraction rate: {metrics['contraction_rate']}/100 words",
        f"  Formality score: {metrics['formality_score']}/10",
        "",
        "SYNTACTIC",
        f"  Sentence length: mean={metrics['sentence_length_mean']}, "
        f"median={metrics['sentence_length_median']}, "
        f"std={metrics['sentence_length_std']}, "
        f"range={metrics['sentence_length_min']}-{metrics['sentence_length_max']}",
        f"  Passive voice (heuristic): {metrics['passive_voice_heuristic']}% of sentences",
        "",
        "PUNCTUATION (per 1000 words)",
    ]
    for key, val in metrics["punctuation"].items():
        label = key.replace("_", " ").title()
        lines.append(f"  {label}: {val}")
    lines.extend([
        "",
        "STRUCTURE",
        f"  Paragraph length: mean={metrics['paragraph_length_sentences']} sentences, "
        f"mean={metrics['paragraph_length_words']} words",
        f"  Self-reference rate: {metrics['self_reference_rate']}/100 words",
    ])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Writing style metrics analyzer")
    parser.add_argument("--file", help="Path to text file to analyze")
    parser.add_argument("--json", action="store_true", dest="json_output",
                        help="Output as JSON")
    parser.add_argument("--compare", metavar="PROFILE",
                        help="Compare against a saved profile JSON")
    args = parser.parse_args()

    # Read input
    if args.file:
        path = os.path.expanduser(args.file)
        with open(path, encoding="utf-8") as f:
            text = f.read()
    elif not sys.stdin.isatty():
        text = sys.stdin.read()
    else:
        print("Error: Provide text via stdin or --file", file=sys.stderr)
        sys.exit(1)

    if not text.strip():
        print("Error: Empty input", file=sys.stderr)
        sys.exit(1)

    metrics = analyze(text)

    if args.compare:
        comparison = compare_metrics(metrics, args.compare)
        if args.json_output:
            print(json.dumps(comparison, indent=2))
        else:
            print("STYLE COMPARISON")
            print("=" * 40)
            for dim in comparison["dimensions"]:
                sig = " ***" if dim["significant"] else ""
                print(f"  {dim['name']}: profile={dim['profile']}, "
                      f"input={dim['input']}, delta={dim['delta']:+.2f}{sig}")
            s = comparison["summary"]
            print(f"\nSummary: {s['matches']} matches, {s['deviations']} deviations "
                  f"({s['significant_deviations']} significant)")
    elif args.json_output:
        print(json.dumps(metrics, indent=2))
    else:
        print(format_human_readable(metrics))


if __name__ == "__main__":
    main()
