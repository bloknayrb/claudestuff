# /// script
# requires-python = ">=3.12"
# ///
"""Resume keyword analyzer: compare resume against a job description to find keyword gaps."""

import argparse
import re
import sys
from collections import Counter
from pathlib import Path


STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can", "need",
    "it", "its", "this", "that", "these", "those", "i", "you", "we",
    "they", "he", "she", "me", "my", "your", "our", "their", "his", "her",
    "not", "no", "nor", "so", "if", "then", "than", "too", "very",
    "also", "just", "about", "up", "out", "into", "over", "after",
    "before", "between", "under", "through", "during", "each", "all",
    "both", "any", "such", "only", "other", "new", "when", "who",
    "which", "where", "how", "what", "why", "more", "most", "some",
    "well", "etc", "per", "via", "able", "must", "while", "within",
}

# Generic filler words common in JDs that aren't meaningful keywords
FILLER_WORDS = {
    "role", "position", "team", "company", "work", "working", "including",
    "experience", "required", "preferred", "strong", "excellent", "ability",
    "skills", "years", "responsibilities", "qualifications", "looking",
    "join", "opportunity", "ideal", "candidate", "will", "ensure",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Compare resume keywords against a job description to identify gaps.",
        epilog=(
            "Example: uv run resume_keyword_analyzer.py --resume resume.txt --job-description jd.txt\n"
            "Or inline: uv run resume_keyword_analyzer.py --inline-resume 'resume text' --inline-jd 'jd text'"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    resume_group = parser.add_mutually_exclusive_group(required=True)
    resume_group.add_argument("--resume", help="Path to resume file (PDF text extract, TXT, etc.)")
    resume_group.add_argument("--inline-resume", help="Resume content as inline text")

    jd_group = parser.add_mutually_exclusive_group(required=True)
    jd_group.add_argument("--job-description", help="Path to job description file")
    jd_group.add_argument("--inline-jd", help="Job description as inline text")

    parser.add_argument(
        "--top-n", type=int, default=15,
        help="Number of missing keywords to show (default: 15)",
    )
    return parser.parse_args()


def load_text(path=None, inline=None):
    """Load text from file path or inline string."""
    if inline:
        return inline
    try:
        return Path(path).read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"Error: File not found: {path}", file=sys.stderr)
        sys.exit(1)
    except UnicodeDecodeError:
        print(
            f"Error: Cannot read '{path}' as text (likely a PDF or DOCX).\n"
            f"Use --inline-resume / --inline-jd with the file's text content instead,\n"
            f"or have Claude read the file first and pass the content inline.",
            file=sys.stderr,
        )
        sys.exit(1)


def tokenize(text):
    """Lowercase, extract words and bigrams, filter stop words."""
    text = text.lower()
    # Remove URLs, email addresses, phone numbers
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"\S+@\S+", "", text)
    text = re.sub(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b", "", text)

    words = re.findall(r"[a-z][a-z0-9+#]*(?:[.-][a-z0-9+#]+)*", text)
    # Filter stop words and very short tokens
    meaningful = [w for w in words if w not in STOP_WORDS and len(w) > 1]
    return meaningful


def extract_keywords(text):
    """Extract unigrams and bigrams with frequency counts."""
    words = tokenize(text)
    unigrams = Counter(words)
    bigrams = Counter()

    for i in range(len(words) - 1):
        bigram = f"{words[i]} {words[i+1]}"
        # Only count bigrams where neither word is filler
        if words[i] not in FILLER_WORDS and words[i+1] not in FILLER_WORDS:
            bigrams[bigram] += 1

    return unigrams, bigrams


def analyze_match(resume_text, jd_text, top_n=15):
    """Analyze keyword overlap between resume and JD."""
    resume_unigrams, resume_bigrams = extract_keywords(resume_text)
    jd_unigrams, jd_bigrams = extract_keywords(jd_text)

    # Filter out filler words from JD unigrams for matching purposes
    jd_meaningful = {k: v for k, v in jd_unigrams.items() if k not in FILLER_WORDS}

    # Find matches and gaps
    matched_uni = set(resume_unigrams.keys()) & set(jd_meaningful.keys())
    missing_uni = set(jd_meaningful.keys()) - set(resume_unigrams.keys())
    matched_bi = set(resume_bigrams.keys()) & set(jd_bigrams.keys())
    missing_bi = set(jd_bigrams.keys()) - set(resume_bigrams.keys())

    # Calculate match rate based on meaningful JD keywords
    total_jd_keywords = len(jd_meaningful) + len(jd_bigrams)
    total_matched = len(matched_uni) + len(matched_bi)
    match_rate = (total_matched / total_jd_keywords * 100) if total_jd_keywords > 0 else 0

    # Sort missing keywords by JD frequency (most important first)
    missing_uni_sorted = sorted(missing_uni, key=lambda k: jd_meaningful.get(k, 0), reverse=True)
    missing_bi_sorted = sorted(missing_bi, key=lambda k: jd_bigrams.get(k, 0), reverse=True)

    return {
        "match_rate": match_rate,
        "matched_unigrams": sorted(matched_uni),
        "matched_bigrams": sorted(matched_bi),
        "missing_unigrams": [(k, jd_meaningful[k]) for k in missing_uni_sorted[:top_n]],
        "missing_bigrams": [(k, jd_bigrams[k]) for k in missing_bi_sorted[:top_n]],
        "total_jd_keywords": total_jd_keywords,
        "total_matched": total_matched,
    }


def print_results(results, top_n):
    """Print keyword analysis report."""
    print("=" * 60)
    print("RESUME KEYWORD ANALYSIS")
    print("=" * 60)

    rate = results["match_rate"]
    print(f"\nOverall match rate: {rate:.0f}%")

    # Visual match bar
    filled = int(rate / 100 * 30)
    bar = "#" * filled + "-" * (30 - filled)
    print(f"  [{bar}] {results['total_matched']}/{results['total_jd_keywords']} keywords")

    # Interpretation
    if rate >= 70:
        print(f"  Strong match -- your resume aligns well with this JD.")
    elif rate >= 50:
        print(f"  Moderate match -- incorporate missing keywords to strengthen.")
    else:
        print(f"  Low match -- significant keyword gaps need addressing.")

    # Missing keywords (most important)
    missing_uni = results["missing_unigrams"]
    missing_bi = results["missing_bigrams"]

    if missing_bi or missing_uni:
        print(f"\n{'-' * 60}")
        print(f"TOP MISSING KEYWORDS (sorted by JD frequency)")
        print(f"{'-' * 60}")

        if missing_bi:
            print(f"\nPhrases (high priority -- add these exact phrases):")
            for phrase, count in missing_bi[:top_n // 2]:
                freq_indicator = "*" * min(count, 5)
                print(f"  {freq_indicator:<5} {phrase}")

        if missing_uni:
            print(f"\nTerms:")
            for word, count in missing_uni[:top_n]:
                freq_indicator = "*" * min(count, 5)
                print(f"  {freq_indicator:<5} {word}")

    # Matched keywords
    matched = results["matched_unigrams"]
    matched_bi = results["matched_bigrams"]
    if matched_bi or matched:
        print(f"\n{'-' * 60}")
        print(f"MATCHED KEYWORDS")
        print(f"{'-' * 60}")
        if matched_bi:
            print(f"\nPhrases: {', '.join(matched_bi[:15])}")
        if matched:
            print(f"Terms: {', '.join(matched[:20])}")
            if len(matched) > 20:
                print(f"  ... and {len(matched) - 20} more")

    print(f"\n{'-' * 60}")
    print("Caveat: This is lexical (exact-word) matching. Also review for")
    print("semantic synonyms the tool can't catch (e.g., 'managed' vs 'led').")


def main():
    args = parse_args()

    resume_text = load_text(path=args.resume, inline=args.inline_resume)
    jd_text = load_text(path=args.job_description, inline=args.inline_jd)

    if len(resume_text.strip()) < 50:
        print("Warning: Resume text is very short. Results may not be meaningful.", file=sys.stderr)
    if len(jd_text.strip()) < 50:
        print("Warning: Job description text is very short. Results may not be meaningful.", file=sys.stderr)

    results = analyze_match(resume_text, jd_text, top_n=args.top_n)
    print_results(results, args.top_n)


if __name__ == "__main__":
    main()
