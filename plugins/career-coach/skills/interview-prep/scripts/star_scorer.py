# /// script
# requires-python = ">=3.12"
# ///
"""STAR response scorer: heuristic analysis of behavioral interview answers by STAR component."""

import argparse
import re
import sys


# Competency-specific keywords that strengthen a response
COMPETENCY_KEYWORDS = {
    "leadership": ["led", "directed", "guided", "mentored", "delegated", "motivated", "coached", "vision", "strategy", "decision"],
    "teamwork": ["collaborated", "together", "team", "partnered", "coordinated", "cross-functional", "consensus", "aligned"],
    "conflict": ["disagreed", "tension", "resolved", "mediated", "compromise", "perspective", "de-escalated", "listened"],
    "problem-solving": ["analyzed", "diagnosed", "root cause", "solution", "approach", "evaluated", "options", "hypothesis"],
    "communication": ["presented", "explained", "communicated", "stakeholder", "audience", "clarity", "persuaded", "wrote"],
    "adaptability": ["pivoted", "adjusted", "changed", "flexible", "adapted", "uncertainty", "ambiguity", "new approach"],
    "initiative": ["proactively", "volunteered", "identified", "proposed", "beyond", "self-directed", "started", "initiated"],
    "failure": ["learned", "mistake", "failed", "lesson", "improved", "differently", "reflection", "growth"],
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Score a STAR (Situation-Task-Action-Result) interview response using heuristics.",
        epilog=(
            "Example: uv run star_scorer.py --response 'In my previous role at...' --competency leadership\n\n"
            "Scores each STAR component 1-5 based on structural patterns.\n"
            "This is heuristic scoring -- it detects patterns, not quality."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--response", required=True,
        help="The STAR response text to score",
    )
    parser.add_argument(
        "--competency", default="general",
        choices=list(COMPETENCY_KEYWORDS.keys()) + ["general"],
        help="The competency being assessed (default: general)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show detailed rubric breakdown per component",
    )
    return parser.parse_args()


def count_pattern(text, patterns):
    """Count how many of the given patterns appear in text."""
    text_lower = text.lower()
    return sum(1 for p in patterns if p in text_lower)


def detect_metrics(text):
    """Detect numeric metrics, percentages, and quantified results."""
    patterns = [
        r"\d+%",                        # percentages
        r"\$[\d,]+",                     # dollar amounts
        r"\d+x",                         # multipliers
        r"\d+\s*(?:hours|days|weeks|months|years)",  # time quantities
        r"\d+\s*(?:people|team members|engineers|reports)",  # team sizes
        r"(?:reduced|increased|improved|saved|grew|cut)\s+.*?\d+",  # action + number
    ]
    count = sum(len(re.findall(p, text, re.IGNORECASE)) for p in patterns)
    return count


def score_situation(text):
    """Score the Situation component (context-setting)."""
    words = text.split()
    word_count = len(words)

    score = 1
    feedback = []

    # Context indicators
    context_words = ["when", "while", "during", "at", "role", "company", "team", "project", "year", "ago"]
    context_count = count_pattern(text, context_words)

    if context_count >= 3:
        score += 1
        feedback.append("Good context-setting with time/place/role details")
    elif context_count >= 1:
        score += 0.5

    # Brevity check -- situation should be concise (target: 20% of response)
    if 20 <= word_count <= 80:
        score += 1
        feedback.append("Appropriate length for Situation")
    elif word_count > 80:
        feedback.append("Situation may be too long -- aim for 2-3 sentences")
    elif word_count < 20:
        score += 0.5
        feedback.append("Situation is very brief -- add enough context for the interviewer")

    # Stakes/importance indicators
    stakes_words = ["critical", "urgent", "deadline", "challenge", "risk", "important", "major", "significant"]
    if count_pattern(text, stakes_words) >= 1:
        score += 1
        feedback.append("Conveys stakes/importance of the situation")

    score = min(5, max(1, round(score)))
    return score, feedback


def score_task(text):
    """Score the Task component (your specific responsibility)."""
    score = 1
    feedback = []

    # First-person specificity
    i_count = len(re.findall(r"\bi\b", text, re.IGNORECASE))
    my_count = len(re.findall(r"\bmy\b", text, re.IGNORECASE))
    we_count = len(re.findall(r"\bwe\b", text, re.IGNORECASE))

    if i_count + my_count > we_count:
        score += 1.5
        feedback.append("Good use of first-person -- shows individual ownership")
    elif i_count + my_count > 0:
        score += 0.5
        feedback.append("Mix of 'I' and 'we' -- try to emphasize YOUR specific role more")
    else:
        feedback.append("Missing first-person language -- interviewer needs to know YOUR task, not the team's")

    # Responsibility indicators
    responsibility_words = ["responsible", "tasked", "assigned", "needed to", "had to", "goal", "objective", "expected"]
    if count_pattern(text, responsibility_words) >= 1:
        score += 1
        feedback.append("Clearly states the specific responsibility")

    # Brevity -- task should be the shortest component
    words = text.split()
    if len(words) <= 40:
        score += 1
        feedback.append("Concise Task section")
    else:
        feedback.append("Task section may be too long -- keep to 1-2 sentences")

    score = min(5, max(1, round(score)))
    return score, feedback


def score_action(text):
    """Score the Action component (what you did -- should be the longest section)."""
    words = text.split()
    word_count = len(words)
    score = 1
    feedback = []

    # Length check -- action should be the longest section (~60% of response)
    if word_count >= 80:
        score += 1
        feedback.append("Substantial Action section with good detail")
    elif word_count >= 40:
        score += 0.5
        feedback.append("Action section could be more detailed -- this should be the longest part")
    else:
        feedback.append("Action section is too brief -- expand with step-by-step details")

    # First-person pronoun density
    i_count = len(re.findall(r"\bi\b", text, re.IGNORECASE))
    if word_count > 0:
        i_density = i_count / word_count
        if i_density >= 0.03:
            score += 1
            feedback.append("Strong first-person narrative throughout")
        elif i_count >= 2:
            score += 0.5
            feedback.append("Some first-person language -- use more 'I decided', 'I built', 'I coordinated'")
        else:
            feedback.append("Lacks first-person language -- describe what YOU specifically did")

    # Step-by-step indicators
    sequence_words = ["first", "then", "next", "after", "finally", "started", "began", "followed",
                      "step", "decided", "chose", "approach"]
    seq_count = count_pattern(text, sequence_words)
    if seq_count >= 3:
        score += 1
        feedback.append("Good step-by-step structure showing your process")
    elif seq_count >= 1:
        score += 0.5
        feedback.append("Some sequential structure -- add more 'First... Then... Finally...' flow")
    else:
        feedback.append("Add sequential language to show your thought process and approach")

    # Decision-making rationale
    rationale_words = ["because", "reason", "decided", "chose", "evaluated", "considered", "trade-off", "weighed"]
    if count_pattern(text, rationale_words) >= 1:
        score += 1
        feedback.append("Shows decision-making rationale -- interviewers love 'I chose X because...'")

    score = min(5, max(1, round(score)))
    return score, feedback


def score_result(text):
    """Score the Result component (outcome and impact)."""
    score = 1
    feedback = []

    # Metric detection
    metric_count = detect_metrics(text)
    if metric_count >= 2:
        score += 2
        feedback.append("Strong quantified results with multiple metrics")
    elif metric_count == 1:
        score += 1
        feedback.append("One metric found -- add another for stronger impact (time saved, revenue, team size)")
    else:
        feedback.append("No quantified metrics detected -- add numbers: percentages, dollar amounts, time saved")

    # Outcome language
    outcome_words = ["resulted", "outcome", "achieved", "delivered", "completed", "launched", "shipped",
                     "succeeded", "improved", "reduced", "increased", "saved", "grew"]
    if count_pattern(text, outcome_words) >= 1:
        score += 1
        feedback.append("Clear outcome language")
    else:
        feedback.append("Add clear outcome language -- what was the end result?")

    # Reflection/learning indicators
    reflection_words = ["learned", "takeaway", "lesson", "differently", "going forward", "since then",
                        "reflection", "growth", "realized", "insight"]
    if count_pattern(text, reflection_words) >= 1:
        score += 1
        feedback.append("Includes reflection/learning -- shows self-awareness")
    else:
        feedback.append("Consider adding a brief reflection: 'What I learned was...' or 'If I did it again...'")

    score = min(5, max(1, round(score)))
    return score, feedback


def score_competency_alignment(text, competency):
    """Check if the response aligns with the target competency."""
    if competency == "general" or competency not in COMPETENCY_KEYWORDS:
        return None, []

    keywords = COMPETENCY_KEYWORDS[competency]
    matched = [k for k in keywords if k in text.lower()]
    total = len(keywords)

    if len(matched) >= 4:
        return "Strong", [f"Strong {competency} alignment: {', '.join(matched[:5])}"]
    elif len(matched) >= 2:
        return "Moderate", [f"Moderate {competency} alignment: {', '.join(matched)}. Consider adding: {', '.join(list(k for k in keywords if k not in matched)[:3])}"]
    else:
        return "Weak", [f"Weak {competency} alignment. Try incorporating: {', '.join(keywords[:4])}"]


def print_results(response, competency, scores, verbose=False):
    """Print STAR scoring results."""
    s_score, s_feedback = scores["situation"]
    t_score, t_feedback = scores["task"]
    a_score, a_feedback = scores["action"]
    r_score, r_feedback = scores["result"]

    overall = round((s_score + t_score + a_score + r_score) / 4, 1)

    print("=" * 55)
    print("STAR RESPONSE ANALYSIS")
    print("=" * 55)

    if competency != "general":
        print(f"Competency: {competency.title()}")

    # Component scores with visual bars
    print(f"\nComponent Scores:")
    for label, sc in [("Situation", s_score), ("Task", t_score),
                      ("Action", a_score), ("Result", r_score)]:
        bar = "*" * sc + "." * (5 - sc)
        print(f"  {label:<12} {bar}  {sc}/5")

    print(f"\n{'-' * 55}")
    overall_bar = "*" * round(overall) + "." * (5 - round(overall))
    print(f"  {'OVERALL':<12} {overall_bar}  {overall}/5")
    print(f"{'-' * 55}")

    # Interpretation
    if overall >= 4:
        print(f"\nStrong response -- well-structured with clear impact.")
    elif overall >= 3:
        print(f"\nSolid foundation -- a few targeted improvements will elevate this.")
    elif overall >= 2:
        print(f"\nNeeds work -- focus on the specific feedback below.")
    else:
        print(f"\nSignificant gaps -- practice the STAR structure with the coaching notes below.")

    # Competency alignment
    alignment, comp_feedback = score_competency_alignment(response, competency)
    if alignment:
        print(f"Competency alignment: {alignment}")

    # Key feedback
    print(f"\n{'-' * 55}")
    print("FEEDBACK")
    print(f"{'-' * 55}")

    all_feedback = {
        "Situation": s_feedback,
        "Task": t_feedback,
        "Action": a_feedback,
        "Result": r_feedback,
    }

    for component, items in all_feedback.items():
        if items or verbose:
            print(f"\n{component}:")
            for item in items:
                print(f"  - {item}")

    if comp_feedback:
        print(f"\nCompetency fit:")
        for item in comp_feedback:
            print(f"  - {item}")

    if verbose:
        # Word count analysis
        word_count = len(response.split())
        print(f"\n{'-' * 55}")
        print("RESPONSE STATISTICS")
        print(f"{'-' * 55}")
        print(f"  Total words: {word_count}")
        if word_count < 100:
            print(f"  Length: Short -- aim for 150-250 words (90-120 seconds spoken)")
        elif word_count <= 250:
            print(f"  Length: Good range for a 2-minute answer")
        else:
            print(f"  Length: Long -- consider tightening to stay under 2 minutes")

        i_count = len(re.findall(r"\bi\b", response, re.IGNORECASE))
        we_count = len(re.findall(r"\bwe\b", response, re.IGNORECASE))
        print(f"  'I' count: {i_count} | 'We' count: {we_count}")
        print(f"  Metrics detected: {detect_metrics(response)}")

    print(f"\nNote: This is heuristic pattern matching, not qualitative judgment.")
    print(f"Use these scores as directional feedback, not absolute grades.")


def main():
    args = parse_args()

    if len(args.response.strip()) < 20:
        print("Error: Response is too short to analyze meaningfully.", file=sys.stderr)
        sys.exit(1)

    # Score each component on the full response
    # In a real interview, these would be distinct sections, but we score
    # the full text against each component's heuristics since users provide
    # their answer as a single block of text.
    scores = {
        "situation": score_situation(args.response),
        "task": score_task(args.response),
        "action": score_action(args.response),
        "result": score_result(args.response),
    }

    print_results(args.response, args.competency, scores, verbose=args.verbose)


if __name__ == "__main__":
    main()
