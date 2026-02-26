# /// script
# requires-python = ">=3.12"
# ///
"""Expense ratio impact calculator: compare the long-term cost difference between two expense ratios."""

import argparse
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Compare the long-term dollar impact of different expense ratios.",
        epilog="Example: uv run expense_ratio_impact.py --portfolio 100000 --ratio-a 0.03 --ratio-b 1.0 --years 30",
    )
    parser.add_argument(
        "--portfolio", type=float, required=True,
        help="Current portfolio value",
    )
    parser.add_argument(
        "--ratio-a", type=float, required=True,
        help="First expense ratio as percentage (e.g., 0.03 for 0.03%%)",
    )
    parser.add_argument(
        "--ratio-b", type=float, required=True,
        help="Second expense ratio as percentage (e.g., 1.0 for 1.0%%)",
    )
    parser.add_argument(
        "--years", type=int, required=True,
        help="Time horizon in years",
    )
    parser.add_argument(
        "--return-rate", type=float, default=7.0,
        help="Assumed annual return before fees, as percentage (default: 7.0%%)",
    )
    parser.add_argument(
        "--contribution", type=float, default=0,
        help="Monthly contribution amount (default: 0)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show year-by-year comparison",
    )
    return parser.parse_args()


def simulate_growth(portfolio, expense_ratio_pct, return_rate_pct, years, monthly_contribution=0):
    """
    Simulate portfolio growth net of expense ratio.

    Returns list of yearly snapshots: (year, balance, total_fees_paid)
    """
    balance = portfolio
    total_fees = 0.0
    monthly_net_return = (return_rate_pct - expense_ratio_pct) / 100 / 12
    monthly_fee_rate = expense_ratio_pct / 100 / 12
    snapshots = []

    for year in range(1, years + 1):
        for _ in range(12):
            balance += monthly_contribution
            # Fees are deducted from returns (reflected in lower net return).
            # total_fees tracks the cumulative expense ratio cost: each period,
            # the ratio is applied to the current balance, mirroring how fund
            # expense ratios reduce NAV daily (approximated monthly here).
            fee_this_month = balance * monthly_fee_rate
            total_fees += fee_this_month
            balance *= (1 + monthly_net_return)

        snapshots.append({
            "year": year,
            "balance": balance,
            "total_fees": total_fees,
        })

    return snapshots


def print_results(portfolio, ratio_a, ratio_b, return_rate, years, contribution, snapshots_a, snapshots_b, verbose=False):
    """Print expense ratio comparison."""
    final_a = snapshots_a[-1]
    final_b = snapshots_b[-1]

    # Ensure A is the lower ratio for consistent presentation
    if ratio_a > ratio_b:
        ratio_a, ratio_b = ratio_b, ratio_a
        final_a, final_b = final_b, final_a
        snapshots_a, snapshots_b = snapshots_b, snapshots_a

    print("=" * 60)
    print("EXPENSE RATIO IMPACT COMPARISON")
    print("=" * 60)
    print(f"\nStarting portfolio:    ${portfolio:>12,.2f}")
    if contribution > 0:
        print(f"Monthly contribution:  ${contribution:>12,.2f}")
    print(f"Assumed annual return: {return_rate:>12.1f}% (before fees)")
    print(f"Time horizon:          {years:>12} years")

    print(f"\n{'-' * 60}")
    print(f"{'':>25} {'Low Cost':>15} {'High Cost':>15}")
    print(f"{'Expense ratio':>25} {ratio_a:>14.2f}% {ratio_b:>14.2f}%")
    print(f"{'Net annual return':>25} {return_rate - ratio_a:>13.2f}% {return_rate - ratio_b:>13.2f}%")
    print(f"{'Final balance':>25} ${final_a['balance']:>13,.0f} ${final_b['balance']:>13,.0f}")
    print(f"{'Total fees paid':>25} ${final_a['total_fees']:>13,.0f} ${final_b['total_fees']:>13,.0f}")
    print(f"{'-' * 60}")

    diff = final_a["balance"] - final_b["balance"]
    fee_diff = final_b["total_fees"] - final_a["total_fees"]
    pct_diff = diff / final_b["balance"] * 100 if final_b["balance"] > 0 else 0

    print(f"\nThe lower-cost option results in:")
    print(f"  ${diff:>12,.0f} more in your portfolio ({pct_diff:.1f}% more)")
    print(f"  ${fee_diff:>12,.0f} less paid in fees over {years} years")

    # Annual fee in dollars
    annual_fee_a = portfolio * ratio_a / 100
    annual_fee_b = portfolio * ratio_b / 100
    print(f"\nAnnual fee on current portfolio:")
    print(f"  {ratio_a:.2f}%: ${annual_fee_a:>8,.2f}/year (${annual_fee_a/12:,.2f}/month)")
    print(f"  {ratio_b:.2f}%: ${annual_fee_b:>8,.2f}/year (${annual_fee_b/12:,.2f}/month)")

    if verbose:
        print(f"\n{'=' * 60}")
        print("YEAR-BY-YEAR COMPARISON")
        print("=" * 60)
        print(f"{'Year':>5} {f'{ratio_a:.2f}% Balance':>15} {f'{ratio_b:.2f}% Balance':>15} {'Difference':>12}")
        print("-" * 60)
        for sa, sb in zip(snapshots_a, snapshots_b):
            d = sa["balance"] - sb["balance"]
            print(f"{sa['year']:>5} ${sa['balance']:>14,.0f} ${sb['balance']:>14,.0f} ${d:>11,.0f}")

    # Context
    print(f"\nContext:")
    bps_diff = (ratio_b - ratio_a) * 100
    print(f"  The difference is {bps_diff:.0f} basis points ({ratio_b - ratio_a:.2f} percentage points)")
    print(f"  This seems small annually but compounds to ${diff:,.0f} over {years} years")
    if diff > 50000:
        print(f"  That's enough to fund years of retirement spending")


def main():
    args = parse_args()

    if args.years < 1 or args.years > 100:
        print("Error: Years must be between 1 and 100.", file=sys.stderr)
        sys.exit(1)

    # Validate ratios are reasonable (0-5%)
    for label, ratio in [("ratio-a", args.ratio_a), ("ratio-b", args.ratio_b)]:
        if ratio < 0 or ratio > 10:
            print(f"Warning: {label} is {ratio}% — unusually high. Double-check the value.", file=sys.stderr)

    snapshots_a = simulate_growth(args.portfolio, args.ratio_a, args.return_rate, args.years, args.contribution)
    snapshots_b = simulate_growth(args.portfolio, args.ratio_b, args.return_rate, args.years, args.contribution)

    print_results(
        args.portfolio, args.ratio_a, args.ratio_b, args.return_rate,
        args.years, args.contribution, snapshots_a, snapshots_b, verbose=args.verbose,
    )


if __name__ == "__main__":
    main()
