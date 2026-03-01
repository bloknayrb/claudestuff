# Review Frameworks by Document Category

This file contains category-specific review checklists. Load the relevant section based
on the document classification from Step 1.

## Table of Contents

1. [System Design Documents](#system-design-documents)
2. [Interface Control Documents](#interface-control-documents)
3. [Vendor Submittals](#vendor-submittals)
4. [Test Documentation](#test-documentation)
5. [Operations & Maintenance Documentation](#operations--maintenance-documentation)
6. [Training Documentation](#training-documentation)
7. [Implementation & Transition Plans](#implementation--transition-plans)
8. [Compliance & Audit Documentation](#compliance--audit-documentation)
9. [Financial & Reconciliation Documentation](#financial--reconciliation-documentation)
10. [Performance & Reporting](#performance--reporting)
11. [Change Management](#change-management)
12. [Plans & Management Documents](#plans--management-documents)
13. [Procurement & Proposals](#procurement--proposals)

---

## System Design Documents

Applies to: system architecture, interface design, database design, network topology,
software design documents, detailed design documents.

### Review Checklist

**Architecture & Approach**
- Does the design satisfy all functional requirements in the contract/specification?
- Are design decisions justified with rationale (not just stated)?
- Is the architecture scalable to handle projected traffic volumes and transaction growth?
- Are single points of failure identified and mitigated?
- Does the design account for system redundancy and high availability requirements?

**Interfaces & Integration**
- Are all external interfaces defined (other toll agencies, DMV, payment processors,
  CSC systems, violation processing, financial systems, law enforcement databases,
  collections agencies, rental car companies via ACRA framework, retail payment networks)?
- Do interface specifications include data formats, protocols, frequency, and error
  handling?
- Is interoperability with regional/national interoperability hubs addressed? Note:
  E-ZPass IAG and NIOP coexist with distinct scopes — IAG governs E-ZPass hub operations
  and business rules, while NIOP defines the national interoperability framework. The
  design should address both as applicable to the project's interoperability requirements.
- Are API specifications versioned and consistent with the integration architecture?

**Toll-Specific Technical Items**
- Does the design address all transaction types? Electronic (transponder/AVI) and video
  (image-based) are fundamentally different paths — AVI is automatic vehicle identification
  via transponder, while video relies on camera capture when no transponder is read. The
  design should clearly distinguish these paths and address mixed/partial reads.
- Is the image capture and OCR/ALPR pipeline described with performance specifications?
- Are roadside controller / toll point controller and roadside equipment interfaces fully
  specified? (In AET environments, these replace legacy barrier-lane "lane controller"
  concepts.)
- Does the design address real-time vs. batch processing boundaries?
- Are financial reconciliation touchpoints identified?
- Is the violation processing workflow (notice generation, escalation, DMV holds)
  accounted for?

**Standards & Compliance**
- Does the design reference applicable standards (IEEE, ISO, NIST, PCI-DSS)? For
  roadside systems in DOT environments, also check for NTCIP (National Transportation
  Communications for ITS Protocol) compliance requirements.
- Are security architecture elements (encryption, access control, audit logging)
  addressed?
- Does the design comply with accessibility requirements (ADA, Section 508)?
- For cloud-hosted toll systems, are FedRAMP requirements addressed where applicable?

**Clarity & Traceability**
- Is there a requirements traceability matrix mapping design elements to specification
  requirements?
- Are diagrams clear, labeled, and consistent with the narrative?
- Are assumptions and constraints explicitly stated?

---

## Interface Control Documents

Applies to: ICDs, API specifications, data exchange agreements, interface design
documents, message format specifications.

### Review Checklist

- Are all system-to-system interfaces identified and documented?
- For each interface: are data formats, protocols, transport mechanisms, message
  schemas, and error handling fully specified?
- Are interface responsibilities clearly assigned (which system initiates, which
  responds, who owns error recovery)?
- Are performance requirements stated (latency, throughput, availability)?
- Are security requirements specified (authentication, encryption, certificate
  management)?
- Is versioning strategy defined for API and message format changes?
- Are test/certification requirements for interface partners documented?

**Toll-Specific Interface Items**
- Are interoperability hub interfaces (E-ZPass IAG, NIOP) fully specified with current
  message formats and settlement protocols?
- Are image transfer interfaces specified (format, resolution, compression, metadata)?
- Are financial settlement and reconciliation interfaces defined with frequency, format,
  and exception handling?

---

## Vendor Submittals

Applies to: hardware submittals, software version submittals, product data sheets,
equipment specifications, material certifications, shop drawings.

### Review Checklist

**Specification Compliance**
- Does the submitted product meet or exceed all specification requirements?
- If the product deviates from the specification, is a formal substitution request
  included with justification?
- Are all required certifications and test reports included (UL listing, FCC compliance,
  environmental ratings)? For roadside enclosures, confirm the rating matches the
  specification: NEMA 4 covers water resistance; NEMA 4X adds corrosion resistance
  (appropriate for coastal or road-salt environments). Many modern specifications also
  require IEC 60529 IP66/IP67 ratings — verify the submittal addresses whichever
  rating system the contract specifies.
- Do performance specifications (MTBF, operating temperature range, power consumption)
  meet contract requirements?

**Product Documentation**
- Are manufacturer data sheets included for all major components?
- Are installation requirements (power, mounting, environmental) documented?
- Are warranty terms stated and consistent with contract requirements?
- Is end-of-life/end-of-support information provided?

**Toll-Specific Hardware**
- For roadside/toll point equipment: Does the submittal address mounting, alignment,
  and field of view for the specific roadway geometry?
- For cameras/ALPR: Are resolution, frame rate, and illumination specifications adequate
  for the posted speed and lane configuration?
- For transponder readers: Are read range, read rate, and multi-protocol support
  addressed? ISO 18000-63 (6C/UHF EPC Gen2) is the current standard; ISO 18000-6B
  is legacy. For E-ZPass-region deployments, readers must also support the IAG
  transponder protocol (915 MHz proprietary), which is distinct from ISO 6C — a
  reader certified only for 6C may not read legacy E-ZPass transponders. SeGo applies
  to specific regional deployments (Kapsch/European-origin systems). Where the agency
  issues sticker transponders, confirm sticker read performance is separately addressed.
- For roadside controllers: Are I/O specifications sufficient for all connected devices?
- For network equipment: Does the design account for bandwidth requirements including
  image transfer?

**Software Submittals**
- Is the software version clearly identified?
- Are release notes included describing changes from the prior version?
- Has the software been tested in a representative environment?
- Are known issues/limitations documented?
- Are third-party component licenses and versions identified?

---

## Test Documentation

Applies to: test plans, test procedures, test cases, test scripts, test reports,
Factory Acceptance Test (FAT), Site Acceptance Test (SAT), User Acceptance Test (UAT),
integration test plans, performance/load test plans, regression test plans,
interoperability test plans.

### Review Checklist

**Test Plan Review**
- Does the test plan define the scope, objectives, and approach?
- Is there a requirements traceability matrix showing which requirements are covered
  by which test cases?
- Are entry and exit criteria defined for each test phase?
- Does the plan address the full test phase taxonomy: Integration Testing,
  Performance/Load Testing, FAT, SAT, UAT, Regression Testing, Interoperability
  Testing, and Operational Readiness Review?
- Is the test environment specified and representative of the production environment?
- Are roles and responsibilities for testing defined?
- Is the defect management process described (severity classification, resolution
  workflow, retest criteria)?
- Are test data requirements identified (synthetic vs. production data, volume)?

**Test Case/Procedure Review**
- Does each test case have a unique identifier traceable to a requirement?
- Are preconditions and setup steps clearly defined?
- Are test steps specific enough to be repeatable by someone unfamiliar with the system?
- Are expected results objectively verifiable (not "system works correctly" but "system
  displays transaction record within 3 seconds with all required fields populated")?
- Do pass/fail criteria leave no room for subjective interpretation?
- Are negative test cases included (invalid inputs, error conditions, boundary values)?
- Are performance/load test cases included where contractually required?

**Toll-Specific Test Considerations**
- Are all transaction types tested? Include: electronic (transponder/AVI), video
  (image-based), Pay-By-Plate, interoperability transactions, and insufficient-funds
  transponder reads. Note: "disputed" is a processing status, not a transaction type —
  dispute handling should be tested as a workflow, not a transaction category.
- Is end-to-end transaction flow tested from roadside to back-office to CSC to financial?
- Are interoperability scenarios tested with actual or simulated partner agency data?
- Is image quality testing included under various lighting/weather conditions?
- Are financial reconciliation tests included (roadside-to-host, host-to-CSC,
  host-to-financial, host-to-interoperability clearinghouse for E-ZPass settlement)?
- Is testing planned for peak volume/degraded mode/failover scenarios?
- Are end-of-day (EOD) processing, batch settlement cycles, and statement/invoice
  generation tested explicitly? These batch processes are frequently untested in
  FAT/SAT environments because they require running through a full billing cycle.
  Verify they are in scope and that test cases cover both successful execution and
  failure/recovery scenarios.
- Are regression tests defined to ensure existing functionality is preserved?

**Test Report Review**
- Are all planned test cases accounted for (passed, failed, blocked, not run)?
- Are failed test cases documented with root cause and resolution?
- Is re-test evidence provided for previously failed cases?
- Are open defects listed with severity, status, and workaround (if applicable)?
- Does the report include a clear go/no-go recommendation with supporting rationale?
- Are actual results documented alongside expected results for each test case?

---

## Operations & Maintenance Documentation

Applies to: O&M manuals, standard operating procedures (SOPs), runbooks, troubleshooting
guides, preventive maintenance schedules, spare parts lists.

### Review Checklist

**Completeness**
- Does the manual cover all system components and subsystems?
- Are both routine operations and exception handling documented?
- Is there a clear table of contents and index for quick reference?
- Are all operational modes documented (normal, degraded, maintenance, emergency)?

**Usability**
- Could operations staff actually use this document to operate the system day-to-day?
- Are procedures written in clear, step-by-step format?
- Are screenshots, diagrams, and visual aids current and legible?
- Is the reading level appropriate for the intended audience?
- Are safety warnings and cautions prominently placed?

**Maintenance Procedures**
- Is a preventive maintenance schedule included with frequencies and task descriptions?
- Are corrective maintenance procedures included for common failure scenarios?
- Are required tools and equipment listed for each maintenance task?
- Is the spare parts list complete with part numbers, quantities, and lead times?
- Are escalation procedures defined (when to call vendor support, when to escalate
  to owner)?
- Are warranty tracking responsibilities documented (warranty periods, claim procedures,
  vendor contact information)?

**Toll-Specific Operations**
- Are toll point activation/deactivation procedures documented? (In AET environments
  this replaces legacy lane open/close procedures.)
- Are image review and transaction correction workflows documented?
- For systems with attended lanes or CSC walk-in centers: are cash-handling procedures
  and financial reconciliation steps included?
- Are shift change/handover procedures defined?
- Is the process for handling system alerts and alarms documented?
- Are disaster recovery and business continuity procedures included?

---

## Training Documentation

Applies to: training plans, course outlines, instructor guides, student manuals,
training schedules, competency assessments.

### Review Checklist

- Does the training plan identify all audiences (operations, maintenance, management,
  CSC staff)?
- Are learning objectives defined for each course/module?
- Is the curriculum mapped to the functions each audience will perform?
- Does the schedule allow sufficient time for hands-on practice?
- Are knowledge assessments or competency evaluations included?
- Is a train-the-trainer component included for sustainability?
- Are training materials consistent with the current version of the O&M manual?
- Does the plan address ongoing/refresher training, not just initial deployment?

---

## Implementation & Transition Plans

Applies to: deployment plans, cutover plans, migration plans, rollback plans,
go-live readiness checklists, parallel operations plans.

### Review Checklist

**Planning & Sequencing**
- Is the implementation broken into logical phases with defined milestones?
- Are dependencies between phases identified?
- Is the critical path clearly identified?
- Are resource requirements (personnel, equipment, facilities) specified per phase?

**Risk & Contingency**
- Is there a rollback plan for each deployment phase?
- Are go/no-go decision points defined with criteria and responsible parties?
- Are risk mitigation strategies identified for key risks (weather, equipment failure,
  vendor staffing)?
- Is there a communication plan for stakeholders during cutover?

**Toll-Specific Transition Items**
- How will toll transactions be handled during the transition (revenue protection)?
- Is there a plan for parallel operations between old and new systems?
- How will in-flight transactions be handled at cutover (e.g., trips that start on
  the old system and end on the new)?
- Is there a plan for migrating: customer accounts, account balances (one of the
  highest-risk cutover elements), transponder inventories, violation records,
  transaction history, correspondence and case notes, image archives,
  interoperability settlement records, payment method and payment history data,
  financial ledgers, active payment plans and installment agreements (including
  remaining balances, payment schedules, and agreed terms — these carry contractual
  obligations), and DMV hold / registration block status with exact parity at cutover
  (missed holds create enforcement gaps; false holds create legal exposure)?
- Are interoperability partner agencies notified and aligned on the transition timeline?
- How will financial reconciliation be maintained across the transition boundary?

---

## Compliance & Audit Documentation

Applies to: SSAE-21 SOC 1 reports, SOC 2 reports, PCI-DSS assessments, security audits,
penetration test reports, privacy impact assessments, ADA compliance assessments.

Note on professional standards: SSAE-21 governs SOC 1 reports (AT-C Section 320),
effective for periods ending on or after June 15, 2022. SOC 2 reports are governed by
AT-C Section 205 and the AICPA Trust Services Criteria — not SSAE-21. When reviewing
a SOC report, verify which report type it is and confirm the applicable professional
standard is correctly cited. If an SSAE-18 SOC 1 report is submitted, flag the outdated
standard as a finding.

### Review Checklist

**Scope & Boundaries**
- Does the assessment scope cover all relevant system components and processes?
- Are scope exclusions justified and acceptable?
- For SOC reports: does the scope match the services the vendor provides under the
  contract?
- For PCI-DSS: confirm the assessment references the current mandatory version (v3.2.1
  was retired March 31, 2025; assessments must be against v4.0 or later). Flag any
  submission referencing a retired version as non-current. Are all cardholder data flows
  within the toll system included?

**Findings & Controls**
- Are all control objectives addressed?
- Are any controls noted as not in place or not operating effectively?
- For exceptions/findings: are management responses adequate and timely?
- Are compensating controls described where primary controls have gaps?

**Toll-Specific Compliance**
- Does PCI-DSS scope include all payment touchpoints (web portal, IVR, CSC agents,
  auto-replenish, mobile app, kiosk/retail payment, mail-in/check processing)?
- Are image handling and PII protections assessed (plate images, account data)?
- Does the SOC report cover transaction processing accuracy and completeness controls?
- Are data retention and destruction policies aligned with state requirements?
- For cloud-hosted components, are FedRAMP or equivalent security requirements addressed?

---

## Financial & Reconciliation Documentation

Applies to: revenue reports, reconciliation procedures, settlement documentation,
financial audit support, collections reporting.

### Review Checklist

- Are reconciliation procedures defined at each system boundary (roadside-to-host,
  host-to-CSC, host-to-financial, host-to-interoperability clearinghouse)?
- Are reconciliation frequencies and tolerances specified?
- Are exception handling procedures defined for out-of-balance conditions?
- Are revenue leakage controls identified and measurable?
- Are collection rate calculations defined and auditable?
- Are interoperability settlement processes documented separately for each applicable
  program (E-ZPass IAG clearinghouse, NIOP, and any regional agreements)? Each program
  has distinct settlement frequencies, file formats, dispute windows, and reconciliation
  tolerances.
- Are financial reporting formats aligned with agency accounting requirements?

---

## Performance & Reporting

Applies to: monthly performance reports, KPI dashboards, SLA compliance reports,
financial reports, traffic and revenue reports.

### Review Checklist

- Are all contractually required metrics reported?
- Are metric definitions consistent with the contract (not redefined by the vendor)?
- Are calculations verifiable (raw data, methodology, sample periods)?
- Are trends identified and analyzed, not just current-period values?
- Where metrics are below threshold, are root cause analyses and corrective action
  plans included?
- Are data sources identified and reliable?
- Is the reporting period clearly stated and consistent?

**Toll-Specific Metrics**
- Transponder read rate (primary indicator of roadside system health)
- Transaction accuracy rates (by type: electronic/AVI, video/image-based)
- Revenue leakage / collection rate (most critical financial metric — ratio of
  revenue collected to revenue earned). Verify whether reported rate is first-pass
  (collected in initial billing cycle) or ultimate (across all collection stages);
  vendors sometimes report ultimate when first-pass is the contractual metric
- Image capture rate, ALPR/OCR read rate (plate string produced), and plate-match rate
  (plate string matched to DMV or account record) — these are distinct metrics; a high
  read rate with a low match rate indicates OCR false reads or DMV data currency issues
- System availability (by component: roadside, host, CSC, web portal, mobile app)
- CSC performance (call answer times, abandonment rates, processing times)
- Financial reconciliation accuracy
- Violation processing cycle times
- Interoperability transaction settlement timeliness

---

## Change Management

Applies to: change requests, change orders, engineering change proposals, scope
modification requests, contract modification proposals.

### Review Checklist

- Is the change clearly described with before/after comparison?
- Is the justification for the change documented (defect, requirement change,
  improvement, regulatory)?
- Are cost and schedule impacts quantified?
- Is the impact on other system components, interfaces, or deliverables assessed?
- Are impacts to testing (regression testing needs) identified?
- Does the proposed change affect any previously approved deliverables?
- Is the change within the scope of the contract, or does it require a contract
  modification?
- Are alternatives considered and documented?

---

## Plans & Management Documents

Applies to: quality assurance plans, configuration management plans, risk management
plans, project management plans, communication plans, staffing plans.

### Review Checklist

- Does the plan address all contract requirements for the subject area?
- Are roles, responsibilities, and authorities clearly defined?
- Are processes described in sufficient detail to be followed?
- Are tools and systems identified?
- Does the plan include metrics or measures of effectiveness?
- Is there a process for updating the plan as the project evolves?
- Are interfaces with other project plans identified and consistent?

---

## Procurement & Proposals

Applies to: RFP responses, technical proposals, cost proposals, best and final offers,
oral presentation materials.

### Review Checklist

- Does the proposal address all mandatory requirements and evaluation criteria?
- Are any requirements unaddressed or only partially addressed?
- Is the technical approach feasible and clearly described?
- Are assumptions and exceptions explicitly stated?
- Is the proposed schedule realistic given the technical approach?
- Are key personnel qualifications documented and relevant?
- Are proposed subcontractors identified with their roles?
- Does the cost proposal align with the technical approach (no unfunded scope)?
- Are optional/priced items clearly delineated?

**Toll-Specific Proposal Items**
- Does the vendor demonstrate experience with comparable toll systems?
- Are proposed COTS products identified with version and licensing model?
- Is the system architecture compliant with the specified interoperability requirements?
- Are transition/migration risks from the incumbent system addressed?
