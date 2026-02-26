# /// script
# requires-python = ">=3.12"
# ///
"""Salary comparator: compare job offers side-by-side with Year 1 vs Year 2+ breakdown."""

import argparse
import json
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Compare job offers with total compensation breakdown.",
        epilog=(
            'Example: uv run salary_comparator.py --base 120000 --options \'[\n'
            '  {"name": "Company A", "base": 130000, "bonus_pct": 10, "equity_annual": 25000, "signing_bonus": 20000},\n'
            '  {"name": "Company B", "base": 120000, "bonus_pct": 15, "equity_annual": 40000, "signing_bonus": 0}\n'
            "]\'"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--base", type=float, default=0,
        help="Benchmark salary for comparison (e.g., current salary). Optional.",
    )
    parser.add_argument(
        "--options", required=True,
        help='JSON array of offer objects. Fields: name, base, bonus_pct, equity_annual, signing_bonus, signing_amortize_years (default: 1)',
    )
    parser.add_argument(
        "--tax-rate", type=float, default=0,
        help="Marginal tax rate as percentage (e.g., 32) for after-tax comparison. Optional.",
    )
    return parser.parse_args()


def validate_offers(offers):
    """Validate and normalize offer data."""
    for i, offer in enumerate(offers):
        if "name" not in offer:
            offer["name"] = f"Offer {i + 1}"
        if "base" not in offer:
            print(f"Error: Offer '{offer['name']}' missing 'base' salary.", file=sys.stderr)
            sys.exit(1)
        offer.setdefault("bonus_pct", 0)
        offer.setdefault("equity_annual", 0)
        offer.setdefault("signing_bonus", 0)
        offer.setdefault("signing_amortize_years", 1)
    return offers


def calculate_comp(offer, year=1):
    """Calculate total compensation for a given year."""
    base = offer["base"]
    bonus = base * (offer["bonus_pct"] / 100)
    equity = offer["equity_annual"]

    signing = 0
    if year <= offer["signing_amortize_years"] and offer["signing_amortize_years"] > 0:
        signing = offer["signing_bonus"] / offer["signing_amortize_years"]

    return {
        "base": base,
        "bonus": bonus,
        "equity": equity,
        "signing": signing,
        "total": base + bonus + equity + signing,
    }


def apply_tax(amount, tax_rate):
    """Apply marginal tax rate."""
    return amount * (1 - tax_rate / 100)


def print_results(offers, benchmark, tax_rate):
    """Print formatted offer comparison."""
    print("=" * 70)
    print("JOB OFFER COMPARISON")
    print("=" * 70)

    if benchmark > 0:
        print(f"\nBenchmark (current comp): ${benchmark:>12,.2f}")
    if tax_rate > 0:
        print(f"Marginal tax rate:        {tax_rate:>12.0f}%")

    # Year 1 comparison
    print(f"\n{'-' * 70}")
    print("YEAR 1 TOTAL COMPENSATION")
    print(f"{'-' * 70}")

    # Header
    name_width = max(len(o["name"]) for o in offers) + 2
    name_width = max(name_width, 12)
    header = f"{'Component':<20}"
    for offer in offers:
        header += f" {offer['name']:>{name_width}}"
    print(header)
    print("-" * (20 + (name_width + 1) * len(offers)))

    # Year 1 rows
    y1_comps = [calculate_comp(o, year=1) for o in offers]
    for label, key in [("Base salary", "base"), ("Bonus (annual)", "bonus"),
                       ("Equity (annual)", "equity"), ("Signing bonus", "signing")]:
        row = f"{label:<20}"
        for comp in y1_comps:
            row += f" ${comp[key]:>{name_width - 1},.0f}"
        print(row)

    print("-" * (20 + (name_width + 1) * len(offers)))
    row = f"{'TOTAL YEAR 1':<20}"
    for comp in y1_comps:
        row += f" ${comp['total']:>{name_width - 1},.0f}"
    print(row)

    if tax_rate > 0:
        row = f"{'After-tax Year 1':<20}"
        for comp in y1_comps:
            row += f" ${apply_tax(comp['total'], tax_rate):>{name_width - 1},.0f}"
        print(row)

    # Year 2+ comparison
    print(f"\n{'-' * 70}")
    print("YEAR 2+ TOTAL COMPENSATION (recurring)")
    print(f"{'-' * 70}")

    y2_comps = [calculate_comp(o, year=2) for o in offers]
    header = f"{'Component':<20}"
    for offer in offers:
        header += f" {offer['name']:>{name_width}}"
    print(header)
    print("-" * (20 + (name_width + 1) * len(offers)))

    for label, key in [("Base salary", "base"), ("Bonus (annual)", "bonus"),
                       ("Equity (annual)", "equity")]:
        row = f"{label:<20}"
        for comp in y2_comps:
            row += f" ${comp[key]:>{name_width - 1},.0f}"
        print(row)

    print("-" * (20 + (name_width + 1) * len(offers)))
    row = f"{'TOTAL YEAR 2+':<20}"
    for comp in y2_comps:
        row += f" ${comp['total']:>{name_width - 1},.0f}"
    print(row)

    if tax_rate > 0:
        row = f"{'After-tax Year 2+':<20}"
        for comp in y2_comps:
            row += f" ${apply_tax(comp['total'], tax_rate):>{name_width - 1},.0f}"
        print(row)

    # Comparison against benchmark
    if benchmark > 0:
        print(f"\n{'-' * 70}")
        print("VS BENCHMARK")
        print(f"{'-' * 70}")
        for offer, y1, y2 in zip(offers, y1_comps, y2_comps):
            y1_diff = y1["total"] - benchmark
            y2_diff = y2["total"] - benchmark
            sign1 = "+" if y1_diff >= 0 else ""
            sign2 = "+" if y2_diff >= 0 else ""
            print(f"  {offer['name']}: Year 1 {sign1}${y1_diff:,.0f} | Year 2+ {sign2}${y2_diff:,.0f}")

    # Winner summary
    print(f"\n{'-' * 70}")
    best_y1 = max(range(len(offers)), key=lambda i: y1_comps[i]["total"])
    best_y2 = max(range(len(offers)), key=lambda i: y2_comps[i]["total"])
    print(f"Highest Year 1:  {offers[best_y1]['name']} (${y1_comps[best_y1]['total']:,.0f})")
    print(f"Highest Year 2+: {offers[best_y2]['name']} (${y2_comps[best_y2]['total']:,.0f})")

    if best_y1 != best_y2:
        print(f"\nNote: Year 1 and Year 2+ winners differ -- the signing bonus shifts")
        print(f"the Year 1 ranking. For a multi-year stay, prioritize Year 2+ comp.")

    # Qualitative reminder
    y2_totals = [c["total"] for c in y2_comps]
    if len(y2_totals) >= 2:
        diff = max(y2_totals) - min(y2_totals)
        avg = sum(y2_totals) / len(y2_totals)
        if diff / avg < 0.10:
            print(f"\nThe offers are within 10% of each other. Non-monetary factors")
            print(f"(growth, culture, flexibility, manager, mission) should weigh heavily.")

    print(f"\nReminder: Total comp is important, but career growth, learning")
    print(f"opportunity, and quality of life matter just as much long-term.")


def main():
    args = parse_args()

    try:
        offers = json.loads(args.options)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in --options: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(offers, list) or len(offers) < 1:
        print("Error: --options must be a JSON array with at least one offer.", file=sys.stderr)
        sys.exit(1)

    offers = validate_offers(offers)
    print_results(offers, args.base, args.tax_rate)


if __name__ == "__main__":
    main()
