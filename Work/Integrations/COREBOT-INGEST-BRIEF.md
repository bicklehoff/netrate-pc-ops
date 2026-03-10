# Corebot — Full Integration Brief

**Date:** 2026-03-09 (revised)
**Author:** Setup (on behalf of David)
**Department:** Integrations
**Decision ref:** cmmjbv8w50001krp481fg99n3 (Core as system of record)
**Mac relay ref:** cmmjdw4aw00014685pdxoj65v (revised Tracker ingest spec, MCR FV7)

---

## Architecture Overview

```
LDox (every 15 min) ──→ POST /api/corebot/ingest ──→ Core DB (system of record)
                                                          │
                                                          │ On status change
                                                          ▼
                                                   POST {Mac}/api/loans/ingest ──→ Tracker (Mac)
                                                          │
                                                          ├── MCR reporting (all apps)
                                                          ├── Payroll (funded loans)
                                                          └── P&L views
```

Two endpoints to build:
1. **Corebot Ingest** — LDox → Core (receive loan data)
2. **Tracker Push** — Core → Mac (push loan data on status changes)

---

# PART 1: Corebot Ingest (LDox → Core)

## Endpoint Spec

**Route:** `POST /api/corebot/ingest`
**Auth:** API key in header (`X-Corebot-Key`) — store in `COREBOT_API_KEY` env var
**Payload:** JSON (see sample below)
**Response:** `{ success: true, processed: N, created: N, updated: N, errors: [] }`

## Sample LDox Payload Structure

```json
{
  "webhookTrigger": {
    "payload": {
      "loans": [ ...array of loan objects... ],
      "customerId": "uuid"
    }
  }
}
```

Each loan object contains: borrower, coBorrower, property, loan terms, dates, expenses, status, service providers, and LDox identifiers (loanId UUID + loanNumber integer).

## Field Mapping: LDox → Core

### Loan model — EXISTS (direct map)

| LDox Field | Core Field | Notes |
|---|---|---|
| `loanAmount` | `loanAmount` | Direct map |
| `noteRate` | `interestRate` | Rename |
| `term` | `loanTerm` | Direct map |
| `purpose.name` | `purpose` | Normalize: "Refinance" → "refinance" |
| `occupancy.name` | `occupancy` | Normalize: "Primary" → "primary" |
| `loanType.name` | `loanType` | Normalize: "Other" → "other" |
| `lender` | `lenderName` | Direct map |
| `loanNumber` | `loanNumber` | Direct map (convert int → string) |
| `subjectPropertyAddress` | `propertyAddress` | JSONB — direct map |
| `propertyType.name` | `propertyType` | Normalize: "SFH-Detached" → TBD convention |
| `units` | `numUnits` | Direct map |
| `purchasePrice` | `purchasePrice` | Direct map |
| `appraisalValue` | `estimatedValue` | Rename |
| `loanStatus.name` | `status` | Map LDox statuses → Core state machine (see below) |

### Loan model — NEEDS ADDING (from LDox)

| LDox Field | Proposed Core Field | Type | Notes |
|---|---|---|---|
| `loanId` | `ldoxLoanId` | `String? @unique` | **Primary merge key** |
| `program` | `program` | `String?` | e.g., "ARM 7/1", "Fixed 30" |
| `apr` | `apr` | `Decimal? @db.Decimal(5,4)` | |
| `ltvRatioPercent` | `ltvPercent` | `Decimal? @db.Decimal(5,2)` | |
| `combinedLtvRatioPercent` | `cltvPercent` | `Decimal? @db.Decimal(5,2)` | |
| `creditScore` | `creditScore` | `Int?` | |
| `otherFinancing` | `otherFinancing` | `Decimal? @db.Decimal(12,2)` | |
| `totalLiquidAssets` | `totalLiquidAssets` | `Decimal? @db.Decimal(12,2)` | |
| `totalLiabilityBalance` | `totalLiabilityBalance` | `Decimal? @db.Decimal(12,2)` | |
| `totalLiabilitiesNonReoMonthPaymentAmount` | `totalMonthlyLiabilities` | `Decimal? @db.Decimal(12,2)` | Shortened name |
| `proposedHousingExpense` | `proposedExpense` | `Json? @db.JsonB` | Full PITI object |
| `disclosure.serviceProviders` | `serviceProviders` | `Json? @db.JsonB` | Full object |

### Loan model — NEEDS ADDING (Tracker push / MCR fields)

These fields are required by Mac's Tracker for MCR FV7 reporting. Some can be derived from LDox data, others need manual entry in Core during processing.

| Field | Type | Source | Notes |
|---|---|---|---|
| `source` | `String @default("portal")` | System | `"portal"` \| `"ldox"` \| `"manual"` |
| `ldoxLastSync` | `DateTime?` | System | Last Corebot sync timestamp |
| `rateType` | `String?` | **Derive** from `program` | `"fixed"` \| `"arm"` — parse "ARM 7/1" → arm |
| `isConforming` | `Boolean?` | **Derive** from `loanAmount` | Compare to conforming limit ($806,500 for 2025) |
| `lienPosition` | `String?` | **Manual** | `"first"` \| `"second"` \| `"heloc"` \| `"unsecured"` |
| `isReverse` | `Boolean @default(false)` | **Derive** from loanType | HECM / reverse detection |
| `reverseType` | `String?` | **Manual** | `"hecm_standard"` \| `"proprietary"` — only if isReverse |
| `loanPurposeDetail` | `String?` | **Manual** | Refi sub-types: `"refi_rate_term"` \| `"refi_cash_out"` \| `"refi_restructure"` \| `"refi_other"` |
| `isHoepa` | `Boolean @default(false)` | **Manual** | High-cost mortgage flag — MCR AC400 |
| `qmStatus` | `String?` | **Manual** | `"qm"` \| `"non_qm"` \| `"not_subject"` — MCR AC920-AC940 |
| `originationChannel` | `String @default("brokered")` | **Default** | `"brokered"` \| `"retail"` \| `"wholesale"` |
| `docType` | `String?` | **Manual** | `"full_doc"` \| `"alt_doc"` — MCR I270/I271 |
| `isInterestOnly` | `Boolean @default(false)` | **Manual** | MCR I280/I281 |
| `isOptionArm` | `Boolean @default(false)` | **Manual** | MCR I290/I291 (probably always false) |
| `hasPrepaymentPenalty` | `Boolean @default(false)` | **Manual** | MCR I300/I301 |
| `hasMortgageInsurance` | `Boolean?` | **Derive** from expenses | `proposedHousingExpense.mortgageInsurance > 0` |
| `hasPiggybackSecond` | `Boolean @default(false)` | **Manual** | MCR I340/I341 |
| `grossComp` | `Decimal? @db.Decimal(12,2)` | **Manual** | Total broker compensation |
| `brokerFee` | `Decimal? @db.Decimal(12,2)` | **Manual** | Broker fee component — MCR AC600 |
| `lenderFee` | `Decimal? @db.Decimal(12,2)` | **Manual** | Lender fees collected — MCR AC610 |
| `dti` | `Decimal? @db.Decimal(5,2)` | **Manual or derive** | Debt-to-income ratio |
| `denialReason` | `String?` | **Manual** | Set on denial disposition |
| `withdrawalReason` | `String?` | **Manual** | Set on withdrawal disposition |

### LoanDates model — NEEDS ADDING

| LDox Field | Proposed Core Field | Notes |
|---|---|---|
| `dates.funded` | `fundedDate` | |
| `dates.closed` | `closedDate` | |
| `dates.estimatedClosing` | `estimatedClosingDate` | |
| `dates.firstPaymentDate` | `firstPaymentDate` | |
| `dates.fundingEstimate` | `fundingEstimateDate` | |
| `dates.brokersRequestForAppraisal` | `appraisalRequested` | May overlap with existing `appraisalOrdered`? |

### Mlo model — NEEDS ADDING

| Field | Type | Notes |
|---|---|---|
| `ldoxOfficerId` | `Int? @unique` | LDox internal officer ID |
| `nmls` | `String?` | NMLS number — needed for Tracker push |

### Borrower / CoBorrower

LDox pushes: firstName, lastName, DOB, SSN, email, phones (mobile/home/work), current address.

**For each borrower/coBorrower in the payload:**
1. Match by SSN (decrypt existing, compare) or by email
2. If no match → create new Borrower record (encrypt SSN + DOB via `src/lib/encryption.js`)
3. Create LoanBorrower junction record (borrowerType: 'primary' or 'co_borrower')
4. Store multiple phone numbers — currently Borrower only has one `phone` field. Options:
   - Add `homePhone`, `workPhone` to Borrower model
   - Or store in Contact model (already exists, check structure)

### MLO Mapping

LDox sends `loanOfficer: 180707` (an LDox-internal ID). Need a lookup:

| LDox Officer ID | Core MLO | NMLS | Notes |
|---|---|---|---|
| `180707` | David Burson | 641790 | Verify this ID |
| TBD | Jamie Cunningham | TBD | Get Jamie's LDox officer ID + NMLS |

## Merge Logic

When a loan comes in from LDox:

1. **Match by `ldoxLoanId`** (primary key — UUID from LDox)
2. If no match, try **`loanNumber`** (fallback)
3. If no match, try **borrower SSN + property address** (last resort)

**If matched (UPDATE):**
- LDox fields update Core UNLESS the field was manually edited in Core after last sync
- Track `ldoxLastSync` timestamp to detect manual overrides
- Log merge as LoanEvent (eventType: 'corebot_sync')

**If no match (CREATE):**
- Create Borrower (+ CoBorrower if present)
- Create Loan with `source: "ldox"`
- Create LoanDates
- Create LoanBorrower junction records
- Log creation as LoanEvent (eventType: 'corebot_import')

## Status Mapping: LDox → Core

| LDox Status | LDox ID | Core Status | Notes |
|---|---|---|---|
| Prospect | 1 | `lead` or `draft` | TBD — may map to Lead model instead |
| Application | ? | `application` | Triggers first push to Tracker |
| Processing | ? | `processing` | |
| Submitted | ? | `submitted` | |
| Approved | ? | `approved` | |
| Clear to Close | ? | `clear_to_close` | |
| Closed | ? | `closed` | |
| Funded | ? | `funded` | Triggers finance push to Tracker |
| Denied | ? | `denied` | Requires denialReason |
| Withdrawn | ? | `withdrawn` | Requires withdrawalReason |

**David:** Need full list of LDox loan statuses and their IDs to complete this mapping.

---

# PART 2: Tracker Push (Core → Mac)

## Overview

When a loan's status changes in Core, push the loan data to Mac's Tracker for MCR reporting, payroll, and P&L.

## When to Push

- On new application (status = `application`)
- On every status change (`processing`, `approved`, `denied`, `withdrawn`, `funded`, etc.)
- On funding — include all finance fields (comp, fees, dates)

## Endpoint (Mac builds this — Core calls it)

**Route:** `POST {TRACKER_API_URL}/api/loans/ingest`
**Auth:** API key in header — store in `TRACKER_API_KEY` env var
**Trigger:** After any loan status change in Core

## Payload Spec (what Core sends)

### All applications (MCR Section I pipeline)

```json
{
  "coreLoanId": "uuid",
  "status": "application|processing|approved|denied|withdrawn|funded",
  "statusDate": "2026-03-09",

  "borrowerName": "First Last",
  "borrowerLast": "Last",
  "coborrowerName": "First Last",

  "propertyState": "CO",
  "propertyAddress": "123 Main St, Fort Collins, CO 80528",
  "propertyType": "sfr|condo|townhouse|multi_2_4|manufactured",
  "numUnits": 1,
  "purchasePrice": 500000,
  "appraisedValue": 500000,

  "loanPurpose": "purchase|refi_rate_term|refi_cash_out|refi_restructure|refi_other|home_improvement",
  "loanType": "conventional|fha|va|usda_rhs",
  "loanAmount": 400000,
  "interestRate": 6.875,
  "loanTerm": 30,

  "rateType": "fixed|arm",
  "isConforming": true,
  "lienPosition": "first|second|heloc|unsecured",
  "isReverse": false,
  "reverseType": null,

  "mloName": "David Burson",
  "mloNmls": "641790",
  "applicationDate": "2026-03-06",

  "denialReason": null,
  "withdrawalReason": null,
  "creditScore": 740,
  "ltv": 80.0,
  "dti": 35.5,
  "cltv": 80.0,
  "loanNumber": "1187"
}
```

### Additional fields — FUNDED loans only (P&L + Payroll)

```json
{
  "lenderName": "UWM",
  "closingDate": "2026-03-26",
  "fundingDate": "2026-03-31",

  "grossComp": 8000.00,
  "brokerFee": 5000.00,
  "lenderFee": 1500.00,

  "isHoepa": false,
  "qmStatus": "qm",
  "originationChannel": "brokered",
  "docType": "full_doc",
  "isInterestOnly": false,
  "isOptionArm": false,
  "hasPrepaymentPenalty": false,
  "hasMortgageInsurance": false,
  "hasPiggybackSecond": false
}
```

## Field Source Summary

| Category | Count | Source |
|---|---|---|
| From LDox (auto) | ~18 fields | Corebot ingest maps these directly |
| Derived in Core | ~4 fields | `rateType`, `isConforming`, `hasMortgageInsurance`, `isReverse` |
| Manual entry in Core | ~14 fields | Comp, compliance flags, product features, refi sub-types |
| System-generated | ~3 fields | `coreLoanId`, `status`, `statusDate` |

## Derivation Logic

```javascript
// rateType — derive from LDox program field
function deriveRateType(program) {
  if (!program) return null;
  return program.toLowerCase().includes('arm') ? 'arm' : 'fixed';
}

// isConforming — derive from loan amount (2025 limit)
function deriveIsConforming(loanAmount, numUnits = 1) {
  const limits = { 1: 806500, 2: 1032650, 3: 1248150, 4: 1551250 };
  return loanAmount <= (limits[numUnits] || limits[1]);
}

// hasMortgageInsurance — derive from PITI breakdown
function deriveHasMI(proposedExpense) {
  return proposedExpense?.mortgageInsurance > 0;
}

// isReverse — derive from loan type
function deriveIsReverse(loanType, program) {
  const lower = (loanType + ' ' + (program || '')).toLowerCase();
  return lower.includes('reverse') || lower.includes('hecm');
}
```

## What Mac Does NOT Need (do not send)

- Borrower PII (SSN, DOB, income details)
- Document/condition tracking
- Processing timeline details
- Internal notes

---

# PART 3: Schema Migration

Full list of fields to add via Prisma migration:

```prisma
// ─── In model Loan — add: ──────────────────────────────────

  // LDox sync
  ldoxLoanId              String?   @unique @map("ldox_loan_id")
  source                  String    @default("portal")                // 'portal' | 'ldox' | 'manual'
  ldoxLastSync            DateTime? @map("ldox_last_sync")

  // From LDox
  program                 String?
  apr                     Decimal?  @map("apr") @db.Decimal(5,4)
  ltvPercent              Decimal?  @map("ltv_percent") @db.Decimal(5,2)
  cltvPercent             Decimal?  @map("cltv_percent") @db.Decimal(5,2)
  creditScore             Int?      @map("credit_score")
  otherFinancing          Decimal?  @map("other_financing") @db.Decimal(12,2)
  totalLiquidAssets       Decimal?  @map("total_liquid_assets") @db.Decimal(12,2)
  totalLiabilityBalance   Decimal?  @map("total_liability_balance") @db.Decimal(12,2)
  totalMonthlyLiabilities Decimal?  @map("total_monthly_liabilities") @db.Decimal(12,2)
  proposedExpense         Json?     @map("proposed_expense") @db.JsonB
  serviceProviders        Json?     @map("service_providers") @db.JsonB

  // MCR / Tracker fields
  rateType                String?   @map("rate_type")                 // 'fixed' | 'arm'
  isConforming            Boolean?  @map("is_conforming")
  lienPosition            String?   @map("lien_position")             // 'first' | 'second' | 'heloc' | 'unsecured'
  isReverse               Boolean   @default(false) @map("is_reverse")
  reverseType             String?   @map("reverse_type")              // 'hecm_standard' | 'proprietary'
  loanPurposeDetail       String?   @map("loan_purpose_detail")       // refi sub-types
  isHoepa                 Boolean   @default(false) @map("is_hoepa")
  qmStatus                String?   @map("qm_status")                // 'qm' | 'non_qm' | 'not_subject'
  originationChannel      String    @default("brokered") @map("origination_channel")
  docType                 String?   @map("doc_type")                  // 'full_doc' | 'alt_doc'
  isInterestOnly          Boolean   @default(false) @map("is_interest_only")
  isOptionArm             Boolean   @default(false) @map("is_option_arm")
  hasPrepaymentPenalty    Boolean   @default(false) @map("has_prepayment_penalty")
  hasMortgageInsurance    Boolean?  @map("has_mortgage_insurance")
  hasPiggybackSecond      Boolean   @default(false) @map("has_piggyback_second")

  // Finance / Compensation
  grossComp               Decimal?  @map("gross_comp") @db.Decimal(12,2)
  brokerFee               Decimal?  @map("broker_fee") @db.Decimal(12,2)
  lenderFee               Decimal?  @map("lender_fee") @db.Decimal(12,2)
  dti                     Decimal?  @map("dti") @db.Decimal(5,2)

  // Disposition
  denialReason            String?   @map("denial_reason")
  withdrawalReason        String?   @map("withdrawal_reason")

// ─── In model LoanDates — add: ──────────────────────────────

  fundedDate              DateTime? @map("funded_date")
  closedDate              DateTime? @map("closed_date")
  estimatedClosingDate    DateTime? @map("estimated_closing_date")
  firstPaymentDate        DateTime? @map("first_payment_date")
  fundingEstimateDate     DateTime? @map("funding_estimate_date")

// ─── In model Mlo — add: ────────────────────────────────────

  ldoxOfficerId           Int?      @unique @map("ldox_officer_id")
  nmls                    String?   @map("nmls")
```

---

# PART 4: Security

- **SSN/DOB:** Encrypt using existing `src/lib/encryption.js` (AES-256-GCM) before storage
- **API keys:** Validate `X-Corebot-Key` (ingest) and use `TRACKER_API_KEY` (push)
- **Rate limit:** Consider limiting Corebot to LDox IP range
- **Logging:** Log all ingest/push attempts but NEVER log PII in plaintext
- **Tracker push:** Only send non-PII fields to Mac (no SSN, DOB, income)
- **Security review:** Flagged to Claw (legal) and Mac (compliance) via relay

---

# PART 5: Build Order

1. **Schema migration** — add all new fields to Loan, LoanDates, Mlo (Part 3)
2. **Corebot ingest endpoint** — `POST /api/corebot/ingest` with auth + validation
3. **Field mapping layer** — transform LDox JSON → Prisma create/update
4. **Derivation functions** — rateType, isConforming, hasMI, isReverse
5. **Merge logic** — match existing records by ldoxLoanId / loanNumber / SSN+address
6. **Borrower handling** — create/match borrowers, encrypt PII
7. **LoanEvent logging** — audit trail for every sync
8. **Tracker push function** — build `pushToTracker(loanId)` that assembles and sends payload
9. **Status change hook** — trigger Tracker push on every loan status transition
10. **Test with sample payload** — use David's LDox JSON sample
11. **Point LDox at Core** — redirect webhook URL
12. **Verify Tracker receives** — confirm with Mac that data arrives correctly

---

# Open Questions for David

1. Full list of LDox loan statuses + IDs (for status mapping)
2. Jamie's LDox officer ID + NMLS number (for MLO mapping)
3. Where does LDox currently push? Zoho webhook URL? (Need to redirect)
4. Dual-push (Zoho + Core) during transition, or cut over?
5. Phone numbers: add homePhone/workPhone to Borrower, or use Contact model?
6. Borrower portal merge key preference: SSN match vs email match?
7. Conforming loan limits — use 2025 ($806,500) or update annually? Store in config?
8. Mac's Tracker API URL — do we have it, or does Mac need to deploy first?

---

*This brief covers both directions: LDox → Core (ingest) and Core → Tracker (push). Ready for an Integrations dev session to build.*
