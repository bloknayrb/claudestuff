# Client Detection Logic

This document provides detailed decision trees and logic for automatically identifying which client's transaction data you're analyzing.

## Quick Detection Flowchart

```
Dataset Received
├─ Check for Field Names
│   ├─ Contains "TagAgencyID" field?
│   │   └─ Yes → VDOT Analysis
│   ├─ Contains disposition codes (F2-F8, I6-I21, R1-R8)?
│   │   └─ Yes → DelDOT Analysis
│   ├─ Contains "ITAG" or "ICLP" references?
│   │   └─ Yes → MDTA Analysis
│   └─ Contains "IAG 1.6" or "ICD" markers?
│       └─ Yes → DRPA Analysis
└─ Check Status Code Patterns
    ├─ POST, PPST, NPST, RINV present?
    │   └─ Yes → VDOT Analysis
    ├─ INSU rejections with tag status timing?
    │   └─ Yes → MDTA Analysis
    └─ Unable to detect → Manual identification needed
```

## Detailed Detection Criteria

### VDOT Dataset Indicators

**Primary Identifiers**:
- Field: `TagAgencyID` (integer, values like 3, 4, 5, 6, 8, 13...)
- Field: `iagtranspostingstatus` containing values:
  - POST (Posted successfully)
  - PPST (Partially posted)
  - NPST (Not posted)
  - RINV (Rejected - invalid)
  - RJDP (Rejected - duplicate)
  - RJPL (Rejected - plate)
  - TAGB (Tag blocked)
  - ACCB (Account blocked)
  - INSU (Insufficient funds)

**Secondary Identifiers**:
- Field: `TransPostingDateConv` (posting date)
- Field: `AckDateConv` (acknowledgment date)
- Separate columns for `plate_txns` and `avi_txns`
- Data source labeled as "IAG Posting Status Data"
- Approximately 41,409 records for multi-month analysis
- 29 specific Tag Agency IDs tracked

**File Name Patterns**:
- Contains "IAG" or "Posting_Status"
- May include "VDOT" or "Virginia"

### DelDOT Dataset Indicators

**Primary Identifiers**:
- Disposition code fields starting with:
  - `F` (Final dispositions: F2-F8)
  - `I` (Interim/In-process: I2-I3, I6-I21, I23)
  - `R` (Rejected: R1-R8)
  - `D` (Dismissed: D3)

**Specific Field Names**:
- "F5 - Final – DelDOT Agency ETC"
- "I7 - Interim – Past Due (30 Days)"
- "I8 - Interim – Past Due (60 Days)"
- "I9 - Interim – Past Due (90 Days)"
- "I10 - Interim – Past Due (120 Days)"
- "R2 - Final – Image Issue"

**Secondary Identifiers**:
- Fields: `Month` (transaction month)
- Fields: `As of` (report month)
- Fields: `Metric` (Count/Amount indicator)
- Data organized for cohort analysis
- TransCore LPT report format
- ~605,000 transactions per month
- US 301 references

**File Name Patterns**:
- Contains "TransCore" or "LPT"
- May include "DelDOT" or "US301"
- May include "Disposition" or "Lifecycle"

### MDTA Dataset Indicators

**Primary Identifiers**:
- INSU rejection analysis focus
- Fields referencing:
  - ITAG files (tag status files)
  - ICLP files (license plate lookups)
  - ICTX (transaction context)
- Tag status validation timestamps:
  - Status at transaction time
  - Status at posting time

**Secondary Identifiers**:
- Low balance rejection patterns
- Individual transaction investigation format
- File receipt timing analysis
- Cross-reference lookup tables
- Maryland-specific references

**Analysis Characteristics**:
- Transaction-level detail (not aggregated)
- Multiple lookup records per transaction
- Timing sequence analysis
- Status change tracking

### DRPA Dataset Indicators

**Primary Identifiers**:
- IAG 1.6 format references
- ICD 1.6 certification testing data
- Cutover date comparisons
- Business rule compliance metrics

**Secondary Identifiers**:
- Pre/post implementation metrics
- Certification test batch IDs
- Image review accuracy rates
- UO (Unmatched/Orphan) transaction handling
- Bridge crossing references

**File Characteristics**:
- Test result formats
- Compliance reports
- Cutover monitoring data
- Batch processing results

## Detection Algorithm

```python
# Pseudocode for client detection

def detect_client(dataset):
    # Check field names first (most reliable)
    fields = dataset.get_field_names()

    # VDOT check
    if 'TagAgencyID' in fields:
        return 'VDOT'

    # DelDOT check
    deldot_patterns = ['F2', 'F5', 'I7', 'I8', 'R2', 'D3']
    if any(pattern in str(fields) for pattern in deldot_patterns):
        return 'DelDOT'

    # MDTA check
    if any(term in str(fields) for term in ['ITAG', 'ICLP', 'ICTX']):
        return 'MDTA'

    # DRPA check
    if any(term in str(fields) for term in ['IAG 1.6', 'ICD', 'cutover']):
        return 'DRPA'

    # Check data values if fields inconclusive
    sample_data = dataset.get_sample_rows(100)

    # VDOT status codes
    vdot_codes = ['POST', 'PPST', 'NPST', 'RINV', 'RJDP']
    if any(code in str(sample_data) for code in vdot_codes):
        return 'VDOT'

    # Check file name as last resort
    filename = dataset.get_filename()
    if 'vdot' in filename.lower():
        return 'VDOT'
    elif 'deldot' in filename.lower() or 'us301' in filename.lower():
        return 'DelDOT'
    elif 'mdta' in filename.lower():
        return 'MDTA'
    elif 'drpa' in filename.lower():
        return 'DRPA'

    return 'UNKNOWN - Manual identification required'
```

## Manual Identification Checklist

If automatic detection fails, check:

1. **Ask about data source**:
   - Which agency/client provided this data?
   - What system generated this export?
   - What time period does it cover?

2. **Examine column headers**:
   - Look for agency-specific terminology
   - Check for disposition vs status codes
   - Identify date field naming conventions

3. **Review data volumes**:
   - VDOT: ~40K records for multi-agency analysis
   - DelDOT: ~600K monthly transactions
   - MDTA: Individual transaction investigations
   - DRPA: Test batch sizes vary

4. **Check documentation**:
   - Email subject lines often indicate client
   - File paths may contain client folders
   - Associated TaskNotes reference client

## Validation After Detection

Once client is identified, validate by checking:

### VDOT Validation
- Confirm 29 Tag Agencies are represented
- Verify status codes match expected set
- Check for plate/AVI transaction split

### DelDOT Validation
- Confirm disposition codes sum to total transactions
- Verify cohort month structure present
- Check for cumulative vs per-month format

### MDTA Validation
- Confirm individual transaction IDs present
- Verify lookup timestamp sequences
- Check for tag status change tracking

### DRPA Validation
- Confirm pre/post comparison structure
- Verify test batch identifiers
- Check for compliance metrics

## Edge Cases

1. **Mixed Client Data**: If dataset contains multiple clients, separate before analysis
2. **Test Data**: May have different structure than production
3. **Historical Formats**: Older exports may use different field names
4. **Partial Exports**: May be missing identifying fields
5. **Summary Reports**: May lack detail needed for detection

## When Detection Fails

If unable to auto-detect:
1. Prompt user to specify client
2. Ask for sample of column headers
3. Request context about data source
4. Check recent emails/tasks for client context