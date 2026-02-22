# Financial Planning Checklist

A step-by-step checklist organized by life stage and priority. Work through sequentially — each section builds on the previous.

## Foundation (Do First)

- [ ] Track all income sources and amounts
- [ ] Track all expenses for at least one full month
- [ ] List all debts with: balance, interest rate, minimum payment, type
- [ ] List all accounts with current balances
- [ ] Calculate net worth (use `scripts/net_worth.py`)
- [ ] Set up a checking/savings system (bills account + emergency fund account)
- [ ] Build starter emergency fund ($1,000–$2,000)

## Employer Benefits (Do During Open Enrollment or When Starting a Job)

- [ ] Enroll in employer retirement plan (401k/403b/457b)
- [ ] Contribute at least enough to get the full employer match
- [ ] Review fund options — choose lowest-cost index funds or target-date fund
- [ ] Check if employer offers: HSA-eligible health plan, mega backdoor Roth, after-tax contributions
- [ ] Review employer life insurance and disability coverage
- [ ] Designate beneficiaries on all employer accounts

## Debt Strategy

- [ ] List all debts sorted by interest rate (highest first)
- [ ] Identify high-rate debt (>6–8%): prioritize payoff
- [ ] Identify medium-rate debt (4–6%): personal decision on payoff vs invest
- [ ] Identify low-rate debt (<4%): generally fine to carry
- [ ] Choose payoff strategy: avalanche (math-optimal) or snowball (motivation-optimal)
- [ ] Calculate payoff timeline (use budgeting skill's `scripts/debt_payoff.py`)
- [ ] Set up autopay for all minimum payments

## Emergency Fund

- [ ] Determine target size based on situation (see SKILL.md sizing table)
- [ ] Open high-yield savings account if not already done
- [ ] Set up automatic monthly transfer
- [ ] Calculate months to reach target (use `scripts/goal_projector.py`)

## Tax-Advantaged Accounts (In Priority Order)

- [ ] **HSA** (if eligible): Contribute to annual maximum; invest balance above $1,000–$2,000 cash buffer
- [ ] **Roth IRA**: Open and fund annually ($7,500 in 2026)
  - [ ] If over income limit: set up backdoor Roth IRA (see investing skill's account-hierarchy.md)
- [ ] **401(k) beyond match**: Increase contributions toward $24,500 limit
  - [ ] Decide Roth vs Traditional based on current vs expected future tax bracket
- [ ] **Mega backdoor Roth** (if available): Use after-tax 401(k) → Roth conversion

## Insurance Review

- [ ] **Health insurance**: Evaluate HDHP + HSA vs traditional plan at open enrollment
- [ ] **Life insurance**: If anyone depends on your income → term life (10–12x annual income)
- [ ] **Disability insurance**: Check employer coverage; supplement if <60% of income
- [ ] **Renter's/homeowner's insurance**: Verify coverage is adequate and up to date
- [ ] **Auto insurance**: Review liability limits (consider umbrella if net worth >$500k)
- [ ] **Umbrella insurance**: Consider if net worth exceeds standard liability coverage

## Estate Planning Basics

- [ ] Designate beneficiaries on all retirement accounts, insurance policies, and bank accounts
- [ ] Set up TOD (transfer on death) or POD (payable on death) on non-retirement accounts
- [ ] Create or update will (especially if you have children or significant assets)
- [ ] Designate healthcare proxy / power of attorney
- [ ] Consider revocable living trust if estate is complex or in a probate-heavy state
- [ ] Store documents securely and tell someone where they are

## Common Decision Trees

### Roth vs Traditional?

```
Current marginal tax rate vs expected rate in retirement:
├── Current rate HIGHER than expected retirement rate → Traditional (deduct now)
├── Current rate LOWER than expected retirement rate → Roth (pay tax now)
├── Rates about the same → Roth (tax diversification, no RMDs)
└── Unsure → Split contributions or favor Roth for flexibility
```

### Pay Off Debt or Invest?

```
Interest rate of debt:
├── >8% → Pay off debt (guaranteed high return)
├── 4–8% → Personal preference (consider splitting)
│   ├── Risk-averse or debt-stressed → Pay off debt
│   └── Comfortable with debt, long horizon → Invest
└── <4% → Generally invest (especially if tax-deductible like mortgage)
    └── Exception: If debt causes stress, paying it off has real value
```

### Lump Sum or Dollar-Cost Average?

```
Investing a large sum (inheritance, bonus, savings):
├── Statistically: Lump sum wins ~2/3 of the time
├── Emotionally: DCA over 3–6 months reduces regret risk
└── Pragmatic: If you'd panic and sell after a drop, DCA is better for you
```

### Rent or Buy a Home?

```
Planning to stay 5+ years AND can afford:
├── 20% down payment (or accept PMI trade-off)
├── Monthly payment ≤28% of gross income (PITI)
├── Total debt payments ≤36% of gross income
├── Still have 3–6 month emergency fund after down payment
└── Yes to all → Buying can make sense
    Otherwise → Renting is not "throwing money away"
```

## Life Event Checklists

### New Job

- [ ] Evaluate 401(k) fund options and match schedule
- [ ] Roll over old 401(k) to new employer plan or IRA (don't leave it orphaned)
- [ ] Check for HSA-eligible health plan option
- [ ] Update emergency fund target if income changed significantly
- [ ] Review and update beneficiaries

### Marriage

- [ ] Discuss financial goals, debts, and spending philosophies
- [ ] Decide on combined vs separate vs hybrid account structure
- [ ] Update tax filing status and withholding
- [ ] Update beneficiaries on all accounts
- [ ] Review insurance needs together
- [ ] Update estate documents (wills, powers of attorney)

### First Child

- [ ] Get term life insurance (both parents, 10–12x income, 20-year term)
- [ ] Add child to health insurance within 30 days (qualifying life event)
- [ ] Start 529 education savings plan (even small amounts compound)
- [ ] Update will to designate guardian
- [ ] Increase emergency fund target
- [ ] Review disability insurance

### Home Purchase

- [ ] Save 20% down payment (or decide on acceptable PMI trade-off)
- [ ] Get pre-approved before house hunting
- [ ] Budget for closing costs (2–5% of purchase price)
- [ ] Budget for maintenance reserve (1–2% of home value annually)
- [ ] Don't drain emergency fund for down payment
- [ ] Keep investing — don't pause retirement contributions for more than 1–2 years
