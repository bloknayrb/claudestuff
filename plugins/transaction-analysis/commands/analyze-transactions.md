---
description: Comprehensive toll transaction data analysis with automatic client detection and quality validation
---

# Analyze Transactions

Perform comprehensive analysis of toll transaction data with automatic client detection (VDOT, DelDOT, MDTA, DRPA), data quality validation, and integrated reporting.

## Instructions

This command orchestrates a multi-step analysis workflow using specialized agents:

### Step 1: Get File Path
Ask the user for the transaction data file path. Example prompt:
"Please provide the path to the transaction data file you'd like to analyze (Excel, CSV, or text format)."

### Step 2: Data Quality Validation
Invoke the **data-quality-validator** agent to validate the data before analysis:
- Check file structure and schema
- Verify completeness and consistency
- Detect anomalies and issues
- Provide PASS/WARNING/FAIL verdict

If validation returns **FAIL**, report the critical issues to the user and stop. Do not proceed with analysis.

If validation returns **WARNING**, inform the user of warnings and ask if they want to proceed despite the issues.

### Step 3: Comprehensive Analysis
If validation passes, invoke the **transaction-analyst** agent to perform comprehensive analysis:
- Automatically detect client type (VDOT, DelDOT, MDTA, DRPA)
- Apply appropriate analysis framework
- Calculate client-specific metrics
- Identify patterns and anomalies
- Perform root cause analysis
- Generate technical and executive reports

### Step 4: Present Results
Present both reports to the user:
1. **Executive Summary** - High-level findings for management
2. **Technical Report** - Detailed breakdown for operators/engineers

### Step 5: Store Findings
The transaction-analyst agent will automatically store patterns and findings in OpenMemory for future reference.

## Usage Examples

**Basic analysis:**
```
/analyze-transactions
```
Then provide file path when prompted.

**Expected workflow:**
1. User runs `/analyze-transactions`
2. Claude asks for file path
3. data-quality-validator checks data quality → reports status
4. If OK, transaction-analyst performs analysis → generates reports
5. Claude presents executive summary and technical details
6. Patterns stored in OpenMemory for future use

## What This Command Does

- ✓ Automatically detects whether data is VDOT, DelDOT, MDTA, or DRPA format
- ✓ Validates data quality before analysis (prevents garbage-in-garbage-out)
- ✓ Applies client-specific analysis frameworks and calculations
- ✓ Identifies healthy patterns and warning signs
- ✓ Determines root causes (system vs data vs equipment vs operational)
- ✓ Generates both technical and business-focused reports
- ✓ Stores findings for pattern recognition across analyses

## Output

The analysis provides:
- **Executive Summary** with key findings, root cause, financial impact, and recommendations
- **Technical Report** with full metrics breakdown, trends, and methodology
- **Quality Assessment** documenting any data issues encountered
- **Stored Knowledge** in OpenMemory for future reference

## Tips

- Have your transaction data file ready (Excel, CSV, or text format)
- Know the approximate date range covered in the data
- Be prepared to answer questions about known operational events during the period
- If validation fails, work with data providers to resolve quality issues before re-running
