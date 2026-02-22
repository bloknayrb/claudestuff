# /// script
# requires-python = ">=3.12"
# ///
"""Compound interest calculator: project future value with regular contributions."""

import argparse
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Calculate compound growth of an investment over time.",
        epilog="Example: uv run compound_interest.py --principal 10000 --rate 0.07 --years 30 --contribution 500",
    )
    parser.add_argument(
        "--principal", type=float, required=True,
        help="Initial investment amount",
    )
    parser.add_argument(
        "--rate", type=float, required=True,
        help="Annual return rate (e.g., 0.07 for 7%%)",
    )
    parser.add_argument(
        "--years", type=int, required=True,
        help="Investment time horizon in years",
    )
    parser.add_argument(
        "--contribution", type=float, default=0,
        help="Contribution added each compounding period (default: monthly)",
    )
    parser.add_argument(
        "--frequency", type=int, default=12,
        help="Compounding frequency per year (default: 12 = monthly)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show year-by-year breakdown",
    )
    return parser.parse_args()


def calculate_compound_growth(principal, annual_rate, years, monthly_contribution=0, frequency=12):
    """
    Calculate compound growth with optional regular contributions.

    Returns list of yearly snapshots: (year, balance, total_contributions, total_interest)
    """
    balance = principal
    total_contributions = principal
    period_rate = annual_rate / frequency
    snapshots = []

    for year in range(1, years + 1):
        for _ in range(frequency):
            # Add monthly contribution
            if monthly_contribution > 0:
                balance += monthly_contribution
                total_contributions += monthly_contribution
            # Apply interest for this period
            balance *= (1 + period_rate)

        total_interest = balance - total_contributions
        snapshots.append({
            "year": year,
            "balance": balance,
            "total_contributions": total_contributions,
            "total_interest": total_interest,
        })

    return snapshots


def print_results(principal, annual_rate, years, monthly_contribution, frequency, snapshots, verbose=False):
    """Print the compound interest projection."""
    final = snapshots[-1]

    print("=" * 55)
    print("COMPOUND INTEREST PROJECTION")
    print("=" * 55)
    print(f"\nInitial investment:    ${principal:>12,.2f}")
    print(f"Monthly contribution:  ${monthly_contribution:>12,.2f}")
    print(f"Annual return rate:    {annual_rate * 100:>12.2f}%")
    print(f"Compounding:           {'monthly' if frequency == 12 else f'{frequency}x/year':>12}")
    print(f"Time horizon:          {years:>12} years")

    print(f"\n{'-' * 55}")
    print(f"Final balance:         ${final['balance']:>12,.2f}")
    print(f"Total contributions:   ${final['total_contributions']:>12,.2f}")
    print(f"Total interest earned: ${final['total_interest']:>12,.2f}")
    print(f"{'-' * 55}")

    if final['total_contributions'] > 0:
        growth_multiple = final['balance'] / final['total_contributions']
        print(f"Growth multiple:       {growth_multiple:>12.2f}x")
        interest_pct = final['total_interest'] / final['balance'] * 100
        print(f"Interest % of total:   {interest_pct:>11.1f}%")

    if verbose and len(snapshots) > 1:
        print(f"\n{'=' * 55}")
        print("YEAR-BY-YEAR BREAKDOWN")
        print("=" * 55)
        print(f"{'Year':>5} {'Balance':>14} {'Contributed':>14} {'Interest':>14}")
        print("-" * 55)
        for s in snapshots:
            print(
                f"{s['year']:>5} "
                f"${s['balance']:>13,.2f} "
                f"${s['total_contributions']:>13,.2f} "
                f"${s['total_interest']:>13,.2f}"
            )

    # Milestone markers
    milestones = [100_000, 250_000, 500_000, 1_000_000, 2_000_000]
    hit = []
    for target in milestones:
        for s in snapshots:
            if s["balance"] >= target:
                hit.append((target, s["year"]))
                break

    if hit:
        print(f"\nMilestones:")
        for target, year in hit:
            print(f"  ${target:>12,.0f} reached in year {year}")


def main():
    args = parse_args()

    if args.rate > 1:
        print(f"Warning: Rate {args.rate} looks like a percentage. Interpreting as {args.rate}% (converting to {args.rate / 100:.4f}).", file=sys.stderr)
        args.rate = args.rate / 100

    if args.years < 1 or args.years > 100:
        print("Error: Years must be between 1 and 100.", file=sys.stderr)
        sys.exit(1)

    snapshots = calculate_compound_growth(
        args.principal, args.rate, args.years, args.contribution, args.frequency,
    )

    print_results(
        args.principal, args.rate, args.years, args.contribution,
        args.frequency, snapshots, verbose=args.verbose,
    )


if __name__ == "__main__":
    main()
