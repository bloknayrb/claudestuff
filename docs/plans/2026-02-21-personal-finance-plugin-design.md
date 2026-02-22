# Personal Finance Plugin — Design Document

**Date**: 2026-02-21
**Author**: Bryan Kolb + Claude
**Plugin**: `personal-finance` (claudestuff marketplace)
**Status**: Approved

## Problem

The Claude Code plugin ecosystem has no meaningful personal finance coverage. Existing financial plugins (equity research, business finance tracking, generic finance skills) target institutional or business use cases. There's nothing for the individual who wants help categorizing bank transactions, building a budget, understanding their investment allocation, or planning financial goals.

## Solution

A hybrid plugin combining **skills** (knowledge/methodology loaded into conversation) and **agents** (autonomous subprocesses for data-heavy work). This separation lets the skills provide domain expertise while agents handle the grunt work of processing CSVs and crunching numbers without clogging the main conversation context.

## Architecture

### Skills (3)

#### 1. `budgeting`

Core budgeting knowledge and methodology.

**References:**
- `merchant-categories.md` — Curated merchant-to-category lookup table. Covers common bank transaction descriptions (SQ *, AMZN MKTP, etc.) mapped to budget categories. Flags ambiguous merchants for human review.
- `budget-frameworks.md` — Zero-based budgeting, 50/30/20, envelope system, sinking funds, cash flow timing.
- `csv-formats.md` — Common bank/credit card CSV export formats (Chase, BofA, Amex, Capital One, etc.) with column mapping guidance.

**Scripts:**
- `spending_summary.py` — Takes categorized transactions, produces spending by category with percentages.
- `debt_payoff.py` — Avalanche vs snowball comparison given a list of debts (balance, rate, minimum payment). Outputs total interest paid and payoff timeline for each method.

**Triggers:** "budget", "spending analysis", "categorize transactions", "debt payoff", "cash flow", "track expenses"

#### 2. `investing`

Investment framework knowledge grounded in evidence-based passive investing.

**References:**
- `three-fund-portfolio.md` — Bogleheads three-fund portfolio concept, fund recommendations by brokerage, rationale.
- `account-hierarchy.md` — Tax-advantaged account priority order (401k match → HSA → IRA → 401k max → taxable) with explanation of each level.
- `contribution-limits.md` — Current IRS limits for all tax-advantaged accounts. Includes "last verified" date and instructions to check IRS.gov for current year.

**Scripts:**
- `compound_interest.py` — FV = PV * (1 + r/n)^(n*t) with clear input/output.
- `rebalancing.py` — Takes current holdings and target allocation, outputs buy/sell instructions prioritizing tax-advantaged accounts.
- `expense_ratio_impact.py` — Shows long-term cost difference between expense ratios on a given portfolio size and time horizon.

**Triggers:** "investing", "portfolio", "asset allocation", "401k", "IRA", "HSA", "index fund", "three-fund", "rebalancing"

#### 3. `financial-planning`

Cross-domain planning that ties budgeting and investing together.

**References:**
- `planning-checklist.md` — Financial planning stages modeled on CFP process: cash flow → emergency fund → debt management → insurance → investing → retirement → estate.
- `professional-referral-guide.md` — When to recommend a CPA, CFP, or attorney. Specific triggers: tax filing situations, estate planning, insurance product selection, divorce, inheritance, business sale.

**Scripts:**
- `net_worth.py` — Simple assets minus liabilities calculator with category breakdown.
- `goal_projector.py` — Given current savings, monthly contribution, and target, project timeline to goal with range (conservative/moderate/optimistic assumptions).

**Triggers:** "financial plan", "net worth", "financial goals", "emergency fund", "financial checklist"

### Agents (2)

#### 1. `budget-analyst` (Priority 1)

Autonomous transaction categorization and spending analysis.

- **Model**: sonnet
- **Tools**: Read, Write, Bash, Glob, Grep
- **Proactive**: Yes — triggers on CSV file provision or spending analysis requests
- **Process**: Read CSV → detect format → normalize columns → categorize each transaction using merchant lookup → flag ambiguous items → generate spending summary → identify trends and anomalies
- **Output**: Categorized transaction table, spending by category (% of income if known), month-over-month trends, subscription detection, sinking fund recommendations, flagged items for review
- **Tone**: Non-judgmental, progressive disclosure (summary first, detail on request)

#### 2. `portfolio-analyzer` (Priority 2)

Autonomous portfolio analysis and rebalancing guidance.

- **Model**: sonnet
- **Tools**: Read, Write, Bash, Glob, Grep, WebSearch
- **Proactive**: Yes — triggers on portfolio holdings provision or allocation questions
- **Process**: Parse holdings → calculate current allocation → compare to target → identify rebalancing opportunities → check expense ratios → evaluate tax-advantaged account utilization
- **Output**: Current allocation breakdown, target comparison, rebalancing instructions (tax-aware), expense ratio flags, account hierarchy utilization check
- **Tone**: Educational framing, ranges not point estimates, professional referral for complex situations

## Design Principles

1. **Education, not advice** — Contextual inline disclaimers, not boilerplate. "This projection assumes 7% returns, which is historically reasonable but not guaranteed."
2. **Show the math** — Transparent calculations with visible formulas, inputs, and assumptions.
3. **Non-judgmental** — No language implying bad decisions. Frame current state, show options.
4. **Annual update flags** — Tax data has "last verified" dates. Agents flag potentially stale info.
5. **Progressive complexity** — Simple answer first, offer depth. "Groceries are 18% of income — want the merchant breakdown?"
6. **Professional referral boundaries** — Clear triggers for "talk to a CPA/CFP/attorney" recommendations.

## Plugin Structure

```
personal-finance/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── budget-analyst.md
│   └── portfolio-analyzer.md
└── skills/
    ├── budgeting/
    │   ├── SKILL.md
    │   ├── references/
    │   │   ├── merchant-categories.md
    │   │   ├── budget-frameworks.md
    │   │   └── csv-formats.md
    │   └── scripts/
    │       ├── spending_summary.py
    │       └── debt_payoff.py
    ├── investing/
    │   ├── SKILL.md
    │   ├── references/
    │   │   ├── three-fund-portfolio.md
    │   │   ├── account-hierarchy.md
    │   │   └── contribution-limits.md
    │   └── scripts/
    │       ├── compound_interest.py
    │       ├── rebalancing.py
    │       └── expense_ratio_impact.py
    └── financial-planning/
        ├── SKILL.md
        ├── references/
        │   ├── planning-checklist.md
        │   └── professional-referral-guide.md
        └── scripts/
            ├── net_worth.py
            └── goal_projector.py
```

## Research Sources

- [Bogleheads Wiki](https://www.bogleheads.org/wiki/Main_Page) — Evidence-based investing reference
- [SEC investor.gov](https://investor.gov) — Official investor education
- [IRS Publications](https://www.irs.gov/publications) — Tax-advantaged account rules and limits
- [FINRA Investor Education](https://www.finra.org/investors) — Behavioral finance and fee impact
- [CFP Board Standards](https://www.cfp.net/ethics/code-of-ethics-and-standards-of-conduct) — Financial planning process and ethics
- [Morningstar Retirement Research](https://www.morningstar.com/retirement) — Updated safe withdrawal rates
- [Anthropic Multi-Agent Documentation](https://docs.anthropic.com/en/docs/build-with-claude/agents) — Agent design patterns
- [awesome-claude-plugins](https://github.com/Chat2AnyLLM/awesome-claude-plugins) — Ecosystem gap analysis
- [claude-equity-research](https://github.com/quant-sentiment-ai/claude-equity-research) — Existing financial plugin patterns

## Future Enhancement: Data Layer & Tool Integration

Research identified several tools and APIs that would enhance the plugin in later phases:

**Data Layer:**
- **SQLite** as a local, privacy-first financial data store (queryable, version-controllable, maps to Beancount concepts)
- **ofxparse** Python library for OFX/QFX/QIF file parsing beyond CSV

**Market Data:**
- **OpenBB Platform** (`pip install openbb`) — Python abstraction layer routing across Yahoo Finance, Alpha Vantage, FRED, Polygon, and 100+ data providers. Best option for investment agent data access.
- **FRED API** (free, no key required) — Authoritative macro data (CPI, Fed Funds Rate, unemployment, yield curves)
- **Alpha Vantage** (free tier: 25 calls/day) — Stocks, ETFs, forex, economic indicators
- **yfinance** — Free historical prices and fundamentals (unofficial, may break)

**Portfolio Analysis:**
- **pyportfolioopt** — Mean-variance optimization, Black-Litterman, risk parity
- **financetoolkit** — Financial statements, ratios, and technical analysis in a clean API

**Bank CSV Formats to Support:**
- Chase, Bank of America, Wells Fargo, Citi, American Express, Capital One, Discover, Schwab, Fidelity

**Privacy Considerations:**
- Financial data should stay local (never committed to git)
- If Plaid is added later (real-time bank sync), OAuth tokens must be stored encrypted
- SQLite database should not live in a git-tracked directory

These integrations are earmarked for Phase 4+ after the core skills and agents are working.

## Implementation Priority

1. Plugin scaffold + `budget-analyst` agent + `budgeting` skill (immediate need)
2. `investing` skill + `portfolio-analyzer` agent
3. `financial-planning` skill (ties everything together)
4. Data layer (SQLite), additional CSV format support, OFX parsing
5. Market data integration (OpenBB, FRED) for portfolio-analyzer enrichment
6. Tax-strategist agent + retirement-planner agent (future specialist additions)
