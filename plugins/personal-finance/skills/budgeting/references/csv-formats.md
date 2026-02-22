# Bank & Credit Card CSV Formats

## Known Formats

### Chase (Credit Card & Checking)
**Columns:** `Transaction Date, Post Date, Description, Category, Type, Amount`
- Dates: MM/DD/YYYY
- Amount: Negative = purchases/debits, Positive = payments/credits
- Category: Chase's own categorization (often inaccurate — treat as hint only)
- Type: `Sale`, `Payment`, `Return`, `Fee`, `Adjustment`

### Bank of America
**Columns:** `Date, Description, Amount, Running Bal.`
- Dates: MM/DD/YYYY
- Amount: Negative = debits, Positive = credits
- Running balance included (can verify import correctness)
- Minimal columns — no built-in category

### American Express
**Columns:** `Date, Description, Card Member, Account #, Amount`
- Dates: MM/DD/YYYY
- Amount: Positive = purchases (opposite of Chase convention!)
- Negative = credits/returns
- Card Member field useful for multi-card households
- Account # is partial (last 5 digits)

### Capital One
**Columns:** `Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit`
- Dates: YYYY-MM-DD (ISO format — different from most)
- Separate Debit and Credit columns instead of signed amounts
- Category: Capital One's categorization
- Card No.: last 4 digits

### Wells Fargo
**Columns:** `Date, Amount, *, *, Description`
- Dates: MM/DD/YYYY
- Two unnamed/empty columns between Amount and Description
- Amount: Negative = debits, Positive = credits
- Sparse format — relies on description for all context

### Discover
**Columns:** `Trans. Date, Post Date, Description, Amount, Category`
- Dates: MM/DD/YYYY
- Amount: Positive = purchases (same convention as Amex)
- Category: Discover's categorization

### USAA
**Columns:** `Date, Description, Original Description, Category, Amount, Status`
- Dates: YYYY-MM-DD
- Has both cleaned and original description fields
- Status: `Posted` or `Pending`

### Citi
**Columns:** `Status, Date, Description, Debit, Credit`
- Dates: MM/DD/YYYY
- Separate Debit and Credit columns
- Status: `Cleared`

### Navy Federal Credit Union
**Columns:** `Date, No., Description, Debit, Credit, Balance`
- Transaction number included
- Separate Debit/Credit columns

---

## Format Detection Heuristics

When encountering an unknown CSV, use these heuristics to identify columns:

### Date Column Detection
- Look for columns where most values match date patterns:
  - `MM/DD/YYYY`, `M/D/YYYY`, `YYYY-MM-DD`, `DD-MMM-YYYY`
- Multiple date columns → first is usually transaction date, second is post date
- Column names containing: `date`, `trans`, `post`

### Amount Column Detection
- Look for columns where most values are numeric with optional sign/decimal
- If two numeric columns exist side-by-side → likely Debit/Credit split
- If one numeric column with mixed signs → signed amount (check convention)
- Column names containing: `amount`, `debit`, `credit`, `amt`

### Description Column Detection
- Longest text column is usually the description
- Column names containing: `description`, `desc`, `memo`, `narrative`, `payee`

### Category Column Detection
- Column with repeating values from a small set → likely category
- Column names containing: `category`, `cat`, `type`

### Balance Column Detection
- Column where values are monotonically changing → likely running balance
- Column names containing: `balance`, `bal`, `running`

---

## Amount Sign Conventions

This is the most common source of confusion. Banks are inconsistent.

| Convention | Banks Using It | Debits | Credits |
|-----------|---------------|--------|---------|
| Negative = money out | Chase, BofA, Wells Fargo, Capital One (single column) | Negative | Positive |
| Positive = money out | Amex, Discover | Positive | Negative |
| Split columns | Capital One (Debit/Credit), Citi, Navy Federal | Debit column | Credit column |

### Detecting Convention
1. If split Debit/Credit columns → unambiguous
2. If single Amount column:
   - Look for a known payment (mortgage, rent) and check sign
   - If a payment transaction is negative → "negative = money out"
   - If a payment transaction is positive → "positive = money out"
3. If running balance is available, use it to verify: balance should decrease on purchases

### Normalization Target
After detection, normalize all amounts to: **Positive = money spent (expense), Negative = money received (income/credit)**. This is the most intuitive convention for spending analysis.

---

## Common Edge Cases

### Transfers Between Own Accounts
- Often appear as both a debit and credit across two CSVs
- If analyzing multiple accounts together, detect and exclude to avoid double-counting
- Patterns: `TRANSFER`, `XFER`, `ONLINE TRANSFER`, account numbers in description

### Refunds and Returns
- Appear as credits — should offset the original category, not be counted as income
- Match to original transaction by merchant name and approximate amount if possible

### Pending vs Posted
- Some exports include pending transactions (not yet finalized)
- Pending amounts may change — warn the user if pending items are present
- Filter to posted-only for accurate historical analysis

### Foreign Currency
- Some banks include original currency and converted amount
- Use the converted (home currency) amount for analysis
- Flag foreign transactions for awareness

### Duplicate Detection
- Same merchant, same amount, same date → possible duplicate (or legitimate repeat purchase)
- Flag but don't auto-remove — let the user decide
