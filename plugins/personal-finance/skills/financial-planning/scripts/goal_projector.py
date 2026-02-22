# /// script
# requires-python = ">=3.12"
# ///
"""Goal projector: calculate time to reach a savings goal or required contribution for a target date."""

import argparse
import math
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Project time to a savings goal or calculate required contributions.",
        epilog="Example: uv run goal_projector.py --current 5000 --monthly 500 --target 50000",
    )
    parser.add_argument(
        "--current", type=float, required=True,
        help="Current savings toward this goal",
    )
    parser.add_argument(
        "--target", type=float, required=True,
        help="Target amount to reach",
    )
    parser.add_argument(
        "--monthly", type=float, default=0,
        help="Monthly contribution (required unless --months is provided)",
    )
    parser.add_argument(
        "--months", type=int, default=0,
        help="Target number of months (if provided, calculates required monthly contribution)",
    )
    parser.add_argument(
        "--return-rate", type=float, default=0,
        help="Expected annual return as percentage (default: 0 for cash savings, use 5-7 for invested goals)",
    )
    parser.add_argument(
        "--scenarios", action="store_true",
        help="Show conservative (5%%), moderate (7%%), and optimistic (9%%) scenarios",
    )
    return parser.parse_args()


def months_to_goal(current, monthly, target, annual_return_pct=0):
    """Calculate months needed to reach target with given contributions and return."""
    if current >= target:
        return 0

    if annual_return_pct == 0:
        # Simple arithmetic
        if monthly <= 0:
            return -1  # Never reaches goal
        return math.ceil((target - current) / monthly)

    monthly_rate = annual_return_pct / 100 / 12
    balance = current
    months = 0
    max_months = 1200  # 100 years cap

    while balance < target and months < max_months:
        balance += monthly
        balance *= (1 + monthly_rate)
        months += 1

    return months if months < max_months else -1


def required_monthly(current, target, months, annual_return_pct=0):
    """Calculate required monthly contribution to reach target in given months."""
    if current >= target:
        return 0

    if months <= 0:
        return -1

    if annual_return_pct == 0:
        return (target - current) / months

    monthly_rate = annual_return_pct / 100 / 12

    # Future value of current savings
    fv_current = current * (1 + monthly_rate) ** months

    if fv_current >= target:
        return 0  # Current savings alone will reach the goal

    # Required monthly using future value of annuity formula
    remaining = target - fv_current
    # FV of annuity: PMT * [((1+r)^n - 1) / r]
    annuity_factor = ((1 + monthly_rate) ** months - 1) / monthly_rate
    return remaining / annuity_factor


def print_time_projection(current, monthly, target, annual_return_pct):
    """Print how long it takes to reach the goal."""
    m = months_to_goal(current, monthly, target, annual_return_pct)

    rate_label = f" @ {annual_return_pct:.0f}% annual return" if annual_return_pct > 0 else " (cash savings, no growth)"

    if m == 0:
        print(f"  Already reached! Current ${current:,.0f} >= target ${target:,.0f}")
    elif m < 0:
        print(f"  Cannot reach target{rate_label}")
        if monthly <= 0:
            print(f"  Monthly contributions needed to make progress")
    else:
        years = m // 12
        remaining_months = m % 12
        if years > 0 and remaining_months > 0:
            time_str = f"{years} year{'s' if years != 1 else ''}, {remaining_months} month{'s' if remaining_months != 1 else ''}"
        elif years > 0:
            time_str = f"{years} year{'s' if years != 1 else ''}"
        else:
            time_str = f"{remaining_months} month{'s' if remaining_months != 1 else ''}"

        total_contributed = current + (monthly * m)
        growth = target - total_contributed if annual_return_pct > 0 else 0

        print(f"  Time to goal{rate_label}: {time_str} ({m} months)")
        print(f"  Total contributed: ${total_contributed:,.0f}")
        if growth > 0:
            print(f"  Investment growth: ${growth:,.0f}")


def print_contribution_projection(current, target, months, annual_return_pct):
    """Print required monthly contribution."""
    pmt = required_monthly(current, target, months, annual_return_pct)

    rate_label = f" @ {annual_return_pct:.0f}% return" if annual_return_pct > 0 else ""

    if pmt == 0:
        print(f"  Current savings will reach the goal on their own{rate_label}")
    elif pmt < 0:
        print(f"  Invalid time horizon")
    else:
        years = months // 12
        remaining_months = months % 12
        if years > 0 and remaining_months > 0:
            time_str = f"{years}y {remaining_months}m"
        elif years > 0:
            time_str = f"{years}y"
        else:
            time_str = f"{remaining_months}m"

        total = current + (pmt * months)
        print(f"  Required monthly contribution{rate_label}: ${pmt:>10,.2f}  (over {time_str})")
        print(f"  Total contributed: ${total:,.0f}")


def main():
    args = parse_args()

    if args.current < 0:
        print("Error: Current savings cannot be negative.", file=sys.stderr)
        sys.exit(1)
    if args.target <= 0:
        print("Error: Target must be positive.", file=sys.stderr)
        sys.exit(1)
    if args.monthly == 0 and args.months == 0:
        print("Error: Provide --monthly (to calculate time) or --months (to calculate required contribution).", file=sys.stderr)
        sys.exit(1)

    gap = args.target - args.current
    print("=" * 55)
    print("GOAL PROJECTION")
    print("=" * 55)
    print(f"\n  Current savings:     ${args.current:>12,.2f}")
    print(f"  Target amount:       ${args.target:>12,.2f}")
    print(f"  Gap to fill:         ${gap:>12,.2f}")

    if args.monthly > 0:
        print(f"  Monthly contribution: ${args.monthly:>11,.2f}")
    if args.months > 0:
        print(f"  Target timeline:     {args.months:>12} months")

    print(f"\n{'-' * 55}")

    if args.scenarios:
        # Show multiple return rate scenarios
        rates = [0, 5, 7, 9]
        print(f"\nSCENARIO COMPARISON:")
        print("-" * 55)
        for rate in rates:
            label = {0: "Cash (0%)", 5: "Conservative (5%)", 7: "Moderate (7%)", 9: "Optimistic (9%)"}[rate]
            print(f"\n  {label}:")
            if args.months > 0:
                print_contribution_projection(args.current, args.target, args.months, rate)
            else:
                print_time_projection(args.current, args.monthly, args.target, rate)
    else:
        # Single scenario
        if args.months > 0:
            print(f"\nRequired monthly contribution:")
            print_contribution_projection(args.current, args.target, args.months, args.return_rate)
        else:
            print(f"\nTime to reach goal:")
            print_time_projection(args.current, args.monthly, args.target, args.return_rate)

    # Sanity check
    if args.monthly > 0 and args.monthly > gap and args.return_rate == 0:
        print(f"\n  Note: A single month's contribution (${args.monthly:,.0f}) exceeds the gap (${gap:,.0f}).")


if __name__ == "__main__":
    main()
