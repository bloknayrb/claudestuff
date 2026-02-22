---
name: budgeting
description: This skill should be used when the user asks to "create a budget", "analyze spending", "categorize transactions", "track expenses", "manage cash flow", "pay off debt", "compare debt payoff methods", or mentions budgeting frameworks like zero-based budgeting, 50/30/20, or envelope budgeting. Provides budgeting methodology, transaction categorization guidance, and spending analysis tools.
---

# Budgeting

## Overview

Provide structured budgeting guidance using established frameworks. Categorize transactions from bank/credit card CSV exports, analyze spending patterns, and build actionable budgets. All advice is educational — recommend a certified financial planner for personalized financial guidance.

## Supported Budgeting Frameworks

### Zero-Based Budgeting (ZBB)
Every dollar of income is assigned a purpose. Income minus all allocations equals zero. When overspending occurs in one category, pull from another — "roll with the punches." Best for people who want full control and visibility.

### 50/30/20 Rule
Split after-tax income into needs (50%), wants (30%), and savings/debt (20%). "Needs" means obligations that don't go away if income drops: housing, utilities, groceries, insurance, minimum debt payments. Everything else is a want. In high-cost-of-living areas, the needs portion often exceeds 50% — adjust ratios rather than mislabeling wants as needs.

### Envelope Budgeting
Assign spending caps to categories. When the envelope is empty, stop spending in that category until next period. Digital equivalent: category tracking with hard limits. Pairs well with ZBB for implementation.

### YNAB's Four Rules
1. Give every dollar a job (ZBB)
2. Embrace your true expenses (sinking funds)
3. Roll with the punches (adjust, don't abandon)
4. Age your money (spend last month's income)

See `references/budget-frameworks.md` for detailed methodology breakdowns.

## Transaction Categorization Workflow

Follow this sequence when processing bank/credit card CSV exports:

1. **Format detection** — Identify the CSV layout (Chase, BofA, Amex, Capital One, etc.). See `references/csv-formats.md` for known formats and column-detection heuristics.
2. **Column normalization** — Map source columns to standard schema: date, description, amount, category (if present).
3. **Merchant normalization** — Strip transaction noise (SQ *, AMZN MKTP US*, PAYPAL *, check digits). See `references/merchant-categories.md` for patterns.
4. **Category assignment** — Match normalized merchants to categories using the merchant lookup table. Apply regex patterns for common prefixes.
5. **Ambiguity flagging** — Flag transactions that map to multiple possible categories (e.g., Walmart, Target, Costco) for human review. Never silently guess on ambiguous items.
6. **Summary generation** — Run `scripts/spending_summary.py` or produce equivalent output: totals by category, percentage of spending, percentage of income, transaction counts, averages.

## Standard Budget Categories

Primary categories with common subcategories:

- **Housing** — rent/mortgage, property tax, HOA, repairs/maintenance
- **Utilities** — electric, gas, water, internet, phone
- **Groceries** — supermarket purchases, meal ingredients
- **Transportation** — gas, car payment, insurance, maintenance, parking, public transit
- **Healthcare** — insurance premiums, copays, prescriptions, dental, vision
- **Debt Payments** — student loans, credit cards (above minimum), personal loans
- **Dining Out** — restaurants, coffee shops, takeout, delivery
- **Entertainment** — streaming, events, hobbies, games
- **Personal Care** — haircuts, toiletries, gym membership
- **Clothing** — apparel, shoes, accessories
- **Subscriptions** — software, memberships, recurring charges
- **Savings** — emergency fund, sinking funds, general savings
- **Gifts & Donations** — presents, charitable giving
- **Childcare** — daycare, school supplies, activities
- **Pets** — food, vet, grooming, supplies

## Sinking Funds

Irregular or annual expenses divided into monthly allocations. Prevent "surprise" large expenses from blowing the budget.

Examples: car registration, annual insurance premiums, holiday gifts, vacation, home maintenance reserve, annual subscriptions (domains, software).

Calculate monthly amount: annual cost / 12. Start accumulating immediately even if the expense is months away.

## Cash Flow Timing

Pay attention to when income arrives versus when bills are due. Biweekly pay creates two "extra" paychecks per year. Aligning bill due dates with pay dates prevents overdrafts. Two-paycheck months handle regular expenses; three-paycheck months accelerate goals.

## Debt Payoff

Two primary strategies:

- **Avalanche** — Pay minimums on all debts, throw extra money at the highest interest rate. Mathematically optimal: minimizes total interest paid.
- **Snowball** — Pay minimums on all debts, throw extra money at the smallest balance. Psychologically effective: quick wins build momentum.

Use `scripts/debt_payoff.py` to calculate and compare both approaches side-by-side.

## Tools

- `scripts/spending_summary.py` — Analyze categorized transactions: totals, percentages, monthly comparisons, threshold alerts
- `scripts/debt_payoff.py` — Compare avalanche vs snowball payoff schedules with total interest and timeline

## References

- `references/merchant-categories.md` — Merchant-to-category lookup table with regex patterns
- `references/budget-frameworks.md` — Detailed methodology for each budgeting framework
- `references/csv-formats.md` — Bank/credit card CSV format documentation and detection heuristics
