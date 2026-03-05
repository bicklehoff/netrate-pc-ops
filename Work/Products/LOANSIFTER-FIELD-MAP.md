# LoanSifter Field Map — Rate Schema Reference

Documented Mar 4, 2026 by walking through each Loan Type in LoanSifter's Modify Search form.

## Loan Types We Support

| Type | Status | Notes |
|------|--------|-------|
| **Conventional** | Live (AmWest) | LLPA matrices, FICO/LTV based |
| **FHA** | Planned | UFMIP 1.75%, annual MIP |
| **VA** | Planned | Funding fee varies by use/down/exempt |
| **USDA** | Planned | G-Fee 1.00%, rural eligibility |
| **Expanded Guidelines** | Planned (later) | Non-QM, extra pricing fields |
| **HELOC** | Skip | Completely different product (variable rate, draw period) |

## Common Fields (All Loan Types)

### Loan Information
- Lien Position (First, Second)
- Loan Type (Conv, FHA, VA, USDA, Expanded, HELOC)
- Product Type (Standard) — not present on Expanded
- Term (30 Years, 15, 20, 25, etc.)
- Amortization Type (Fixed, ARM)
- Loan Purpose (Purchase, Rate/Term Refi, Cash-Out Refi)
- Construction to Perm (checkbox)
- Property Value
- Base Loan Amount / LTV
- Subordinate Financing (checkbox)
- Duty to Serve (Not Evaluated)
- Mission Score (Not Evaluated)

### Borrower Information
- Loan Level FICO
- DTI Ratio
- Reserves (Months)
- Monthly Qualifying Income
- Properties Financed
- Citizenship (U.S. Citizen, Perm Resident, Non-Perm Resident)
- Self Employed (checkbox)
- Non-Occupant Co-Borrower (checkbox)

### Property Information
- Occupancy (Primary, Secondary, Investment)
- Legal Structure (Single Family, Condo, etc.)
- Number of Units (1-4)
- Type (Detached, Attached)
- Manufactured (Yes/No)
- Property Zip
- State
- County

### Product Characteristics
- Search By (Price, Rate)
- Desired Price / Desired Rate
- Interest Only (Yes/No)
- Buydown (None, 2-1, 1-0, etc.)
- Desired Lock Period (15, 30, 45, 60)
- Fees In (checkbox)
- Borrower Paid Compensation (Dollar + Percentage)
- Min/Max constraints
- Waive Escrows (Yes/No)
- Prepayment Penalty (None, 1yr, 2yr, 3yr)
- Automated U/W System (DU, LP, Not Specified)
- Investor Groups (Rate Sheets)

## Loan-Type-Specific Fields

### FHA
- **UFMIP** — 1.75% (upfront mortgage insurance premium, financed into loan)
- **Total Loan Amount** — Base + UFMIP (e.g., $400K + $7K = $407K)
- Annual MIP calculated downstream (not on this form) — varies by LTV and term

### VA
- **Funding Fee** — 2.15% first use / 0% down (financed into loan)
- **Total Loan Amount** — Base + Funding Fee (e.g., $400K + $8.6K = $408.6K)
- **Subsequent Use** — checkbox (higher fee: 3.30% vs 2.15%)
- **Exempt from Funding Fee** — checkbox (disabled vets = 0%)
- **Cash-Out Amount** — separate field

**VA Funding Fee Table:**

| Scenario | 0% down | 5%+ down | 10%+ down |
|----------|---------|----------|-----------|
| First use | 2.15% | 1.50% | 1.25% |
| Subsequent | 3.30% | 1.50% | 1.25% |
| Exempt | 0% | 0% | 0% |

### USDA
- **G-Fee** (Guarantee Fee) — 1.00% (financed into loan)
- **Total Loan Amount** — Base + G-Fee (e.g., $400K + $4K = $404K)
- LTV recalculated with financed fee (80% becomes 80.81%)
- Geographic eligibility required (rural areas) — not on form but matters for site

### Expanded Guidelines (Non-QM)
- **Product Type** field removed
- **Mortgage Lates - Last 12 Months** — 30/60/90/120 day counts
- **Mortgage Lates - 13-24 Months** — 30/60/90/120 day counts
- **Income Verification Type** — Full Doc, Bank Statement, DSCR, Asset Depletion, 1099, P&L
- **Unique Property** — Yes/No
- **Debt Consolidation** — Yes/No
- **Housing Event Type** — None, Foreclosure, Short Sale, Deed-in-Lieu, Modification
- **Bankruptcy Type** — None, Chapter 7, Chapter 13

## Upfront Fee Summary

| Type | Fee Name | Rate | Financed | Affects Total Loan |
|------|----------|------|----------|-------------------|
| Conv | none | — | — | no |
| FHA | UFMIP | 1.75% | yes | yes |
| VA | Funding Fee | 2.15%* | yes | yes |
| USDA | Guarantee Fee | 1.00% | yes | yes |
| Non-QM | none | — | — | no |

*VA fee varies — see table above

## Schema Implications

The rate results table in the database needs to store rates per:
- **Loan type** (Conv/FHA/VA/USDA/NonQM)
- **Lender** (AmWest, Sunwest, etc.)
- **Scenario inputs** (FICO, LTV, purpose, property type, occupancy, state)
- **Lock period** (30, 45 day)
- **Effective date**

The website then queries: "Given this borrower scenario, what's the best rate across all lenders for this loan type?"

Upfront fees (UFMIP, Funding Fee, G-Fee) are calculated client-side based on loan type — they're standard rates, not lender-specific.
