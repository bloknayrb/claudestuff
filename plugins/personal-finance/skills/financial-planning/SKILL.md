---
name: financial-planning
description: This skill should be used when the user asks about "financial planning", "priority ladder", "emergency fund", "net worth", "financial goals", "life event checklist", "where to start with money", or mentions prioritizing between debt, saving, and investing. Provides a goal-based financial priority framework, net worth tracking, and life event financial checklists.
version: 1.0.0
tags: [finance, planning, goals, emergency-fund, net-worth]
---

# Financial Planning

> This is an educational financial planning framework, not personalized financial advice. For advice tailored to your complete situation, consult a fee-only fiduciary financial advisor.

## The Financial Priority Ladder

Work through these stages in order. Each stage builds on the previous one — don't skip ahead unless the earlier stages are covered.

### Stage 1: Stabilize Cash Flow

- Track income and expenses (use the budgeting skill)
- Build a starter emergency fund ($1,000–$2,000) to break the paycheck-to-paycheck cycle
- Set up a system: checking for bills, savings for emergencies, automate what you can

### Stage 2: Capture Free Money

- Contribute to employer 401(k)/403(b) up to the full employer match
- This is an immediate 50–100% return — no investment beats it

### Stage 3: Eliminate High-Rate Debt

- Pay off debt above ~6–8% interest (credit cards, personal loans, some private student loans)
- Use avalanche method (highest rate first) for math-optimal payoff, or snowball (smallest balance first) for motivation
- Use `skills/budgeting/scripts/debt_payoff.py` for comparison

### Stage 4: Build Full Emergency Fund

- 3–6 months of essential expenses in a high-yield savings account
- Stable job, dual income, no dependents → 3 months may be enough
- Variable income, single earner, dependents, health concerns → 6+ months
- Self-employed or commission-based → consider 6–12 months

### Stage 5: Fill Tax-Advantaged Space

Work through in priority order (see investing skill's account hierarchy):

1. **HSA** (if eligible) — triple tax advantage, best account in the tax code
2. **Roth IRA** (or backdoor Roth if over income limit) — tax-free growth forever
3. **401(k) up to maximum** ($24,500 in 2026) — pre-tax or Roth depending on situation
4. **Mega backdoor Roth** (if employer plan allows) — after-tax 401(k) → Roth

### Stage 6: Medium-Rate Debt vs Investing

For debt between ~4–6% interest (some student loans, auto loans):
- This is a personal decision, not purely mathematical
- Guaranteed "return" of paying off 5% debt vs expected ~7% market return with risk
- Emotional weight of debt matters — being debt-free has real psychological value
- Split approach works: pay extra toward debt AND invest simultaneously

### Stage 7: Taxable Investing and Beyond

- Open a taxable brokerage account for goals beyond tax-advantaged space
- Same index fund philosophy applies (three-fund portfolio)
- Consider tax-efficient fund placement (see investing skill's asset location guidance)
- Low-rate debt (<3–4%: mortgage, some federal student loans) generally fine to carry while investing

## Emergency Fund Sizing

| Situation | Suggested Range |
|-----------|----------------|
| Dual income, stable jobs, no dependents | 3 months |
| Single income, stable job | 3–4 months |
| Single income, dependents | 4–6 months |
| Variable income / commission | 6–9 months |
| Self-employed | 6–12 months |
| Pre-retirement (within 5 years) | 12–24 months |

"Months" means monthly essential expenses — not gross income. Housing, food, insurance, utilities, minimum debt payments, transportation.

## Goal Prioritization Framework

When someone has multiple financial goals competing for dollars:

1. **Non-negotiables first**: employer match, minimum debt payments, basic emergency fund
2. **High-impact next**: high-rate debt payoff, full emergency fund
3. **Long-term growth**: tax-advantaged retirement contributions
4. **Time-sensitive goals**: home down payment, education funding (use `scripts/goal_projector.py`)
5. **Optimization**: taxable investing, low-rate debt acceleration, charitable giving

## Net Worth Tracking

Net worth = total assets minus total liabilities. Track quarterly or annually to measure progress.

Use `scripts/net_worth.py` to calculate and categorize:
- **Liquid assets**: checking, savings, taxable investments
- **Retirement assets**: 401(k), IRA, Roth IRA, HSA
- **Illiquid assets**: real estate equity, vehicles, business interests
- **Liabilities**: mortgage, student loans, auto loans, credit cards, other debt

The number itself matters less than the trend. A negative net worth is common early in life (student loans, mortgage) — the trajectory is what counts.

## Life Event Triggers

Major life changes often require revisiting the financial plan:

- **New job**: Review 401(k) options, update contributions, roll over old 401(k)
- **Marriage**: Combine or coordinate finances, update beneficiaries, review insurance
- **Children**: Life insurance, 529 plans, update emergency fund, estate documents
- **Home purchase**: Down payment strategy, mortgage pre-approval, budget adjustment
- **Job loss**: Shift to emergency mode, review COBRA/ACA options, pause non-essential goals
- **Inheritance**: Don't rush decisions — park in HYSA for 6 months, then plan deliberately
- **Divorce**: Separate accounts, QDRO for retirement splits, update beneficiaries and estate docs
- **Approaching retirement**: Shift allocation, build cash buffer, Social Security timing analysis

## When to Seek Professional Help

See `references/professional-referral-guide.md` for detailed guidance on when to consult:
- Fee-only fiduciary financial advisor (CFP)
- Tax professional (CPA/EA)
- Estate planning attorney
- Insurance specialist

General rule: if the decision involves more than $50,000, has significant tax implications, or you're uncertain after researching — a professional consultation is worth the cost.
