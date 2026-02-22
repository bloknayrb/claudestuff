# /// script
# requires-python = ">=3.12"
# ///
"""Portfolio rebalancing calculator: compare current allocation to target and generate trade instructions."""

import argparse
import csv
import json
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Calculate portfolio rebalancing instructions.",
        epilog=(
            "Holdings: JSON or CSV with fields: account, ticker, value, asset_class. "
            "Target: JSON mapping asset_class to target percentage (must sum to 100). "
            "Example: uv run rebalancing.py --holdings portfolio.json --target '{\"US Stocks\": 60, \"Intl Stocks\": 25, \"Bonds\": 15}'"
        ),
    )
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--holdings-json", help="Path to JSON file with holdings")
    input_group.add_argument("--holdings-csv", help="Path to CSV file with holdings")
    input_group.add_argument("--holdings-inline", help="Inline JSON string of holdings")

    parser.add_argument(
        "--target", required=True,
        help='Target allocation as JSON string, e.g. \'{"US Stocks": 60, "Intl Stocks": 25, "Bonds": 15}\'',
    )
    parser.add_argument(
        "--new-money", type=float, default=0,
        help="New money available to invest (rebalance by contributing to underweight assets first)",
    )
    parser.add_argument(
        "--threshold", type=float, default=5.0,
        help="Rebalancing threshold in percentage points (default: 5.0)",
    )
    return parser.parse_args()


def load_holdings_json(path):
    with open(path) as f:
        return json.load(f)


def load_holdings_csv(path):
    holdings = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            account = row.get("account") or row.get("Account") or "Unknown"
            ticker = row.get("ticker") or row.get("Ticker") or row.get("symbol") or row.get("Symbol") or "Unknown"
            value = float(
                (row.get("value") or row.get("Value") or row.get("balance") or row.get("Balance") or "0")
                .replace("$", "").replace(",", "")
            )
            asset_class = row.get("asset_class") or row.get("Asset Class") or row.get("class") or "Unclassified"
            holdings.append({
                "account": account,
                "ticker": ticker,
                "value": value,
                "asset_class": asset_class,
            })
    return holdings


def validate_inputs(holdings, target):
    """Validate holdings and target allocation."""
    if not holdings:
        print("Error: No holdings provided.", file=sys.stderr)
        sys.exit(1)

    for h in holdings:
        for field in ("account", "ticker", "value", "asset_class"):
            if field not in h:
                print(f"Error: Holding missing '{field}': {h}", file=sys.stderr)
                sys.exit(1)

    target_sum = sum(target.values())
    if abs(target_sum - 100) > 0.5:
        print(f"Error: Target allocation sums to {target_sum}%, must sum to 100%.", file=sys.stderr)
        sys.exit(1)

    # Check for asset classes in holdings not in target
    holding_classes = set(h["asset_class"] for h in holdings)
    target_classes = set(target.keys())
    unclassified = holding_classes - target_classes
    if unclassified:
        print(f"Warning: Holdings have asset classes not in target: {unclassified}", file=sys.stderr)
        print("These will be treated as unclassified and should be sold/reassigned.", file=sys.stderr)


def calculate_allocation(holdings, target, new_money=0, threshold=5.0):
    """Calculate current allocation and rebalancing instructions."""
    total_value = sum(h["value"] for h in holdings)
    total_with_new = total_value + new_money

    # Aggregate by asset class
    class_totals = {}
    for h in holdings:
        ac = h["asset_class"]
        class_totals[ac] = class_totals.get(ac, 0) + h["value"]

    # Current allocation
    current_alloc = {}
    for ac, val in class_totals.items():
        current_alloc[ac] = {
            "value": val,
            "pct": val / total_value * 100 if total_value > 0 else 0,
        }

    # Target allocation (based on total including new money)
    target_alloc = {}
    for ac, target_pct in target.items():
        target_value = total_with_new * target_pct / 100
        current_value = class_totals.get(ac, 0)
        deviation = current_alloc.get(ac, {"pct": 0})["pct"] - target_pct
        target_alloc[ac] = {
            "target_pct": target_pct,
            "target_value": target_value,
            "current_value": current_value,
            "current_pct": current_alloc.get(ac, {"pct": 0})["pct"],
            "deviation": deviation,
            "change_needed": target_value - current_value,
            "needs_rebalance": abs(deviation) > threshold,
        }

    return total_value, total_with_new, current_alloc, target_alloc


def print_results(holdings, total_value, total_with_new, current_alloc, target_alloc, new_money, threshold):
    """Print rebalancing analysis."""
    print("=" * 70)
    print("PORTFOLIO REBALANCING ANALYSIS")
    print("=" * 70)

    print(f"\nCurrent portfolio value: ${total_value:>12,.2f}")
    if new_money > 0:
        print(f"New money to invest:    ${new_money:>12,.2f}")
        print(f"Total after investment:  ${total_with_new:>12,.2f}")
    print(f"Rebalancing threshold:  {threshold:>12.1f}%")

    # Holdings detail
    print(f"\n{'CURRENT HOLDINGS':}")
    print(f"{'Account':<20} {'Ticker':<10} {'Value':>12} {'Asset Class':<20}")
    print("-" * 70)
    for h in sorted(holdings, key=lambda x: (x["asset_class"], x["account"])):
        print(f"{h['account']:<20} {h['ticker']:<10} ${h['value']:>11,.2f} {h['asset_class']:<20}")

    # Allocation comparison
    print(f"\n{'ALLOCATION COMPARISON':}")
    print(f"{'Asset Class':<20} {'Current':>10} {'Target':>10} {'Deviation':>10} {'Action':>12}")
    print("-" * 70)

    all_classes = sorted(set(list(current_alloc.keys()) + list(target_alloc.keys())))
    for ac in all_classes:
        ta = target_alloc.get(ac)
        if ta:
            current_pct = ta["current_pct"]
            target_pct = ta["target_pct"]
            deviation = ta["deviation"]
            flag = " !" if ta["needs_rebalance"] else ""
            change = ta["change_needed"]
            action = f"+${change:,.0f}" if change > 0 else f"-${abs(change):,.0f}"
            print(
                f"{ac:<20} {current_pct:>9.1f}% {target_pct:>9.1f}% {deviation:>+9.1f}% {action:>12}{flag}"
            )
        else:
            ca = current_alloc[ac]
            print(
                f"{ac:<20} {ca['pct']:>9.1f}% {'—':>10} {'N/A':>10} {'SELL ALL':>12}"
            )

    # Rebalancing instructions
    needs_rebalance = any(ta["needs_rebalance"] for ta in target_alloc.values())
    buys = [(ac, ta) for ac, ta in target_alloc.items() if ta["change_needed"] > 0]
    sells = [(ac, ta) for ac, ta in target_alloc.items() if ta["change_needed"] < 0]

    if not needs_rebalance and new_money == 0:
        print(f"\nAll asset classes within {threshold}% threshold — no rebalancing needed.")
        return

    print(f"\n{'REBALANCING INSTRUCTIONS':}")
    print("-" * 70)

    if new_money > 0 and buys:
        print(f"\nStep 1: Direct new money (${new_money:,.2f}) to underweight assets:")
        remaining = new_money
        buys_sorted = sorted(buys, key=lambda x: x[1]["change_needed"], reverse=True)
        for ac, ta in buys_sorted:
            amount = min(remaining, ta["change_needed"])
            if amount > 0:
                print(f"  Buy ${amount:>10,.2f} of {ac}")
                remaining -= amount
            if remaining <= 0:
                break
        if remaining > 0:
            print(f"  Remaining ${remaining:,.2f} — distribute proportionally or hold as cash")

        # Check if new money covers the gap
        total_buy_needed = sum(ta["change_needed"] for _, ta in buys)
        if new_money >= total_buy_needed:
            print("\n  New contributions fully rebalance the portfolio — no selling needed.")
            return

        print(f"\nStep 2: If still off-target, rebalance within accounts:")
    else:
        print(f"\nTrades needed:")

    if sells:
        print(f"\n  Sell (overweight):")
        for ac, ta in sorted(sells, key=lambda x: x[1]["change_needed"]):
            amount = abs(ta["change_needed"])
            if new_money > 0:
                amount = max(0, amount - new_money * ta["target_pct"] / 100)
            if amount > 0:
                print(f"    Sell ${amount:>10,.2f} of {ac}")

    if buys:
        print(f"\n  Buy (underweight):")
        for ac, ta in sorted(buys, key=lambda x: x[1]["change_needed"], reverse=True):
            amount = ta["change_needed"]
            if new_money > 0:
                amount = max(0, amount - new_money)
            if amount > 0:
                print(f"    Buy  ${amount:>10,.2f} of {ac}")

    print(f"\n  Priority: Rebalance in tax-advantaged accounts first to avoid capital gains taxes.")


def main():
    args = parse_args()

    if args.holdings_json:
        holdings = load_holdings_json(args.holdings_json)
    elif args.holdings_csv:
        holdings = load_holdings_csv(args.holdings_csv)
    else:
        holdings = json.loads(args.holdings_inline)

    target = json.loads(args.target)
    validate_inputs(holdings, target)

    total_value, total_with_new, current_alloc, target_alloc = calculate_allocation(
        holdings, target, args.new_money, args.threshold,
    )

    print_results(holdings, total_value, total_with_new, current_alloc, target_alloc, args.new_money, args.threshold)


if __name__ == "__main__":
    main()
