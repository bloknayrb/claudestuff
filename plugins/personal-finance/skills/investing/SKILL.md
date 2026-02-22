---
name: investing
description: This skill should be used when the user asks about "investing", "portfolio", "asset allocation", "401k", "IRA", "HSA", "529", "index fund", "three-fund portfolio", "Bogleheads", "rebalancing", "expense ratio", "Roth vs Traditional", "tax-advantaged accounts", "dollar cost averaging", or "compound interest". Provides passive index investing guidance, tax-advantaged account strategies, and portfolio analysis tools.
---

# Investing

## Overview

Provide investing education grounded in the Bogleheads passive index investing philosophy. All guidance is educational — ranges and frameworks rather than specific recommendations. For personalized investment advice, recommend a fee-only fiduciary financial advisor.

## Bogleheads Core Principles

1. **Develop a workable plan** — Start with goals and timeframe, then choose an allocation
2. **Start investing early** — Time in market beats timing the market; compound growth rewards patience
3. **Never bear too much or too little risk** — Match risk tolerance and capacity to allocation
4. **Diversify** — Broad market index funds eliminate single-stock risk
5. **Never try to time the market** — Stay the course through volatility
6. **Use index funds when possible** — Low cost, broad diversification, tax efficient
7. **Keep costs low** — Expense ratios compound against returns; every basis point matters
8. **Minimize taxes** — Use tax-advantaged accounts strategically, place assets intentionally
9. **Invest with simplicity** — A three-fund portfolio captures the entire investable market
10. **Stay the course** — The biggest enemy is behavioral: don't panic sell, don't chase performance

## Three-Fund Portfolio

The core Bogleheads recommendation: three funds that together capture the entire investable market with no overlap and no gaps.

| Fund | Purpose | Example (Vanguard) |
|------|---------|-------------------|
| US Total Stock Market | Domestic equity exposure | VTSAX / VTI |
| International Total Stock Market | Non-US equity exposure | VTIAX / VXUS |
| US Total Bond Market | Fixed income / stability | VBTLX / BND |

See `references/three-fund-portfolio.md` for brokerage-specific fund picks (Fidelity, Schwab equivalents) and allocation rationale.

## Tax-Advantaged Account Priority

Follow this hierarchy to maximize tax benefits. Each level should be utilized before moving to the next:

1. **401(k) up to employer match** — Immediate 50-100% return; always capture the full match
2. **HSA (if eligible)** — Triple tax advantage: deductible, grows tax-free, withdrawals tax-free for medical
3. **Roth IRA or Traditional IRA** — Tax-free growth (Roth) or tax deduction now (Traditional)
4. **401(k) up to annual max** — Additional tax-deferred or Roth growth
5. **Taxable brokerage** — No tax advantage, but no restrictions; use after maxing tax-advantaged space

See `references/account-hierarchy.md` for detailed explanations and Roth vs Traditional decision framework.
See `references/contribution-limits.md` for current IRS limits (verify annually).

## Asset Allocation Guidelines

Allocation between stocks and bonds depends on risk tolerance, time horizon, and financial situation. Common starting points:

**Age-based rules of thumb:**
- "Age in bonds" — a 30-year-old holds 30% bonds, 70% stocks (conservative)
- "Age minus 10 in bonds" — a 30-year-old holds 20% bonds, 80% stocks (moderate)
- "Age minus 20 in bonds" — a 30-year-old holds 10% bonds, 90% stocks (aggressive)

These are starting points, not mandates. Adjust based on:
- **Risk capacity**: stable income, emergency fund, low debt → can handle more risk
- **Risk tolerance**: if market drops 40%, would you hold or panic sell?
- **Time horizon**: 30+ years → more stocks; <5 years → more bonds
- **Other income**: pension, Social Security, rental income reduce need for bond allocation

**Within stocks — US vs International split:**
- Global market cap weight: ~60% US / 40% international
- Common simplification: 70% US / 30% international or 80/20
- Home country bias is natural but should be conscious, not accidental

## Dollar Cost Averaging vs Lump Sum

**Lump sum investing** wins approximately 2/3 of the time historically — markets go up more often than down, so getting money invested sooner captures more upside.

**Dollar cost averaging** (investing fixed amounts over time) reduces regret risk and smooths entry price. Better than not investing at all while waiting for the "right time."

Practical guidance: if the money is available now and the timeframe is long, lump sum is statistically optimal. If the psychological comfort of spreading it out means actually investing rather than sitting in cash, DCA is better.

## Rebalancing

Over time, asset allocation drifts as different assets grow at different rates. Rebalancing restores the target allocation.

**Calendar rebalancing**: Check allocation annually or semi-annually, rebalance if off target.
**Threshold rebalancing**: Rebalance when any asset class drifts >5% from target (e.g., target 70% stocks, rebalance if stocks reach 75% or 65%).

**Tax-efficient rebalancing priority:**
1. Direct new contributions to underweight assets
2. Rebalance within tax-advantaged accounts (no tax consequences)
3. Sell in taxable accounts only as last resort (triggers capital gains)

Use `scripts/rebalancing.py` to calculate current allocation and generate rebalancing instructions.

## Expense Ratio Impact

Expense ratios are the annual fee charged by a fund, expressed as a percentage. They compound against returns over time.

Example: On a $100,000 portfolio over 30 years at 7% return:
- 0.03% expense ratio (index fund): ~$737,000 final value
- 1.00% expense ratio (active fund): ~$574,000 final value
- **Difference: ~$163,000** lost to fees

Use `scripts/expense_ratio_impact.py` to compare specific expense ratios over your time horizon.

## Tools

- `scripts/compound_interest.py` — Project future value with contributions and compound growth
- `scripts/rebalancing.py` — Calculate current allocation, compare to target, generate rebalancing instructions
- `scripts/expense_ratio_impact.py` — Compare the long-term dollar impact of different expense ratios

## References

- `references/three-fund-portfolio.md` — Fund picks by brokerage, allocation rationale, no-overlap principle
- `references/account-hierarchy.md` — Full account priority with Roth vs Traditional framework
- `references/contribution-limits.md` — Current IRS limits for all account types (verify annually)
