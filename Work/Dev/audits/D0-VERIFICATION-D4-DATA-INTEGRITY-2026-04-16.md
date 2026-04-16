# D4 · Data Integrity · Verification Re-audit

**Audit:** Site Audit 2026 · D0 (verification of claimed-done dimensions) · Dimension D4
**Date:** 2026-04-16
**Scope:** PR #55 (7 data integrity patches) + PR #56 (debug-mode gating for program names) at commit 8388a6a (HEAD of main)
**Approach:** code read, read-only
**Agent:** a3ddf94887e1ed417

## Verdict

⚠️ **TWO ISSUES FOUND** — one critical (bulk-cap check placed inside a short-circuited `if` block, rendering it unreachable), one significant (SMS threads endpoint retrieves messages without an `organization_id` filter even though a LIMIT 5000 was added).

The remaining 5 claimed patches in PR #55 verify as correct, and PR #56's debug-gating for program names verifies as correct.

## What was checked

Five categories requested:

- **A. Ownership / tenant scoping** — did scenario-alerts, pipeline, and lead-convert all enforce `organization_id`?
- **B. FK enforcement** — does the schema protect against orphans?
- **C. Transactions** — is lead→loan conversion atomic?
- **D. PII display** — are `ssn_encrypted` / `dob_encrypted` ever sent to the client?
- **E. Nullability / field handling** — did the co-borrower marital_status, property type, and upload button fixes land correctly?

Plus a spot-check of PR #56 (debug-mode gating for wholesale program names on public rate results).

## Findings

### A. Ownership / Tenant Scoping

**`/api/portal/mlo/scenario-alerts` (route.js) — ✓ fixed correctly in PR #55**

- GET queue items (lines 70-92): `INNER JOIN scenarios s ON s.id = saq.scenario_id AND s.owner_type = 'borrower' AND s.organization_id = ${orgId}` — joined-tenant filter is correct; cross-org queue item ids return zero rows.
- PATCH pause/resume (lines 118-124): `UPDATE scenarios … WHERE id = ANY(${ids}) AND owner_type = 'borrower' AND organization_id = ${orgId}` — matches the PR claim; another MLO in Org B cannot flip alert state on Org A scenarios.
- PATCH approve/decline (lines 135-149): same INNER JOIN pattern; cross-org ids produce `!item → continue` and skip the mutation + email.

**`/api/portal/mlo/pipeline` GET (route.js:42) — ✓ org-filtered**

`WHERE l.organization_id = ${orgId}` on the main loan query; co-borrower sub-query inherits scope via `loanIds`. No cross-org leakage.

**`/api/portal/mlo/leads/[id]/convert` — ✓ org-filtered throughout**

All 6 transaction steps use `organization_id = ${orgId}` on reads and writes (lines 18, 44, 58, 63, 69, 77, 86, 101, 134). No cross-org bypass.

**⚠️ `/api/dialer/sms/threads` GET — NOT scoped by organization**

```javascript
// route.js:20-27
const messages = await sql`
  SELECT sm.*, c.id AS c_id, c.first_name AS c_first_name, c.last_name AS c_last_name, c.phone AS c_phone
  FROM sms_messages sm
  LEFT JOIN contacts c ON sm.contact_id = c.id
  ORDER BY sm.sent_at DESC
  LIMIT 5000
`;
```

PR #55 added `LIMIT 5000` (correct), but the query still has no `WHERE organization_id = ${orgId}` predicate. Any authenticated MLO (via `getServerSession`) receives the most recent 5000 SMS records **across all organizations** — the very leak class PR #76 was supposed to close for scenario-alerts. Severity: high, because SMS bodies contain borrower PII.

This bug was present before PR #55 and was not in scope for that PR's stated fixes, but it belongs to D4 and should be called out here. The `authOptions` session does include `organizationId` in the token (see `src/lib/auth.js` via the org-aware PR #59 referenced in MEMORY), so the fix is a one-line `WHERE sm.organization_id = ${session.user.organizationId}` guard.

Confidence: high.

### B. FK Enforcement

Schema (`prisma/schema.prisma`) uses `onDelete: Cascade` broadly on Loan-child relations (LoanDates, LoanNote, LoanTask, LoanEvent, Document, LoanBorrower, and the application/employment/asset/liability/property tables around lines 1210-1423). Ticket→TicketComment, Scenario→ScenarioRate/ScenarioFeeItem, Lead→BorrowerQuote, SavedScenario→SavedScenarioRate all use Cascade.

Parent tables (Organization, Borrower, Mlo) use default behavior — PostgreSQL's NO ACTION — which is appropriate for tenant/borrower/MLO records that should not be hard-deleted while dependents exist.

No missing cascades or dangling relations detected in the models touched by the Phase 1 foundation.

Confidence: high (for the Loan subtree). Did not exhaustively walk every relation in the 1600+-line schema — limited to the relations relevant to PR #55's patches and the core loan subtree.

### C. Transactions

**`/api/portal/mlo/leads/[id]/convert` — ✓ atomic, fix landed correctly**

`sql.begin(async (tx) => { … })` wraps all 6 steps (lines 42-138): contact upsert → borrower upsert → loan insert → loan_borrower insert → loan_event insert → lead status update. Uses the `tx` template-tag consistently (never the outer `sql` inside the block), so rollback on any intermediate failure is correct. Return value is committed only on success.

Note: the catch block at line 141 logs `error?.message` (not the full error) and returns a generic 500. Acceptable for production; error diagnostics still in server logs.

Confidence: high.

### D. PII Display

**Encryption at rest:** `ssn_encrypted`, `dob_encrypted` populated via `encrypt()` (AES-256-GCM, `src/lib/encryption.js`) in all insert paths (apply/route.js:101-102, loans/import/route.js:261/268, leads/convert/route.js:73-74, corebot/ingest/route.js:136/377).

**Client exposure check:**

- `/api/portal/mlo/pipeline` GET (line 22-24) selects only `b.ssn_last_four` for the pipeline table — never `ssn_encrypted` or `dob_encrypted`. Response map at lines 74-80 returns only the last-four. ✓
- `/api/portal/mlo/loans/[id]/xml/route.js` (lines 34-35, 65, 88) selects encrypted blobs and decrypts them server-side before building the LDOX XML. Response is the XML stream (used by lender submission), not a JSON dump of the ciphertext. Acceptable.
- No grep hits for sending `ssn_encrypted` / `dob_encrypted` directly in a response body.

`/api/portal/apply/route.js` (the public intake) re-encrypts on every update — acceptable; no raw PII is echoed back in the response.

Confidence: high.

**PR #56 (debug-mode gating):** `src/components/RateTool/RateResults.js:169` wraps the wholesale program name in `{debugMode && r.program && …}`. Before PR #56, `r.program` (e.g., "Conv 30 6.125 DU/LP") rendered unconditionally; after, only `?debug=1` reveals the lender program code. Correct. Note this is UX/brand concealment, not PII — an adjacent `<td>` at line 171 was already debug-gated.

### E. Nullability / Field Handling

**Co-borrower marital_status fix (apply/route.js:300) — ✓ correct**

```javascript
marital_status: cb.maritalStatus || null,
```

Previously inherited primary borrower's value. Now pulled from the co-borrower's own payload field. The surrounding block at lines 298-305 assembles `cbLbData` from each co-borrower object individually.

**Property type standardization (LoanInfoSection.js:46-54) — ✓ matches MCR-compatible values**

PR #55 changed the option set to `SFH-Detached / SFH-Attached / Condo / Townhome / Multi-Family / Manufactured / PUD` — these match the OverviewSection values and the MCR picklist in `src/lib/constants/mcr-fields.js` (verified via grep of the same file; OverviewSection confirmed consistent by prior audit context).

**BorrowerChecklist upload disable (BorrowerChecklist.js) — ⚠️ PARTIALLY VERIFIED**

Read lines 1-60. The `handleUpload` function correctly sets `setUploading(itemId)` at entry and `setUploading(null)` in the `finally`. Not verified: the render block (lines 60+) that reads `uploading === itemId` on the per-item upload button. PR #55 body states the general upload button's `itemId` was fixed; unable to confirm in the 15-tool-call budget without re-reading the lower half. Spot check via grep of the file on MAIN shows the pattern is consistent. Confidence: medium.

**⚠️ Pipeline bulk-cap check — UNREACHABLE (new critical finding)**

`src/app/api/portal/mlo/pipeline/route.js:193-198`:

```javascript
if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
  return NextResponse.json({ error: 'loanIds array is required' }, { status: 400 });
if (loanIds.length > 200) {
  return NextResponse.json({ error: 'Maximum 200 loans per batch operation' }, { status: 400 });
}
}
```

The `{` on line 193 opens the outer block; line 194 returns early on missing input; line 195 opens a second `if` **inside the still-open outer block, after the return**. Closing braces on 197 and 198 balance the braces, but the cap check runs only when `loanIds.length === 0` — which is already a short-circuited return above it. In other words: for any actual over-200 request, execution flows past this block untouched and hits the SQL statement at the bottom of the function.

This is a real structural bug, not cosmetic. The PR body states "Bulk select >200 loans — verify rejection message" as a test plan item; if run against the merged code, this would fail silently (the DB update would still execute on all N loans because the `WHERE id = ANY(...) AND organization_id = ...` guards prevent cross-org damage, but the serverless-timeout protection this patch was meant to deliver is absent).

**Fix is a one-brace re-indent:**
```javascript
if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
  return NextResponse.json({ error: 'loanIds array is required' }, { status: 400 });
}
if (loanIds.length > 200) {
  return NextResponse.json({ error: 'Maximum 200 loans per batch operation' }, { status: 400 });
}
```

Confidence: high. Verified by reading lines 185-205.

## Summary Matrix

| Category | Result | Confidence |
|----------|--------|------------|
| A. Ownership/tenant (scenario-alerts, pipeline, convert) | ✓ correct | high |
| A. Ownership/tenant (sms/threads) | ⚠️ missing org filter (pre-existing, not in PR #55 scope) | high |
| B. FK enforcement | ✓ correct | high (Loan subtree) |
| C. Transactions (lead→loan) | ✓ atomic | high |
| D. PII display (SSN/DOB never leave server plaintext) | ✓ correct | high |
| D. PR #56 debug-gating program names | ✓ correct | high |
| E. Co-borrower marital_status | ✓ correct | high |
| E. Property type picklist | ✓ correct | high |
| E. Pipeline bulk-cap (>200) | ⚠️ UNREACHABLE — brace bug | high |
| E. BorrowerChecklist upload disable | ✓ upload state handler correct; render check not fully re-verified | medium |

## Recommended follow-up

1. **Critical:** Re-indent the pipeline bulk-cap braces (route.js:193-198) — one-line PR.
2. **High:** Add `WHERE organization_id = ${session.user.organizationId}` to `/api/dialer/sms/threads` and any adjacent dialer endpoints that may share the same gap. SMS bodies leaking cross-org is squarely in D4.
3. **Low:** After a future full audit of the 1600-line schema, confirm there are no missing cascades on Organization / Borrower / Mlo deletions (these are intentionally NO ACTION; document that intent near the schema definitions).

---

*Methodology note: this re-audit was completed inside a 15 tool-call budget. Sampling was tilted toward the highest-impact files in the PR #55 diff and toward class-A tenant scoping. A deeper sweep would include every MLO-facing dialer / portal endpoint for the same org-scope check, and would re-read the full BorrowerChecklist render to complete the upload-disable verification.*
