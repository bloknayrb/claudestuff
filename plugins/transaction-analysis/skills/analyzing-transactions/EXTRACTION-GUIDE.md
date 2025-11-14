# Data Extraction and Preparation Guide

This guide provides a framework for developing data extraction scripts and preparing transaction data for analysis. While not providing actual code, it outlines the structure and considerations for building robust extraction processes.

## Script Development Framework

### Phase 1: Input Identification

#### Source Discovery Checklist
- [ ] Identify data source system (IAG, TransCore LPT, direct database)
- [ ] Determine access method (file export, API, database query)
- [ ] Document update frequency (daily, weekly, monthly)
- [ ] Note file naming conventions and locations
- [ ] Identify any access credentials or permissions needed

#### File Format Assessment
- [ ] File type (CSV, Excel, fixed-width, JSON, XML)
- [ ] Encoding (UTF-8, ASCII, Windows-1252)
- [ ] Delimiter type (comma, tab, pipe)
- [ ] Header row presence and format
- [ ] Multi-sheet or multi-file considerations

### Phase 2: Transformation Requirements

#### Field Mapping Specification

**Standard Field Mappings**:
| Source Field | Target Field | Transformation Required |
|--------------|--------------|------------------------|
| Transaction timestamp | transaction_date | Parse datetime format |
| Status codes | status_category | Map to standard categories |
| Amount fields | amount_cents | Convert to cents integer |
| Agency identifiers | agency_id | Standardize to numeric |
| Plate/Tag data | identifier_type | Classify as PLATE or AVI |

#### Data Type Conversions
- **Dates**: Identify format (MM/DD/YYYY vs YYYY-MM-DD), timezone handling
- **Numbers**: Decimal precision, thousand separators, currency symbols
- **Strings**: Trimming whitespace, case standardization, special characters
- **Booleans**: Y/N, True/False, 1/0 conversions

#### Aggregation Logic
- **Grouping levels**: By day, agency, status code, disposition
- **Calculation rules**: Sum amounts, count transactions, calculate rates
- **Hierarchy**: Transaction → Daily → Monthly → Period summaries

### Phase 3: Validation Steps

#### Data Quality Checks

**Completeness Validation**:
```
Check: All expected date ranges present
- Generate list of expected dates
- Compare against actual dates in data
- Flag any gaps or missing periods
- Document known outages or holidays
```

**Consistency Validation**:
```
Check: Transaction counts remain static
- Month X transactions in Report Month X: 100,000
- Month X transactions in Report Month X+1: 100,000 (should match)
- Month X transactions in Report Month X+2: 100,000 (should match)
- Flag if historical counts change
```

**Integrity Validation**:
```
Check: Disposition progression is logical
- Transactions shouldn't move from Final to Interim
- Sum of all dispositions equals total transactions
- Percentages sum to 100% (±0.1% for rounding)
```

#### Record Count Verification
- Source record count before transformation
- Records filtered/excluded with reasons
- Final record count after transformation
- Reconciliation report generation

### Phase 4: Output Specification

#### Target Format Requirements

**For Excel Analysis**:
- Tabular format with headers
- One row per aggregation unit
- Separate sheets for different views
- Named ranges for key data areas
- Data validation on input cells

**For Power BI Import**:
- Star schema consideration
- Fact and dimension tables
- Proper data types for each field
- Indexing key columns
- Relationship keys defined

**For Database Storage**:
- Table schema definition
- Primary and foreign keys
- Indexes for query performance
- Partitioning strategy for large datasets
- Archive strategy for historical data

### Phase 5: Error Handling

#### Exception Management Framework

**Input Errors**:
```
Handle: File not found
- Check alternate locations
- Verify naming convention
- Alert if critical file missing
- Use previous file with warning
```

**Transformation Errors**:
```
Handle: Invalid data format
- Log specific error details
- Skip record or use default value
- Count errors by type
- Generate exception report
```

**Validation Errors**:
```
Handle: Quality check failures
- Classify severity (Critical/Warning/Info)
- Continue with flags or stop processing
- Generate detailed validation report
- Email notification for critical issues
```

## Client-Specific Extraction Patterns

### VDOT Extraction Pattern

**Source Characteristics**:
- IAG Posting Status Data export
- ~41,409 records per extract
- Daily granularity with multiple agencies

**Key Transformations**:
1. Parse TagAgencyID to numeric
2. Map status codes to categories
3. Separate plate and AVI transactions
4. Calculate daily reject rates
5. Aggregate by agency and date

**Output Structure**:
```
Date | TagAgencyID | Status | PlateCount | AVICount | RejectRate
-----|-------------|--------|------------|----------|------------
```

### DelDOT Extraction Pattern

**Source Characteristics**:
- TransCore LPT monthly reports
- Manual extraction from system
- Complex disposition code structure

**Key Transformations**:
1. Pivot disposition codes to columns
2. Separate transaction month from report month
3. Calculate cumulative and per-month views
4. Generate cohort tracking structure
5. Map disposition codes to categories:
   - Success: F2-F8
   - At Risk: I6-I21
   - Processing: I2, I3, I20, I23
   - Loss: R1-R8, D3

**Output Structure**:
```
TxnMonth | ReportMonth | Cohort | Success | AtRisk | Processing | Loss
---------|-------------|--------|---------|--------|------------|------
```

### MDTA Extraction Pattern

**Source Characteristics**:
- Individual transaction records
- Multiple lookup tables (ITAG, ICLP)
- Focus on status timing

**Key Transformations**:
1. Join transaction with lookup data
2. Calculate status timing deltas
3. Identify INSU rejection patterns
4. Preserve transaction-level detail
5. Generate investigation examples

**Output Structure**:
```
TxnID | TxnTime | PostTime | StatusAtTxn | StatusAtPost | Delta | Outcome
------|---------|----------|-------------|--------------|-------|--------
```

### DRPA Extraction Pattern

**Source Characteristics**:
- IAG 1.6 format data
- Pre/post cutover comparison
- Test batch identifiers

**Key Transformations**:
1. Separate pre and post cutover data
2. Match test batches for comparison
3. Calculate compliance rates
4. Identify business rule violations
5. Generate certification metrics

**Output Structure**:
```
TestBatch | PreRate | PostRate | Delta | Compliance | Issues
----------|---------|----------|-------|------------|--------
```

## Performance Optimization Strategies

### Large Dataset Handling

**Memory Management**:
- Process in chunks (e.g., 10,000 records at a time)
- Use streaming/iterative reading
- Clear intermediate variables
- Monitor memory usage

**Processing Efficiency**:
- Parallel processing for independent operations
- Index before joining datasets
- Pre-filter unnecessary data
- Cache frequently accessed lookups

### Query Optimization

**Database Queries**:
- Use appropriate indexes
- Limit date ranges in WHERE clause
- Aggregate at database level when possible
- Use materialized views for common queries

**File Processing**:
- Read only required columns
- Filter early in the process
- Use binary formats when possible
- Compress archived data

## Script Structure Template

```
EXTRACTION SCRIPT STRUCTURE
===========================

1. CONFIGURATION SECTION
   - Input file paths
   - Output destinations
   - Processing parameters
   - Error thresholds

2. VALIDATION FUNCTIONS
   - Date range checker
   - Record count validator
   - Data quality assessor
   - Schema validator

3. TRANSFORMATION FUNCTIONS
   - Field mappers
   - Type converters
   - Aggregators
   - Category assigners

4. MAIN PROCESSING FLOW
   a. Load configuration
   b. Validate inputs exist
   c. Read source data
   d. Apply transformations
   e. Validate output quality
   f. Write results
   g. Generate reports

5. ERROR HANDLING
   - Try/catch blocks
   - Logging framework
   - Error recovery
   - Notification system

6. REPORTING
   - Processing summary
   - Error report
   - Validation report
   - Performance metrics
```

## Testing Your Extraction Process

### Unit Testing Checklist
- [ ] Test with minimal valid dataset
- [ ] Test with missing fields
- [ ] Test with invalid data types
- [ ] Test with duplicate records
- [ ] Test with empty dataset

### Integration Testing Checklist
- [ ] Test full pipeline end-to-end
- [ ] Verify output matches expected format
- [ ] Validate calculations are correct
- [ ] Confirm error handling works
- [ ] Check performance with full dataset

### Validation Testing Checklist
- [ ] Compare output to known good results
- [ ] Verify totals reconcile
- [ ] Spot-check individual records
- [ ] Validate date range coverage
- [ ] Confirm all agencies/entities included

## Common Pitfalls and Solutions

| Pitfall | Solution |
|---------|----------|
| Hardcoded file paths | Use configuration files or parameters |
| No error handling | Implement try-catch with logging |
| Memory overflow with large files | Process in chunks |
| Lost precision in calculations | Use appropriate numeric types |
| Date parsing failures | Explicitly specify format |
| Character encoding issues | Detect and handle encoding |
| Missing data not flagged | Add completeness validation |
| No audit trail | Implement comprehensive logging |

## Documentation Requirements

Your extraction script should document:

1. **Purpose**: What data it extracts and why
2. **Prerequisites**: Required access, files, or systems
3. **Parameters**: All configurable options
4. **Process Flow**: Step-by-step what it does
5. **Output Format**: Structure of results
6. **Error Handling**: How failures are managed
7. **Performance**: Expected run time and resource usage
8. **Maintenance**: How to update for new requirements

## Quick Start Checklist

Before writing your extraction script:

- [ ] Obtain sample input data files
- [ ] Define expected output format
- [ ] List all transformation rules
- [ ] Identify validation requirements
- [ ] Plan error handling approach
- [ ] Design logging strategy
- [ ] Create test datasets
- [ ] Document assumptions

## Integration with Analysis Workflow

After extraction completes:
1. Validate output quality metrics
2. Load into analysis tool (Excel/Power BI)
3. Run standard analysis reports
4. Check for anomalies or issues
5. Store processed data for historical comparison
6. Update OpenMemory with any new patterns discovered