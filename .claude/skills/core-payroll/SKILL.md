---
name: core-payroll
description: "CORE payroll workflow for funded loans — how to find the Closing Disclosure, CD extraction, MLO approval, and payroll submission. Use when working on CD uploads, payroll processing, commission calculation, funded loan workflows, or when a dev session can't find a CD."
---

# CORE Payroll

Payroll processing for funded loans. The MLO uploads the final Closing Disclosure, system auto-extracts data via Claude, MLO reviews and approves, then sends to payroll.

## Working Directory

`D:\PROJECTS\netrate-pc-ops`

## Flow

```
Upload CD → Auto-Extract via Claude → MLO Reviews → MLO Approves → Send to Payroll
```

1. Loan reaches `funded` status
2. MLO uploads final CD PDF → stored in WorkDrive CLOSING folder
3. System downloads CD from WorkDrive, sends to Claude for structured extraction
4. MLO sees extracted data compared to loan record (match/mismatch/new)
5. MLO approves or disputes
6. If approved, MLO clicks "Send to Payroll" → stamps `payrollSentAt`

## How to Find the Closing Disclosure

The CD PDF lives in Zoho WorkDrive's CLOSING subfolder. The reference is stored on the loan record.

### Database (snake_case in raw SQL, camelCase in Prisma)

```
-- Loan table fields
cd_work_drive_file_id  -- WorkDrive file ID (Prisma: cdWorkDriveFileId)
cd_file_name           -- Original filename (Prisma: cdFileName)
cd_extracted_data      -- JSON extraction result (Prisma: cdExtractedData)
cd_processed_at        -- When extraction ran (Prisma: cdProcessedAt)
cd_approved_at         -- When MLO approved (Prisma: cdApprovedAt)
cd_approved_by         -- MLO user ID who approved (Prisma: cdApprovedBy)
payroll_sent_at        -- When sent to payroll (Prisma: payrollSentAt)
work_drive_folder_id   -- Root WorkDrive folder (Prisma: workDriveFolderId)
work_drive_subfolders  -- JSON with SUBMITTED, EXTRA, CLOSING folder IDs (Prisma: workDriveSubfolders)
```

### Query: Loans with a CD uploaded

```sql
SELECT l.id, l.status, b.first_name, b.last_name,
       l.cd_work_drive_file_id, l.cd_file_name, l.cd_extracted_data, l.cd_approved_at, l.payroll_sent_at
FROM loans l
LEFT JOIN borrowers b ON l.borrower_id = b.id
WHERE l.cd_work_drive_file_id IS NOT NULL;
```

```js
// Prisma
const loans = await prisma.loan.findMany({
  where: { cdWorkDriveFileId: { not: null } },
  include: { borrower: { select: { firstName: true, lastName: true } } },
});
```

### Query: CD upload event history

```sql
SELECT id, loan_id, event_type, details, created_at
FROM loan_events
WHERE event_type IN ('cd_uploaded', 'cd_extracted', 'cd_approved', 'cd_disputed', 'cd_extraction_failed')
ORDER BY created_at DESC;
```

### WorkDrive folder structure

Each loan gets a WorkDrive folder under `[MLO Name]/[Borrower Last Name]` with subfolders:
- `SUBMITTED` — docs sent to lender
- `EXTRA` — supplemental docs
- `CLOSING` — final CD and closing docs (this is where the CD lives)

## How to Find Funded Loans by Payroll State

```sql
-- Funded, no CD yet (needs upload)
SELECT * FROM loans WHERE status = 'funded' AND cd_work_drive_file_id IS NULL;

-- CD uploaded, extraction pending or failed
SELECT * FROM loans WHERE status = 'funded' AND cd_work_drive_file_id IS NOT NULL AND cd_approved_at IS NULL;

-- CD approved, not yet sent to payroll
SELECT * FROM loans WHERE status = 'funded' AND cd_approved_at IS NOT NULL AND payroll_sent_at IS NULL;

-- Sent to payroll
SELECT * FROM loans WHERE status = 'funded' AND payroll_sent_at IS NOT NULL;
```

```js
// Prisma equivalents
// Needs CD upload
await prisma.loan.findMany({ where: { status: 'funded', cdWorkDriveFileId: null } });

// Awaiting MLO review/approval
await prisma.loan.findMany({ where: { status: 'funded', cdWorkDriveFileId: { not: null }, cdApprovedAt: null } });

// Approved, ready to send
await prisma.loan.findMany({ where: { status: 'funded', cdApprovedAt: { not: null }, payrollSentAt: null } });

// Sent
await prisma.loan.findMany({ where: { status: 'funded', payrollSentAt: { not: null } } });
```

## CD Extraction

**File:** `src/lib/cd-extractor.js`

Uses the same pattern as `src/lib/corebot/processor.js`:
1. `downloadFile(fileId)` from WorkDrive → stream → Uint8Array → base64
2. Send to `askClaudeWithDocs()` with structured prompt
3. Returns `{ status: 'success', data: {...}, extractedAt }` or `{ status: 'error', error: '...', extractedAt }`

**Extracted fields:**
loanAmount, interestRate, monthlyPI, loanTerm, totalClosingCosts, cashToClose, lenderCredits, brokerCompensation, propertyAddress, borrowerNames, closingDate, disbursementDate, loanNumber, loanType, prepaidInterest, escrowsAtClosing, totalLoanCosts, totalOtherCosts

**cdExtractedData JSON shape (on success):**
```json
{
  "status": "success",
  "data": {
    "loanAmount": 630000,
    "interestRate": 5.875,
    "monthlyPI": 3727,
    "brokerCompensation": 8500,
    ...
  },
  "extractedAt": "ISO timestamp"
}
```

## API Endpoints

**Route:** `src/app/api/portal/mlo/loans/[id]/payroll/route.js`

| Method | Action | Details |
|--------|--------|---------|
| GET | Payroll status | Returns all CD/extraction/approval/payroll fields + computed booleans |
| PUT | Upload CD + extract | Uploads to WorkDrive, clears previous state, triggers Claude extraction |
| PATCH | Approve/dispute | `{ action: 'approve' }` or `{ action: 'dispute' }` — dispute clears CD |
| POST | Send to payroll | Requires `cdApprovedAt` set. Stamps `payrollSentAt`, creates audit event |

## Payroll Data Payload

When "Send to Payroll" fires, a `payroll_sent` LoanEvent is created with full snapshot including `cdExtractedData` and `cdApprovedAt`.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/cd-extractor.js` | CD extraction: WorkDrive → Claude → structured JSON |
| `src/app/api/portal/mlo/loans/[id]/payroll/route.js` | API: GET/PUT/PATCH/POST handlers |
| `src/components/Portal/PayrollSection.js` | UI: 6-phase component (upload → extracting → error/review → approved → sent) |
| `src/app/api/portal/mlo/loans/[id]/files/route.js` | File management: auto-routes CDs, SMS notify |
| `src/lib/zoho-workdrive.js` | WorkDrive: upload, download, folder creation |
| `src/lib/anthropic.js` | Claude API: askClaudeWithDocs() for PDF extraction |
| `src/components/Portal/Core/LoanSidebar.js` | Shows PayrollSection when `loan.status === 'funded'` |

## UI Phases (PayrollSection.js)

| Phase | Condition | UI |
|-------|-----------|-----|
| 1. Upload | No CD | Drag-and-drop upload |
| 2. Extracting | Upload in progress | Spinner "Uploading & extracting CD data..." |
| 3. Error | `extraction.status === 'error'` | Error + retry/re-upload |
| 4. Review | Extracted, not approved | Comparison table (CD vs On File), Approve/Dispute buttons |
| 5. Approved | Approved, not sent | Green badge + Send to Payroll button |
| 6. Sent | `payrollSentAt` set | Confirmation with timestamp |

## Audit Events

| event_type | Icon | When |
|---|---|---|
| `cd_uploaded` | 📕 | CD PDF uploaded to WorkDrive |
| `cd_extracted` | 🔍 | Claude extraction succeeded |
| `cd_extraction_failed` | ⚠️ | Claude extraction failed |
| `cd_approved` | ✅ | MLO approved extracted data |
| `cd_disputed` | ❌ | MLO disputed, CD cleared |
| `payroll_sent` | 💰 | Sent to payroll |

## Constraints

- CD upload only allowed when `status = 'funded'`
- Must be PDF, max 25 MB
- Extraction runs synchronously during upload (~10-15 seconds)
- "Send to Payroll" requires `cdApprovedAt` (approval gate)
- Dispute clears CD + extraction — MLO must re-upload
- Uploading a new CD resets extraction, approval, and payrollSentAt

## Planned (Not Yet Built)

1. **Comp Plan / Commission Calculation** — Calculate expected MLO commission from comp plan rules. Show alongside extracted data. Needs David's comp structure.
2. **TrackerPortal API Push** — Send confirmed commission data to Mac's TrackerPortal for payroll processing.
3. **Funded → Settled Transition** — Auto-transition after payroll confirmed. Currently `funded` is terminal.
