# Agency Mapping Reference

This document provides TagAgencyID to agency name lookups for IAG Posting Status analysis.

## Complete Agency Mapping

| TagAgencyID | Agency Code | Full Name | State/Region |
|-------------|-------------|-----------|--------------|
| 3 | DRJTBC | Delaware River Joint Toll Bridge Commission | PA/NJ |
| 4 | PTC | Pennsylvania Turnpike Commission | PA |
| 5 | DelDOT | Delaware Department of Transportation | DE |
| 6 | MDTA | Maryland Transportation Authority | MD |
| 8 | NYSTA | New York State Thruway Authority | NY |
| 10 | MTA | Metropolitan Transportation Authority | NY |
| 13 | NJTA | New Jersey Turnpike Authority | NJ |
| 15 | SJTA | South Jersey Transportation Authority | NJ |
| 16 | DRPA | Delaware River Port Authority | PA/NJ |
| 18 | PANYNJ | Port Authority of New York and New Jersey | NY/NJ |
| 20 | NHDOT | New Hampshire Department of Transportation | NH |
| 22 | MassDOT | Massachusetts Department of Transportation | MA |
| 24 | RIDOT | Rhode Island Department of Transportation | RI |
| 26 | MaineDOT | Maine Department of Transportation | ME |
| 28 | WVTA | West Virginia Turnpike Authority | WV |
| 30 | KYTC | Kentucky Transportation Cabinet | KY |
| 32 | ITA | Illinois Tollway Authority | IL |
| 34 | OOCEA | Orlando-Orange County Expressway Authority | FL |
| 36 | FDOT | Florida Department of Transportation | FL |
| 38 | CFX | Central Florida Expressway Authority | FL |
| 40 | HCTRA | Harris County Toll Road Authority | TX |
| 42 | NTTA | North Texas Tollway Authority | TX |
| 44 | TxDOT | Texas Department of Transportation | TX |
| 46 | CTRMA | Central Texas Regional Mobility Authority | TX |
| 48 | GCRTA | Greater Cleveland RTA | OH |
| 50 | ODOT | Ohio Department of Transportation | OH |
| 52 | INDOT | Indiana Department of Transportation | IN |
| 54 | NCTCOG | North Central Texas Council of Governments | TX |
| 56 | NCTA | North Carolina Turnpike Authority | NC |
| 58 | GDOT | Georgia Department of Transportation | GA |
| 60 | VDOT | Virginia Department of Transportation | VA |
| 62 | SRT | State Road & Tollway Authority (Georgia) | GA |

## Python Lookup Dictionary

```python
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

def get_agency_name(tag_agency_id: int, use_code: bool = True) -> str:
    """
    Get agency name from TagAgencyID.

    Args:
        tag_agency_id: The IAG agency identifier
        use_code: If True, returns short code (e.g., 'MDTA'),
                  if False, returns full name

    Returns:
        Agency code or full name, or 'Unknown (ID)' if not found
    """
    if tag_agency_id in AGENCY_MAPPING:
        code, full_name = AGENCY_MAPPING[tag_agency_id]
        return code if use_code else full_name
    return f'Unknown ({tag_agency_id})'
```

## Key Agencies for VDOT Analysis

The following agencies typically have significant transaction volumes with VDOT:

### High Volume (>10K daily transactions)
- **Agency 6 - MDTA**: Maryland Transportation Authority - Primary neighbor state
- **Agency 5 - DelDOT**: Delaware DOT - I-95 corridor traffic
- **Agency 4 - PTC**: PA Turnpike - Regional traffic

### Medium Volume (1K-10K daily transactions)
- **Agency 13 - NJTA**: New Jersey Turnpike Authority
- **Agency 16 - DRPA**: Delaware River Port Authority
- **Agency 18 - PANYNJ**: Port Authority NY/NJ
- **Agency 56 - NCTA**: North Carolina Turnpike Authority

### Lower Volume (<1K daily transactions)
- Remaining agencies typically have lower transaction volumes with VDOT

## Regional Groupings

For reporting purposes, agencies can be grouped by region:

### Northeast Corridor
- Agency 3: DRJTBC
- Agency 4: PTC
- Agency 5: DelDOT
- Agency 6: MDTA
- Agency 8: NYSTA
- Agency 10: MTA
- Agency 13: NJTA
- Agency 15: SJTA
- Agency 16: DRPA
- Agency 18: PANYNJ
- Agency 20: NHDOT
- Agency 22: MassDOT
- Agency 24: RIDOT
- Agency 26: MaineDOT

### Southeast
- Agency 56: NCTA
- Agency 58: GDOT
- Agency 62: SRT
- Agency 34: OOCEA
- Agency 36: FDOT
- Agency 38: CFX

### Midwest
- Agency 28: WVTA
- Agency 30: KYTC
- Agency 32: ITA
- Agency 48: GCRTA
- Agency 50: ODOT
- Agency 52: INDOT

### Texas/Southwest
- Agency 40: HCTRA
- Agency 42: NTTA
- Agency 44: TxDOT
- Agency 46: CTRMA
- Agency 54: NCTCOG

## Notes

1. **Agency IDs are not sequential**: IAG uses specific ID assignments, with gaps in numbering
2. **VDOT (60) excluded from analysis**: Since this is VDOT's own data, Agency 60 represents internal transactions
3. **New agencies**: If new TagAgencyIDs appear in data, check IAG documentation for updated roster
4. **Regional context**: Transaction volumes vary based on geographic proximity to Virginia
