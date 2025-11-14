---
name: analyzing-transactions
description: Analyzes toll transaction data for VDOT, DelDOT, MDTA, and DRPA. Automatically detects client type from dataset characteristics, calculates collection rates, identifies rejection patterns, tracks disposition lifecycles, and generates technical and executive reports. Use when working with transaction posting data, IAG files, TransCore LPT reports, or analyzing rejection rates, collection efficiency, and payment cohorts.
---

# Analyzing Transactions

## Purpose
Guides comprehensive transaction data analysis across toll system clients with automatic detection of data source and selection of appropriate analysis framework.

## Quick Start Checklist
- [ ] Identify data source and client type
- [ ] Validate data quality and completeness
- [ ] Calculate key metrics (collection/reject/at-risk rates)
- [ ] Identify patterns and anomalies
- [ ] Determine root cause (system vs data vs equipment)
- [ ] Generate appropriate deliverables

## Client Detection
The skill automatically identifies your client based on dataset characteristics:
- **VDOT**: TagAgencyID field present, POST/PPST/NPST/RINV/RJDP/RJPL/TAGB/ACCB/INSU status codes
- **DelDOT**: F/I/R/D disposition codes, TransCore LPT format, cohort analysis fields
- **MDTA**: INSU rejection patterns, ITAG/ICLP timestamp references
- **DRPA**: IAG 1.6 format markers, ICD testing batch identifiers

For detailed detection logic and decision trees, see [[CLIENT-DETECTION.md]].

## Analysis Workflow

### Step 1: Data Preparation
Review source format and validate quality:
- Check for missing months or data gaps
- Verify date alignment (transaction month vs report month)
- Confirm static baseline (total transactions shouldn't change)
- Determine if cumulative or per-month view needed
- Flag any corrupt or anomalous data periods

For script development guidance, see [[EXTRACTION-GUIDE.md]].

### Step 2: Framework Selection

#### VDOT Analysis Framework
**Focus**: Daily posting performance by Tag Agency (29 agencies tracked)
- **Key Metrics**:
  - Reject rate by agency and status code
  - Plate vs AVI transaction separation
  - Daily transaction volumes and trends
- **Granularity**: Daily with agency-level breakdown
- **Expected Volume**: ~41,409 records per analysis period
- **Deliverable**: Power BI dashboard with agency filtering, Excel backup

#### DelDOT Analysis Framework
**Focus**: Disposition lifecycle and payment cohort tracking
- **Key Metrics**:
  - Collection Rate = (F2-F8 codes) / Total Transactions
  - At Risk Rate = (I6-I21 codes) / Total Transactions
  - Loss Rate = (R1-R8, D3 codes) / Total Transactions
  - Processing Rate = (I2, I3, I20, I23) / Total
- **Granularity**: Monthly with 3-month and 6-month cohort windows
- **Expected Volume**: ~605,000 transactions/month
- **Deliverable**: Excel workbook + stakeholder interpretation summary

#### MDTA Analysis Framework
**Focus**: Tag status synchronization and INSU rejection investigation
- **Key Metrics**:
  - INSU rejection rate and patterns
  - Tag status timing discrepancies
  - ITAG/ICLP file processing delays
- **Granularity**: Transaction-level investigation with examples
- **Analysis Method**: Individual transaction tracing with all lookup history
- **Deliverable**: Investigation report with 5 example transactions

#### DRPA Analysis Framework
**Focus**: IAG 1.6 cutover monitoring and ICD certification testing
- **Key Metrics**:
  - Pre/post cutover success rates
  - Business rule compliance rates
  - Image review accuracy
  - UO transaction handling
- **Granularity**: Test batch analysis
- **Deliverable**: Certification compliance report

### Step 3: Metric Calculation

**Universal Metrics** (all clients):
- Collection Rate = Successful Collections / Total Transactions × 100
- Reject Rate = Rejected Transactions / Total Transactions × 100
- At Risk Rate = In-Collection Transactions / Total Transactions × 100
- Loss Rate = Uncollectable Transactions / Total Transactions × 100

**Client-Specific Calculations**:
- **VDOT**: Separate plate-only vs all transactions; agency-specific rates
- **DelDOT**: Cohort progression (% paid at 30/60/90/120/180 days)
- **MDTA**: Status at transaction time vs status at posting time delta
- **DRPA**: Pre-cutover baseline vs post-cutover performance

### Step 4: Pattern Recognition

**Expected Healthy Patterns**:
- Payment rates increase over time (logarithmic curve)
- Past due amounts decrease as collection progresses
- DMV lookup queues trend toward zero over 3-4 months
- Collection rates improve for 3-4 months then stabilize at ~78-82%

**Warning Signs Requiring Investigation**:
- Missing data periods or gaps in sequence
- Sudden spikes or drops (>10% change) without known cause
- Past due escalation failures (30-day not progressing to 60/90/120)
- Hardcoded summary values not reconciling with detail data
- Static metrics that should be changing over time

**Known Issues to Check**:
- Maryland special character encoding in ICLP files
- NY Bad Acks affecting multi-agency transactions
- Key Bridge collapse impact on transaction patterns (March 2024)
- Equipment calibration issues (elevated R2/I20 codes)

### Step 5: Root Cause Analysis

Use decision trees to categorize issues systematically:

**Primary Classification**:
1. **System/Configuration Issue**: Pattern consistent across all months/agencies
2. **Data Quality Problem**: Specific months affected, hardcoded values present
3. **Equipment Issue**: R2/I20 rejection codes elevated
4. **Processing Bottleneck**: I3/I23 codes indicate DMV lookup delays
5. **Operational Disruption**: Correlates with known infrastructure events

For detailed root cause flowcharts, see [[DECISION-TREES.md]].

### Step 6: Deliverable Generation

#### Technical Report Components
Target Audience: CSC operators, system engineers, vendor technical teams
- Full disposition code breakdown with counts and percentages
- Daily/weekly/monthly trend analysis
- Data quality assessment with specific issues flagged
- Methodology documentation and assumptions
- Raw data extracts for validation

#### Executive Summary Components
Target Audience: Client management, stakeholder decision-makers
- **Key Findings** (3-5 bullets, prioritized by impact)
- **Root Cause Determination** (operational vs data vs equipment)
- **Financial Quantification** (revenue at risk, permanent loss, recovery opportunity)
- **Recommendations** (prioritized, actionable, with effort estimates)
- **Questions for Discussion** (strategic decisions needed)

#### Translation Principles
Convert technical findings to business language:
| Technical Finding | Executive Translation |
|-------------------|----------------------|
| "I3/I23 codes at 15-20%" | "Processing delays affecting 1 in 5 transactions, reducing payment likelihood" |
| "Reject rate 2.3% vs 1.8% baseline" | "Equipment issues causing $X preventable monthly revenue loss" |
| "78% collection at 180 days" | "System recovering industry-standard 78% of revenue within 6 months" |

## Validation Steps

Before finalizing analysis:
1. Verify total transaction counts remain static across report months
2. Confirm disposition progression is logical (no backward movement)
3. Check that percentages sum to 100% (± 0.1% for rounding)
4. Validate against prior month for consistency
5. Cross-reference with known operational events

## Integration Points

- **OpenMemory Storage**: Store identified patterns, root causes, and client-specific findings for future reference
- **TaskNote Creation**: Generate follow-up tasks for issues requiring action
- **Tracking Updates**: Add items needing ongoing monitoring to /track system
- **Meeting Preparation**: Reference findings when preparing for client meetings

## Common Pitfalls to Avoid

1. **Cumulative vs Per-Month Confusion**: Always clarify which view is needed
2. **Date Alignment Issues**: Transaction month ≠ Report month ≠ Acknowledgment date
3. **Missing Zero Values**: Agencies with no transactions may be excluded from exports
4. **Hardcoded Summaries**: Always trace summary values to detail data
5. **Equipment vs System Issues**: Check multiple agencies before concluding

## Success Metrics

Analysis is successful when:
- ✓ All data quality issues identified and documented
- ✓ Root cause determined with supporting evidence
- ✓ Financial impact quantified accurately
- ✓ Recommendations are specific and actionable
- ✓ Both technical and executive audiences can understand findings