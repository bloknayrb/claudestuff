---
name: document-review
version: 1.0.0
description: >-
  Guides structured review of toll project documents from an owner's representative
  perspective. Triggers on document review requests, vendor submittal evaluation,
  test plan assessment, O&M manual review, compliance artifact checking, or any
  toll project deliverable analysis. Covers submittals, FAT/SAT/UAT plans,
  SSAE-21/PCI-DSS reports, change requests, RFP responses, design documents,
  interface control documents (ICDs), and implementation plans. Also triggers on
  "review this," "check this document," "review this ICD," contract compliance
  verification, completeness assessment, or review comment generation.
tags:
  - toll
  - document-review
  - owner-representative
  - submittal
  - compliance
allowed-tools:
  - Read
---

# Document Review Skill — Toll Systems Owner's Representative

This skill guides a structured review of project documentation from the perspective of an
owner's representative on a toll systems program. The review process is built around a
critical first step: **classifying the document's purpose**, which determines the entire
review framework, depth, and evaluation criteria applied.

---

## Step 1: Document Classification & Purpose Determination

This is the most important step. Before reading for content, determine *what the document
is trying to accomplish*. The classification drives everything downstream — what to look
for, how deeply to read, and what standard to hold it against.

### Classification Process

Read the document's title page, table of contents, introduction/purpose section, and any
transmittal or cover letter. From these, answer three questions:

1. **Document Category** — What type of deliverable is this? (See taxonomy below)
2. **Lifecycle Phase** — Where does this fit in the project timeline?
   - Procurement (pre-award)
   - Design (preliminary, detailed, design reviews)
   - Development / Build
   - Integration Testing
   - Factory Acceptance Testing (FAT)
   - Site Acceptance Testing (SAT)
   - User Acceptance Testing (UAT)
   - Operational Readiness Review (ORR)
   - Deployment & Transition
   - Operations & Maintenance
   - Closeout
3. **Review Objective** — What is the owner's representative actually deciding?
   - Approve/reject a submittal
   - Verify compliance with contract requirements
   - Assess technical adequacy and feasibility
   - Confirm readiness for a milestone (e.g., go/no-go for testing)
   - Evaluate ongoing performance
   - Identify risks or gaps

### Document Taxonomy

Classify the document into one of these categories. Each category has a dedicated review
framework in `references/review-frameworks.md`.

| Category | Examples | Primary Review Focus |
|---|---|---|
| **System Design** | System architecture, interface design, database design, network diagrams | Technical soundness, contract compliance, interoperability |
| **Interface Control** | Interface Control Documents (ICDs), API specifications, data exchange agreements | Interface completeness, protocol definitions, partner alignment |
| **Vendor Submittal** | Hardware/software submittals, product data sheets, shop drawings | Specification compliance, substitution justification |
| **Test Documentation** | Test plans, test procedures, test cases, test reports/results | Coverage, traceability to requirements, pass/fail criteria |
| **Operations & Maintenance** | O&M manuals, SOPs, runbooks, troubleshooting guides | Completeness, usability by operations staff, accuracy |
| **Training** | Training plans, course materials, instructor guides | Audience appropriateness, coverage of system functions |
| **Implementation & Transition** | Deployment plans, cutover plans, migration strategies, rollback plans | Risk identification, sequencing, contingency planning |
| **Compliance & Audit** | SSAE-21 SOC reports, PCI-DSS evidence, security assessments | Control adequacy, gap identification, finding resolution |
| **Financial & Reconciliation** | Revenue reports, reconciliation procedures, settlement documentation | Accuracy, auditability, alignment with contract financial terms |
| **Performance & Reporting** | Monthly reports, KPI dashboards, SLA compliance reports | Accuracy, trend identification, contractual metric alignment |
| **Change Management** | Change requests, change orders, scope modification proposals | Impact assessment, cost/schedule justification, scope creep |
| **Plans & Management Docs** | QA plans, CM plans, risk management plans, project schedules | Process adequacy, alignment with contract, practicality |
| **Procurement & Proposals** | RFP responses, best & final offers, cost proposals | Evaluation criteria compliance, technical approach viability |

### Classification Output

After classification, state the findings before proceeding:

```
DOCUMENT CLASSIFICATION
- Document: [title]
- Category: [from taxonomy]
- Lifecycle Phase: [phase]
- Review Objective: [what the owner's rep is deciding]
- Review Depth: [Standard | Deep | Cursory] (see below)
- Applicable Framework: [reference to specific review checklist]
```

### Review Depth Determination

The combination of category + lifecycle phase + stakes determines review depth:

- **Deep Review** — First submittal of a design document, test plan for a critical
  milestone (SAT, UAT), compliance documentation with regulatory implications, change
  requests with significant cost/schedule impact. Read line-by-line. Every claim must be
  traceable to a requirement or supported by evidence.

- **Standard Review** — Routine monthly reports, training materials, O&M manual updates.
  Read for completeness and accuracy. Spot-check details against requirements.

- **Standard Review (Resubmittal)** — Resubmittals with tracked changes receive standard
  depth overall, but "Revise and Resubmit" resubmittals require targeted deep review on
  all revised sections and verification that every prior comment was addressed.

- **Cursory Review** — Informational submittals, meeting minutes for acknowledgment,
  minor document revisions with cosmetic changes only. Scan for completeness and flag
  anything unexpected.

---

## Step 2: Contract Alignment Check

Before evaluating content quality, verify the document meets its *contractual obligations*.
This is where the owner's rep adds value that a purely technical reviewer cannot.

Check for:

- **Deliverable Requirements** — Does the contract's submittal register or deliverable
  requirements list specify this document? Does the submitted version match the required
  format, content outline, or data item description? (Some contracts use CDRL terminology
  adopted from DoD practice.)
- **Submission Timing** — Is this submittal on schedule per the contract's deliverable
  schedule or project plan?
- **Prior Review Resolution** — If this is a resubmittal, have all prior review comments
  been addressed? Is a comment resolution matrix included?
- **Completeness Check** — Are all required sections, appendices, and attachments present
  per the deliverable specification? Are there placeholder sections or TBDs that should
  have been resolved by this submission?
- **Distribution & Approval Chain** — Is this going through the correct submittal process?

If the document being reviewed is provided without contract context, note which contract
references would be needed for a complete review and proceed with the technical evaluation.

---

## Step 3: Content Review

**Before proceeding, read the category-specific checklist.** Open
`references/review-frameworks.md` and read *only* the section matching the Document Category
from Step 1. The Table of Contents at the top maps category names to section headings. Do
not load the entire file — read the one relevant section, then return here to apply both
that checklist and the universal criteria below.

Regardless of category, every content review also evaluates these universal dimensions:

### Universal Review Criteria

1. **Completeness** — Are all required sections present? Are there placeholder sections
   or TBDs that should have been resolved?
2. **Internal Consistency** — Do figures match text? Do cross-references resolve? Are
   version numbers, dates, and document references current?
3. **Technical Accuracy** — Are technical claims supportable? Are calculations or sizing
   correct? Do proposed approaches reflect current industry practice?
4. **Clarity & Usability** — Could the intended audience (operations staff, testers,
   project managers) use this document to do their job?
5. **Requirements Traceability** — Can content be traced back to specific contract
   requirements, specifications, or standards?
6. **Risk Identification** — Does the document reveal risks not previously identified?
   Are assumptions stated and reasonable?

---

## Step 4: Generate Review Comments

Structure review findings as actionable comments. Each comment must be categorized and
traceable.

### Comment Format

```
COMMENT [sequential number]
- Section/Page: [location in document]
- Severity: [Critical | Major | Minor | Editorial]
- Category: [Completeness | Accuracy | Compliance | Clarity | Risk]
- Finding: [Specific description of the issue]
- Basis: [Contract reference, specification, standard, or technical rationale]
- Recommended Action: [What the vendor/author should do]
```

### Severity Definitions

- **Critical** — The document cannot be approved as-is. The issue affects system
  functionality, safety, contractual compliance, or represents a fundamental gap.
  Requires resubmittal.
- **Major** — Significant issue that must be resolved but does not necessarily require
  full resubmittal. May be resolved via formal response or targeted revision.
- **Minor** — Issue should be corrected but does not affect the document's fundamental
  adequacy. Can be resolved in next scheduled revision.
- **Editorial** — Typographical, formatting, or stylistic issues. Noted for correction
  but do not affect approval status.

---

## Step 5: Approval Recommendation

If the review produces Critical or Major findings that affect project milestones, note
in the recommendation which stakeholders should be coordinated with before the
disposition is finalized (e.g., project manager, subject matter experts, contract
administrator).

Conclude with an overall recommendation using standard submittal disposition codes:

| Disposition | Meaning |
|---|---|
| **Approved** | Document meets all requirements. No further action needed. |
| **Approved as Noted** | Document is acceptable with minor corrections. Corrections do not require resubmittal for review but should be incorporated. Note: agency interpretation of this disposition varies — some treat it as unconditional approval with corrections tracked separately, others require verification that notes were incorporated. |
| **Revise and Resubmit** | Document has significant issues. Vendor must address comments and resubmit for review. |
| **Rejected** | Document is fundamentally inadequate or non-compliant. Requires substantial rework and resubmittal. |

The recommendation must include:

- Total comment count by severity
- Summary of critical/major findings (if any)
- Specific conditions for approval (if "Approved as Noted" or "Revise and Resubmit")
- Whether the document blocks any project milestones

---

## Guidance for the Reviewing Model

When executing this skill:

- Always complete Step 1 before diving into content. The classification determines
  everything. If classification is skipped, a test plan may be reviewed as a design
  document or compliance angles may be missed entirely.
- Be specific in comments. "This section needs more detail" is not useful. "Section 4.2
  describes the failover process but does not specify the RTO/RPO targets required by
  Specification Section 3.5.1" is useful.
- Distinguish between genuine issues and stylistic preferences. The owner's rep role is
  to protect the owner's interests, not to rewrite the vendor's document.
- When contract context is not available, note what would be checked against and focus
  on technical adequacy and completeness.
- For test documentation, pay special attention to traceability matrices and pass/fail
  criteria. Vague acceptance criteria ("system performs adequately") are always a finding.
  Verify coverage across all test phases: integration testing, performance/load testing,
  regression testing, interoperability testing, and operational readiness review — not
  just FAT/SAT/UAT.
- For compliance documents, check that the scope of the assessment matches the toll
  system's actual boundaries and that all relevant controls are covered. Note that
  SSAE-21 governs SOC 1 reports specifically; SOC 2 reports are governed by AT-C
  Section 205 and AICPA Trust Services Criteria. Verify PCI-DSS assessments reference
  the current mandatory version.
- If the document is clearly not toll-related, apply only the universal review criteria
  from Step 3 and skip toll-specific checklist items in the category framework.
- Toll-specific items to always watch for:
  - Interoperability with other agencies (E-ZPass IAG, NIOP)
  - Image-based transaction handling — distinguish no-read rate (roadside capture
    failure) from reject rate (back-office disposition); these are separate metrics
    and vendors frequently conflate them
  - LPR/ALPR accuracy and reject rates
  - CSC and violation processing workflows
  - Pay-By-Mail (PBM) account workflows — where offered, confirm the system
    distinguishes PBM registered accounts from violation billing (different billing
    rules, replenishment models, and customer-facing workflows)
  - Financial reconciliation requirements and revenue leakage controls
  - Transponder technology compatibility
  - Cybersecurity and access control requirements
  - Data retention and privacy compliance
  - HOV/HOT managed lane classification rules (where applicable)
  - Commercial vehicle classification accuracy
