# /// script
# requires-python = ">=3.12"
# ///
"""Spending summary: analyze categorized transactions by category with totals, percentages, and monthly comparisons."""

import argparse
import csv
import sys
from collections import defaultdict
from datetime import datetime


def parse_args():
    parser = argparse.ArgumentParser(
        description="Analyze categorized transactions by category.",
        epilog="Input CSV must have columns: date, description, amount, category",
    )
    parser.add_argument("csv_file", help="Path to categorized transactions CSV")
    parser.add_argument(
        "--income",
        type=float,
        default=None,
        help="Monthly income for percentage-of-income calculations",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        help="Flag categories exceeding this dollar amount",
    )
    parser.add_argument(
        "--threshold-pct",
        type=float,
        default=None,
        help="Flag categories exceeding this percentage of total spending",
    )
    parser.add_argument(
        "--sort",
        choices=["amount", "count", "name"],
        default="amount",
        help="Sort output by total amount (default), transaction count, or category name",
    )
    return parser.parse_args()


def detect_columns(header):
    """Map CSV columns to standard fields using heuristic matching."""
    header_lower = [h.strip().lower() for h in header]
    mapping = {"date": None, "description": None, "amount": None, "category": None}

    date_keywords = ["date", "trans"]
    desc_keywords = ["description", "desc", "memo", "narrative", "payee"]
    amount_keywords = ["amount", "amt", "debit"]
    category_keywords = ["category", "cat"]

    for i, col in enumerate(header_lower):
        if mapping["date"] is None and any(k in col for k in date_keywords):
            mapping["date"] = i
        elif mapping["category"] is None and any(k in col for k in category_keywords):
            mapping["category"] = i
        elif mapping["amount"] is None and any(k in col for k in amount_keywords):
            mapping["amount"] = i
        elif mapping["description"] is None and any(k in col for k in desc_keywords):
            mapping["description"] = i

    # Fallback: if we have exactly 4 columns, assume date, description, amount, category
    if all(v is None for v in mapping.values()) and len(header) == 4:
        mapping = {"date": 0, "description": 1, "amount": 2, "category": 3}

    missing = [k for k, v in mapping.items() if v is None]
    if missing:
        print(f"Error: Could not detect columns: {', '.join(missing)}", file=sys.stderr)
        print(f"Header: {header}", file=sys.stderr)
        sys.exit(1)

    return mapping


def parse_date(date_str):
    """Try common date formats."""
    date_str = date_str.strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y", "%d-%b-%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def parse_amount(amount_str):
    """Parse amount string, handling currency symbols and parentheses for negatives."""
    amount_str = amount_str.strip().replace("$", "").replace(",", "")
    if amount_str.startswith("(") and amount_str.endswith(")"):
        amount_str = "-" + amount_str[1:-1]
    try:
        return float(amount_str)
    except ValueError:
        return None


def load_transactions(csv_file):
    """Load and parse transactions from CSV."""
    transactions = []
    with open(csv_file, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)
        col_map = detect_columns(header)

        for row_num, row in enumerate(reader, start=2):
            if not row or all(cell.strip() == "" for cell in row):
                continue

            date = parse_date(row[col_map["date"]])
            if date is None:
                print(f"Warning: Skipping row {row_num}, unparseable date: {row[col_map['date']]}", file=sys.stderr)
                continue

            amount = parse_amount(row[col_map["amount"]])
            if amount is None:
                print(f"Warning: Skipping row {row_num}, unparseable amount: {row[col_map['amount']]}", file=sys.stderr)
                continue

            # Store raw signed amount — credits (negative) offset their category totals
            transactions.append({
                "date": date,
                "description": row[col_map["description"]].strip(),
                "amount": amount,
                "category": row[col_map["category"]].strip(),
                "month": date.strftime("%Y-%m"),
            })

    return transactions


def summarize_by_category(transactions, sort_by="amount"):
    """Aggregate spending by category."""
    cats = defaultdict(lambda: {"total": 0.0, "count": 0, "transactions": []})
    for t in transactions:
        cat = cats[t["category"]]
        cat["total"] += t["amount"]
        cat["count"] += 1
        cat["transactions"].append(t["amount"])

    # Calculate averages
    for cat in cats.values():
        cat["avg"] = cat["total"] / cat["count"] if cat["count"] > 0 else 0

    # Sort
    if sort_by == "amount":
        return dict(sorted(cats.items(), key=lambda x: x[1]["total"], reverse=True))
    elif sort_by == "count":
        return dict(sorted(cats.items(), key=lambda x: x[1]["count"], reverse=True))
    else:
        return dict(sorted(cats.items()))


def summarize_by_month(transactions):
    """Aggregate spending by month and category."""
    monthly = defaultdict(lambda: defaultdict(float))
    for t in transactions:
        monthly[t["month"]][t["category"]] += t["amount"]
    return dict(sorted(monthly.items()))


def print_category_summary(categories, gross_spending, total_credits, net_spending, income=None, threshold=None, threshold_pct=None):
    """Print spending summary by category."""
    print("=" * 70)
    print("SPENDING SUMMARY BY CATEGORY")
    print("=" * 70)
    print(f"{'Category':<25} {'Total':>10} {'% Spend':>8} {'Count':>6} {'Avg':>10}", end="")
    if income:
        print(f" {'% Income':>9}", end="")
    print()
    print("-" * 70)

    flags = []
    for name, data in categories.items():
        pct_spend = (data["total"] / gross_spending * 100) if gross_spending > 0 else 0
        line = f"{name:<25} ${data['total']:>9,.2f} {pct_spend:>7.1f}% {data['count']:>6} ${data['avg']:>9,.2f}"
        if income:
            pct_income = data["total"] / income * 100
            line += f" {pct_income:>8.1f}%"
        print(line)

        # Check thresholds
        if threshold and data["total"] > threshold:
            flags.append(f"  ! {name}: ${data['total']:,.2f} exceeds ${threshold:,.2f} threshold")
        if threshold_pct and pct_spend > threshold_pct:
            flags.append(f"  ! {name}: {pct_spend:.1f}% exceeds {threshold_pct:.1f}% threshold")

    print("-" * 70)
    print(f"{'GROSS SPENDING':<25} ${gross_spending:>9,.2f} {'100.0%':>8}")
    if total_credits < 0:
        print(f"{'CREDITS/REFUNDS':<25} ${total_credits:>9,.2f}")
        print(f"{'NET SPENDING':<25} ${net_spending:>9,.2f}")
    if income:
        savings = income - net_spending
        savings_pct = savings / income * 100
        print(f"\nIncome:    ${income:>12,.2f}")
        print(f"Spending:  ${net_spending:>12,.2f}")
        print(f"Remaining: ${savings:>12,.2f} ({savings_pct:.1f}%)")

    if flags:
        print(f"\n{'ALERTS':}")
        for flag in flags:
            print(flag)


def print_monthly_comparison(monthly, all_categories):
    """Print month-over-month comparison."""
    months = sorted(monthly.keys())
    if len(months) < 2:
        return

    print(f"\n{'=' * 70}")
    print("MONTHLY COMPARISON")
    print("=" * 70)

    # Header
    header = f"{'Category':<25}"
    for m in months:
        header += f" {m:>10}"
    print(header)
    print("-" * 70)

    for cat in sorted(all_categories):
        line = f"{cat:<25}"
        for m in months:
            val = monthly[m].get(cat, 0)
            line += f" ${val:>9,.2f}"
        print(line)

    # Totals
    print("-" * 70)
    line = f"{'TOTAL':<25}"
    for m in months:
        total = sum(monthly[m].values())
        line += f" ${total:>9,.2f}"
    print(line)


def main():
    args = parse_args()
    transactions = load_transactions(args.csv_file)

    if not transactions:
        print("No transactions found.", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(transactions)} transactions")
    date_range = f"{min(t['date'] for t in transactions).strftime('%Y-%m-%d')} to {max(t['date'] for t in transactions).strftime('%Y-%m-%d')}"
    print(f"Date range: {date_range}\n")

    gross_spending = sum(t["amount"] for t in transactions if t["amount"] > 0)
    total_credits = sum(t["amount"] for t in transactions if t["amount"] < 0)
    net_spending = gross_spending + total_credits  # total_credits is negative
    categories = summarize_by_category(transactions, sort_by=args.sort)

    print_category_summary(categories, gross_spending, total_credits, net_spending, args.income, args.threshold, args.threshold_pct)

    # Monthly comparison if multiple months
    monthly = summarize_by_month(transactions)
    all_categories = set(categories.keys())
    print_monthly_comparison(monthly, all_categories)


if __name__ == "__main__":
    main()
