# Transaction Analysis Plugin

Toll transaction data analysis with automatic client detection, specialized agents, and multi-format reporting.

> **Domain-Specific**: This plugin is designed for toll industry transaction analysis, specifically VDOT, DelDOT, MDTA, and DRPA data formats.

## Components

| Type | Name | Description |
|------|------|-------------|
| Command | `/analyze-transactions` | Full analysis workflow |
| Agent | Transaction Analyst | Main analysis with client detection |
| Agent | Data Quality Validator | Pre-analysis validation |
| Skill | Analyzing Transactions | Client frameworks and patterns |
| Skill | IAG Posting Analysis | Agency-level rejection metrics |
| Hook | Post-tool | Progress indicators |

## Command: /analyze-transactions

Orchestrates a multi-step analysis workflow:

1. **Get File Path** - Prompt user for transaction data file
2. **Data Quality Validation** - Check structure, completeness, anomalies
3. **Client Detection** - Automatically identify VDOT, DelDOT, MDTA, or DRPA
4. **Comprehensive Analysis** - Apply client-specific frameworks
5. **Report Generation** - Executive summary and technical report
6. **Pattern Storage** - Save findings to OpenMemory

**Usage:**
```
/analyze-transactions
```

**Output:**
- Executive Summary (management-focused)
- Technical Report (detailed metrics)
- Quality Assessment
- Stored knowledge for future reference

## Agents

### Transaction Analyst

Main analysis agent with:
- Automatic client type detection from data characteristics
- Client-specific analysis frameworks
- Collection rate, reject rate, at-risk rate calculations
- Pattern recognition and anomaly detection
- Root cause analysis (system vs data vs equipment)
- Technical and executive report generation

### Data Quality Validator

Pre-analysis validation agent that:
- Checks file structure and schema
- Verifies data completeness and consistency
- Detects anomalies and potential issues
- Returns PASS/WARNING/FAIL verdict

**Validation stops analysis if critical issues are found.**

## Skills

### Analyzing Transactions

Complete transaction analysis knowledge base including:

**CLIENT-DETECTION.md** - Signatures for identifying data sources:
- Column patterns
- Value formats
- Naming conventions

**DECISION-TREES.md** - Analysis flow based on data characteristics

**EXTRACTION-GUIDE.md** - How to read and parse different formats

### IAG Posting Analysis

Inter-Agency Group posting analysis for VDOT:
- Agency-level rejection metrics
- Plate-specific analysis
- Trend reports
- Markdown and Excel output

**AGENCY-MAPPING.md** - Home agency code mappings

## Supported Clients

| Client | Data Characteristics |
|--------|---------------------|
| **VDOT** | Virginia DOT transaction formats, IAG posting files |
| **DelDOT** | Delaware DOT toll data |
| **MDTA** | Maryland Transportation Authority |
| **DRPA** | Delaware River Port Authority |

## How Client Detection Works

The plugin examines data characteristics to automatically identify the source:

1. **Column names** - Each client has distinctive headers
2. **Value patterns** - Agency codes, transaction types
3. **File naming** - Common naming conventions
4. **Data structure** - Row/column organization

This eliminates the need for users to specify which client's data they're analyzing.

## File Structure

```
transaction-analysis/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── data-quality-validator.md
│   └── transaction-analyst.md
├── commands/
│   └── analyze-transactions.md
├── hooks/
│   └── hooks.json
└── skills/
    ├── analyzing-transactions/
    │   ├── SKILL.md
    │   ├── CLIENT-DETECTION.md
    │   ├── DECISION-TREES.md
    │   └── EXTRACTION-GUIDE.md
    └── iag-posting-analysis/
        ├── SKILL.md
        └── AGENCY-MAPPING.md
```

## Requirements

- **Data files**: Excel, CSV, or text format transaction data
- **OpenMemory MCP** (optional): For pattern storage across analyses

## Example Workflow

```
User: /analyze-transactions

Claude: Please provide the path to the transaction data file you'd like
to analyze (Excel, CSV, or text format).

User: C:\Data\VDOT_Transactions_2025-12.xlsx

Claude: Running data quality validation...
✓ File structure validated
✓ 15,432 records found
✓ Date range: 2025-12-01 to 2025-12-31
⚠ Warning: 23 records with missing plate data

Detected client: VDOT (Virginia DOT)
Proceeding with VDOT analysis framework...

[Analysis results...]
```

## Complexity Rating

| Aspect | Rating | Notes |
|--------|--------|-------|
| Setup Difficulty | Low | Just needs data files |
| Customization Needed | High | Client frameworks are domain-specific |
| Value as Reference | High | Shows multi-agent analysis patterns |

## Adapting for Other Domains

The architecture can be adapted for other data analysis domains:

1. **Replace client detection** - Define signatures for your data sources
2. **Create analysis frameworks** - Domain-specific metrics and calculations
3. **Update validation rules** - Quality checks for your data types
4. **Customize reporting** - Output formats for your audience
