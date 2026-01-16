---
name: iag-posting-analysis
description: Analyzes VDOT IAG Posting Status workbooks to generate agency-level rejection metrics, plate-specific analysis, and trend reports. Produces both markdown and Excel output with configurable analysis windows. Use when working with IAGPostingStatus*.xlsx files.
---

# IAG Posting Status Analysis

## Purpose

Provides quick rejection trend analysis for VDOT incoming transactions from other IAG agencies. Generates structured reports showing rejection patterns, plate-specific metrics, and agency-level breakdowns across configurable time windows.

## When to Use

Trigger this skill when:
- User mentions "IAG posting status" analysis
- Working with `IAGPostingStatus*.xlsx` files
- Need to analyze VDOT rejection trends by away agency
- Preparing agency performance reports for VDOT

## Quick Start Checklist

- [ ] Locate most recent `IAGPostingStatus*.xlsx` in data directory
- [ ] Confirm analysis window (7, 14, 30, 60, or 90 days)
- [ ] Run analysis script: `python ~/Tools/iag_posting_analysis.py <file> --window <days>`
- [ ] Review markdown report for key findings
- [ ] Deliver Excel workbook with detailed breakdowns

## Standalone Script

The analysis script is available at:
```
C:\Users\bkolb\Tools\iag_posting_analysis.py
```

**Usage:**
```bash
# Basic analysis (30-day window)
python ~/Tools/iag_posting_analysis.py IAGPostingStatus260114.xlsx

# Custom window
python ~/Tools/iag_posting_analysis.py IAGPostingStatus260114.xlsx --window 7

# Specify output directory
python ~/Tools/iag_posting_analysis.py IAGPostingStatus260114.xlsx --output-dir ./reports
```

**Outputs:**
- `IAG_Posting_Analysis_YYYYMMDD_Nday.md` - Markdown report
- `IAG_Posting_Analysis_YYYYMMDD_Nday.xlsx` - Excel workbook with 5 sheets

## Configuration Options

### Analysis Window

| Window | Use Case |
|--------|----------|
| 7 days | Weekly status checks, recent trend monitoring |
| 14 days | Bi-weekly reviews, short-term pattern detection |
| 30 days | Monthly reporting, standard analysis period |
| 60 days | Trend analysis, pattern confirmation |
| 90 days | Quarterly reviews, long-term baseline establishment |

Default: **30 days** unless user specifies otherwise.

## File Discovery

### Locate Source File

```
# Search pattern for IAG Posting Status files
IAGPostingStatus*.xlsx

# Expected filename format
IAGPostingStatus[YYMMDD].xlsx

# Example
IAGPostingStatus260114.xlsx → Data as of 2026-01-14
```

### Standard Data Location

Check these directories in order:
1. User-specified path
2. "C:\Users\bkolb\RK&K\24029-VDOT CSC Support - Coordination\IAG Posting Status Data\IAGPostingStatus260114.xlsx"
3. Downloads folder for recent files

### Extract Metadata from Filename

The filename suffix encodes the data date:
- `260114` → January 14, 2026
- Format: `YYMMDD`

## Data Schema

**Source**: Single sheet workbook, typically ~330K rows

| Column | Type | Description |
|--------|------|-------------|
| TagAgencyID | int | Away agency identifier (32 agencies) |
| facilityid | int | VDOT facility/plaza (16 facilities) |
| iagtranspostingstatus | str | Status code (POST, PPST, RJPL, etc.) |
| txdy | datetime | Transaction day |
| transpostingdate | int | Posting date (YYYYMMDD format) |
| ackday | datetime | Acknowledgment day |
| txns | int | Total transaction count |
| PlateTxns | int | Plate-only transaction count |
| PostedTx | int | Successfully posted count |
| RejTxns | int | Rejected transaction count |

### Status Codes

| Code | Description | Category |
|------|-------------|----------|
| POST | Posted successfully | Success |
| PPST | Partially posted | Success |
| NPST | Not posted - pending | Pending |
| RJPL | Rejected - plate issue | Plate Rejection |
| RJDP | Rejected - duplicate | Rejection |
| RINV | Rejected - invalid | Rejection |
| TAGB | Tag blocked | Rejection |
| ACCB | Account blocked | Rejection |
| INSU | Insufficient funds | Plate Rejection |
| OLD1 | Old format type 1 | Plate Rejection |
| OLD2 | Old format type 2 | Plate Rejection |

### Plate-Related Non-Success Statuses

Any rejection code where `PlateTxns > 0` counts as plate-related. Primary codes:
- RJPL, RJDP, INSU, TAGB, RINV, OLD1, OLD2, ACCB, NPST

## Analysis Workflow

### Step 1: Load and Validate Data

```python
# Load workbook
df = pd.read_excel(filepath)

# Validate required columns
required_cols = ['TagAgencyID', 'txdy', 'transpostingdate', 'ackday',
                 'txns', 'PlateTxns', 'RejTxns', 'iagtranspostingstatus']
assert all(col in df.columns for col in required_cols)

# Convert dates
df['txdy'] = pd.to_datetime(df['txdy'])
df['ackday'] = pd.to_datetime(df['ackday'])
df['transpostingdate'] = pd.to_datetime(df['transpostingdate'].astype(str), format='%Y%m%d')
```

### Step 2: Apply Date Window Filter

```python
# Get data end date from filename or max date in data
data_end_date = df['txdy'].max()

# Calculate window start
window_days = 30  # configurable
window_start = data_end_date - pd.Timedelta(days=window_days)

# Filter to window
df_window = df[df['txdy'] >= window_start]
```

### Step 3: Calculate Metrics

For each date metric (transpostingdate, txdy, ackday), calculate:

#### Basic Aggregation

```python
# Group by agency and date
daily = df_window.groupby(['TagAgencyID', date_col]).agg({
    'txns': 'sum',
    'RejTxns': 'sum',
    'PlateTxns': 'sum'
}).reset_index()

# Calculate rates
daily['reject_rate'] = daily['RejTxns'] / daily['txns'] * 100
```

#### Plate Rejection Rate

```python
# Filter to plate-related rejections (non-success statuses with PlateTxns > 0)
plate_rejections = df_window[
    (df_window['iagtranspostingstatus'].isin(['RJPL', 'RJDP', 'INSU', 'TAGB', 'RINV', 'OLD1', 'OLD2', 'ACCB', 'NPST'])) &
    (df_window['PlateTxns'] > 0)
]

# Calculate plate reject rate
plate_reject_rate = plate_rejections.groupby(['TagAgencyID', date_col])['PlateTxns'].sum() / \
                    daily_plate_txns * 100
```

#### Agency-Level Metrics

For each agency, calculate:

1. **Average transaction volume**: `daily['txns'].mean()`
2. **Average reject rate**: `daily['reject_rate'].mean()`
3. **Average plate reject rate**: `daily['plate_reject_rate'].mean()`
4. **Peak reject rate**: `daily['reject_rate'].max()` + date via `idxmax()`
5. **Peak plate reject rate**: `daily['plate_reject_rate'].max()` + date
6. **Top 2 plate rejection statuses**: By volume, with window average and peak

### Step 4: Generate Output

See **Output Specifications** section below.

## Output Specifications

### Markdown Report Structure

```markdown
# IAG Posting Status Analysis

**Generated**: [timestamp]
**Data Range**: [start_date] to [end_date]
**Analysis Window**: [N] days
**Source File**: [filename]

## Summary Statistics

- **Total Transactions**: X,XXX,XXX
- **Overall Reject Rate**: X.XX%
- **Plate Reject Rate**: X.XX%
- **Agencies Analyzed**: XX

## Analysis by Transaction Posting Date

| Agency | Avg Volume | Reject Rate | Plate Rej Rate | Peak Rej | Peak Plate Rej | Top Plate Rejections |
|--------|------------|-------------|----------------|----------|----------------|----------------------|
| MDTA   | 12,345     | 0.91%       | 2.3%           | 1.5% (Jan 5) | 4.2% (Jan 3) | RJPL: 1.8% (peak 3.1%), INSU: 0.4% (peak 0.9%) |
| ... | ... | ... | ... | ... | ... | ... |

## Analysis by Transaction Day

[Same table structure as above]

## Analysis by Acknowledgment Day

[Same table structure as above]

## Anomalies & Flags

- [List agencies with reject rates >2x the overall average]
- [Flag any days with unusual spikes (>3 standard deviations)]
- [Note any agencies with missing data in the window]
```

### Excel Output Structure

**Sheet 1: Summary**
- Overall statistics
- Date ranges and window configuration
- Data quality notes

**Sheet 2: By Posting Date**
- Full agency metrics table
- All metrics for each agency
- Conditional formatting for high reject rates

**Sheet 3: By Transaction Day**
- Full agency metrics table
- Same structure as Sheet 2

**Sheet 4: By Acknowledgment Day**
- Full agency metrics table
- Same structure as Sheet 2

**Sheet 5: Daily Detail**
- Raw daily aggregates by agency
- Suitable for chart creation
- Columns: Agency, Date, Txns, RejTxns, RejectRate, PlateTxns, PlateRejectRate

### Output File Naming

```
IAG_Posting_Analysis_[YYYYMMDD]_[window]day.md
IAG_Posting_Analysis_[YYYYMMDD]_[window]day.xlsx
```

Example: `IAG_Posting_Analysis_20260114_30day.xlsx`

## Metric Calculations Reference

### Reject Rate
```
RejectRate = (RejTxns / txns) × 100
```

### Plate Reject Rate
```
PlateRejectRate = (Sum of PlateTxns for non-success statuses / Total PlateTxns) × 100
```

### Peak Detection
```python
peak_date = daily_series.idxmax()  # Date of maximum value
peak_value = daily_series.max()     # Maximum value
```

### Window Average
```python
window_avg = daily_series.mean()
```

## Agency Mapping

See [[AGENCY-MAPPING.md]] for complete TagAgencyID to agency name lookup.

Key agencies typically appearing in VDOT data:
- **Agency 6**: Maryland Transportation Authority (MDTA)
- **Agency 5**: Delaware DOT (DelDOT)
- **Agency 4**: PA Turnpike Commission
- **Agency 3**: Delaware River Joint Toll Bridge Commission

## Validation Checklist

Before delivering results:

1. **Row Count Verification**: Confirm expected ~330K rows loaded
2. **Date Range Check**: Verify data spans expected period
3. **Agency Count**: Should see 28-32 agencies represented
4. **Metric Sanity**: Overall reject rate typically 0.5-2%
5. **Spot Check MDTA**: Agency 6 should show ~0.63% reject rate (historical baseline)

## Integration Points

- **Excel Skill**: Use `/xlsx` for workbook generation
- **OpenMemory**: Store analysis patterns and baselines for trend comparison
- **TaskNote Creation**: Flag agencies needing follow-up investigation
- **Tracking Updates**: Add monitoring items to `/track` for ongoing review

## Common Issues

1. **Date Format Confusion**: `transpostingdate` is stored as YYYYMMDD integer, not datetime
2. **Missing Agencies**: Some agencies may have no transactions in window period
3. **Zero Division**: Handle agencies with zero plate transactions gracefully
4. **Large File Performance**: Use chunked reading for files >500K rows

## Analysis Script

The standalone script is at `~/Tools/iag_posting_analysis.py`. See [[ANALYSIS-SCRIPT.md]] for implementation details and code documentation.
