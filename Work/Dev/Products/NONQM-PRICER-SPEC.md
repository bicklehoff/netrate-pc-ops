# NonQM Pricing Engine Spec

## Why

Agency products (Conv/FHA/VA) use one adjustment structure: FICO/LTV grids, SRP, risk-based, investor adj. NonQM products (DSCR, Bank Statement, Expanded Prime) use a completely different structure: DSCR ratio grids, PPP adjustments, doc type tiers, property type matrices. Shoehorning both into one engine would create a mess. Two engines, same API.

## Product Types

| Product | Tier | Count | Key Differentiator |
|---------|------|-------|-------------------|
| DSCR 1 | Elite | 5 | Standard DSCR investor |
| DSCR 2 | Elite | 5 | Mid-tier DSCR |
| DSCR 5 | Elite | 5 | Higher-tier DSCR |
| DSCR Plus | Core | 6 | Core DSCR |
| Expanded Prime Plus | Core | 6 | Alt-doc / bank statement |
| Non QM 1 | Elite | 1 | Elite NonQM |
| Bank Statement | - | 6 | Self-employed |

## NonQM Adjustment Structure (from EverStream XLSX)

### Elite DSCR LLPAs (sheets: Elite DSCR 1/2/5)

**Base grid:** FICO x CLTV matrix, segmented by:
- Purpose: Purchase, NCO Refi (non-cashout), CO Refi (cashout)
- Occupancy: Primary, Second Home, Investment (NOO)
- FICO bands: 800+, 780-799, ..., 620-639
- CLTV bands: 0-50, 50.01-55, 55.01-60, ..., 90.01-95

**Price cap:** Assumes 3-4 year PPP. Adjustments:
- 5yr PPP: +0.50
- 2yr PPP: -0.50
- 1yr PPP: -1.00
- No PPP: -1.50

**Additional adjustments (stacked):**
- Loan amount tiers
- DSCR ratio bands
- Interest only
- Property type (condo, non-warrantable, 5-8 units, rural)
- Credit events (FC/SS/DIL/BK by months seasoning)
- Escrow waiver
- 40-year maturity

### Core DSCR Plus LLPAs (sheet: Core Non-QM, right side)

**Base grid:** FICO x LTV, investor only
- FICO bands: >=780, 760-779, ..., 660-679
- LTV bands: 0-50, 50.01-55, ..., 75.01-80

**Stacked adjustments:**
- DSCR ratio: No Ratio (-0.875 to -2.375), 0.75-0.99 (-0.25 to -1.0), 1.00-1.24 (0), 1.25+ (+0.25 to +0.375)
- Loan size tiers (<=250K, >2M, >2.5M, >3M)
- Credit events
- Purchase/Refi/Cashout purpose adj
- Interest only
- Escrow waiver
- 40-year maturity
- Property type (condo, FL condo, non-warrantable, 5-8 units, rural, mixed use)

### Core Expanded Prime LLPAs (sheet: Core Non-QM, left side)

**Base grid:** FICO x LTV, segmented by doc type:
- Full Doc
- Alt Doc
- FICO bands: >=780, 760-779, ..., 660-679
- LTV bands: 0-50, 50.01-55, ..., 85.01-90

**Stacked adjustments:**
- Loan size tiers
- Credit events
- PPP adjustment (5yr +0.75, 4yr +0.375, 3yr 0, 2yr -0.375, 1yr -0.75, none -1.125)
- Price floor: 98, Price cap: 104.5

## Pricing Flow

```
Scenario:
  - DSCR ratio (or income type for bank statement)
  - FICO, LTV/CLTV
  - Property type, occupancy
  - Loan amount
  - PPP term (1-5yr or none)
  - Purpose (purchase/refi/cashout)
  - Interest only (yes/no)
  - Doc type (full/alt — for Expanded Prime)

Steps:
  1. Base price from rate_prices (same as agency)
  2. Look up FICO x CLTV base adjustment from grid
  3. Apply DSCR ratio adjustment (if DSCR product)
  4. Apply PPP adjustment
  5. Apply loan size adjustment
  6. Apply property type adjustment
  7. Apply purpose adjustment
  8. Apply IO / escrow waiver / 40yr maturity adjustments
  9. Apply credit event adjustment (if applicable)
  10. Enforce price floor and cap
  11. Subtract broker comp
  12. Return final price + breakdown
```

## Implementation Plan

### 1. Parser fixes
- DSCR product name: include tier (DSCR 1/2/5) and loan amount band in product key
- Fix 80.08 bogus price (parser artifact from DSCR section header)
- Separate Core DSCR Plus from Core Expanded Prime (both on "Core Non-QM" sheet)

### 2. LLPA extraction
- New extractor for Elite DSCR 1/2/5 sheets
- New extractor for Core Non-QM sheet (split left=Expanded Prime, right=DSCR Plus)
- Output: JSON files like `elite-dscr-1-llpa.json`, `core-dscr-plus-llpa.json`, `core-expanded-prime-llpa.json`

### 3. Seed script
- New adjustment types: `dscrFicoLtv`, `dscrRatio`, `pppAdj`, `dscrLoanSize`, `dscrPropertyType`, `dscrCreditEvent`
- Each product tier gets its own rows

### 4. Pricing engine: `pricing-nonqm.js`
- Separate file, same export pattern as pricing-v2.js
- `priceNonQmRate(rateEntry, product, scenario, lenderAdj, brokerConfig)`
- Different scenario inputs: dscrRatio, pppTerm, docType, isInterestOnly

### 5. API routing
- `/api/pricing` already switches on loanType
- Add: if loanType in ['dscr', 'bankstatement', 'nonqm'] → use `priceNonQmRate()`

### 6. Rate tool UI
- New scenario fields: DSCR ratio, PPP term, doc type, IO toggle
- Show/hide based on loan type selection
- NonQM-specific result display (PPP impact, price cap indicator)

## Data Volume Estimate

Per lender (EverStream):
- 3 Elite DSCR sheets x ~300 rows x ~40 cols = ~36,000 adjustment values
- 1 Core Non-QM sheet = ~2,000 adjustment values
- Total: ~38,000 new adjustment_rules rows

## Dependencies

- Agency pricer validated and stable (done)
- DSCR Scenario Builder tool (Claw relay — ties into this engine)
- Income Qualification Calculator (Claw relay — queries product eligibility)
- Dedicated NonQM content pages (relay sent to Claw)
