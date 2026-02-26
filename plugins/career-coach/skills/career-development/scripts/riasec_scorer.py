# /// script
# requires-python = ">=3.12"
# ///
"""Holland RIASEC interest assessment scorer: calculate Holland code from self-ratings or forced rankings."""

import argparse
import json
import sys


# Career family suggestions for each RIASEC type
CAREER_FAMILIES = {
    "R": {
        "name": "Realistic",
        "label": "The Builder",
        "careers": [
            "Engineer", "Mechanic", "Electrician", "Architect", "Surgeon",
            "Pilot", "Forester", "Athletic Trainer", "Construction Manager",
        ],
    },
    "I": {
        "name": "Investigative",
        "label": "The Thinker",
        "careers": [
            "Scientist", "Data Analyst", "Researcher", "Software Developer",
            "Economist", "Physician", "Psychologist", "Pharmacist",
        ],
    },
    "A": {
        "name": "Artistic",
        "label": "The Creator",
        "careers": [
            "Graphic Designer", "Writer", "Musician", "Art Director",
            "UX Designer", "Photographer", "Interior Designer", "Actor",
        ],
    },
    "S": {
        "name": "Social",
        "label": "The Helper",
        "careers": [
            "Teacher", "Counselor", "Social Worker", "Nurse", "HR Specialist",
            "Physical Therapist", "Community Manager", "Nonprofit Director",
        ],
    },
    "E": {
        "name": "Enterprising",
        "label": "The Persuader",
        "careers": [
            "Sales Manager", "Entrepreneur", "Lawyer", "Marketing Director",
            "Real Estate Agent", "Financial Advisor", "Recruiter", "Lobbyist",
        ],
    },
    "C": {
        "name": "Conventional",
        "label": "The Organizer",
        "careers": [
            "Accountant", "Actuary", "Database Administrator", "Auditor",
            "Technical Writer", "Logistics Coordinator", "Compliance Officer",
        ],
    },
}

# Common two-letter combo interpretations
COMBO_DESCRIPTIONS = {
    "RI": "Practical problem-solvers who apply analytical thinking to hands-on work",
    "IR": "Analytical minds who enjoy working with tangible systems and tools",
    "IA": "Creative thinkers who approach problems with both rigor and imagination",
    "AI": "Artistic individuals who bring intellectual depth to creative work",
    "AS": "Empathetic creatives who express ideas through human connection",
    "SA": "People-oriented helpers who use creativity in their approach",
    "SE": "Natural leaders who motivate and develop others",
    "ES": "Persuasive communicators who care about people's wellbeing",
    "EC": "Organized leaders who build efficient systems and teams",
    "CE": "Detail-oriented professionals who thrive in structured leadership",
    "RC": "Methodical workers who combine hands-on skill with precision",
    "CR": "Systematic organizers who value practical, tangible outcomes",
    "IS": "Thoughtful advisors who apply research to help others",
    "SI": "Caring professionals who use evidence-based approaches",
    "RE": "Action-oriented leaders who build and manage real-world projects",
    "ER": "Driven achievers who prefer concrete, physical endeavors",
    "IC": "Precise analysts who excel in structured research environments",
    "CI": "Detail-focused professionals who apply analytical frameworks",
    "AE": "Creative entrepreneurs who turn artistic vision into business",
    "EA": "Ambitious innovators who blend persuasion with creative flair",
    "SC": "Organized helpers who bring structure to people-focused work",
    "CS": "Reliable supporters who maintain systems that serve others",
    "RA": "Hands-on creators who build tangible works of art or craft",
    "AR": "Artists who work with physical media, tools, and materials",
    "IE": "Strategic thinkers who apply research to business problems",
    "EI": "Ambitious leaders who value data-driven decision-making",
    "AC": "Creative professionals who bring order to artistic production",
    "CA": "Organized individuals with an eye for aesthetics and design",
    "RS": "Practical helpers who provide hands-on assistance and training",
    "SR": "People-focused professionals who work in active, physical settings",
}

TYPES = ["R", "I", "A", "S", "E", "C"]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Score Holland RIASEC interest assessment and generate Holland code.",
        epilog=(
            'Rate mode: --responses \'{"R":7,"I":9,"A":3,"S":5,"E":6,"C":4}\' --mode rate\n'
            'Rank mode: --responses \'{"R":3,"I":1,"A":6,"S":4,"E":2,"C":5}\' --mode rank\n'
            "In rank mode, 1 = most like you, 6 = least like you."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--responses", required=True,
        help="JSON object with R, I, A, S, E, C scores",
    )
    parser.add_argument(
        "--mode", choices=["rate", "rank"], default="rate",
        help="Input mode: 'rate' for 1-10 self-ratings, 'rank' for 1-6 forced ranking (default: rate)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show detailed breakdown with career suggestions per type",
    )
    return parser.parse_args()


def validate_responses(responses, mode):
    """Validate RIASEC response data."""
    for t in TYPES:
        if t not in responses:
            print(f"Error: Missing type '{t}' in responses. Need all of: {', '.join(TYPES)}", file=sys.stderr)
            sys.exit(1)

    for t in TYPES:
        try:
            responses[t] = float(responses[t])
        except (ValueError, TypeError):
            print(f"Error: Invalid score for '{t}': {responses[t]}", file=sys.stderr)
            sys.exit(1)

    if mode == "rate":
        for t in TYPES:
            if not (1 <= responses[t] <= 10):
                print(f"Warning: Score for {t} ({responses[t]}) is outside 1-10 range.", file=sys.stderr)
    elif mode == "rank":
        ranks = sorted(responses[t] for t in TYPES)
        expected = [1, 2, 3, 4, 5, 6]
        if ranks != expected:
            print(f"Warning: Rank mode expects ranks 1-6 (each used once). Got: {ranks}", file=sys.stderr)

    return responses


def scores_from_ranks(responses):
    """Convert forced rankings (1=best) to scores (higher=better)."""
    return {t: 7 - responses[t] for t in TYPES}


def generate_holland_code(scores):
    """Generate 3-letter Holland code from scores."""
    sorted_types = sorted(TYPES, key=lambda t: scores[t], reverse=True)
    return "".join(sorted_types[:3])


def print_bar(label, value, max_value, width=30):
    """Print a terminal bar chart row."""
    filled = int((value / max_value) * width) if max_value > 0 else 0
    bar = "#" * filled + "-" * (width - filled)
    print(f"  {label:<14} {bar} {value:.1f}")


def print_results(responses, scores, holland_code, mode, verbose=False):
    """Print RIASEC assessment results."""
    max_score = max(scores.values())
    sorted_types = sorted(TYPES, key=lambda t: scores[t], reverse=True)

    print("=" * 55)
    print("HOLLAND RIASEC ASSESSMENT")
    print("=" * 55)
    print(f"\nInput mode: {'Self-rating (1-10)' if mode == 'rate' else 'Forced ranking (1=most)'}")

    print(f"\nYour scores:")
    for t in sorted_types:
        info = CAREER_FAMILIES[t]
        print_bar(f"{t} ({info['name'][:6]})", scores[t], max_score)

    print(f"\n{'-' * 55}")
    print(f"Holland Code: {holland_code}")
    print(f"{'-' * 55}")

    # Primary and secondary type descriptions
    primary = holland_code[0]
    secondary = holland_code[1]
    p_info = CAREER_FAMILIES[primary]
    s_info = CAREER_FAMILIES[secondary]

    print(f"\nPrimary type:   {primary} -- {p_info['name']} ({p_info['label']})")
    print(f"Secondary type: {secondary} -- {s_info['name']} ({s_info['label']})")

    combo = primary + secondary
    if combo in COMBO_DESCRIPTIONS:
        print(f"\nProfile: {COMBO_DESCRIPTIONS[combo]}")

    if verbose:
        print(f"\n{'=' * 55}")
        print("DETAILED BREAKDOWN")
        print("=" * 55)
        for t in sorted_types:
            info = CAREER_FAMILIES[t]
            raw = responses[t]
            print(f"\n{t} -- {info['name']} ({info['label']})")
            if mode == "rank":
                print(f"  Rank: {int(raw)} -> Score: {scores[t]:.0f}")
            else:
                print(f"  Rating: {scores[t]:.1f}/10")
            print(f"  Sample careers: {', '.join(info['careers'][:5])}")

    # Top career suggestions from primary and secondary
    print(f"\n{'-' * 55}")
    print("Career families to explore:")
    for t in holland_code[:2]:
        info = CAREER_FAMILIES[t]
        print(f"  {info['name']}: {', '.join(info['careers'][:4])}")

    print(f"\nNote: RIASEC is one lens among many. Use these results as a")
    print(f"starting point for exploration, not a definitive career match.")


def main():
    args = parse_args()

    try:
        responses = json.loads(args.responses)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in --responses: {e}", file=sys.stderr)
        sys.exit(1)

    responses = validate_responses(responses, args.mode)

    if args.mode == "rank":
        scores = scores_from_ranks(responses)
    else:
        scores = {t: responses[t] for t in TYPES}

    holland_code = generate_holland_code(scores)
    print_results(responses, scores, holland_code, args.mode, verbose=args.verbose)


if __name__ == "__main__":
    main()
