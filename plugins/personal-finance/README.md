# Personal Finance Plugin

A Claude Code plugin for personal finance education — budgeting, investing, and financial planning grounded in the Bogleheads philosophy and fee-only fiduciary principles.

> **Disclaimer**: This plugin provides educational frameworks, not personalized financial advice. For advice tailored to your complete financial situation, consult a fee-only fiduciary financial advisor.

## What's Included

### Skills (3)

**Budgeting** — Transaction categorization, spending analysis, budget frameworks (50/30/20, zero-based, envelope), debt payoff comparison (avalanche vs snowball).

**Investing** — Three-fund portfolio construction, tax-advantaged account hierarchy, asset allocation guidelines, expense ratio analysis, rebalancing guidance.

**Financial Planning** — Financial priority ladder (cash flow → emergency fund → employer match → debt → insurance → HSA → IRA → 401k → taxable), goal projection, net worth tracking, life event checklists.

### Agents (2)

**budget-analyst** — Autonomously processes bank CSV exports: detects format, normalizes columns, categorizes transactions, flags ambiguities, generates spending summaries. Triggers on CSV uploads or bank statement mentions.

**portfolio-analyzer** — Analyzes investment portfolios: parses holdings, calculates allocation across asset classes, compares to age-appropriate targets, evaluates expense ratios, generates rebalancing instructions. Triggers on portfolio data or allocation questions.

### Scripts (5)

| Script | Purpose |
|--------|---------|
| `budgeting/scripts/spending_summary.py` | Parse bank CSVs, categorize spending, compare to budget |
| `budgeting/scripts/debt_payoff.py` | Compare avalanche vs snowball debt payoff strategies |
| `investing/scripts/compound_interest.py` | Project future value with regular contributions |
| `investing/scripts/expense_ratio_impact.py` | Compare long-term cost of different expense ratios |
| `investing/scripts/rebalancing.py` | Calculate rebalancing trades from current vs target allocation |
| `financial-planning/scripts/net_worth.py` | Calculate and categorize net worth |
| `financial-planning/scripts/goal_projector.py` | Time-to-goal or required-contribution calculator |

### Reference Files (6)

| File | Content |
|------|---------|
| `budgeting/references/budget-frameworks.md` | Detailed budgeting methodology comparisons |
| `budgeting/references/merchant-categories.md` | Merchant normalization patterns and category mappings |
| `budgeting/references/csv-formats.md` | Bank CSV format detection (9 banks) |
| `investing/references/three-fund-portfolio.md` | Fund picks by brokerage, allocation splits |
| `investing/references/account-hierarchy.md` | Tax-advantaged account priority, Roth vs Traditional |
| `investing/references/contribution-limits.md` | 2025 IRS limits, phase-outs, MAGI |
| `financial-planning/references/planning-checklist.md` | Step-by-step checklist with decision trees |
| `financial-planning/references/professional-referral-guide.md` | When and how to find professional advisors |

## Installation

Add to your Claude Code configuration:

```bash
claude --plugin-dir /path/to/claudestuff/plugins/personal-finance
```

Or add to `.claude/settings.json`:

```json
{
  "plugins": ["/path/to/claudestuff/plugins/personal-finance"]
}
```

## Usage Examples

**Budgeting:**
- "Here's my bank statement CSV, can you categorize my spending?"
- "Compare avalanche vs snowball for paying off my credit cards"
- "Help me set up a budget using the 50/30/20 rule"

**Investing:**
- "Here are my 401k and IRA holdings — is my allocation right for my age?"
- "Compare the expense ratios on my funds"
- "How should I rebalance my portfolio?"

**Financial Planning:**
- "Where should I start with my finances?"
- "Calculate my net worth"
- "How long until I save $50,000 if I put away $500/month?"
- "Should I pay off my student loans or invest?"

## Scripts

All scripts run with `uv` and require Python 3.12+. No external dependencies.

```bash
# Compound interest projection
uv run scripts/compound_interest.py --principal 10000 --rate 0.07 --years 30 --contribution 500

# Expense ratio comparison
uv run scripts/expense_ratio_impact.py --portfolio 500000 --ratio-a 0.03 --ratio-b 1.0 --years 30

# Debt payoff comparison
uv run scripts/debt_payoff.py --inline '[{"name":"CC","balance":5000,"rate":22,"minimum":100},{"name":"Car","balance":12000,"rate":5,"minimum":300}]' --extra 200

# Net worth calculation
uv run scripts/net_worth.py --inline '{"assets":[{"name":"Checking","value":5000,"category":"Cash"}],"liabilities":[{"name":"CC","value":2000,"category":"Credit Cards"}]}'

# Goal projection with scenarios
uv run scripts/goal_projector.py --current 5000 --monthly 500 --target 50000 --scenarios
```

## Annual Maintenance

- **January**: Update `investing/references/contribution-limits.md` when IRS publishes new limits. The file has a "Last verified" date to track this.
- **As needed**: Review fund recommendations in `three-fund-portfolio.md` if brokerages change their offerings.

## Philosophy

This plugin follows a few core principles:

- **Education over prescription** — present ranges and frameworks, not "the answer"
- **Bogleheads philosophy** — low-cost index funds, diversification, stay the course
- **Fee-only fiduciary** — always recommend fee-only advisors, never commission-based
- **Progressive disclosure** — quick summary first, details available on request
- **Know your limits** — explicit referral triggers for when professional help is needed
