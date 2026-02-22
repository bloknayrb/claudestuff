# Budget Frameworks — Detailed Reference

## Zero-Based Budgeting (ZBB)

### Core Principle
Every dollar of income is assigned a specific purpose before the month begins. The formula: **Income - All Allocations = $0**. This doesn't mean spending everything — "savings" and "investing" are allocations.

### How It Works
1. Start with total expected take-home pay for the month
2. List every expense category with a planned amount
3. Subtract allocations from income until reaching zero
4. Track spending against each category throughout the month
5. When overspending occurs in one category, pull from another ("roll with the punches")

### Strengths
- Maximum visibility into where every dollar goes
- Forces intentional decisions about spending
- Naturally surfaces waste and forgotten subscriptions
- Works with any income level

### Weaknesses
- High maintenance — requires active tracking
- Can feel restrictive, leading to budget fatigue
- Irregular income makes planning harder (solution: budget the previous month's income)
- Easy to over-categorize and create complexity

### Best For
People who want full control, detail-oriented trackers, those trying to find "where the money goes."

---

## 50/30/20 Rule

### Core Principle
Split after-tax income into three buckets: **50% Needs, 30% Wants, 20% Savings & Debt Repayment**.

### Defining the Buckets

**Needs (50%)** — Obligations that remain if income drops to zero:
- Housing (rent/mortgage)
- Utilities
- Groceries (not dining out)
- Insurance premiums
- Minimum debt payments
- Transportation to work
- Childcare required for work

**Wants (30%)** — Everything that improves quality of life but isn't required:
- Dining out
- Entertainment and streaming
- Gym membership
- Vacations
- Upgraded housing beyond necessity
- Clothing beyond basics
- Hobbies

**Savings & Debt (20%)** — Building wealth and eliminating debt:
- Emergency fund contributions
- Retirement contributions (beyond employer match)
- Extra debt payments above minimums
- Investing
- Sinking funds

### HCOL Adjustments
In high-cost-of-living areas, needs often exceed 50%. Common adjustments:
- 60/20/20 (higher needs, lower wants)
- 70/15/15 (very high cost areas, temporary)
- The key: don't mislabel wants as needs to make the numbers work — adjust the ratios honestly

### Strengths
- Simple to understand and implement
- Low maintenance compared to ZBB
- Good starting point for budgeting beginners
- Flexible enough for lifestyle variation

### Weaknesses
- Too coarse for detailed spending analysis
- The 50% needs threshold is unrealistic in many markets
- Doesn't account for income level (someone earning $200k doesn't need 30% on wants)
- Can mask overspending within categories

### Best For
Budgeting beginners, people who find detailed tracking unsustainable, high-income earners who need guardrails.

---

## Envelope Budgeting

### Core Principle
Assign fixed spending limits to categories. When the envelope is empty, stop spending in that category until the next period. Originally used physical envelopes of cash; now implemented digitally.

### How It Works
1. Determine monthly spending limit per category
2. "Fill" each envelope at the start of the month
3. Every purchase draws from the appropriate envelope
4. When an envelope hits zero, spending stops in that category
5. Unspent money rolls over or gets reallocated

### Digital Implementation
- Category tracking in a spreadsheet or app
- Virtual envelopes in budgeting tools (YNAB, Goodbudget)
- Separate bank accounts per major category (housing, bills, spending)
- Prepaid debit cards loaded with category amounts

### Strengths
- Hard limits create spending discipline
- Visual and tactile (even digitally)
- Prevents category-to-category bleed
- Simple rules: money in envelope = available, no money = stop

### Weaknesses
- Rigid — doesn't adapt well to variable expenses
- Can lead to artificial scarcity anxiety
- Requires discipline to not "borrow" between envelopes
- Multi-person households need coordination

### Best For
Impulse spenders, people who respond to concrete limits, visual thinkers, those who struggle with abstract budgets.

---

## YNAB's Four Rules

### Rule 1: Give Every Dollar a Job
Identical to zero-based budgeting. Every dollar of available cash gets assigned to a category before spending.

### Rule 2: Embrace Your True Expenses
Large, infrequent expenses are predictable — they're just not monthly. Break them into monthly amounts and start saving now.

Examples:
- Car insurance ($1,200/year) → $100/month
- Holiday gifts ($600/year) → $50/month
- Car registration ($200/year) → ~$17/month
- Annual subscriptions → divide by 12
- Home maintenance (1% of home value/year) → divide by 12

This is the **sinking fund** concept. It transforms "surprise" expenses into planned ones.

### Rule 3: Roll With the Punches
When overspending happens (it will), move money from another category to cover it. The budget is a plan, not a prison. Adjust and move forward rather than abandoning the budget entirely.

### Rule 4: Age Your Money
Spend money that's at least 30 days old. This means living on last month's income rather than this month's. Breaks the paycheck-to-paycheck cycle by building a buffer.

How to get there:
- Start by getting one day ahead, then a week, then two weeks
- Use windfalls (tax refunds, bonuses) to accelerate
- Once achieved, income timing becomes irrelevant

---

## Sinking Funds

### Concept
Set aside money monthly for predictable irregular expenses. Prevents budget disruption from large periodic costs.

### Common Sinking Fund Categories

| Expense | Typical Annual Cost | Monthly Set-Aside |
|---------|-------------------|-------------------|
| Car registration | $100-300 | $8-25 |
| Annual insurance premiums | $1,000-2,400 | $83-200 |
| Holiday gifts | $300-1,000 | $25-83 |
| Vacation | $1,000-5,000 | $83-417 |
| Home maintenance | 1% of home value | varies |
| Car maintenance | $500-1,500 | $42-125 |
| Annual subscriptions | $200-600 | $17-50 |
| Back-to-school | $200-500 | $17-42 |
| Property tax (if not escrowed) | varies | varies |

### Implementation
- Separate savings account or sub-accounts per fund
- Track balances in a spreadsheet
- "Spend" from the fund when the expense hits — it's already budgeted

---

## Debt Payoff Frameworks

### Avalanche Method
1. List all debts by interest rate (highest first)
2. Pay minimum on all debts
3. Throw all extra money at the highest-rate debt
4. When that's paid off, roll its payment into the next highest rate
5. Repeat until debt-free

**Advantage**: Minimizes total interest paid. Mathematically optimal.
**Disadvantage**: If the highest-rate debt is also the largest balance, visible progress is slow. Can be demotivating.

### Snowball Method
1. List all debts by balance (smallest first)
2. Pay minimum on all debts
3. Throw all extra money at the smallest balance
4. When that's paid off, roll its payment into the next smallest
5. Repeat until debt-free

**Advantage**: Quick wins build momentum and motivation. Psychologically effective.
**Disadvantage**: Costs more in total interest than avalanche.

### Hybrid Approach
Start with snowball for quick wins (knock out 1-2 small debts), then switch to avalanche for the remaining larger balances. Gets the psychological boost early without sacrificing too much interest savings.

### When Avalanche and Snowball Give the Same Answer
If your smallest balance also has the highest rate, both methods agree. This is common with credit card debt (small balances, high rates).

Use `scripts/debt_payoff.py` to calculate both methods and show the exact dollar difference — often the interest difference is smaller than expected, making snowball's psychological benefits worth considering.
