# Personal Finance Plugin — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `personal-finance` plugin for the claudestuff marketplace with skills for financial knowledge and agents for autonomous data processing, starting with budgeting as the immediate priority.

**Architecture:** Hybrid skill+agent plugin. Skills provide domain knowledge, reference data, and calculation scripts that load into conversation context. Agents run as autonomous subprocesses for data-heavy operations like CSV transaction categorization and portfolio analysis. The plugin lives in `plugins/personal-finance/` in the claudestuff repo.

**Tech Stack:** Markdown (agent/skill definitions), Python 3.12 via uv (calculation scripts), YAML frontmatter (metadata)

---

## Phase 1: Plugin Scaffold + Budgeting Skill + Budget Analyst Agent

### Task 1: Clone the claudestuff repo and create plugin scaffold

**Files:**
- Create: `plugins/personal-finance/.claude-plugin/plugin.json`
- Create: `plugins/personal-finance/agents/` (directory)
- Create: `plugins/personal-finance/skills/` (directory)

**Step 1: Clone the repo**

```bash
cd ~/GitHub
git clone git@github.com:bloknayrb/claudestuff.git claudestuff-finance
cd claudestuff-finance
git checkout -b feature/personal-finance
```

**Step 2: Create plugin manifest**

Create `plugins/personal-finance/.claude-plugin/plugin.json`:

```json
{
  "name": "personal-finance",
  "version": "1.0.0",
  "description": "Personal finance plugin with budgeting, investing, and financial planning skills and agents. Includes transaction categorization, spending analysis, portfolio analysis, and financial calculation tools.",
  "author": {
    "name": "bloknayrb"
  },
  "repository": "https://github.com/bloknayrb/claudestuff"
}
```

**Step 3: Create directory structure**

```bash
mkdir -p plugins/personal-finance/agents
mkdir -p plugins/personal-finance/skills/budgeting/{references,scripts}
mkdir -p plugins/personal-finance/skills/investing/{references,scripts}
mkdir -p plugins/personal-finance/skills/financial-planning/{references,scripts}
```

**Step 4: Commit**

```bash
git add plugins/personal-finance/
git commit -m "feat: scaffold personal-finance plugin structure"
```

---

### Task 2: Create the budgeting skill — SKILL.md

**Files:**
- Create: `plugins/personal-finance/skills/budgeting/SKILL.md`

**Step 1: Write SKILL.md**

The SKILL.md should be lean (~1,500-2,000 words) with detailed content in references/. It must use imperative/infinitive form (not second person) and third-person description in frontmatter.

```yaml
---
name: budgeting
description: This skill should be used when the user asks to "create a budget", "analyze spending", "categorize transactions", "track expenses", "manage cash flow", "pay off debt", "compare debt payoff methods", or mentions budgeting frameworks like zero-based budgeting, 50/30/20, or envelope budgeting. Provides budgeting methodology, transaction categorization guidance, and spending analysis tools.
---
```

Body should cover:
- Overview of supported budgeting frameworks (ZBB, 50/30/20, envelope)
- Transaction categorization workflow (CSV import → format detection → merchant normalization → category assignment → review flagging)
- Standard budget categories (housing, utilities, groceries, transportation, healthcare, debt, dining, entertainment, personal care, clothing, subscriptions, savings, gifts, childcare, pets)
- Sinking fund concept for irregular expenses
- Cash flow timing awareness
- References to `references/merchant-categories.md`, `references/budget-frameworks.md`, `references/csv-formats.md`
- References to `scripts/spending_summary.py`, `scripts/debt_payoff.py`

**Step 2: Commit**

```bash
git add plugins/personal-finance/skills/budgeting/SKILL.md
git commit -m "feat: add budgeting skill SKILL.md"
```

---

### Task 3: Create budgeting reference files

**Files:**
- Create: `plugins/personal-finance/skills/budgeting/references/merchant-categories.md`
- Create: `plugins/personal-finance/skills/budgeting/references/budget-frameworks.md`
- Create: `plugins/personal-finance/skills/budgeting/references/csv-formats.md`

**Step 1: Write merchant-categories.md**

A curated merchant-to-category lookup table. Include:
- Common bank transaction description patterns and their categories
- Regex patterns for merchant normalization (SQ *, AMZN MKTP US*, PAYPAL *, etc.)
- Known ambiguous merchants with guidance (Walmart = groceries or household? Target = groceries or clothing? Costco = groceries or bulk?)
- A note that ambiguous transactions should be flagged for human review, not silently guessed
- Category hierarchy (primary → subcategory)

**Step 2: Write budget-frameworks.md**

Detailed reference on each budgeting methodology:
- Zero-Based Budgeting: every dollar assigned, income - allocations = 0, roll with the punches
- 50/30/20: after-tax income split (needs/wants/savings), definition of "needs" vs "wants", HCOL caveats
- Envelope Budgeting: digital equivalent, category caps, stop-when-empty discipline
- YNAB's Four Rules: give every dollar a job, true expenses, roll with the punches, age your money
- Sinking Funds: annual/irregular expenses divided by 12, examples (car registration, annual subscriptions, holiday gifts)
- Debt payoff frameworks: avalanche (highest rate first, mathematically optimal) vs snowball (lowest balance first, psychologically effective)

**Step 3: Write csv-formats.md**

Document common bank/credit card CSV export formats:
- Chase: Transaction Date, Post Date, Description, Category, Type, Amount
- Bank of America: Date, Description, Amount, Running Bal.
- American Express: Date, Description, Card Member, Account #, Amount
- Capital One: Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit
- Wells Fargo: Date, Amount, *, *, Description
- Discover: Trans. Date, Post Date, Description, Amount, Category
- Generic column detection heuristics (look for date-like, amount-like, description-like columns)
- Handling of negative amounts (some banks use negative for debits, some for credits)

**Step 4: Commit**

```bash
git add plugins/personal-finance/skills/budgeting/references/
git commit -m "feat: add budgeting reference files"
```

---

### Task 4: Create budgeting calculation scripts

**Files:**
- Create: `plugins/personal-finance/skills/budgeting/scripts/spending_summary.py`
- Create: `plugins/personal-finance/skills/budgeting/scripts/debt_payoff.py`

**Step 1: Write spending_summary.py**

Python script (uv-compatible, no exotic deps) that:
- Takes a CSV of categorized transactions (date, description, amount, category)
- Outputs spending by category with:
  - Total per category
  - Percentage of total spending
  - Percentage of income (if income provided as argument)
  - Count of transactions per category
  - Average transaction size per category
- Monthly comparison if multiple months present
- Flags categories over a configurable threshold

**Step 2: Write debt_payoff.py**

Python script that:
- Takes a list of debts as JSON or CSV (name, balance, interest_rate, minimum_payment)
- Takes an extra_monthly_payment amount
- Calculates both avalanche and snowball payoff schedules
- Outputs for each method:
  - Total interest paid
  - Months to payoff
  - Month-by-month schedule (optional, with --verbose flag)
  - Savings difference between methods

**Step 3: Test both scripts**

```bash
cd plugins/personal-finance/skills/budgeting/scripts
uv run spending_summary.py --help
uv run debt_payoff.py --help
```

**Step 4: Commit**

```bash
git add plugins/personal-finance/skills/budgeting/scripts/
git commit -m "feat: add budgeting calculation scripts"
```

---

### Task 5: Create the budget-analyst agent

**Files:**
- Create: `plugins/personal-finance/agents/budget-analyst.md`

**Step 1: Write the agent file**

Frontmatter:
```yaml
---
name: budget-analyst
description: Use PROACTIVELY when user provides bank or credit card CSV transaction files, asks for spending analysis, wants to categorize transactions, or needs help building a budget. MUST BE USED when CSV financial data is provided for analysis. Examples:

<example>
Context: User provides a bank transaction CSV for analysis
user: "Here's my Chase statement for January, can you tell me where my money went?"
assistant: "I'll use the budget-analyst agent to categorize and analyze your transactions."
<commentary>
User provided a CSV of bank transactions, so the budget-analyst agent processes and categorizes them autonomously.
</commentary>
</example>

<example>
Context: User wants a spending breakdown
user: "Analyze my spending from the last 3 months and show me trends"
assistant: "I'll use the budget-analyst agent to process your transaction data and identify spending trends."
<commentary>
User is asking for spending analysis which requires autonomous CSV processing — trigger budget-analyst.
</commentary>
</example>

<example>
Context: User wants to understand their budget situation
user: "I downloaded my credit card statements, help me figure out a budget"
assistant: "I'll use the budget-analyst agent to categorize your transactions and build a spending baseline for budgeting."
<commentary>
User wants to build a budget from transaction data — budget-analyst categorizes first, then helps structure a budget.
</commentary>
</example>

model: sonnet
color: green
tools: ["Read", "Write", "Bash", "Glob", "Grep"]
---
```

System prompt should cover:
- Role: Personal budget analyst specializing in transaction categorization and spending analysis
- Process: Detect CSV format → normalize columns → categorize transactions using merchant lookup patterns → flag ambiguous items → generate spending summary → identify trends/anomalies
- Output format: Categorized transaction summary, spending by category (amount + % of total + % of income if known), month-over-month trends, subscription detection, anomaly flags, actionable observations
- Tone guidelines: Non-judgmental, progressive disclosure, no shame language
- Disclaimer: "This is a spending analysis tool, not financial advice. For personalized financial guidance, consult a certified financial planner."
- Edge cases: Handle multiple CSV formats, mixed date formats, transactions in different currencies, refunds/credits, transfers between own accounts

**Step 2: Commit**

```bash
git add plugins/personal-finance/agents/budget-analyst.md
git commit -m "feat: add budget-analyst agent"
```

---

## Phase 2: Investing Skill + Portfolio Analyzer Agent

### Task 6: Create the investing skill — SKILL.md

**Files:**
- Create: `plugins/personal-finance/skills/investing/SKILL.md`

**Step 1: Write SKILL.md**

Frontmatter with third-person description and triggers for: "investing", "portfolio", "asset allocation", "401k", "IRA", "HSA", "529", "index fund", "three-fund", "rebalancing", "expense ratio".

Body should cover:
- Bogleheads passive index investing philosophy (core principles)
- Three-fund portfolio concept
- Tax-advantaged account priority hierarchy
- Asset allocation by age/risk tolerance guidelines
- Dollar cost averaging vs lump sum
- Rebalancing approaches (calendar vs threshold)
- Expense ratio impact over time
- References to all reference files and scripts

**Step 2: Commit**

```bash
git add plugins/personal-finance/skills/investing/SKILL.md
git commit -m "feat: add investing skill SKILL.md"
```

---

### Task 7: Create investing reference files

**Files:**
- Create: `plugins/personal-finance/skills/investing/references/three-fund-portfolio.md`
- Create: `plugins/personal-finance/skills/investing/references/account-hierarchy.md`
- Create: `plugins/personal-finance/skills/investing/references/contribution-limits.md`

**Step 1: Write three-fund-portfolio.md**

- The three funds and their purpose (US total market, international total market, US total bond)
- Specific fund/ETF recommendations by brokerage (Vanguard: VTSAX/VTI, VTIAX/VXUS, VBTLX/BND; Fidelity: FSKAX/FZROX, FZILX, FXNAX/FZROX; Schwab equivalents)
- Rationale for why three funds capture the entire investable market
- Common allocation splits (stock:bond by age, US:international within stocks)
- No overlap, no gaps principle

**Step 2: Write account-hierarchy.md**

- Full priority order with explanations: 401k match → HSA → IRA → 401k max → taxable
- Why each level exists and its tax advantage
- Roth vs Traditional decision framework (current bracket vs expected retirement bracket)
- Backdoor Roth IRA concept for high earners
- Income limits and phase-outs

**Step 3: Write contribution-limits.md**

- 2025 IRS limits for all account types (IRA, 401k, 403b, HSA, 529)
- Catch-up contribution amounts (50+ and 60-63 for 401k)
- Income phase-outs for Roth IRA and Traditional IRA deductibility
- **IMPORTANT**: Include `Last verified: 2025-01-01` date and instructions to check irs.gov for current year
- MAGI calculation basics for determining eligibility

**Step 4: Commit**

```bash
git add plugins/personal-finance/skills/investing/references/
git commit -m "feat: add investing reference files"
```

---

### Task 8: Create investing calculation scripts

**Files:**
- Create: `plugins/personal-finance/skills/investing/scripts/compound_interest.py`
- Create: `plugins/personal-finance/skills/investing/scripts/rebalancing.py`
- Create: `plugins/personal-finance/skills/investing/scripts/expense_ratio_impact.py`

**Step 1: Write compound_interest.py**

- FV = PV * (1 + r/n)^(n*t)
- Arguments: principal, annual_rate, years, compounding_frequency (default: 12), monthly_contribution (default: 0)
- Output: final value, total contributions, total interest earned
- Optional: year-by-year breakdown with --verbose

**Step 2: Write rebalancing.py**

- Input: current holdings (JSON or CSV: account, ticker, value, asset_class) and target allocation (JSON: asset_class → percentage)
- Calculate current allocation percentages
- Determine deviation from target
- Output buy/sell instructions, prioritizing:
  1. New contributions to underweight assets first
  2. Tax-advantaged accounts for sells (no tax consequences)
  3. Taxable accounts last
- Flag if any asset class is >5% off target (threshold rebalancing trigger)

**Step 3: Write expense_ratio_impact.py**

- Input: portfolio_value, expense_ratio_a, expense_ratio_b, years, annual_return (default: 7%)
- Calculate portfolio value for each expense ratio over time
- Output: the dollar difference and percentage difference
- Show year-by-year if --verbose

**Step 4: Test all scripts**

```bash
cd plugins/personal-finance/skills/investing/scripts
uv run compound_interest.py --principal 10000 --rate 0.07 --years 30
uv run rebalancing.py --help
uv run expense_ratio_impact.py --portfolio 500000 --ratio-a 0.03 --ratio-b 1.0 --years 30
```

**Step 5: Commit**

```bash
git add plugins/personal-finance/skills/investing/scripts/
git commit -m "feat: add investing calculation scripts"
```

---

### Task 9: Create the portfolio-analyzer agent

**Files:**
- Create: `plugins/personal-finance/agents/portfolio-analyzer.md`

**Step 1: Write the agent file**

Frontmatter with proactive triggering for portfolio/holdings data, asset allocation questions, rebalancing requests. Model: sonnet. Color: cyan. Tools: Read, Write, Bash, Glob, Grep, WebSearch.

System prompt:
- Role: Personal portfolio analyst specializing in passive index investing and asset allocation
- Process: Parse holdings → calculate current allocation → compare to target → identify rebalancing opportunities → check expense ratios → evaluate tax-advantaged account utilization
- Output format: Current allocation breakdown (stocks/bonds/cash, US/international/bonds), comparison to age-appropriate target, rebalancing instructions, expense ratio flags, account hierarchy utilization check
- Education-not-advice framing: ranges not point estimates, uncertainty acknowledged, assumptions stated
- Disclaimer: inline and contextual, not boilerplate
- Professional referral triggers: complex tax situations, estate planning, specific product recommendations
- Examples in description showing 2-3 triggering scenarios

**Step 2: Commit**

```bash
git add plugins/personal-finance/agents/portfolio-analyzer.md
git commit -m "feat: add portfolio-analyzer agent"
```

---

## Phase 3: Financial Planning Skill (Cross-Domain)

### Task 10: Create the financial-planning skill

**Files:**
- Create: `plugins/personal-finance/skills/financial-planning/SKILL.md`
- Create: `plugins/personal-finance/skills/financial-planning/references/planning-checklist.md`
- Create: `plugins/personal-finance/skills/financial-planning/references/professional-referral-guide.md`
- Create: `plugins/personal-finance/skills/financial-planning/scripts/net_worth.py`
- Create: `plugins/personal-finance/skills/financial-planning/scripts/goal_projector.py`

**Step 1: Write SKILL.md**

Triggers: "financial plan", "net worth", "financial goals", "emergency fund", "financial checklist", "where should I start", "financial priorities".

Body covers:
- Financial planning stages (CFP-inspired): cash flow → emergency fund → employer match → high-rate debt → insurance gaps → HSA → IRA → 401k max → medium-rate debt → taxable investing → low-rate debt
- Emergency fund sizing (3-6 months expenses; stable job → 3, variable income → 6+)
- Goal prioritization framework
- When to refer to a professional
- Net worth tracking concept

**Step 2: Write planning-checklist.md**

Detailed step-by-step financial planning checklist with:
- Prerequisites at each stage
- Decision trees for common forks (Roth vs Traditional, pay debt vs invest, etc.)
- Life event considerations (marriage, kids, home purchase, job change, inheritance)

**Step 3: Write professional-referral-guide.md**

- When to recommend a CPA (specific tax filing situations, self-employment, multi-state income)
- When to recommend a CFP (retirement planning, major life transitions, complex estates)
- When to recommend an attorney (estate planning, prenup, business formation)
- When to recommend an insurance agent/broker (life insurance needs analysis, disability, long-term care)
- How to find fee-only fiduciary advisors (NAPFA, fee-only network)

**Step 4: Write net_worth.py**

- Input: assets and liabilities as JSON (name, value, category)
- Categories: Cash/Checking, Savings, Investments (taxable), Retirement (401k, IRA, Roth), Real Estate, Vehicles, Other Assets, Credit Cards, Student Loans, Mortgage, Auto Loans, Other Debt
- Output: net worth, asset breakdown, liability breakdown, liquid vs illiquid split

**Step 5: Write goal_projector.py**

- Input: current_savings, monthly_contribution, target_amount, annual_return (default: conservative 5%, moderate 7%, optimistic 9%)
- Output: months to goal for each scenario, plus a range
- Optional: if target_date provided instead, calculate required monthly contribution

**Step 6: Test scripts**

```bash
uv run net_worth.py --help
uv run goal_projector.py --current 5000 --monthly 500 --target 50000
```

**Step 7: Commit**

```bash
git add plugins/personal-finance/skills/financial-planning/
git commit -m "feat: add financial-planning skill with references and scripts"
```

---

## Phase 4: Integration and Polish

### Task 11: Add README and documentation

**Files:**
- Create: `plugins/personal-finance/README.md`

**Step 1: Write README**

Cover:
- What the plugin provides (3 skills, 2 agents)
- Installation instructions
- Quick start guide (how to use each component)
- Disclaimers about education vs financial advice
- Annual update requirements (contribution limits)

**Step 2: Commit**

```bash
git add plugins/personal-finance/README.md
git commit -m "docs: add personal-finance plugin README"
```

---

### Task 12: Test plugin installation and triggering

**Step 1: Test local plugin loading**

```bash
cc --plugin-dir ~/GitHub/claudestuff-finance/plugins/personal-finance
```

**Step 2: Test agent triggering**

Try prompts like:
- "Here's my bank statement CSV" (should trigger budget-analyst)
- "Analyze my portfolio holdings" (should trigger portfolio-analyzer)

**Step 3: Test skill triggering**

Try prompts like:
- "Help me set up a budget" (should load budgeting skill)
- "Explain the three-fund portfolio" (should load investing skill)
- "Where should I start with my finances?" (should load financial-planning skill)

**Step 4: Fix any triggering issues**

Adjust descriptions/examples if agents or skills don't trigger on expected prompts.

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: adjust triggering conditions based on testing"
```

---

### Task 13: Push and create PR

**Step 1: Push branch**

```bash
git push -u origin feature/personal-finance
```

**Step 2: Create PR**

```bash
gh pr create --title "feat: add personal-finance plugin" --body "## Summary
- New personal-finance plugin with 3 skills and 2 agents
- Budgeting skill with transaction categorization, spending analysis, debt payoff tools
- Investing skill with three-fund portfolio, account hierarchy, rebalancing guidance
- Financial planning skill with planning checklist, net worth tracking, goal projection
- Budget-analyst agent for autonomous CSV transaction processing
- Portfolio-analyzer agent for autonomous portfolio analysis

## Components
- 3 Skills: budgeting, investing, financial-planning
- 2 Agents: budget-analyst, portfolio-analyzer
- 5 Python scripts for financial calculations
- 6 Reference files with domain knowledge
"
```

---

## Implementation Notes

- **Python scripts**: Use uv inline script metadata (`# /// script`) for dependencies if any are needed. Prefer stdlib where possible.
- **Agent model**: Both agents use sonnet — capable enough for financial reasoning, fast enough for interactive use.
- **Skill writing style**: Imperative/infinitive form throughout. Third-person in frontmatter descriptions.
- **Annual maintenance**: contribution-limits.md needs updating each January when IRS publishes new limits. The "last verified" date makes this trackable.
- **Future extensions**: Tax-strategist and retirement-planner agents can be added as Phase 5/6 following the same patterns.
