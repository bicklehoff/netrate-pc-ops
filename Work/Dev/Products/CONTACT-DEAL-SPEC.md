# Contact → Deal Architecture Spec

**Date:** 2026-04-01
**Author:** pc-dev + David
**Status:** DRAFT — needs David review

---

## Problem

When a borrower comes back for a new loan, LenDox clones the entire loan file — creating duplicate records with stale data. In Core, we need a clean way to:

1. Keep one Contact per person (with their financial profile)
2. Link multiple Deals (loans) to that Contact
3. Create a new Deal pre-filled from the Contact's data
4. Close old Deals without losing the person
5. Know when a loan becomes a real MCR application (the "5 fields" gate)

---

## Architecture

```
Contact (the person)
  ├── Deal #1 (funded 2024 — refi)
  ├── Deal #2 (file closed 2025 — purchase fell through)
  └── Deal #3 (active 2026 — new purchase)
```

**Contact = who they are.** Name, SSN, income, assets, employment, properties, credit history, marketing prefs.

**Deal = a specific loan transaction.** Property, loan amount, lender, purpose, status, dates, conditions, documents.

**Mapping to existing models:**
- Contact → `contacts` table (already exists, needs field additions)
- Deal → `loans` table (already exists, IS the deal)
- Join → `borrowerId` on Loan already links them. Contact links via `borrowerId` on Contact.

---

## What Changes

### Contact Model — Lightweight Identity + CRM

Contact is the person, not the deal. No sensitive financial data. No deal-specific fields.

| Field | Type | Notes |
|-------|------|-------|
| firstName | String | Identity |
| lastName | String | Identity |
| email | String | Unique, dedup key |
| phone | String | |
| dobEncrypted | String | For identity matching only |
| mailingAddress | Json | Current mailing address |
| city | String | |
| state | String | Home state |
| zipCode | String | |
| source | String | How they found us (rate-tool, referral, zoho-import, etc.) |
| status | String | lead, applicant, past-client, dormant |
| assignedMloId | String (FK) | Default MLO for new deals |
| newsletterOptIn | Boolean | Marketing pref |
| strikeRateOptIn | Boolean | Rate alert pref |
| emailOptOut | Boolean | |
| smsOptOut | Boolean | |
| zohoContactId | String | Import matching |
| zohoLeadId | String | Import matching |
| homeiqImported | Boolean | MyHomeIQ dedup flag |
| notes | String | Free-text CRM notes |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Everything else stays on Loan (deal-specific):**
- SSN (encrypted), credit score, income, employment, declarations
- propertyAddress, purchasePrice, downPayment, estimatedValue, currentBalance
- loanAmount, loanType, loanTerm, interestRate, lienStatus, purpose, occupancy
- lenderName, loanNumber, lenderLoanNumber
- All status/workflow fields
- All closing/funding/compensation fields
- All MCR fields (actionTaken, actionTakenDate, qmStatus)

**Pre-fill for "New App" copies from most recent Deal, not Contact.**

### Loan Model — Add Contact Link

| Field | Type | Notes |
|-------|------|-------|
| contactId | String (FK) | Links to Contact. Replaces borrowerId for CRM purposes. |

**borrowerId stays** — it's the auth identity for the borrower portal. contactId is the CRM identity.

---

## Application Gate (MCR Screener)

A loan becomes an MCR application (AC020) only when ALL 5 Reg B fields are present:

1. **Borrower name** — Contact.firstName + Contact.lastName
2. **SSN / credit pull** — Contact.ssnEncrypted OR Loan.creditScore
3. **Property address** — Loan.propertyAddress (with state)
4. **Loan amount** — Loan.loanAmount
5. **Income** — Contact.monthlyBaseIncome OR Loan.monthlyBaseIncome

Until all 5 are present:
- Loan exists in Core as a prospect/lead
- Loan does NOT appear in MCR push
- Status can be draft → prospect (no MCR)
- `applicationDate` is NULL

When all 5 become present:
- `applicationDate` is auto-set to NOW (or overrideable)
- Loan enters MCR pipeline (AC020 for that quarter)
- Status transitions to `applied` (or stays wherever it is, but MCR now tracks it)

### Implementation

Add to Loan model:
```
applicationDate  DateTime?   // Set when all 5 fields present. NULL = not an MCR app.
isApplication    Boolean     @default(false)  // Computed flag for quick filtering
```

Add a check function (called on every loan save):
```javascript
function checkApplicationGate(loan, contact) {
  const hasName = contact?.firstName && contact?.lastName;
  const hasCredit = contact?.ssnEncrypted || loan.creditScore;
  const hasProperty = loan.propertyAddress?.state && loan.propertyAddress?.street;
  const hasAmount = loan.loanAmount > 0;
  const hasIncome = contact?.monthlyBaseIncome || loan.monthlyBaseIncome;

  return hasName && hasCredit && hasProperty && hasAmount && hasIncome;
}
```

When gate flips from false → true:
- Set `applicationDate = new Date()`
- Set `isApplication = true`
- Create LoanEvent: `eventType: 'application_gate_passed'`

---

## "New App from Contact" Flow

### UI
1. Contact detail page shows "Loan History" — all linked Deals
2. Button: **"+ New Application"**
3. Creates new Loan record pre-filled from Contact + most recent Deal

### Pre-fill Logic

**From Contact:**
- firstName, lastName, email, phone

**From most recent Deal (copied, not linked):**
- SSN (encrypted), DOB (encrypted)
- monthlyBaseIncome, otherMonthlyIncome, otherIncomeSource
- employmentStatus, employerName, positionTitle, yearsInPosition
- presentHousingExpense, maritalStatus, numDependents, dependentAges
- declarations
- creditScore (latest pull)
- occupancy (likely same)
- currentAddress, mailingAddress

**Left blank (new deal):**
- propertyAddress
- loanAmount, loanType, loanTerm, interestRate
- purchasePrice, downPayment, estimatedValue
- purpose, lenderName
- All status/workflow fields (start fresh)
- All dates (start fresh)

### API

```
POST /api/portal/mlo/contacts/:contactId/new-deal
```

Returns new Loan ID. Redirects to loan detail page.

---

## Deal Lifecycle + MCR

```
Prospect (no MCR)
  │ ← all 5 fields present → applicationDate set
  ▼
Application (AC020)
  │
  ├─ FUNDED (AC070) → settled after payroll
  ├─ DENIED (AC040)
  ├─ WITHDRAWN (AC050) → borrower pulled out
  ├─ FILE_CLOSED (AC060) → incomplete, fell through
  └─ IN_PIPELINE (AC080) → carries to next quarter
```

**"Back to Lead" pattern (Cameron Hall):**
1. Deal #1 → application (had property) → file closed (AC060)
2. Contact remains active as a lead
3. When ready → "New Application" → Deal #2 → new MCR application

---

## Migration Path

### Phase 1: Wire Contact ↔ Loan (minimal)
- Add `contactId` FK to Loan model
- For existing loans with `borrowerId`, auto-create/link Contact records
- Add financial profile fields to Contact model
- Build "New App from Contact" API endpoint
- Add application gate check

### Phase 2: Contact Detail Page
- Show Contact profile (financial data, history)
- Show all linked Deals with status badges
- "New Application" button
- Edit Contact financial profile (updates carry to future deals)

### Phase 3: Borrower Application Integration
- When a borrower applies via portal, create/find Contact first
- Loan links to both Borrower (auth) and Contact (CRM)
- Application gate auto-fires when form is submitted (all 5 fields present)

### Phase 4: Zoho/MyHomeIQ Import
- Import into Contact model (not Borrower)
- Match by email, merge duplicates
- Create Deal records from Zoho Loans_001.csv
- Link via DealContact

---

## Decisions (Resolved)

1. **Co-borrowers** — separate Contacts, each linked to loans independently. A co-borrower on one deal can be the primary on another.

2. **LoanBorrower table** — keep and extend. Add `role` field (borrower, co-borrower, co-signer, non-occupant-co-borrower). Already has ordinal for ordering. No need for a separate DealContact table.

3. **"New App" source selection** — MLO picks which Deal to copy from. Contact detail page shows loan history; MLO clicks the loan they want to use as template, hits "New App from this loan." Handles cases where borrower had different deal types (purchase vs refi).
