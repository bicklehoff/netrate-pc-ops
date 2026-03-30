---
name: core-payroll
description: "CORE payroll workflow for funded loans — CD extraction, comp split, MLO approval, TrackerPortal integration, person reconciliation. Use when working on CD uploads, payroll processing, commission calculation, funded loan workflows, or when a dev session can't find a CD."
---

# CORE Payroll

Payroll processing for funded loans. MLO uploads CD → Claude extracts data → comp split calculated → MLO reviews/approves → POSTs to TrackerPortal.

## Working Directory

`D:\PROJECTS\netrate-pc-ops`

## Flow

```
Upload CD → Extract via Claude (15s) → Show comparison + comp breakdown
→ MLO classifies extra persons (co-borrower/NBS) → MLO approves
→ CD data written to loan record → POST to TrackerPortal → Done
```

## Comp Plan

**Decision:** House fee = 12.948857% of gross broker compensation. LO gets the remainder.

```
Gross Comp (from CD):     $4,410.00
NetRate House Fee (12.95%): -$571.04
LO Commission:            $3,838.96
```

Reimbursements (appraisal, credit report, misc) pass through the wire but are NOT part of the comp split.
Wire Total = Gross Comp + Reimbursements.

Calculated locally — no TrackerPortal dependency for the split.

## How to Find the Closing Disclosure

CD PDF lives in WorkDrive CLOSING subfolder. Reference stored on the loan record.

### Database Fields (snake_case SQL / camelCase Prisma)

```
-- CD fields
cd_work_drive_file_id    (cdWorkDriveFileId)
cd_file_name             (cdFileName)
cd_extracted_data        (cdExtractedData) — JSON with status + data
cd_processed_at          (cdProcessedAt)
cd_approved_at           (cdApprovedAt)
cd_approved_by           (cdApprovedBy)

-- Loan fields written on CD approval
lender_loan_number       (lenderLoanNumber) — from CD, different from internal loanNumber
closing_date             (closingDate) — Date
funding_date             (fundingDate) — Date
broker_compensation      (brokerCompensation) — Decimal
monthly_payment          (monthlyPayment) — Decimal
total_closing_costs      (totalClosingCosts) — Decimal
cash_to_close            (cashToClose) — Decimal
lender_credits           (lenderCredits) — Decimal

-- Borrower fields (nickname detection)
legal_first_name         (legalFirstName) — from CD
legal_last_name          (legalLastName) — from CD
nickname                 (nickname) — the on-file first name if different from legal

-- Payroll
payroll_sent_at          (payrollSentAt)
```

### Query: Funded Loans by Payroll State

```sql
-- Needs CD upload
SELECT * FROM loans WHERE status = 'funded' AND cd_work_drive_file_id IS NULL;

-- Awaiting review/approval
SELECT * FROM loans WHERE status = 'funded' AND cd_work_drive_file_id IS NOT NULL AND cd_approved_at IS NULL;

-- Approved, ready to send
SELECT * FROM loans WHERE status = 'funded' AND cd_approved_at IS NOT NULL AND payroll_sent_at IS NULL;

-- Sent to payroll
SELECT * FROM loans WHERE status = 'funded' AND payroll_sent_at IS NOT NULL;
```

## CD Extraction

**File:** `src/lib/cd-extractor.js`

Accepts file buffer directly (from upload) or WorkDrive file ID (fallback). Sends PDF to Claude via `askClaudeWithDocs()`.

**Extracted fields:**
loanAmount, interestRate, monthlyPI, loanTerm, totalClosingCosts, cashToClose, lenderCredits, brokerCompensation, appraisalReimb, creditReimb, miscReimb, totalDueToBroker, propertyAddress, borrowerNames (array of {firstName, lastName}), closingDate, disbursementDate, loanNumber, loanType, lenderName, prepaidInterest, escrowsAtClosing, totalLoanCosts, totalOtherCosts

**Key:** `borrowerNames` returns an array, not a string. Each element: `{ firstName, lastName }`.

## API Endpoints

**Route:** `src/app/api/portal/mlo/loans/[id]/payroll/route.js`

| Method | Action | Details |
|--------|--------|---------|
| GET | Status + details | Returns CD/extraction/approval/payroll fields, relatedLoans (dup check), payrollDetails (from latest successful payroll_sent event) |
| PUT | Upload CD + extract | Uploads to WorkDrive, passes file buffer to Claude (no re-download), returns extraction + relatedLoans |
| PATCH | Approve/dispute | Approve: writes CD data to loan, handles nickname + co-borrower/NBS creation. Dispute: clears CD |
| POST | Send to payroll | Requires cdApprovedAt. Reads reimbursements from cdExtractedData, calculates wireTotal, POSTs to TrackerPortal |

### PATCH Approve Details

On approve, the handler:
1. Writes CD-extracted values to loan record (loanAmount, interestRate, loanType, lenderName, lenderLoanNumber, closingDate, fundingDate, brokerCompensation, monthlyPayment, totalClosingCosts, cashToClose, lenderCredits)
2. If `nicknameConfirmed`: stores legalFirstName/legalLastName/nickname on borrower
3. For each `unmatchedPersons` with role assigned:
   - `co_borrower`: creates Borrower record + LoanBorrower link + optional Contact
   - `nbs`: creates Contact only (no borrower/loan link)

### POST TrackerPortal Payload

```
POST https://tracker.netratemortgage.com/api/payroll/commission-confirmed
Header: x-tracker-api-key: <TRACKER_API_KEY env var>
```

Sends: borrowerName, loanNumber, propertyAddress, propertyState, lender, loanAmount, loanType, loanPurpose, interestRate, loanTerm (years), grossComp, appraisalReimb, creditReimb, miscReimb, wireTotal, closingDate, fundingDate, loName, loNmls, confirmedBy, confirmedAt

Returns: `{ success, id, cdNumber, status, wireTotal, loName, loCompAmount }`

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/cd-extractor.js` | CD extraction: file buffer → Claude → structured JSON |
| `src/app/api/portal/mlo/loans/[id]/payroll/route.js` | API: GET/PUT/PATCH/POST handlers |
| `src/components/Portal/PayrollSection.js` | UI: 6-phase flow with comp breakdown, nickname detection, person reconciliation |
| `src/components/Portal/CompensationSection.js` | Standalone comp section on loan overview (visible after CD approved) |
| `src/lib/zoho-workdrive.js` | WorkDrive: upload, download, folder creation |
| `src/lib/anthropic.js` | Claude API: askClaudeWithDocs() |

## UI Components

### PayrollSection (6 phases)

| Phase | Condition | UI |
|-------|-----------|-----|
| 1. Upload | No CD | Drag-and-drop upload |
| 2. Extracting | Upload in progress | Spinner (~15s) |
| 3. Error | extraction failed | Error + retry. On catch, verifies server state before showing error |
| 4. Review | Extracted, not approved | Comparison table ("From CD" blue / "On File" gray), comp breakdown, nickname prompt, person reconciliation, Approve/Dispute buttons |
| 5. Approved | Approved, not sent | Verified CD summary + Send to Payroll |
| 6. Sent | payrollSentAt set | Payroll Confirmation (CD#, wire, LO comp) + Submitted Data |

**Review phase includes:**
- Comparison table with Match/New/Mismatch badges (text comparison normalized: case, punctuation, whitespace)
- Compensation Breakdown: Broker Comp → House Fee (12.95%) → Your Commission
- Reimbursements (pass-through): appraisal, credit report, misc
- Expected Wire Total
- Nickname detection (same last name, different first → "Is X a nickname for Y?")
- Person reconciliation (extra people on CD → classify as Co-Borrower or NBS)
- Approve blocked until all persons classified

### CompensationSection

Standalone section on loan overview. Shows once CD is approved. Calculates comp split locally (12.948857% house fee). Shows LO commission, house fee, reimbursements, wire total, TrackerPortal status.

## Duplicate Loan Check

On CD upload (PUT) and status check (GET), queries for other loans with same borrowerId that aren't settled/cancelled. Shows warning banner with loan details and MCR compliance note.

## Audit Events

| event_type | Icon | When |
|---|---|---|
| `cd_uploaded` | 📕 | CD PDF uploaded |
| `cd_extracted` | 🔍 | Claude extraction succeeded |
| `cd_extraction_failed` | ⚠️ | Extraction failed |
| `cd_approved` | ✅ | MLO approved (includes fieldsUpdated, nicknameUpdate, personsCreated) |
| `cd_disputed` | ❌ | MLO disputed, CD cleared |
| `payroll_sent` | 💰 | Sent to payroll (includes trackerPayload + trackerResult) |

## Known Issues / Patterns

- **Upload takes 15s** — Claude extraction is synchronous. AbortController set to 60s. If response times out, catch block verifies server state before showing error.
- **window.location.reload()** used after all actions (upload, approve, dispute, send) to ensure fresh state.
- **TrackerPortal API key** stored in `TRACKER_API_KEY` env var (Vercel + local .env).

## Planned (Not Yet Built)

1. **MCR Quote vs Application** — Governance decision pending. Need to distinguish quotes from applications. Relay sent to Mac + Claw.
2. **Lender Change Detection** — When CD shows different lender than loan record, flag for MCR disposition of old lender submission.
3. **Funded → Settled Transition** — Auto-transition after payroll confirmed. Currently `funded` is terminal.
4. **Comp plan in DB** — Move house fee rate from hardcoded constant to broker_config table.
5. **Contact dedup** — Check existing contacts before offering "Save as contact" for co-borrowers/NBS.
