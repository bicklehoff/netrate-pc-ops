# D5 · Org Scoping · Verification Re-audit

**Audit:** Site Audit 2026 · D0 · Dimension D5
**Date:** 2026-04-15
**Scope:** Every MLO/borrower API route at commit 4a8a5ad checked for WHERE organization_id

## Verdict

🔴 **CRITICAL FINDING** — one cross-org data leak in `/api/portal/mlo/scenario-alerts` GET. All other 43 MLO routes verified clean.

## Route inventory (44 routes checked)

| # | Route | Method | Session check | WHERE org_id | Status |
|---|-------|--------|:---:|:---:|---|
| 1 | `/mlo/leads` | GET/POST | ✅ | ✅ | PASS |
| 2 | `/mlo/leads/[id]` | GET/PATCH | ✅ | ✅ | PASS |
| 3 | `/mlo/leads/[id]/quote` | POST | ✅ | ✅ | PASS |
| 4 | `/mlo/leads/[id]/convert` | POST | ✅ | ✅ | PASS |
| 5 | `/mlo/contacts` | GET/POST | ✅ | ✅ | PASS |
| 6 | `/mlo/contacts/[id]` | GET | ✅ | ✅ | PASS |
| 7 | `/mlo/contacts/[id]` | PATCH | ✅ | ✅ | PASS |
| 8 | `/mlo/contacts/[id]/loans` | GET | ✅ | ✅ | PASS |
| 9 | `/mlo/contacts/[id]/notes` | GET/POST | ✅ | ✅ | PASS |
| 10 | `/mlo/contacts/[id]/create-lead` | POST | ✅ | ✅ | PASS |
| 11 | `/mlo/contacts/[id]/new-deal` | POST | ✅ | ✅ | PASS |
| 12 | `/mlo/contacts/[id]/actions` | GET | ✅ | ✅ | PASS |
| 13 | `/mlo/quotes` | GET/POST | ✅ | ✅ | PASS |
| 14 | `/mlo/quotes/[id]` | GET/PATCH | ✅ | ✅ | PASS |
| 15 | `/mlo/quotes/[id]/send` | POST | ✅ | ✅ | PASS |
| 16 | `/mlo/quotes/[id]/price` | POST | ✅ | ✅ | PASS |
| 17 | **`/mlo/scenario-alerts`** | **GET** | ✅ | ⚠️ | **CRITICAL** |
| 18 | `/mlo/scenario-alerts` | PATCH | ✅ | ✅ | PASS |
| 19 | `/mlo/loans` | GET | ✅ | ✅ | PASS |
| 20 | `/mlo/loans/[id]` | GET/PATCH | ✅ | ✅ | PASS |
| 21 | `/mlo/loans/[id]/tasks` | GET/POST | ✅ | ✅ | PASS |
| 22 | `/mlo/loans/[id]/tasks/[taskId]` | PATCH/DELETE | ✅ | ✅ | PASS |
| 23 | `/mlo/loans/[id]/files` | GET/PUT/DELETE | ✅ | ✅ | PASS |
| 24 | `/mlo/loans/[id]/files/create-folder` | POST | ✅ | ✅ | PASS |
| 25 | `/mlo/loans/[id]/files/move` | PATCH | ✅ | ✅ | PASS |
| 26 | `/mlo/loans/[id]/docs` | GET/POST/PATCH | ✅ | ✅ | PASS |
| 27 | `/mlo/loans/[id]/conditions` | GET/POST/PATCH/PUT | ✅ | ✅ | PASS |
| 28 | `/mlo/loans/[id]/dates` | GET/PATCH | ✅ | ✅ | PASS |
| 29 | `/mlo/loans/[id]/contact` | PATCH | ✅ | ✅ | PASS |
| 30 | `/mlo/loans/[id]/ssn` | PATCH | ✅ | ✅ | PASS |
| 31 | `/mlo/loans/[id]/geocode` | POST | ✅ | ✅ | PASS |
| 32 | `/mlo/loans/[id]/payroll` | GET/POST | ✅ | ✅ | PASS |
| 33 | `/mlo/loans/[id]/application` | GET/PATCH | ✅ | ✅ | PASS |
| 34 | `/mlo/loans/[id]/xml` | GET | ✅ | ✅ | PASS |
| 35 | `/mlo/loans/import` | POST | ✅ | ✅ | PASS |
| 36 | `/mlo/tickets` | GET/POST | ✅ | ✅ | PASS |
| 37 | `/mlo/tickets/[id]` | GET/PATCH/DELETE | ✅ | ✅ | PASS |
| 38 | `/mlo/tickets/[id]/entries` | GET/POST | ✅ | ✅ | PASS |
| 39 | `/mlo/accounts` | GET/POST | ✅ | ✅ | PASS |
| 40 | `/mlo/hecm-scenarios` | GET/POST | ✅ | ✅ | PASS |
| 41 | `/mlo/hecm-scenarios/[id]` | GET/PATCH/DELETE | ✅ | ✅ | PASS |
| 42 | `/mlo/pipeline` | GET/PATCH | ✅ | ✅ | PASS |
| 43 | `/portal/quotes/[id]` (magic token) | GET | ✅ token-scoped | ✅ | PASS |
| 44 | `/portal/loans` (borrower) | GET | ✅ borrower-scoped | ✅ | PASS |

## Critical finding

### 🔴 `/api/portal/mlo/scenario-alerts` GET — cross-org data leak

**File:** `src/app/api/portal/mlo/scenario-alerts/route.js`
**Lines:** 66-85 (GET default view)

Current code:

```javascript
const queueItems = await sql`
  SELECT saq.*,
    json_build_object(...)
  FROM scenario_alert_queue saq
  LEFT JOIN scenarios s ON s.id = saq.scenario_id AND s.owner_type = 'borrower'
  LEFT JOIN leads l ON l.id = s.lead_id
  WHERE (${effectiveStatus}::text IS NULL OR saq.status = ${effectiveStatus})
    AND (${searchPattern}::text IS NULL OR l.name ILIKE ${searchPattern} OR l.email ILIKE ${searchPattern})
  ORDER BY saq.created_at DESC
`;
```

**Missing scope:** `AND s.organization_id = ${orgId}` in either the JOIN condition or WHERE clause.

**Impact:**
- An MLO from Organization A can see all scenario-alert queue items from every organization
- Cross-org data exposed: borrower names, emails, loan amounts (joined from `leads`)
- Privacy / compliance breach if any second organization ever exists in the system

**Attack vector:**
1. MLO A (Org A) logs into their MLO portal
2. Requests `GET /api/portal/mlo/scenario-alerts`
3. Response includes queue items for all orgs (A, B, C, …)
4. MLO A reads borrower PII belonging to other brokers

**Timeline:**
- Route added or modified in PR #68 ("Migrate Saved Scenario + Alert APIs", 2026-04-15, commit 88c1f1a)
- Org scoping on MLO routes was established in PR #60 (2026-04-14). This route landed after and was not covered by #60's sweep.

**Fix (one line):**

```javascript
LEFT JOIN scenarios s ON s.id = saq.scenario_id
  AND s.owner_type = 'borrower'
  AND s.organization_id = ${orgId}   // ← add this
```

or equivalently in the WHERE clause:

```javascript
WHERE s.organization_id = ${orgId}
  AND (${effectiveStatus}::text IS NULL OR saq.status = ${effectiveStatus})
  AND (...)
```

Both forms are correct. Adding to the JOIN is slightly safer because it also filters out orphan `scenario_alert_queue` rows whose scenario was deleted.

**Severity:** CRITICAL in a multi-tenant world. Currently low blast radius because NetRate is the only active org, but the whole point of the org-scoping dimension is to be ready for the shop-ready target. This is a data-leak bug by architecture.

## Auth & session layer — PASS

- `src/lib/require-mlo-session.js:35` — correctly extracts `organizationId` from the MLO session JWT and returns `{ session, orgId, mloId }` to all callers
- `src/lib/auth.js:65` — JWT callback embeds `organizationId` in the token
- `src/lib/auth.js:76` — session callback exposes it on `session.user.organizationId`
- `src/lib/borrower-session.js` — borrower auth uses magic-link tokens; borrowers are person-scoped, not org-scoped (by design)

## DAL / helper layer — PASS

`src/lib/scenarios/db.js`:

- `getScenarioById(id, orgId)` — enforces `WHERE organization_id = ${orgId}` (line 175)
- `listScenarios({ orgId, ... })` — all queries scoped (lines 216, 230, ...)
- `updateScenario(id, orgId, fields)` — WHERE `id = $1 AND organization_id = $2` (line 287)
- `deleteScenario(id, orgId)` — scoped delete (line 325)

All rate/fee operations inherit scenario org scope via FK cascade.

## Request body validation — PASS

No route accepts `organization_id` / `orgId` / `org_id` from the request body. Every org assignment comes from the session. Checked via grep across all MLO routes (0 matches).

## Magic-link / public APIs — PASS

- `/api/portal/quotes/[id]?token=...` — validates magic token first, then calls `getScenarioById(id, borrower.organization_id)` — scope comes from the token's borrower record, not client
- `/api/portal/loans` (borrower) — uses `requireBorrowerAuth()`; borrower-scoped by user ID, not org-scoped (correct for person-scoped resources)

## Nested resource checks — PASS

Sample checks:

- `/mlo/loans/[id]/tasks` — parent loan access verified: `WHERE id = ${id} AND organization_id = ${orgId}`
- `/mlo/loans/[id]/conditions` — `verifyMloAccess()` helper enforces `organization_id = ${orgId}`
- `/mlo/contacts/[id]/loans` — query scoped: `l.organization_id = ${orgId}`
- `/mlo/leads/[id]/convert` — transactional 6-step create enforces org on every step (lines 44, 49, 69, 86, ...)

## Post-PR #60 routes (regression candidates)

- **PR #67 — MLO quote APIs** (`/mlo/quotes/*`): ✅ scoped via the `listScenarios()` DAL
- **PR #68 — Borrower scenario + alert APIs**: ✅ scenario writes scoped via DAL; ⚠️ **scenario-alerts GET missing scope** (this finding)
- **PR #72 — DSCR routes** (`/api/pricing/dscr`): N/A — public pricing, no auth required, no org scope relevant

## Recommended next actions

1. **Immediate:** fix `src/app/api/portal/mlo/scenario-alerts/route.js` GET — add `AND s.organization_id = ${orgId}` to the JOIN
2. **Defense-in-depth:** add a test case asserting that MLO A's GET response to `/mlo/scenario-alerts` contains only Org A's queue items (once a second seed org exists in test data)
3. **Process:** add to `DEV-PLAYBOOK.md` — any new DAL function must accept `orgId` as a required parameter after any resource ID
4. **Process:** add to `CLAUDE.md` Dev section — any new MLO route must be added to this audit's route inventory with its org-scope status

## What wasn't checked (out of scope for this pass)

- Borrower-portal routes' own scoping (person-scoped by session; no org implications)
- TrackerPortal / cross-device relay routes (separate product, separate audit)
- Public marketing pages and rate-tool endpoints (no org scope by design — they are public)
- MLO session cookie security (JWT signing, expiration, refresh — covered by D1 Security, not D5)
