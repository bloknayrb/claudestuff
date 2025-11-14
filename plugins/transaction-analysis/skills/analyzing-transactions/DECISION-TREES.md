# Root Cause Analysis Decision Trees

This document provides systematic decision trees for identifying root causes of transaction processing issues.

## Master Root Cause Flowchart

```
Performance Issue Detected
├─ Is pattern consistent across all months?
│   ├─ Yes → System/Configuration Issue
│   │   ├─ Affects all agencies equally?
│   │   │   ├─ Yes → System-wide configuration
│   │   │   └─ No → Agency-specific setup issue
│   │   └─ Started after specific date?
│   │       ├─ Yes → Check for system changes/upgrades
│   │       └─ No → Long-standing configuration problem
│   └─ No → Check specific periods
│       ├─ Specific months affected?
│       │   ├─ Yes → Data Quality Issue
│       │   │   ├─ Hardcoded values present?
│       │   │   │   ├─ Yes → Manual data entry error
│       │   │   │   └─ No → Export/extraction problem
│       │   │   └─ Missing data periods?
│       │   │       ├─ Yes → Data collection failure
│       │   │       └─ No → Data corruption
│       │   └─ No → Operational Issue
│       │       ├─ Correlates with known event?
│       │       │   ├─ Yes → External disruption
│       │       │   └─ No → Internal process failure
│       └─ Pattern follows daily/weekly cycle?
│           ├─ Yes → Capacity/scheduling issue
│           └─ No → Random operational variance
```

## Rejection Analysis Decision Tree

```
High Rejection Rate Detected
├─ Which rejection codes are elevated?
│   ├─ TAGB/ACCB (Tag/Account Blocked)
│   │   ├─ Specific agencies affected?
│   │   │   ├─ Yes → Interoperability issue with agency
│   │   │   └─ No → System-wide account status problem
│   │   └─ Timing pattern?
│   │       ├─ Sudden spike → Batch update error
│   │       └─ Gradual increase → Sync degradation
│   ├─ INSU (Insufficient Funds)
│   │   ├─ Tag status at transaction vs posting?
│   │   │   ├─ Different → ITAG file timing issue
│   │   │   └─ Same → Actual low balance rejections
│   │   └─ Pattern by time of day?
│   │       ├─ Yes → File processing delay
│   │       └─ No → Random distribution
│   ├─ RINV (Invalid Data)
│   │   ├─ Specific field causing rejection?
│   │   │   ├─ Special characters → Encoding issue
│   │   │   └─ Missing required fields → Integration gap
│   │   └─ Agency-specific?
│   │       ├─ Yes → Agency data format issue
│   │       └─ No → System validation problem
│   └─ R2/I20 (Image Issues)
│       ├─ Specific lanes/locations?
│       │   ├─ Yes → Equipment calibration needed
│       │   └─ No → System-wide image processing
│       └─ Weather correlation?
│           ├─ Yes → Environmental factors
│           └─ No → Equipment degradation
```

## Collection Rate Analysis Tree

```
Low Collection Rate Issue
├─ At which stage is falloff occurring?
│   ├─ Initial Processing (I2/I3)
│   │   ├─ DMV lookup delays?
│   │   │   ├─ Specific states?
│   │   │   │   ├─ Yes → State DMV system issue
│   │   │   │   └─ No → Processing capacity issue
│   │   │   └─ Volume exceeds threshold?
│   │   │       ├─ Yes → Capacity constraint
│   │   │       └─ No → System performance issue
│   │   └─ Image review backlog (I20/I23)?
│   │       ├─ Yes → Manual review bottleneck
│   │       └─ No → Automated processing failure
│   ├─ Collection Process (I6-I21)
│   │   ├─ Normal progression 30→60→90 days?
│   │   │   ├─ Yes → Expected collection curve
│   │   │   └─ No → Collection process failure
│   │   └─ Stuck at specific stage?
│   │       ├─ I6/I7 → Initial notice failure
│   │       ├─ I8/I9 → Follow-up process broken
│   │       └─ I10/I11 → Escalation not occurring
│   └─ Final Disposition (R/D codes)
│       ├─ High R1 (No vehicle owner)?
│       │   ├─ Yes → DMV data quality
│       │   └─ No → Check other R codes
│       ├─ High R3 (Government/Exempt)?
│       │   ├─ Yes → Expected based on location
│       │   └─ No → Misclassification issue
│       └─ High D3 (Dismissed)?
│           ├─ Business rule → Review criteria
│           └─ Manual → Process review needed
```

## Data Quality Decision Tree

```
Data Quality Issue Suspected
├─ What type of anomaly observed?
│   ├─ Missing Data
│   │   ├─ Entire time period missing?
│   │   │   ├─ Yes → Export/extraction failure
│   │   │   └─ No → Selective data loss
│   │   └─ Specific fields missing?
│   │       ├─ Yes → Schema/format change
│   │       └─ No → Random corruption
│   ├─ Inconsistent Values
│   │   ├─ Totals don't reconcile?
│   │   │   ├─ Hardcoded summaries → Manual entry error
│   │   │   └─ Calculated summaries → Formula error
│   │   └─ Values change for historical periods?
│   │       ├─ Yes → Retroactive adjustments
│   │       └─ No → Point-in-time issue
│   ├─ Duplicate Data
│   │   ├─ Exact duplicates?
│   │   │   ├─ Yes → Export error
│   │   │   └─ No → Processing duplication
│   │   └─ Pattern to duplicates?
│   │       ├─ Yes → Systematic issue
│   │       └─ No → Random error
│   └─ Format Issues
│       ├─ Date format problems?
│       │   ├─ Yes → Regional settings issue
│       │   └─ No → Check other formats
│       └─ Encoding issues?
│           ├─ Special characters → UTF-8/ASCII mismatch
│           └─ Truncation → Field length limits
```

## Processing Bottleneck Tree

```
Processing Delay Identified
├─ Where is the bottleneck?
│   ├─ DMV Lookups (I3/I23)
│   │   ├─ All states affected?
│   │   │   ├─ Yes → System capacity issue
│   │   │   └─ No → Check specific states
│   │   │       ├─ Maryland → Known special character issue
│   │   │       ├─ New York → Multi-agency coordination
│   │   │       └─ Other → State-specific problem
│   │   └─ Volume-based?
│   │       ├─ Peak hours only → Scheduling optimization needed
│   │       └─ Consistent → Capacity increase required
│   ├─ Image Review (I20)
│   │   ├─ Manual review queue?
│   │   │   ├─ Yes → Staffing issue
│   │   │   └─ No → Automated review failure
│   │   └─ Image quality issues?
│   │       ├─ Yes → Equipment maintenance needed
│   │       └─ No → Processing algorithm issue
│   └─ Payment Processing
│       ├─ Credit card processing delays?
│       │   ├─ Yes → Payment gateway issue
│       │   └─ No → Internal processing
│       └─ ACH/Check delays?
│           ├─ Yes → Banking integration
│           └─ No → Reconciliation backlog
```

## Comparison Analysis Tree

```
Comparing Periods/Agencies
├─ What type of comparison?
│   ├─ Year-over-Year
│   │   ├─ Seasonal patterns evident?
│   │   │   ├─ Yes → Expected variation
│   │   │   └─ No → Investigate changes
│   │   └─ Major changes?
│   │       ├─ System upgrades → Review implementation
│   │       └─ Process changes → Evaluate impact
│   ├─ Month-over-Month
│   │   ├─ Gradual trend?
│   │   │   ├─ Improving → Positive intervention
│   │   │   └─ Degrading → Growing problem
│   │   └─ Sudden change?
│   │       ├─ Yes → Specific event/change
│   │       └─ No → Natural variation
│   └─ Agency-to-Agency
│       ├─ Similar agencies different results?
│       │   ├─ Yes → Configuration difference
│       │   └─ No → Expected based on profiles
│       └─ Geographic patterns?
│           ├─ Yes → Regional factors
│           └─ No → Agency-specific issues
```

## Financial Impact Assessment

```
Determining Financial Impact
├─ What revenue category affected?
│   ├─ Permanent Loss (R codes)
│   │   ├─ Preventable losses?
│   │   │   ├─ R2 (Image) → Equipment fix = $X saved
│   │   │   └─ R4 (Timeout) → Process fix = $Y saved
│   │   └─ Unpreventable losses?
│   │       ├─ R3 (Government) → Expected loss
│   │       └─ R1 (No owner) → Acceptable threshold
│   ├─ Revenue at Risk (I codes)
│   │   ├─ Calculate time value of money
│   │   ├─ Estimate collection probability by age
│   │   └─ Project recovery timeline
│   └─ Processing Costs
│       ├─ Manual review costs
│       ├─ Collection agency fees
│       └─ System processing costs
```

## Recommendation Priority Matrix

```
Issue Identified → Determine Priority
├─ Revenue Impact
│   ├─ High (>$100K/month)
│   │   └─ Priority: CRITICAL
│   ├─ Medium ($25K-$100K/month)
│   │   └─ Priority: HIGH
│   └─ Low (<$25K/month)
│       └─ Priority: MEDIUM
├─ Implementation Effort
│   ├─ Low (Configuration change)
│   │   └─ Do immediately
│   ├─ Medium (Process update)
│   │   └─ Schedule for next sprint
│   └─ High (System modification)
│       └─ Evaluate ROI
└─ Risk Assessment
    ├─ Customer impact?
    ├─ Regulatory compliance?
    └─ Operational disruption?
```

## Quick Reference: Common Root Causes

| Symptom | Common Causes | Investigation Steps |
|---------|---------------|-------------------|
| Sudden rejection spike | System change, File format change, Agency config | Check change log, Compare file formats, Review agency settings |
| Gradual collection decline | Equipment degradation, Process drift, Staffing changes | Trend analysis, Equipment logs, Process audit |
| Agency-specific issues | Interoperability, Config differences, Data format | Compare configs, Test transactions, Review integration |
| Cyclical patterns | Batch processing, Peak loads, Scheduled maintenance | Time-based analysis, Capacity review, Schedule audit |
| Data quality issues | Manual entry, Export errors, Integration gaps | Source validation, Process review, Error logs |

## Using These Trees Effectively

1. **Start at the top**: Begin with the master flowchart
2. **Gather evidence**: Collect data to answer each decision point
3. **Document path**: Record which branches you follow and why
4. **Multiple causes**: Some issues have multiple root causes
5. **Iterate if needed**: May need multiple passes for complex issues
6. **Validate findings**: Test your conclusion with additional data

## Integration with Analysis

After identifying root cause:
1. Quantify the financial impact
2. Determine fix complexity and timeline
3. Identify who needs to act (client, vendor, operations)
4. Create follow-up TaskNotes for remediation
5. Store pattern in OpenMemory for future reference