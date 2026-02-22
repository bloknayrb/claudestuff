# Merchant-to-Category Lookup

## Merchant Normalization Patterns

Strip these prefixes/suffixes before category lookup. Transaction descriptions often include payment processor noise that obscures the actual merchant.

| Pattern | Meaning | Example Raw → Normalized |
|---------|---------|--------------------------|
| `SQ *` | Square POS | `SQ *COFFEE SHOP` → `COFFEE SHOP` |
| `TST*` | Toast POS | `TST* PIZZA PLACE` → `PIZZA PLACE` |
| `AMZN MKTP US*` | Amazon Marketplace | `AMZN MKTP US*AB1CD2EF3` → `AMAZON` |
| `AMAZON.COM*` | Amazon direct | `AMAZON.COM*AB1CD2EF3` → `AMAZON` |
| `AMZN Mktp US` | Amazon Marketplace | same as above |
| `PAYPAL *` | PayPal transaction | `PAYPAL *MERCHANT` → `MERCHANT` |
| `SP *` | Shopify | `SP * STORENAME` → `STORENAME` |
| `CKE*` | Cardknox | `CKE*MERCHANT` → `MERCHANT` |
| `DD *` | DoorDash | `DD *RESTAURANT` → `DOORDASH` |
| `UBER *` | Uber/UberEats | `UBER *EATS` → `UBER EATS` |
| `GOOGLE *` | Google services | `GOOGLE *CLOUD` → `GOOGLE CLOUD` |
| `APL*` | Apple | `APL*APPLE.COM` → `APPLE` |
| Trailing `#\d+` | Reference numbers | Strip |
| Trailing city/state | Location info | `STORE NAME CITY ST` → `STORE NAME` |

## Category Assignments

### Housing
- Mortgage lenders (common patterns: `WELLS FARGO MORTGAGE`, `QUICKEN LOANS`, `NATIONSTAR`)
- Rent payments (`ZELLE`, `VENMO` tagged as rent, property management companies)
- HOA payments

### Utilities
- `XCEL ENERGY`, `DUKE ENERGY`, `COMED`, `PG&E` → Electric/Gas
- `WATER DEPT`, `CITY OF *WATER` → Water
- `COMCAST`, `XFINITY`, `SPECTRUM`, `ATT`, `VERIZON`, `T-MOBILE` → Internet/Phone
- `WASTE MGMT`, `REPUBLIC SVCS` → Trash

### Groceries
- `KROGER`, `SAFEWAY`, `PUBLIX`, `HEB`, `ALDI`, `TRADER JOE`, `WHOLE FOODS`, `SPROUTS`
- `WEGMANS`, `GIANT`, `FOOD LION`, `STOP & SHOP`, `HARRIS TEETER`, `MEIJER`
- `LIDL`, `SAVE A LOT`, `WINCO`, `PIGGLY WIGGLY`, `FAREWAY`

### Transportation
- `SHELL`, `EXXON`, `BP`, `CHEVRON`, `SUNOCO`, `WAWA`, `SHEETZ`, `RACETRAC` → Gas
- `GEICO`, `STATE FARM`, `PROGRESSIVE`, `ALLSTATE`, `USAA` → Car insurance
- `JIFFY LUBE`, `VALVOLINE`, `FIRESTONE`, `PEP BOYS`, `AUTOZONE` → Maintenance
- `METRO`, `WMATA`, `MTA`, `CTA`, `BART`, `MARTA` → Public transit
- `UBER`, `LYFT` → Rideshare
- `PARKWHIZ`, `SPOTHERO`, `LAZ PARKING` → Parking

### Dining Out
- `MCDONALD`, `STARBUCKS`, `CHIPOTLE`, `PANERA`, `CHICK-FIL-A`, `SUBWAY`
- `DOMINOS`, `PIZZA HUT`, `TACO BELL`, `WENDY`, `BURGER KING`, `DUNKIN`
- `GRUBHUB`, `DOORDASH`, `UBER EATS`, `POSTMATES` → Delivery
- Any `SQ *` or `TST*` prefix in a restaurant context

### Entertainment
- `NETFLIX`, `HULU`, `DISNEY+`, `HBO MAX`, `PARAMOUNT+`, `PEACOCK` → Streaming
- `SPOTIFY`, `APPLE MUSIC`, `YOUTUBE PREMIUM` → Music/Video
- `AMC`, `REGAL`, `CINEMARK` → Movies
- `STEAM`, `PLAYSTATION`, `XBOX`, `NINTENDO` → Gaming
- `TICKETMASTER`, `STUBHUB`, `AXSTICKETS` → Events

### Subscriptions
- `ADOBE`, `MICROSOFT 365`, `GOOGLE STORAGE`, `DROPBOX`, `ICLOUD`
- `GYM` patterns, `PLANET FITNESS`, `LA FITNESS`, `ORANGETHEORY`
- `AMAZON PRIME`, `COSTCO MEMBERSHIP`, `SAMS CLUB`
- `NOTION`, `1PASSWORD`, `LASTPASS`, `NORDVPN`

### Healthcare
- `CVS`, `WALGREENS`, `RITE AID` → Pharmacy
- `KAISER`, `UNITED HEALTH`, `AETNA`, `CIGNA`, `BLUE CROSS` → Insurance
- Hospital and clinic patterns
- `ZOCDOC`, `TELADOC` → Telehealth

### Personal Care
- `GREAT CLIPS`, `SUPERCUTS`, `SPORTS CLIPS` → Haircuts
- `ULTA`, `SEPHORA`, `BATH & BODY` → Personal care products

### Clothing
- `NIKE`, `ADIDAS`, `OLD NAVY`, `GAP`, `H&M`, `ZARA`, `UNIQLO`
- `NORDSTROM`, `MACYS`, `KOHLS`, `TJ MAXX`, `MARSHALLS`, `ROSS`

### Pets
- `PETCO`, `PETSMART`, `CHEWY` → Pet supplies
- `BANFIELD`, `VCA ANIMAL` → Vet

## Ambiguous Merchants

These merchants sell across multiple categories. **Flag for human review** rather than auto-assigning.

| Merchant | Possible Categories | Guidance |
|----------|-------------------|----------|
| `WALMART` | Groceries, Household, Clothing, Electronics | Ask user or split. If amount <$50 and frequent, likely groceries. |
| `TARGET` | Groceries, Clothing, Household, Electronics | Same as Walmart. |
| `COSTCO` | Groceries, Bulk household, Gas | Costco gas stations are separate line items. Warehouse trips are often mixed. |
| `AMAZON` | Almost anything | Cannot reliably categorize without item-level data. Flag all. |
| `WALMART.COM` | Same as Walmart | Online orders even harder to categorize. |
| `SAM'S CLUB` | Groceries, Bulk household | Similar to Costco. |
| `DOLLAR GENERAL` / `DOLLAR TREE` | Groceries, Household | Small amounts may be household; larger may be groceries. |
| `VENMO` / `ZELLE` / `CASHAPP` | Any (P2P transfer) | Cannot categorize without memo. Flag all. |
| `CHECK` / `ACH` | Any | Needs description context. |

## Category Hierarchy

```
Primary Category
└── Subcategory (optional, for detailed tracking)

Housing
├── Rent/Mortgage
├── Property Tax
├── HOA
└── Repairs & Maintenance

Transportation
├── Gas/Fuel
├── Car Payment
├── Insurance
├── Maintenance
├── Parking
└── Public Transit

...and so on for each primary category
```

When in doubt about subcategory assignment, use the primary category only. Precision matters less than consistency — pick a convention and stick with it across the entire dataset.
