# Pricing Engine — Foundation Spec

**Status:** Project — foundation layer for all calculators
**Priority:** HIGH — every calculator depends on this
**Actor:** pc-dev

---

## What This Is

A server-side pricing engine that takes a borrower scenario and returns accurate, rate-sheet-based pricing. This is the single source of truth for rates across the entire site. Every calculator calls this engine instead of using hardcoded or manually entered rates.

The Rate Tool already does a version of this (GCS pipeline → rate display). The pricing engine extends it to be scenario-aware — factoring in LLPAs, MI, and program eligibility.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                BORROWER SCENARIO                 │
│  credit, LTV, loan amount, property type,       │
│  occupancy, state, county, loan type, term       │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              PRICING ENGINE (API)                │
│                                                  │
│  1. Base rate (from rate sheet — GCS pipeline)   │
│  2. + LLPA adjustments (scenario-dependent)      │
│  3. = Adjusted rate / price                      │
│  4. + MI lookup (if LTV > 80%)                   │
│  5. + Closing cost estimate (state-dependent)    │
│  6. = Full scenario output                       │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
        ┌──────────────┼──────────────┐
        │              │              │
   Rate Tool    Purchase Calc    Refi Modeler
   DSCR Calc    Cost of Waiting  Reverse Calc
```

---

## API Design

### `POST /api/pricing/scenario`

**Request:**
```json
{
  "loanPurpose": "purchase | refinance | cashout",
  "loanType": "conventional | fha | va | usda",
  "propertyType": "sfr | condo | townhouse | 2unit | 3unit | 4unit | manufactured",
  "occupancy": "primary | secondary | investment",
  "state": "CO",
  "county": "Boulder",
  "creditScore": 720,
  "loanAmount": 400000,
  "propertyValue": 500000,
  "loanTerm": 30,
  "downPayment": 100000
}
```

**Response:**
```json
{
  "scenario": { ... },  // echo back inputs + derived values
  "derived": {
    "ltv": 80.0,
    "conformingLimit": 766550,
    "loanCategory": "conforming",  // conforming | highBalance | jumbo
    "dti": null  // if debts provided
  },
  "rates": [
    {
      "rate": 5.875,
      "apr": 5.902,
      "basePrice": 100.25,
      "llpaAdjustments": [
        { "factor": "credit_ltv", "description": "720 FICO / 80% LTV", "adjustment": -0.375 },
        { "factor": "loan_purpose", "description": "Rate/term refinance", "adjustment": 0.0 }
      ],
      "adjustedPrice": 99.875,
      "costOrCredit": 135,  // positive = cost to borrower, negative = lender credit
      "monthlyPI": 2366.15,
      "monthlyMI": 0,
      "totalMonthlyPayment": 2366.15,
      "lender": "UWM",
      "tags": ["PAR"]
    },
    // ... more rate options
  ],
  "closingCosts": {
    "hardCosts": {
      "lenderFees": 1295,
      "titleAndSettlement": 1800,
      "total": 3095
    },
    "softCosts": {
      "escrowSetup": 4200,
      "prepaidInterest": 650,
      "total": 4850
    },
    "totalEstimated": 7945,
    "source": "state_average"  // or "county_specific" when available
  },
  "mi": {
    "required": false,
    "type": null,
    "monthlyPremium": 0,
    "upfrontPremium": 0
  },
  "programs": [
    { "name": "Conventional 30yr Fixed", "eligible": true },
    { "name": "FHA 30yr Fixed", "eligible": true, "note": "MIP required" },
    { "name": "VA 30yr Fixed", "eligible": null, "note": "Requires VA eligibility" }
  ],
  "pricedAt": "2026-03-20T14:30:00Z",
  "rateSheetDate": "2026-03-20"
}
```

---

## Component 1: LLPA Tables

### What are LLPAs?
Loan-Level Price Adjustments. Every lender publishes a grid: credit score × LTV × loan type × property type × occupancy = basis point adjustment to the base price. These stack.

### Data format
```json
{
  "lender": "UWM",
  "effectiveDate": "2026-03-01",
  "adjustments": {
    "credit_ltv": {
      "conventional": {
        ">=740": { "<=60": 0.000, "60.01-70": -0.250, "70.01-75": -0.250, "75.01-80": -0.375, "80.01-85": -0.375, ... },
        "720-739": { "<=60": -0.125, "60.01-70": -0.375, ... },
        "700-719": { ... },
        "680-699": { ... },
        "660-679": { ... },
        "640-659": { ... }
      }
    },
    "property_type": {
      "condo": -0.375,
      "2unit": -0.500,
      "3unit": -0.500,
      "4unit": -0.750,
      "manufactured": -1.000,
      "investment": -1.750
    },
    "loan_purpose": {
      "cashout": -0.375,
      "rate_term_refi": 0.000,
      "purchase": 0.000
    },
    "subordinate_financing": -0.125,
    "high_balance": -0.250
  }
}
```

### Source
- Fannie/Freddie publish standard LLPAs (LLPA matrices)
- Individual lenders layer their own on top
- Start with GSE standard LLPAs (covers ~80% accuracy), add lender-specific later
- **Update frequency:** Quarterly for GSE, monthly for lender-specific
- **Format:** PDFs and Excel from lenders — need parser (similar to rate sheet pipeline)

### Tier Boundaries (for reprice detection)
```javascript
const CREDIT_TIERS = [620, 640, 660, 680, 700, 720, 740, 760, 780];
const LTV_TIERS = [60, 65, 70, 75, 80, 85, 90, 95, 97];
const LOAN_LIMITS = {
  // per county — from FHFA data (already needed for loan limit tool)
  "CO_Boulder": { conforming: 766550, highBalance: 1149825 },
  // ...
};
```

---

## Component 2: MI Lookup

### FHA MIP (deterministic — we can calculate exactly)
- **Upfront:** 1.75% of loan amount (can be financed)
- **Annual:** 0.55% for most cases (>95% LTV, >15yr term, loan ≤ $766,550)
- Annual rate varies by LTV, term, and loan amount — full table from HUD
- MIP for life of loan (no auto-cancellation for most FHA)

### Conventional PMI (varies by insurer)
- Lookup table by credit score × LTV × coverage percentage
- Sources: MGIC, Radian, Essent, National MI all publish rate cards
- **Start with MGIC rate card** (most common) — publicly available
- Monthly, single-pay, and lender-paid options
- Auto-cancels at 78% LTV (original value)

### VA Funding Fee
- One-time fee (can be financed): 2.15% first use, 3.3% subsequent use
- Exempt for disabled vets
- No monthly MI

### USDA
- Upfront guarantee fee: 1.0%
- Annual fee: 0.35%

---

## Component 3: Closing Cost Estimator

### Hard Costs (Sections A & B of Loan Estimate)
- **Lender fees (Section A):** Relatively stable per lender. Default: $1,295
- **Title & settlement (Section B):** Varies by state and loan amount
  - CO: ~$1,800-2,200
  - CA: ~$2,000-3,500 (higher, varies by county)
  - TX: ~$2,500-4,000 (title insurance is regulated, higher)
  - OR: ~$1,800-2,500

### Soft Costs (Sections F & G)
- **Escrow setup:** 2-6 months property tax + 14 months homeowner's insurance
  - Needs: county tax rate + insurance estimate
- **Prepaid interest:** Per diem interest × days until first payment
  - Needs: loan amount, rate, closing date

### State Data Tables Needed
```json
{
  "CO": {
    "avgPropertyTaxRate": 0.0051,
    "counties": {
      "Boulder": 0.0053,
      "Denver": 0.0056,
      "Jefferson": 0.0050,
      // ... all counties for CO, CA, TX, OR
    },
    "avgTitleInsurance": 1800,
    "avgRecordingFees": 75,
    "transferTax": 0.001,
    "avgHomeownersInsurance": 2400  // annual
  }
}
```

### Source
- County tax rates: Census Bureau / state DOR websites (annual update)
- Title insurance: state-regulated in many states, published rate schedules
- Recording fees: county clerk websites
- Homeowner's insurance: average by state/county (can refine later with actual quotes)

---

## Component 4: Reprice Detection (Client-Side)

### How it works
When a borrower runs a scenario, we store the "priced state":
```javascript
const pricedState = {
  creditTier: getTier(740, CREDIT_TIERS),     // "740+"
  ltvTier: getTier(80.0, LTV_TIERS),          // "75.01-80"
  loanCategory: "conforming",                  // conforming | highBalance | jumbo
  propertyType: "sfr",
  occupancy: "primary",
  loanPurpose: "purchase",
  state: "CO",
  pricedAt: "2026-03-20T14:30:00Z"
};
```

### On any input change, check:
```javascript
function needsReprice(currentInputs, pricedState) {
  // Credit score crossed a tier boundary?
  if (getTier(currentInputs.creditScore, CREDIT_TIERS) !== pricedState.creditTier) return true;

  // LTV crossed a tier boundary?
  const currentLTV = (currentInputs.loanAmount / currentInputs.propertyValue) * 100;
  if (getTier(currentLTV, LTV_TIERS) !== pricedState.ltvTier) return true;

  // Loan amount crossed conforming/HB/jumbo?
  if (getLoanCategory(currentInputs) !== pricedState.loanCategory) return true;

  // Property type, occupancy, purpose, state changed?
  if (currentInputs.propertyType !== pricedState.propertyType) return true;
  if (currentInputs.occupancy !== pricedState.occupancy) return true;
  if (currentInputs.loanPurpose !== pricedState.loanPurpose) return true;
  if (currentInputs.state !== pricedState.state) return true;

  // Rate sheet is stale (older than today)?
  if (pricedState.rateSheetDate < today) return true;

  return false;
}
```

### UI behavior
- **No reprice needed:** Calcs update instantly on every change (pure math — payment, DTI, etc.)
- **Reprice needed:** Yellow banner appears: "Scenario changed — your rate may be different. [Reprice →]"
- **Reprice button:** One click → hits `/api/pricing/scenario` → updates rate + all downstream calcs
- **What changed:** Show which factor triggered the reprice: "Credit score dropped below 740 — this affects pricing"

---

## Component 5: Shared Scenario State

### localStorage profile
```javascript
const borrowerProfile = {
  creditScore: 740,
  state: "CO",
  county: "Boulder",
  propertyType: "sfr",
  occupancy: "primary",
  // Populated progressively as they use any calc
};
```

### Profile bar (persistent across all calc pages)
- Shows current profile: "740 credit | Boulder, CO | SFR | Primary"
- Edit button → inline editing
- "Add your details for accurate numbers" nudge if incomplete
- As they enter data in any calc, profile auto-fills
- Profile persists via localStorage — survives page navigation

### Soft lead capture
- Once profile has 3+ fields populated: "Save your profile → get updated when rates change"
- Captures email → ties into Strike Rate alert system
- Progressive: never gates the calculator, always optional

---

## Build Order

### Phase 1: Data infrastructure
1. LLPA tables — start with GSE standard (Fannie/Freddie published matrices)
2. County data tables — tax rates + loan limits for CO, CA, TX, OR
3. MI lookup tables — FHA MIP formula + MGIC conventional PMI rate card
4. State closing cost estimates

### Phase 2: API
5. `POST /api/pricing/scenario` — core pricing endpoint
6. Wire existing Rate Tool to use pricing engine (replaces current logic)
7. Add closing cost + MI to response

### Phase 3: Client-side
8. Shared scenario state (localStorage + profile bar component)
9. Reprice detection logic
10. Reprice UI (yellow banner + button + "what changed" explanation)

### Phase 4: Calculator rewrites
11. Purchase Calculator — full rebuild with DTI, program tiers, MI, escrow
12. Refi Scenario Modeler — 4-option rebuild with sliders and graphs
13. Cost of Waiting — wire to pricing engine for auto-populated rates
14. DSCR Calculator — separate rate sheet pipeline (DSCR lenders)
15. Reverse Mortgage Calculator — separate (CMT rates + PLF tables)

---

## Dependencies on Other Projects

| Project | What it provides to pricing engine |
|---|---|
| **County loan limit tool** | FHFA data — conforming/HB/FHA limits per county |
| **County tax rate tables** | Property tax rates for escrow calc |
| **State closing cost calc** | Hard + soft cost estimates per state |
| **DSCR rate sheet pipeline** | Separate pricing for DSCR products |
| **Reverse/HECM rate integration** | CMT rates + PLF tables for reverse |
| **Strike Rate alerts** | Consumes pricing engine for daily rate checks |

---

## What We Already Have

- ✅ GCS rate pipeline (base rates from lenders)
- ✅ Rate Tool UI (display layer)
- ✅ State dropdown on rate tool
- ✅ Third-party cost estimates per state (basic)
- ✅ Loan amount input
- ❌ LLPA tables (need to build)
- ❌ MI lookup (need to build)
- ❌ County-level data (need to build)
- ❌ Scenario API (need to build)
- ❌ Reprice detection (need to build)
- ❌ Shared scenario state (need to build)

---

## Reference

- Fannie Mae LLPA Matrix: https://singlefamily.fanniemae.com/media/9391/display
- Freddie Mac LLPA: https://guide.freddiemac.com/app/guide/section/4203.4
- FHFA loan limits: https://www.fhfa.gov/data/conforming-loan-limit
- MGIC rate cards: https://www.mgic.com/rates
- HUD MIP tables: https://www.hud.gov/program_offices/housing/comp/premiums/sfpcmort
- FHA county limits: https://entp.hud.gov/idapp/html/hicostlook.cfm

---

*Created: 2026-03-20 | Actor: pc-dev*
