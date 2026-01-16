# IAG Posting Status Analysis Script

This document provides the complete Python implementation template for analyzing VDOT IAG Posting Status workbooks.

## Complete Analysis Script

```python
"""
IAG Posting Status Analysis Script
Analyzes VDOT IAG Posting Status workbooks to generate agency-level rejection metrics.

Usage:
    python iag_posting_analysis.py <input_file> [--window DAYS] [--output-dir DIR]

Example:
    python iag_posting_analysis.py IAGPostingStatus260114.xlsx --window 30
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import argparse
import sys

# =============================================================================
# AGENCY MAPPING
# =============================================================================

AGENCY_MAPPING = {
    3: ('DRJTBC', 'Delaware River Joint Toll Bridge Commission'),
    4: ('PTC', 'Pennsylvania Turnpike Commission'),
    5: ('DelDOT', 'Delaware Department of Transportation'),
    6: ('MDTA', 'Maryland Transportation Authority'),
    8: ('NYSTA', 'New York State Thruway Authority'),
    10: ('MTA', 'Metropolitan Transportation Authority'),
    13: ('NJTA', 'New Jersey Turnpike Authority'),
    15: ('SJTA', 'South Jersey Transportation Authority'),
    16: ('DRPA', 'Delaware River Port Authority'),
    18: ('PANYNJ', 'Port Authority of New York and New Jersey'),
    20: ('NHDOT', 'New Hampshire Department of Transportation'),
    22: ('MassDOT', 'Massachusetts Department of Transportation'),
    24: ('RIDOT', 'Rhode Island Department of Transportation'),
    26: ('MaineDOT', 'Maine Department of Transportation'),
    28: ('WVTA', 'West Virginia Turnpike Authority'),
    30: ('KYTC', 'Kentucky Transportation Cabinet'),
    32: ('ITA', 'Illinois Tollway Authority'),
    34: ('OOCEA', 'Orlando-Orange County Expressway Authority'),
    36: ('FDOT', 'Florida Department of Transportation'),
    38: ('CFX', 'Central Florida Expressway Authority'),
    40: ('HCTRA', 'Harris County Toll Road Authority'),
    42: ('NTTA', 'North Texas Tollway Authority'),
    44: ('TxDOT', 'Texas Department of Transportation'),
    46: ('CTRMA', 'Central Texas Regional Mobility Authority'),
    48: ('GCRTA', 'Greater Cleveland RTA'),
    50: ('ODOT', 'Ohio Department of Transportation'),
    52: ('INDOT', 'Indiana Department of Transportation'),
    54: ('NCTCOG', 'North Central Texas Council of Governments'),
    56: ('NCTA', 'North Carolina Turnpike Authority'),
    58: ('GDOT', 'Georgia Department of Transportation'),
    60: ('VDOT', 'Virginia Department of Transportation'),
    62: ('SRT', 'State Road & Tollway Authority'),
}

# Plate-related non-success status codes
PLATE_REJECTION_CODES = ['RJPL', 'RJDP', 'INSU', 'TAGB', 'RINV', 'OLD1', 'OLD2', 'ACCB', 'NPST']

# Success status codes
SUCCESS_CODES = ['POST', 'PPST']


def get_agency_name(tag_agency_id: int, use_code: bool = True) -> str:
    """Get agency name from TagAgencyID."""
    if tag_agency_id in AGENCY_MAPPING:
        code, full_name = AGENCY_MAPPING[tag_agency_id]
        return code if use_code else full_name
    return f'Unknown ({tag_agency_id})'


# =============================================================================
# DATA LOADING
# =============================================================================

def load_data(filepath: Path) -> pd.DataFrame:
    """
    Load and validate IAG Posting Status workbook.

    Args:
        filepath: Path to IAGPostingStatus*.xlsx file

    Returns:
        DataFrame with validated data
    """
    print(f"Loading {filepath.name}...")

    # Load Excel file
    df = pd.read_excel(filepath, engine='openpyxl')

    # Validate required columns
    required_cols = [
        'TagAgencyID', 'facilityid', 'iagtranspostingstatus',
        'txdy', 'transpostingdate', 'ackday',
        'txns', 'PlateTxns', 'PostedTx', 'RejTxns'
    ]

    missing = [col for col in required_cols if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Convert date columns
    df['txdy'] = pd.to_datetime(df['txdy'])
    df['ackday'] = pd.to_datetime(df['ackday'])

    # Convert transpostingdate from YYYYMMDD integer to datetime
    df['transpostingdate'] = pd.to_datetime(
        df['transpostingdate'].astype(str),
        format='%Y%m%d',
        errors='coerce'
    )

    # Add agency name columns
    df['AgencyCode'] = df['TagAgencyID'].apply(lambda x: get_agency_name(x, use_code=True))
    df['AgencyName'] = df['TagAgencyID'].apply(lambda x: get_agency_name(x, use_code=False))

    print(f"Loaded {len(df):,} rows")
    print(f"Date range: {df['txdy'].min().date()} to {df['txdy'].max().date()}")
    print(f"Agencies: {df['TagAgencyID'].nunique()}")

    return df


def extract_date_from_filename(filename: str) -> datetime:
    """
    Extract data date from filename suffix (YYMMDD format).

    Args:
        filename: e.g., 'IAGPostingStatus260114.xlsx'

    Returns:
        datetime object
    """
    # Extract 6-digit suffix before .xlsx
    import re
    match = re.search(r'(\d{6})\.xlsx$', filename, re.IGNORECASE)
    if match:
        date_str = match.group(1)
        # Parse YYMMDD
        year = 2000 + int(date_str[:2])
        month = int(date_str[2:4])
        day = int(date_str[4:6])
        return datetime(year, month, day)
    return datetime.now()


# =============================================================================
# METRIC CALCULATIONS
# =============================================================================

def calculate_daily_metrics(df: pd.DataFrame, date_col: str) -> pd.DataFrame:
    """
    Calculate daily metrics grouped by agency and specified date column.

    Args:
        df: Source DataFrame
        date_col: Column to use for date grouping ('txdy', 'transpostingdate', 'ackday')

    Returns:
        DataFrame with daily metrics per agency
    """
    # Basic daily aggregation
    daily = df.groupby(['TagAgencyID', 'AgencyCode', date_col]).agg({
        'txns': 'sum',
        'RejTxns': 'sum',
        'PlateTxns': 'sum',
        'PostedTx': 'sum'
    }).reset_index()

    # Calculate reject rate
    daily['reject_rate'] = np.where(
        daily['txns'] > 0,
        daily['RejTxns'] / daily['txns'] * 100,
        0
    )

    # Calculate plate rejection metrics
    plate_rej = df[
        (df['iagtranspostingstatus'].isin(PLATE_REJECTION_CODES)) &
        (df['PlateTxns'] > 0)
    ].groupby(['TagAgencyID', date_col])['PlateTxns'].sum().reset_index()
    plate_rej.columns = ['TagAgencyID', date_col, 'PlateRejTxns']

    # Merge plate rejections
    daily = daily.merge(plate_rej, on=['TagAgencyID', date_col], how='left')
    daily['PlateRejTxns'] = daily['PlateRejTxns'].fillna(0)

    # Calculate plate reject rate
    daily['plate_reject_rate'] = np.where(
        daily['PlateTxns'] > 0,
        daily['PlateRejTxns'] / daily['PlateTxns'] * 100,
        0
    )

    return daily


def calculate_agency_metrics(daily: pd.DataFrame, date_col: str) -> pd.DataFrame:
    """
    Calculate agency-level summary metrics from daily data.

    Args:
        daily: Daily metrics DataFrame
        date_col: Date column name for peak date reference

    Returns:
        DataFrame with one row per agency
    """
    results = []

    for agency_id in daily['TagAgencyID'].unique():
        agency_data = daily[daily['TagAgencyID'] == agency_id].copy()
        agency_code = agency_data['AgencyCode'].iloc[0]

        # Basic metrics
        avg_volume = agency_data['txns'].mean()
        avg_reject_rate = agency_data['reject_rate'].mean()
        avg_plate_reject_rate = agency_data['plate_reject_rate'].mean()

        # Peak reject rate
        peak_rej_idx = agency_data['reject_rate'].idxmax()
        peak_reject_rate = agency_data.loc[peak_rej_idx, 'reject_rate']
        peak_reject_date = agency_data.loc[peak_rej_idx, date_col]

        # Peak plate reject rate
        if agency_data['PlateTxns'].sum() > 0:
            peak_plate_idx = agency_data['plate_reject_rate'].idxmax()
            peak_plate_reject_rate = agency_data.loc[peak_plate_idx, 'plate_reject_rate']
            peak_plate_reject_date = agency_data.loc[peak_plate_idx, date_col]
        else:
            peak_plate_reject_rate = 0
            peak_plate_reject_date = None

        results.append({
            'TagAgencyID': agency_id,
            'AgencyCode': agency_code,
            'AvgVolume': avg_volume,
            'AvgRejectRate': avg_reject_rate,
            'AvgPlateRejectRate': avg_plate_reject_rate,
            'PeakRejectRate': peak_reject_rate,
            'PeakRejectDate': peak_reject_date,
            'PeakPlateRejectRate': peak_plate_reject_rate,
            'PeakPlateRejectDate': peak_plate_reject_date
        })

    return pd.DataFrame(results)


def calculate_top_plate_rejections(df: pd.DataFrame, date_col: str,
                                    window_start: datetime, n_top: int = 2) -> dict:
    """
    Calculate top N plate-related rejection statuses per agency.

    Args:
        df: Source DataFrame filtered to window
        date_col: Date column for grouping
        window_start: Start of analysis window
        n_top: Number of top rejection types to return

    Returns:
        Dict mapping agency_id to list of (status, avg, peak) tuples
    """
    # Filter to plate rejections
    plate_rej = df[
        (df['iagtranspostingstatus'].isin(PLATE_REJECTION_CODES)) &
        (df['PlateTxns'] > 0)
    ].copy()

    results = {}

    for agency_id in df['TagAgencyID'].unique():
        agency_rej = plate_rej[plate_rej['TagAgencyID'] == agency_id]

        if len(agency_rej) == 0:
            results[agency_id] = []
            continue

        # Aggregate by status
        status_totals = agency_rej.groupby('iagtranspostingstatus')['PlateTxns'].sum()
        top_statuses = status_totals.nlargest(n_top).index.tolist()

        top_list = []
        for status in top_statuses:
            status_data = agency_rej[agency_rej['iagtranspostingstatus'] == status]

            # Daily rates for this status
            status_daily = status_data.groupby(date_col)['PlateTxns'].sum()

            # Total plate txns per day for this agency
            agency_total = df[df['TagAgencyID'] == agency_id].groupby(date_col)['PlateTxns'].sum()

            # Calculate rate
            daily_rate = status_daily / agency_total * 100
            daily_rate = daily_rate.fillna(0)

            avg_rate = daily_rate.mean()
            peak_rate = daily_rate.max()

            top_list.append({
                'status': status,
                'avg_rate': avg_rate,
                'peak_rate': peak_rate
            })

        results[agency_id] = top_list

    return results


# =============================================================================
# OUTPUT GENERATION
# =============================================================================

def format_top_rejections(top_rej_list: list) -> str:
    """Format top rejections for table display."""
    if not top_rej_list:
        return 'N/A'

    parts = []
    for item in top_rej_list:
        parts.append(f"{item['status']}: {item['avg_rate']:.1f}% (peak {item['peak_rate']:.1f}%)")

    return ', '.join(parts)


def generate_markdown_report(
    source_file: str,
    data_range: tuple,
    window_days: int,
    summary_stats: dict,
    metrics_by_posting: pd.DataFrame,
    metrics_by_txday: pd.DataFrame,
    metrics_by_ackday: pd.DataFrame,
    top_rejections_posting: dict,
    top_rejections_txday: dict,
    top_rejections_ackday: dict,
    anomalies: list
) -> str:
    """Generate markdown report content."""

    report = []
    report.append("# IAG Posting Status Analysis\n")
    report.append(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    report.append(f"**Data Range**: {data_range[0].strftime('%Y-%m-%d')} to {data_range[1].strftime('%Y-%m-%d')}")
    report.append(f"**Analysis Window**: {window_days} days")
    report.append(f"**Source File**: {source_file}\n")

    # Summary Statistics
    report.append("## Summary Statistics\n")
    report.append(f"- **Total Transactions**: {summary_stats['total_txns']:,.0f}")
    report.append(f"- **Overall Reject Rate**: {summary_stats['overall_reject_rate']:.2f}%")
    report.append(f"- **Plate Reject Rate**: {summary_stats['plate_reject_rate']:.2f}%")
    report.append(f"- **Agencies Analyzed**: {summary_stats['agency_count']}\n")

    # Helper to generate table
    def generate_table(metrics_df: pd.DataFrame, top_rej: dict, title: str) -> list:
        lines = []
        lines.append(f"## {title}\n")
        lines.append("| Agency | Avg Volume | Reject Rate | Plate Rej Rate | Peak Rej | Peak Plate Rej | Top Plate Rejections |")
        lines.append("|--------|------------|-------------|----------------|----------|----------------|----------------------|")

        for _, row in metrics_df.sort_values('AvgVolume', ascending=False).iterrows():
            agency = row['AgencyCode']
            avg_vol = f"{row['AvgVolume']:,.0f}"
            rej_rate = f"{row['AvgRejectRate']:.2f}%"
            plate_rej = f"{row['AvgPlateRejectRate']:.2f}%"

            peak_rej_date = row['PeakRejectDate']
            peak_rej = f"{row['PeakRejectRate']:.2f}%"
            if pd.notna(peak_rej_date):
                peak_rej += f" ({peak_rej_date.strftime('%b %d')})"

            peak_plate_date = row['PeakPlateRejectDate']
            peak_plate = f"{row['PeakPlateRejectRate']:.2f}%"
            if pd.notna(peak_plate_date):
                peak_plate += f" ({peak_plate_date.strftime('%b %d')})"

            top_rej_str = format_top_rejections(top_rej.get(row['TagAgencyID'], []))

            lines.append(f"| {agency} | {avg_vol} | {rej_rate} | {plate_rej} | {peak_rej} | {peak_plate} | {top_rej_str} |")

        lines.append("")
        return lines

    # Three tables by date metric
    report.extend(generate_table(metrics_by_posting, top_rejections_posting, "Analysis by Transaction Posting Date"))
    report.extend(generate_table(metrics_by_txday, top_rejections_txday, "Analysis by Transaction Day"))
    report.extend(generate_table(metrics_by_ackday, top_rejections_ackday, "Analysis by Acknowledgment Day"))

    # Anomalies section
    report.append("## Anomalies & Flags\n")
    if anomalies:
        for anomaly in anomalies:
            report.append(f"- {anomaly}")
    else:
        report.append("- No significant anomalies detected")

    return '\n'.join(report)


def generate_excel_workbook(
    output_path: Path,
    summary_stats: dict,
    metrics_by_posting: pd.DataFrame,
    metrics_by_txday: pd.DataFrame,
    metrics_by_ackday: pd.DataFrame,
    daily_detail: pd.DataFrame,
    data_range: tuple,
    window_days: int,
    source_file: str
):
    """Generate Excel workbook with all analysis results."""

    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        # Sheet 1: Summary
        summary_df = pd.DataFrame([
            ('Report Generated', datetime.now().strftime('%Y-%m-%d %H:%M')),
            ('Data Start', data_range[0].strftime('%Y-%m-%d')),
            ('Data End', data_range[1].strftime('%Y-%m-%d')),
            ('Analysis Window (days)', window_days),
            ('Source File', source_file),
            ('', ''),
            ('Total Transactions', f"{summary_stats['total_txns']:,.0f}"),
            ('Overall Reject Rate', f"{summary_stats['overall_reject_rate']:.2f}%"),
            ('Plate Reject Rate', f"{summary_stats['plate_reject_rate']:.2f}%"),
            ('Agencies Analyzed', summary_stats['agency_count'])
        ], columns=['Metric', 'Value'])
        summary_df.to_excel(writer, sheet_name='Summary', index=False)

        # Sheet 2: By Posting Date
        metrics_by_posting.to_excel(writer, sheet_name='By Posting Date', index=False)

        # Sheet 3: By Transaction Day
        metrics_by_txday.to_excel(writer, sheet_name='By Transaction Day', index=False)

        # Sheet 4: By Acknowledgment Day
        metrics_by_ackday.to_excel(writer, sheet_name='By Ack Day', index=False)

        # Sheet 5: Daily Detail
        daily_detail.to_excel(writer, sheet_name='Daily Detail', index=False)

    print(f"Excel workbook saved: {output_path}")


# =============================================================================
# ANOMALY DETECTION
# =============================================================================

def detect_anomalies(df: pd.DataFrame, metrics_df: pd.DataFrame) -> list:
    """Detect anomalies in the data."""
    anomalies = []

    # Calculate overall average reject rate
    overall_avg = metrics_df['AvgRejectRate'].mean()

    # Flag agencies with >2x average reject rate
    high_rej = metrics_df[metrics_df['AvgRejectRate'] > overall_avg * 2]
    for _, row in high_rej.iterrows():
        anomalies.append(
            f"Agency {row['AgencyCode']} has elevated reject rate "
            f"({row['AvgRejectRate']:.2f}% vs {overall_avg:.2f}% average)"
        )

    # Check for missing agencies (common agencies that should be present)
    expected_agencies = [4, 5, 6, 13, 16]  # PTC, DelDOT, MDTA, NJTA, DRPA
    missing = [a for a in expected_agencies if a not in df['TagAgencyID'].unique()]
    if missing:
        missing_names = [get_agency_name(a) for a in missing]
        anomalies.append(f"Expected agencies missing from data: {', '.join(missing_names)}")

    return anomalies


# =============================================================================
# MAIN ANALYSIS
# =============================================================================

def run_analysis(input_file: Path, window_days: int = 30, output_dir: Path = None):
    """
    Run complete IAG Posting Status analysis.

    Args:
        input_file: Path to IAGPostingStatus*.xlsx
        window_days: Analysis window in days (7, 14, 30, 60, 90)
        output_dir: Directory for output files (default: same as input)
    """
    # Setup output directory
    if output_dir is None:
        output_dir = input_file.parent

    # Load data
    df = load_data(input_file)

    # Determine date range and apply window filter
    data_end_date = df['txdy'].max()
    window_start = data_end_date - pd.Timedelta(days=window_days)

    print(f"\nAnalysis window: {window_start.date()} to {data_end_date.date()} ({window_days} days)")

    df_window = df[df['txdy'] >= window_start].copy()
    print(f"Filtered to {len(df_window):,} rows in window")

    # Calculate summary statistics
    summary_stats = {
        'total_txns': df_window['txns'].sum(),
        'overall_reject_rate': df_window['RejTxns'].sum() / df_window['txns'].sum() * 100,
        'plate_reject_rate': (
            df_window[df_window['iagtranspostingstatus'].isin(PLATE_REJECTION_CODES)]['PlateTxns'].sum() /
            df_window['PlateTxns'].sum() * 100
        ) if df_window['PlateTxns'].sum() > 0 else 0,
        'agency_count': df_window['TagAgencyID'].nunique()
    }

    print(f"\nSummary: {summary_stats['total_txns']:,.0f} txns, "
          f"{summary_stats['overall_reject_rate']:.2f}% reject rate")

    # Calculate metrics by each date type
    print("\nCalculating metrics by Transaction Posting Date...")
    daily_posting = calculate_daily_metrics(df_window, 'transpostingdate')
    metrics_posting = calculate_agency_metrics(daily_posting, 'transpostingdate')
    top_rej_posting = calculate_top_plate_rejections(df_window, 'transpostingdate', window_start)

    print("Calculating metrics by Transaction Day...")
    daily_txday = calculate_daily_metrics(df_window, 'txdy')
    metrics_txday = calculate_agency_metrics(daily_txday, 'txdy')
    top_rej_txday = calculate_top_plate_rejections(df_window, 'txdy', window_start)

    print("Calculating metrics by Acknowledgment Day...")
    daily_ackday = calculate_daily_metrics(df_window, 'ackday')
    metrics_ackday = calculate_agency_metrics(daily_ackday, 'ackday')
    top_rej_ackday = calculate_top_plate_rejections(df_window, 'ackday', window_start)

    # Detect anomalies
    anomalies = detect_anomalies(df_window, metrics_posting)

    # Generate outputs
    data_date = extract_date_from_filename(input_file.name)
    date_suffix = data_date.strftime('%Y%m%d')

    # Markdown report
    md_content = generate_markdown_report(
        source_file=input_file.name,
        data_range=(window_start, data_end_date),
        window_days=window_days,
        summary_stats=summary_stats,
        metrics_by_posting=metrics_posting,
        metrics_by_txday=metrics_txday,
        metrics_by_ackday=metrics_ackday,
        top_rejections_posting=top_rej_posting,
        top_rejections_txday=top_rej_txday,
        top_rejections_ackday=top_rej_ackday,
        anomalies=anomalies
    )

    md_path = output_dir / f"IAG_Posting_Analysis_{date_suffix}_{window_days}day.md"
    md_path.write_text(md_content, encoding='utf-8')
    print(f"\nMarkdown report saved: {md_path}")

    # Excel workbook
    xlsx_path = output_dir / f"IAG_Posting_Analysis_{date_suffix}_{window_days}day.xlsx"
    generate_excel_workbook(
        output_path=xlsx_path,
        summary_stats=summary_stats,
        metrics_by_posting=metrics_posting,
        metrics_by_txday=metrics_txday,
        metrics_by_ackday=metrics_ackday,
        daily_detail=daily_txday,  # Use txday for daily detail
        data_range=(window_start, data_end_date),
        window_days=window_days,
        source_file=input_file.name
    )

    print("\nAnalysis complete!")
    return md_path, xlsx_path


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Analyze VDOT IAG Posting Status workbooks'
    )
    parser.add_argument('input_file', type=Path, help='IAGPostingStatus*.xlsx file')
    parser.add_argument('--window', type=int, default=30,
                        choices=[7, 14, 30, 60, 90],
                        help='Analysis window in days (default: 30)')
    parser.add_argument('--output-dir', type=Path, default=None,
                        help='Output directory (default: same as input)')

    args = parser.parse_args()

    if not args.input_file.exists():
        print(f"Error: File not found: {args.input_file}")
        sys.exit(1)

    run_analysis(args.input_file, args.window, args.output_dir)


if __name__ == '__main__':
    main()
```

## Usage Examples

### Basic Analysis (30-day window)

```bash
python iag_posting_analysis.py IAGPostingStatus260114.xlsx
```

### Custom Window

```bash
# Weekly review
python iag_posting_analysis.py IAGPostingStatus260114.xlsx --window 7

# Quarterly analysis
python iag_posting_analysis.py IAGPostingStatus260114.xlsx --window 90
```

### Specify Output Directory

```bash
python iag_posting_analysis.py IAGPostingStatus260114.xlsx --output-dir ./reports
```

## Integration with Claude Code

When using this skill, Claude should:

1. **Locate the source file** using glob patterns
2. **Prompt for analysis window** if not specified
3. **Run the analysis** using the script template above
4. **Review outputs** and highlight key findings
5. **Store insights** to OpenMemory for trend comparison

### Example Claude Interaction

```
User: Analyze the latest IAG posting status data

Claude: I'll analyze the VDOT IAG Posting Status data. Let me find the most recent file.

[Searches for IAGPostingStatus*.xlsx]

Found: IAGPostingStatus260114.xlsx (January 14, 2026 data)

What analysis window would you like?
- 7 days (weekly snapshot)
- 14 days (bi-weekly)
- 30 days (monthly - recommended)
- 60 days (trend analysis)
- 90 days (quarterly review)

User: 30 days

Claude: Running 30-day analysis...

[Executes analysis, generates report]

Analysis complete. Key findings:
- Overall reject rate: 0.87% (within normal range)
- MDTA (Agency 6) showing slightly elevated plate rejections at 1.2%
- Top rejection type: RJPL at 0.6% average (peak 1.1% on Jan 8)

Reports generated:
- IAG_Posting_Analysis_20260114_30day.md
- IAG_Posting_Analysis_20260114_30day.xlsx
```

## Validation Checklist

Before delivering analysis:

- [ ] Confirm ~330K rows loaded from source file
- [ ] Verify date range spans expected period
- [ ] Check agency count (expect 28-32 agencies)
- [ ] Validate MDTA (Agency 6) shows ~0.5-1.0% reject rate
- [ ] Ensure no division by zero errors in calculations
- [ ] Confirm both markdown and Excel outputs generated
