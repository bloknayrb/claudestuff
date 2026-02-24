# Agency Mapping Reference

This document describes TagAgencyID to agency name lookups for IAG Posting Status analysis.

## Authoritative Source

**The Excel file is the single source of truth for agency mappings.**

The analysis script loads mappings dynamically at runtime from:
```
C:\Users\bkolb\OneDrive - RK&K\Obsidian\Obsidian\01-Projects\VDOT\CSC Operations Support\Resources\Agency ID Mapping.xlsx
```

Columns used:
- `NIOP Tag Agency ID` → integer key
- `Original Issuing Agency` → agency code extracted from trailing parentheses, e.g., "New Jersey Turnpike Authority (NJTA)" → code `NJTA`

## Key Agencies for VDOT Analysis

Correct NIOP Tag Agency IDs per the Agency ID Mapping Excel (authoritative):

### High Volume (primary I-95/I-495 corridor neighbors)
- **ID 3 — NJTA**: New Jersey Turnpike Authority
- **ID 6 — PTC**: Pennsylvania Turnpike Commission
- **ID 16 — MDTA**: Maryland Transportation Authority
- **ID 19 — DelDOT**: Delaware DOT

### Medium Volume
- **ID 4 — NYSTA**: New York State Thruway Authority
- **ID 5 — PANYNJ**: Port Authority of NY & NJ
- **ID 7 — SJTA**: South Jersey Transportation Authority
- **ID 8 — MTA B&T**: MTA Bridges & Tunnels
- **ID 9 — DRPA**: Delaware River Port Authority
- **ID 10 — VDOT**: Virginia DOT (internal — typically excluded from analysis)
- **ID 29 — DRJTBC**: Delaware River Joint Toll Bridge Commission
- **ID 33 — NCTA**: North Carolina Turnpike Authority

### Other Eastern Agencies
- **ID 21 — MassDOT**: Massachusetts DOT
- **ID 22 — NJCSC**: New Jersey CSC
- **ID 24 — WVPA**: West Virginia Parkways Authority
- **ID 26 — NHDOT**: New Hampshire DOT
- **ID 28 — MeTA**: Maine Turnpike Authority
- **ID 34 — SRTA/GA**: Georgia State Road and Tollway Authority (6C transponders)

## Expected Agencies Check

The `detect_anomalies()` function checks for these agencies as a data quality signal:

```python
# Correct NIOP IDs: PTC=6, DRPA=9, MDTA=16, DelDOT=19, DRJTBC=29
expected_agencies = [6, 9, 16, 19, 29]
```

If any of these are absent from the dataset, an anomaly is flagged.

## Regional Groupings (for reporting)

### Northeast Corridor
- ID 3: NJTA
- ID 4: NYSTA
- ID 5: PANYNJ
- ID 6: PTC
- ID 7: SJTA
- ID 8: MTA B&T
- ID 9: DRPA
- ID 16: MDTA
- ID 19: DelDOT
- ID 21: MassDOT
- ID 22: NJCSC
- ID 26: NHDOT
- ID 28: MeTA
- ID 29: DRJTBC

### Southeast
- ID 10: VDOT (internal)
- ID 33: NCTA
- ID 34: SRTA/GA

## Notes

1. **IDs are not sequential**: NIOP uses specific ID assignments per the ICD, with gaps
2. **VDOT (ID 10) excluded from analysis by default**: This is VDOT's own facility data
3. **IDs appearing in data but not in Excel**: Will display as `Unknown (ID)` — check IAG ICD for updates
4. **Do not hardcode this mapping** — always load from the Excel file so it stays current with the NIOP ICD
