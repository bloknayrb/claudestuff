# /// script
# requires-python = ">=3.12"
# ///
"""Net worth calculator: categorize assets and liabilities, calculate net worth with breakdown."""

import argparse
import json
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Calculate net worth from assets and liabilities.",
        epilog='Example: uv run net_worth.py --inline \'{"assets": [{"name": "Checking", "value": 5000, "category": "Cash"}], "liabilities": [{"name": "Credit Card", "value": 2000, "category": "Credit Cards"}]}\'',
    )
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--json", help="Path to JSON file with assets and liabilities")
    input_group.add_argument("--inline", help="Inline JSON string")

    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show detailed breakdown by category",
    )
    return parser.parse_args()


ASSET_CATEGORIES = {
    "liquid": ["Cash", "Checking", "Savings", "Money Market", "HYSA"],
    "investments": ["Taxable Brokerage", "Investments", "Stocks", "Bonds", "Crypto"],
    "retirement": ["401k", "403b", "457b", "Traditional IRA", "Roth IRA", "HSA", "Pension", "TSP"],
    "illiquid": ["Real Estate", "Home Equity", "Vehicles", "Business Interest", "Other Assets"],
}

LIABILITY_CATEGORIES = {
    "high_rate": ["Credit Cards", "Personal Loans", "Payday Loans"],
    "medium_rate": ["Student Loans", "Auto Loans"],
    "low_rate": ["Mortgage", "HELOC", "Federal Student Loans"],
    "other": ["Medical Debt", "Tax Debt", "Other Debt"],
}


def classify_item(name, category, category_map):
    """Find which group an item belongs to based on its category."""
    category_lower = category.lower().strip()
    for group, members in category_map.items():
        for member in members:
            if member.lower() == category_lower:
                return group
    return list(category_map.keys())[-1]  # Default to last group


def validate_data(data):
    """Validate the input data structure."""
    if "assets" not in data and "liabilities" not in data:
        print("Error: JSON must contain 'assets' and/or 'liabilities' arrays.", file=sys.stderr)
        sys.exit(1)

    for section in ("assets", "liabilities"):
        items = data.get(section, [])
        for item in items:
            if "name" not in item or "value" not in item:
                print(f"Error: Each {section} item needs 'name' and 'value': {item}", file=sys.stderr)
                sys.exit(1)
            if "category" not in item:
                item["category"] = "Other Assets" if section == "assets" else "Other Debt"


def calculate_net_worth(data):
    """Calculate net worth with categorized breakdown."""
    assets = data.get("assets", [])
    liabilities = data.get("liabilities", [])

    # Categorize assets
    asset_groups = {group: [] for group in ASSET_CATEGORIES}
    for item in assets:
        group = classify_item(item["name"], item["category"], ASSET_CATEGORIES)
        asset_groups[group].append(item)

    # Categorize liabilities
    liability_groups = {group: [] for group in LIABILITY_CATEGORIES}
    for item in liabilities:
        group = classify_item(item["name"], item["category"], LIABILITY_CATEGORIES)
        liability_groups[group].append(item)

    # Calculate totals
    total_assets = sum(item["value"] for item in assets)
    total_liabilities = sum(item["value"] for item in liabilities)
    net_worth = total_assets - total_liabilities

    # Group totals
    asset_group_totals = {
        group: sum(item["value"] for item in items)
        for group, items in asset_groups.items()
    }
    liability_group_totals = {
        group: sum(item["value"] for item in items)
        for group, items in liability_groups.items()
    }

    liquid_total = asset_group_totals.get("liquid", 0) + asset_group_totals.get("investments", 0)
    illiquid_total = asset_group_totals.get("retirement", 0) + asset_group_totals.get("illiquid", 0)

    return {
        "net_worth": net_worth,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "asset_groups": asset_groups,
        "asset_group_totals": asset_group_totals,
        "liability_groups": liability_groups,
        "liability_group_totals": liability_group_totals,
        "liquid_total": liquid_total,
        "illiquid_total": illiquid_total,
    }


GROUP_LABELS = {
    "liquid": "Cash & Savings",
    "investments": "Taxable Investments",
    "retirement": "Retirement Accounts",
    "illiquid": "Illiquid Assets",
    "high_rate": "High-Rate Debt (>8%)",
    "medium_rate": "Medium-Rate Debt (4-8%)",
    "low_rate": "Low-Rate Debt (<4%)",
    "other": "Other Liabilities",
}


def print_results(result, verbose=False):
    """Print net worth analysis."""
    print("=" * 55)
    print("NET WORTH STATEMENT")
    print("=" * 55)

    # Assets summary
    print(f"\n{'ASSETS':}")
    print("-" * 55)
    for group in ASSET_CATEGORIES:
        total = result["asset_group_totals"].get(group, 0)
        if total > 0 or verbose:
            label = GROUP_LABELS.get(group, group)
            print(f"  {label:<30} ${total:>12,.2f}")
            if verbose:
                for item in result["asset_groups"].get(group, []):
                    print(f"    {item['name']:<28} ${item['value']:>12,.2f}")
    print(f"  {'-' * 30} {'-' * 13}")
    print(f"  {'Total Assets':<30} ${result['total_assets']:>12,.2f}")

    # Liabilities summary
    print(f"\n{'LIABILITIES':}")
    print("-" * 55)
    for group in LIABILITY_CATEGORIES:
        total = result["liability_group_totals"].get(group, 0)
        if total > 0 or verbose:
            label = GROUP_LABELS.get(group, group)
            print(f"  {label:<30} ${total:>12,.2f}")
            if verbose:
                for item in result["liability_groups"].get(group, []):
                    print(f"    {item['name']:<28} ${item['value']:>12,.2f}")
    print(f"  {'-' * 30} {'-' * 13}")
    print(f"  {'Total Liabilities':<30} ${result['total_liabilities']:>12,.2f}")

    # Net worth
    print(f"\n{'=' * 55}")
    sign = "" if result["net_worth"] >= 0 else "-"
    abs_nw = abs(result["net_worth"])
    print(f"  {'NET WORTH':<30} {sign}${abs_nw:>12,.2f}")
    print(f"{'=' * 55}")

    # Liquidity breakdown
    print(f"\n{'LIQUIDITY BREAKDOWN':}")
    print("-" * 55)
    print(f"  {'Liquid (cash + taxable invest)':<30} ${result['liquid_total']:>12,.2f}")
    print(f"  {'Less accessible (retirement + illiquid)':<39} ${result['illiquid_total']:>12,.2f}")
    if result["total_assets"] > 0:
        liquid_pct = result["liquid_total"] / result["total_assets"] * 100
        print(f"  Liquid assets are {liquid_pct:.0f}% of total assets")

    # Context
    if result["net_worth"] < 0:
        print(f"\nNote: Negative net worth is common early in life (student loans, mortgage).")
        print(f"Focus on the trend — track quarterly and aim for improvement.")
    elif result["total_liabilities"] > 0:
        debt_to_asset = result["total_liabilities"] / result["total_assets"] * 100 if result["total_assets"] > 0 else 0
        print(f"\n  Debt-to-asset ratio: {debt_to_asset:.0f}%")


def main():
    args = parse_args()

    if args.json:
        with open(args.json) as f:
            data = json.load(f)
    else:
        data = json.loads(args.inline)

    validate_data(data)
    result = calculate_net_worth(data)
    print_results(result, verbose=args.verbose)


if __name__ == "__main__":
    main()
