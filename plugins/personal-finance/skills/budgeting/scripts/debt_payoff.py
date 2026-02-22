# /// script
# requires-python = ">=3.12"
# ///
"""Debt payoff calculator: compare avalanche vs snowball methods with month-by-month schedules."""

import argparse
import csv
import json
import sys
from copy import deepcopy


def parse_args():
    parser = argparse.ArgumentParser(
        description="Compare avalanche vs snowball debt payoff strategies.",
        epilog=(
            "Provide debts via --json or --csv. "
            "JSON format: [{\"name\": \"...\", \"balance\": N, \"rate\": N, \"minimum\": N}, ...]. "
            "CSV format: name, balance, interest_rate, minimum_payment columns."
        ),
    )
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--json", help="Path to JSON file with debt list")
    input_group.add_argument("--csv", help="Path to CSV file with debt list")
    input_group.add_argument(
        "--inline",
        help='Inline JSON string, e.g. \'[{"name":"CC","balance":5000,"rate":0.22,"minimum":100}]\'',
    )
    parser.add_argument(
        "--extra",
        type=float,
        required=True,
        help="Extra monthly payment beyond minimums",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show month-by-month payoff schedule",
    )
    return parser.parse_args()


def load_debts_json(path):
    with open(path) as f:
        return json.load(f)


def load_debts_csv(path):
    debts = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Try common column name variations
            name = row.get("name") or row.get("Name") or row.get("debt") or "Unknown"
            balance = float(
                (row.get("balance") or row.get("Balance") or "0")
                .replace("$", "").replace(",", "")
            )
            rate = float(
                (row.get("rate") or row.get("interest_rate") or row.get("Rate") or row.get("APR") or "0")
                .replace("%", "")
            )
            # If rate looks like a percentage (>1), convert to decimal
            if rate > 1:
                rate = rate / 100
            minimum = float(
                (row.get("minimum") or row.get("minimum_payment") or row.get("Minimum") or row.get("Min Payment") or "0")
                .replace("$", "").replace(",", "")
            )
            debts.append({"name": name, "balance": balance, "rate": rate, "minimum": minimum})
    return debts


def validate_debts(debts):
    """Validate debt entries and print warnings."""
    for d in debts:
        for field in ("name", "balance", "rate", "minimum"):
            if field not in d:
                print(f"Error: Debt entry missing '{field}': {d}", file=sys.stderr)
                sys.exit(1)
        if d["rate"] > 1:
            print(f"Warning: Rate for {d['name']} is {d['rate']} — interpreting as {d['rate']}% (converting to {d['rate']/100:.4f})", file=sys.stderr)
            d["rate"] = d["rate"] / 100
        if d["balance"] <= 0:
            print(f"Warning: {d['name']} has zero or negative balance, skipping.", file=sys.stderr)
    return [d for d in debts if d["balance"] > 0]


def simulate_payoff(debts, extra_payment, strategy="avalanche", verbose=False):
    """
    Simulate debt payoff month by month.

    strategy: "avalanche" (highest rate first) or "snowball" (lowest balance first)
    Returns: (total_interest, total_months, schedule)
    """
    debts = deepcopy(debts)
    total_interest = 0.0
    month = 0
    schedule = []
    max_months = 1200  # 100 years safety cap
    rolled_minimums = 0.0
    paid_off = set()

    while any(d["balance"] > 0 for d in debts) and month < max_months:
        month += 1
        month_interest = 0.0
        month_detail = {"month": month, "payments": {}, "balances": {}}

        # Apply interest to all debts
        for d in debts:
            if d["balance"] > 0:
                interest = d["balance"] * d["rate"] / 12
                d["balance"] += interest
                month_interest += interest

        total_interest += month_interest

        # Pay minimums on all debts
        remaining_extra = extra_payment
        for d in debts:
            if d["balance"] > 0:
                payment = min(d["minimum"], d["balance"])
                d["balance"] -= payment
                month_detail["payments"][d["name"]] = payment

        # Sort remaining debts by strategy for extra payment
        active_debts = [d for d in debts if d["balance"] > 0]
        if strategy == "avalanche":
            active_debts.sort(key=lambda d: d["rate"], reverse=True)
        else:  # snowball
            active_debts.sort(key=lambda d: d["balance"])

        # Capture freed minimums from newly paid-off debts (permanent rollover)
        for d in debts:
            if d["balance"] <= 0 and d["name"] not in paid_off:
                rolled_minimums += d["minimum"]
                paid_off.add(d["name"])

        # Apply extra payment + all rolled minimums to target debt(s)
        combined_extra = remaining_extra + rolled_minimums
        for d in active_debts:
            if combined_extra <= 0:
                break
            if d["balance"] > 0:
                payment = min(combined_extra, d["balance"])
                d["balance"] -= payment
                combined_extra -= payment
                month_detail["payments"][d["name"]] = month_detail["payments"].get(d["name"], 0) + payment

        for d in debts:
            month_detail["balances"][d["name"]] = max(0, d["balance"])

        if verbose:
            schedule.append(month_detail)

    return total_interest, month, schedule


def print_results(debts, extra_payment, avalanche_result, snowball_result, verbose=False):
    """Print comparison of both methods."""
    av_interest, av_months, av_schedule = avalanche_result
    sn_interest, sn_months, sn_schedule = snowball_result

    total_debt = sum(d["balance"] for d in debts)
    total_minimums = sum(d["minimum"] for d in debts)

    print("=" * 60)
    print("DEBT PAYOFF COMPARISON")
    print("=" * 60)
    print(f"\nTotal debt:           ${total_debt:>12,.2f}")
    print(f"Total minimums:       ${total_minimums:>12,.2f}/mo")
    print(f"Extra payment:        ${extra_payment:>12,.2f}/mo")
    print(f"Total monthly budget: ${total_minimums + extra_payment:>12,.2f}/mo")

    print(f"\nDebts:")
    for d in sorted(debts, key=lambda x: x["rate"], reverse=True):
        print(f"  {d['name']:<20} ${d['balance']:>10,.2f}  {d['rate']*100:>5.1f}% APR  ${d['minimum']:>8,.2f}/mo min")

    print(f"\n{'-' * 60}")
    print(f"{'Method':<20} {'Total Interest':>15} {'Months':>8} {'Years':>7}")
    print(f"{'-' * 60}")
    print(f"{'Avalanche':<20} ${av_interest:>14,.2f} {av_months:>8} {av_months/12:>6.1f}")
    print(f"{'Snowball':<20} ${sn_interest:>14,.2f} {sn_months:>8} {sn_months/12:>6.1f}")
    print(f"{'-' * 60}")

    diff = sn_interest - av_interest
    if diff > 0:
        print(f"\nAvalanche saves ${diff:,.2f} in interest ({sn_months - av_months} fewer months)")
    elif diff < 0:
        print(f"\nSnowball saves ${-diff:,.2f} in interest ({av_months - sn_months} fewer months)")
    else:
        print(f"\nBoth methods cost the same — order doesn't matter for your debt mix.")

    if diff > 0 and diff < 100:
        print(f"Note: The difference is small (${diff:,.2f}). Snowball's psychological benefits may outweigh the cost.")

    if verbose:
        for label, schedule in [("AVALANCHE", av_schedule), ("SNOWBALL", sn_schedule)]:
            print(f"\n{'=' * 60}")
            print(f"{label} — MONTH-BY-MONTH SCHEDULE")
            print(f"{'=' * 60}")
            debt_names = [d["name"] for d in debts]
            header = f"{'Mo':>4}"
            for name in debt_names:
                header += f" {name[:12]:>12}"
            print(header)
            print("-" * (4 + 13 * len(debt_names)))
            for entry in schedule:
                line = f"{entry['month']:>4}"
                for name in debt_names:
                    bal = entry["balances"].get(name, 0)
                    line += f" ${bal:>11,.2f}"
                print(line)


def main():
    args = parse_args()

    if args.json:
        debts = load_debts_json(args.json)
    elif args.csv:
        debts = load_debts_csv(args.csv)
    else:
        debts = json.loads(args.inline)

    debts = validate_debts(debts)
    if not debts:
        print("No valid debts to analyze.", file=sys.stderr)
        sys.exit(1)

    avalanche = simulate_payoff(debts, args.extra, strategy="avalanche", verbose=args.verbose)
    snowball = simulate_payoff(debts, args.extra, strategy="snowball", verbose=args.verbose)

    print_results(debts, args.extra, avalanche, snowball, verbose=args.verbose)


if __name__ == "__main__":
    main()
