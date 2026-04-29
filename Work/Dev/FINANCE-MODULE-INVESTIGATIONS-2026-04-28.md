# Finance Module Investigations — PC Side
**Date:** 2026-04-28
**Author:** pc-dev
**Source:** Backlog #142, #143, #144 (Finance Module Audit §8 Q1, Q2, Q8)
**Audit contract:** `Work/Admin/finance/FINANCE-MODULE-AUDIT-2026-04-28.md` (Mac/Tracker)

These are read-only discovery investigations. No code was changed. Mac directs implementation from here.

---

## Summary

Two cross-device paths already exist and are wired. Neither is automatic — both require a human click. The audit §4 funded-event (auto-fire on status transition) is absent. MCR sync direction is correct. Quarterly scheduling doesn't exist.

---

## #142 — Core Finance-Intake Contract

### What PC emits today

Two distinct paths:

**Path 1 — MCR Batch Push** (`src/app/api/portal/mlo/mcr/push/route.js`)
- Trigger: Admin clicks "MCR Push" button in MLO portal
- Sends: All non-draft loans in the pipeline as a batch
- Endpoint: `POST https://tracker.netratemortgage.com/api/mcr/loans`
- Auth: `x-tracker-api-key` header
- Payload shape:
  ```json
  {
    "loans": [
      {
        "ldoxLoanId": "...",
        "borrowerName": "...",
        "loanAmount": 400000,
        "propertyState": "CO",
        "loanType": "conventional",
        "loanPurpose": "purchase",
        "propertyType": "sfr",
        "lienPosition": "first",
        "occupancy": "primary",
        "mloNmlsId": "641790",
        "qmStatus": "qm",
        "eventType": "FUNDED",
        "eventDate": "2026-04-15",
        "applicationDate": "2026-03-01",
        "brokerComp": 4595,
        "loanNumber": "...",
        "creditScore": 780
      }
    ]
  }
  ```
- Status → eventType mapping: `funded→FUNDED`, `denied→DENIED`, `withdrawn→WITHDRAWN`, `archived→FILE_CLOSED`, all others→`IN_PIPELINE`

**Path 2 — Commission Confirmation** (`src/app/api/portal/mlo/loans/[id]/payroll/route.js`)
- Trigger: MLO clicks "Send to Payroll" button after CD approval
- Sends: One per-loan payload with CD-extracted compensation data
- Endpoint: `POST https://tracker.netratemortgage.com/api/payroll/commission-confirmed`
- Auth: `x-tracker-api-key` header
- Payload shape (PC field name → Tracker field name):
  ```
  borrowerNames       → borrowerName
  loanNumber          → loanNumber
  propertyAddress     → propertyAddress
  propertyState       → propertyState
  lenderName          → lender
  loanAmount          → loanAmount
  loanType            → loanType
  loanPurpose         → loanPurpose
  interestRate        → interestRate
  loanTerm            → loanTerm
  grossComp           → grossComp  (fallback: brokerCompensation)
  reimbursements      → reimbursements
  totalReimb          → totalReimb
  wireTotal           → wireTotal
  closingDate         → closingDate
  disbursementDate    → fundingDate
  mloName             → loName
  mloNmls             → loNmls
  confirmedBy         → confirmedBy
  confirmedAt         → confirmedAt
  cdWorkDriveFileId   → cdFilePath
  ```

### Critical gap vs. audit §4

When `loan.status` transitions to `funded` via `PATCH /api/portal/mlo/loans/[id]`, **nothing fires to Tracker automatically**. The handler:
- Updates status in DB ✓
- Logs `status_change` event locally ✓
- Sends borrower email ✓
- **Does NOT post to `/api/mcr/loans`** ✗
- **Does NOT trigger commission-confirmed flow** ✗

The funded-event per audit §4 is entirely absent from the status transition path.

---

## #143 — Send to Payroll Button

### Does the button exist?

**Yes.** Located at `src/components/Portal/PayrollSection.js:881` inside a 5-phase CD flow:

1. Upload CD to Zoho WorkDrive
2. Claude AI extracts CD data
3. MLO reviews extracted data
4. MLO approves extracted data (`cd_approved_at` set)
5. **"Send to Payroll" button** — fires `POST /api/portal/mlo/loans/{id}/payroll`
6. Confirmation view (post-send)

### What does it currently do?

On click, the POST handler (`payroll/route.js:357–467`):
1. Validates loan status = `funded`
2. Validates CD file uploaded
3. Validates `cd_approved_at IS NOT NULL`
4. Validates `payroll_sent_at IS NULL` (prevents double-send)
5. Builds tracker payload from CD-extracted + loan fields
6. Posts to `tracker/api/payroll/commission-confirmed`
7. Sets `payroll_sent_at = NOW()` on the loan
8. Logs `payroll_sent` audit event with payload + tracker response

### Gates today

| Gate | Status |
|------|--------|
| Loan funded | ✓ |
| CD uploaded | ✓ |
| CD approved | ✓ |
| Not already sent | ✓ |
| MLO owns this loan | ✗ Missing |
| CD locked (cannot re-upload) | ✗ Missing |

### Gaps vs. audit §3–4 lock-and-fire spec

1. **No CD lock:** No `cd_locked_at` column. MLO can upload a new CD after sending, which clears `cd_approved_at`, `cd_extracted_data`, and `payroll_sent_at` — effectively un-sending.
2. **No atomic transaction:** `payroll_sent_at` is written before the Tracker POST resolves. If Tracker fails, the local timestamp is already persisted (no rollback).
3. **No MLO-ownership gate:** Any authenticated MLO can send another MLO's loan.

### Estimate to close gaps

3–5 dev-days:
- New `cd_locked_at` DB column (migration)
- Block CD re-upload when locked
- Wrap POST in a transaction (Tracker failure → rollback)
- Add UI lock phase between Approve and Send
- MLO ownership check
- Integration tests for all paths

---

## #144 — MCR Sync Direction

### Direction

**Confirmed correct: PC (Core) → Tracker. One-way push. No reverse flow.**

- PC pushes to `tracker.netratemortgage.com/api/mcr/loans`
- Tracker does not pull from PC
- Tracker does not push MCR data back to PC
- Matches audit assumption

### Gaps vs. quarterly per-period spec

| Item | Status |
|------|--------|
| Core→Tracker direction | ✓ Correct |
| On-demand batch push | ✓ Exists (admin button) |
| Quarterly scheduled push | ✗ Missing — manual only |
| Period-aware batching on PC side | ✗ PC sends all non-draft loans; Tracker derives period from event date |
| All required MCR fields populated | ⚠ Some fields defaulted rather than sourced from loan data |
| Preview endpoint before push | ✓ Exists (`GET /api/portal/mlo/mcr/push`) |

---

## Open Questions for Mac

1. **Funded-event trigger (audit §4):** Should the auto-fire happen at `status → funded` transition (PATCH handler), or stay manual (MLO click) with the atomicity gaps fixed? The current "Send to Payroll" flow is richer (includes CD data) but decoupled from the status change.

2. **CD lock semantics:** Is the lock meant to be a distinct MLO action (separate "Lock" button before "Send"), or should it lock automatically on "Send to Payroll" click?

3. **MCR quarterly cron:** Should this be a PC-side cron job, a Tracker-side cron that calls PC, or an admin-triggered button with a "Q1 2026" period selector? The current manual push sends all periods at once.

4. **Field coverage audit:** The MCR batch currently defaults some fields (occupancy, lien position). Should we do a field-by-field audit against HMDA requirements before scheduling quarterly pushes?

5. **mcr_data_feed export (audit §8):** Is this separate from the existing `/api/mcr/loans` push, or is the existing push already the mcr_data_feed? The backlog item implies a named export; clarify before building.
