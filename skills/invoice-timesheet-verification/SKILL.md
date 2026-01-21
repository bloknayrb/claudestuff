---
name: invoice-timesheet-verification
description: Update monthly progress report invoices by cross-referencing timesheet data. Use when asked to update an invoice, verify invoice work items, reconcile timesheets with progress reports, or create defensible billing documentation. Requires invoice document (.docx) and timesheet data (images, Excel, or PDF). Prioritizes accuracy over completeness - only includes activities directly verifiable from source documents.
version: 1.0.0
tags: [invoice, timesheet, billing, verification]
---

# Invoice Timesheet Verification

Update monthly progress report invoices by systematically verifying work items against timesheet data.

## Core Principles

1. **Accuracy over completeness** - Only include activities directly verifiable from timesheets
2. **Conservative interpretation** - When in doubt, exclude rather than infer
3. **Client value filter** - Exclude administrative tasks that don't demonstrate client value
4. **Removal/addition methodology** - Don't replace existing items; remove unverified items and add newly documented ones
5. **Source language fidelity** - Use specific terminology from timesheet entries

## Workflow

### Step 1: Extract and Filter Timesheet Data

1. Identify the invoice reporting period (start and end dates)
2. Extract ALL timesheet entries from provided data
3. **Critical**: Filter to include ONLY entries within the reporting period
4. Create a working list of dated activities with staff names

### Step 2: Analyze Original Invoice

1. Read the existing invoice Work Performed section
2. List each current work item
3. Note the professional tone and formatting style

### Step 3: Systematic Verification

For each item in the original invoice:

1. Search timesheet data for supporting entries
2. **Verify match** -> Keep item (may refine language if timesheets are more specific)
3. **No match found** -> Mark for removal
4. **Partial match** -> Assess if timesheet language supports the claim

### Step 4: Identify New Items

Scan filtered timesheet entries for activities not captured in original invoice:

1. Group related entries by activity type
2. Draft work items using timesheet language
3. Apply client value filter before adding

### Step 5: Apply Client Value Filter

**Exclude** activities that don't demonstrate client value:
- Invoice preparation, billing activities
- Internal tracking and consolidation tasks
- Generic "coordination" without specific deliverables
- Status meetings without documented outcomes

**Include** activities that demonstrate project progress:
- Document reviews with specific deliverables named
- Attendance at project-specific meetings (FAT testing, coordination calls)
- Technical analysis and comments provided
- Vendor coordination with identified parties

### Step 6: Quality Control

Final verification pass:
- [ ] Every work item traces to specific timesheet entry with date
- [ ] No inferred or interpreted activities remain
- [ ] No activities outside reporting period
- [ ] Professional tone maintained
- [ ] Original structure preserved

## Output Format

Present analysis as:

```
## Analysis

**Reporting Period:** [Start Date] - [End Date]

**Items to REMOVE** (cannot be verified in timesheets):
- [Item 1] - Reason: [no supporting entry found]
- [Item 2] - Reason: [outside reporting period]

**Items to ADD** (verified in timesheets):
- [New Item 1] - Source: [Staff, Date, Entry text]
- [New Item 2] - Source: [Staff, Date, Entry text]

**Items RETAINED** (verified):
- [Existing Item] - Source: [Staff, Date, Entry text]
```

Then create updated invoice document preserving:
- Original formatting (List Paragraph style, 10pt font, bullets)
- All sections except Work Performed
- Professional document structure

## Do NOT Include

- Activities mentioned in original invoice without timesheet verification
- Broad project management statements without specific supporting entries
- Technical interpretations of vague timesheet descriptions (e.g., "networking call" != "network infrastructure coordination")
- Meeting attendance not explicitly documented
- "General" or "overall" coordination activities unless specifically listed
- Labor hour summaries (unless explicitly requested)

## Do NOT Modify

- Existing items that are adequately supported even if timesheet language differs slightly
- Overall structure or format of the original invoice
- Professional language with overly technical rewrites
- Items by replacing with more detailed versions

## Common Verification Challenges

**Ambiguous timesheet entries:**
- "Project coordination" -> Too vague; exclude unless context clarifies
- "Document review" -> Need specific document name to include
- "Calls" without context -> Cannot assume meeting type; exclude

**Similar but different activities:**
- "FAT testing" (on-site attendance) != "FAT Test Plan review" (document review)
- "SDDD review" != "DDD review" (different document types)
- Split into separate line items when timesheets show distinct activities

**Date boundary issues:**
- FAT testing in August, FAT report review in September -> May need separate items if spanning invoice periods
- Activities starting before period but continuing into period -> Include only portion within period

## Key Lesson

It is better to have a shorter, completely accurate Work Performed section than a longer one containing unverifiable or non-value-adding activities. The goal is defensibility and client relevance, not comprehensiveness.
