# D9d · Reference Data Migration Spec

**Audit:** FoH April · Dimension 9d
**Date:** 2026-04-21
**Scope:** Umbrella design for the 13 `ref_*` tables proposed in Pass 8
**Status:** v1 · implementation PR 1 ships the first table (`ref_county_loan_limits` + `ref_conforming_baselines`)
**Precursor:** [PASS-8-REFERENCE-DATA-INVENTORY-2026-04-16.md](./PASS-8-REFERENCE-DATA-INVENTORY-2026-04-16.md)
**Driver:** PC Dev

---

## 1 · Why

Per Pass 8, ~18 distinct externally-authored values are currently baked into code, each with its own staleness cadence (annual FHFA reset, HUD mortgagee letter, state assessor update, etc.). Every one of them requires a code deploy to refresh. That creates three recurring pains:

1. **Silent staleness** — nothing alerts us when the value goes out of date; the loan just mis-prices or the disclosure just goes wrong
2. **Deploy-coupled updates** — a FHFA loan-limit update shouldn't require a JS change + PR + review + Vercel build
3. **No audit trail** — we can't see "what was the high-balance threshold on 2025-06-14 when we quoted this loan"

D9d solves all three with one consistent pattern: every externally-authored value lives in a `ref_*` table with explicit temporal versioning.

---

## 2 · Inclusion / exclusion rule

From Pass 8, reiterated here as the **sole test** for whether a value belongs in a `ref_*` table:

> **If the value changes because a regulator / industry body / market published something new, it's reference data (D9d).**
> **If the value changes because we refactored code, it's an enum (stays in `src/lib/constants/`).**

Examples:
- ✅ FHA UFMIP rate (HUD publishes) → `ref_fha_ufmip`
- ✅ County loan limit (FHFA publishes) → `ref_county_loan_limits`
- ❌ `LOAN_TYPES = ['conv', 'fha', 'va', ...]` (we decide; refactor changes it) → stays in `src/lib/constants/loan-types.js`
- ❌ `DEFAULT_SCENARIO = { fico: 780, ... }` (business-policy anchor, we set it) → stays in `src/lib/rates/defaults.js`

---

## 3 · Universal schema pattern

Every `ref_*` table follows this shape, in order:

```sql
CREATE TABLE ref_<scope> (
  id SERIAL PRIMARY KEY,

  -- Temporal versioning (REQUIRED)
  effective_from DATE NOT NULL,
  effective_to DATE NULL,  -- NULL = current; populated when superseded

  -- Scope keys (REQUIRED, whatever makes a row unique)
  <key_columns>,

  -- Payload (the actual externally-authored value)
  <payload_columns>,

  -- Provenance (REQUIRED)
  source TEXT NOT NULL,  -- e.g., 'FHFA 2026 Conforming Loan Limits', 'HUD ML 2025-04'
  notes TEXT NULL,       -- freeform — amendments, edge cases

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (<key_columns>, effective_from)
);

CREATE INDEX idx_ref_<scope>_lookup ON ref_<scope> (<key_columns>);
CREATE INDEX idx_ref_<scope>_effective ON ref_<scope> (effective_from, effective_to);
```

**Rules:**

1. **No `organization_id`.** Reference data is globally-scoped — FHFA doesn't publish per-org loan limits. The one exception (`ref_licensed_states`) lives at the org level, not inside each ref table.
2. **Temporal lookup by `transaction_date` or `NOW()`.** Readers pass a date (usually `NOW()` for live pricing, sometimes a loan's `lock_date` for historical quotes). The DAL returns the row where `effective_from <= date < COALESCE(effective_to, '9999-12-31')`.
3. **Supersede by writing a new row and updating the old `effective_to`.** Never UPDATE payload values in place — that loses the audit trail. This is why every table has `effective_from, effective_to` as first-class columns.
4. **`source` is a required string.** Every row cites the publishing authority. If we can't cite the source, we don't write the row.
5. **No soft-delete.** `effective_to` in the past is the only "deletion" primitive.

---

## 4 · The 13 tables (+ 1 renamed)

From Pass 8 §3, grouped by domain. Each table links back to its Pass 8 finding IDs.

### 4.1 Loan limits

| Table | Absorbs | Keys | Notes |
|---|---|---|---|
| `ref_conforming_baselines` | A2 (partial) | `effective_from` (unique, single national row per year) | National 1/2/3/4 unit baselines + high-balance ceilings. Paired with `ref_county_loan_limits` to resolve any county's effective limit. |
| `ref_county_loan_limits` | A1, A2 (partial), REF-1, REF-2 | `(state, county_fips, effective_from)` | Per-county high-balance ceilings. Baseline counties also have rows (with baseline values explicitly written) so every county has a definitive answer. |
| `ref_hecm_limits` | REF-3 | `effective_from` | Single national max-claim-amount per year. |

### 4.2 Government insurance / funding fees

| Table | Absorbs | Keys | Notes |
|---|---|---|---|
| `ref_fha_ufmip` | B3, REF-5 | `(effective_from, loan_purpose, case_type)` | HUD sets via mortgagee letter. `case_type` covers purchase vs streamline-refi vs cash-out-refi. |
| `ref_fha_annual_mip` | REF-4 | `(effective_from, case_number_date_from, term_max, ltv_max, base_loan_amount_min)` | The 5-dimensional MIP grid. FHA MIP lookup depends on **case number assignment date**, which we need to start tracking on loans (see §6 Q2). |
| `ref_va_funding_fee` | REF-8 | `(effective_from, purpose, down_payment_min, is_first_use, is_exempt)` | ~12-row grid. Currently disclosed in prose only — this table promotes it to real data (we can actually charge it when VA pricing ships). |
| `ref_hecm_ufmip` | REF-6, REF-9 | `effective_from` | Scalar rate per effective period. |
| `ref_hecm_annual_mip` | REF-7 | `effective_from` | Scalar rate per effective period. |

### 4.3 HECM pricing

| Table | Absorbs | Keys | Notes |
|---|---|---|---|
| `ref_hecm_plf` | REF-10 | `(effective_from, expected_rate_bps, age)` | HUD Principal Limit Factor table. ~4,800 rows per edition. |
| `ref_hecm_pricing` | REF-12 | `(lender_code, product, rate_sheet_date, margin_bps, plu_bucket_min)` | Promotes HECM into the existing rate-sheet pipeline pattern (GCS → cron → DB) rather than hardcoding grids. |
| `ref_lender_corrections` (optional) | REF-11 | `(lender_code, metric, effective_from)` | Low-priority — one row today (FOA PLF correction). Defer unless more corrections surface. |

### 4.4 Geographic / tax

| Table | Absorbs | Keys | Notes |
|---|---|---|---|
| `ref_state_tax_rates` | REF-13 | `(state, effective_from)` | State-average effective property tax rate. |
| `ref_county_tax_rates` | REF-14 | `(state, county_fips, effective_from)` | County-level. `is_placeholder` flag marks rows that are still state-avg stubs until real data is sourced. |
| `ref_state_closing_costs` | REF-15 | `(state, effective_from)` | Third-party cost estimates per state. |
| `ref_fee_templates` (rename of existing `fee_templates`) | REF-16 | `(state, county, purpose, effective_from)` | Already exists; formalize the schema + add admin write path. |

### 4.5 Business scope

| Table | Absorbs | Keys | Notes |
|---|---|---|---|
| `ref_licensed_states` (already shipped in PR #122) | REF-17 | `(code)` | Already exists from D7-3 picklist work. Formalize as the canonical licensed-states reference; D9d doesn't rebuild it. |

---

## 5 · DAL pattern

Every ref-table gets a companion reader module at `src/lib/rates/ref-<scope>.js` with:

1. **A typed accessor** matching the business question (`getLoanLimits(state, county, units)` not `SELECT * FROM ref_county_loan_limits WHERE ...`).
2. **Temporal awareness** — takes an optional `asOf: Date` param (default `NOW()`). Pricing code passes the lock date; display code passes `NOW()`.
3. **In-memory caching** — reference data changes on a cadence measured in months, not seconds. Cache keyed by `(asOf quantized to day, lookup key)`. TTL 1 hour with a force-flush admin endpoint.
4. **Graceful degradation** — if the DB read fails and there's no cache, throw an explicit error. Never silently fall back to a hardcoded value — that's exactly what D9d is retiring.

Example:

```js
// src/lib/rates/ref-loan-limits.js
import sql from '@/lib/db';

const cache = new Map();
const TTL_MS = 60 * 60 * 1000;

export async function getLoanLimits(state, county, { asOf = new Date() } = {}) {
  const cacheKey = `${state}|${county}|${asOf.toISOString().slice(0, 10)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const rows = await sql`
    SELECT limit_1unit, limit_2unit, limit_3unit, limit_4unit, is_high_cost, source
      FROM ref_county_loan_limits
     WHERE state = ${state}
       AND county_name_norm = ${normalizeCounty(county)}
       AND effective_from <= ${asOf}
       AND (effective_to IS NULL OR effective_to > ${asOf})
     ORDER BY effective_from DESC
     LIMIT 1
  `;
  if (!rows.length) throw new Error(`No ref_county_loan_limits row for ${state}/${county} @ ${asOf}`);
  const value = rows[0];
  cache.set(cacheKey, { value, at: Date.now() });
  return value;
}
```

**Why not wrap every ref table in a REST API?** Because readers live inside Next.js server components and server-only utilities — direct SQL is simpler, faster, and doesn't require a network hop. The `sql` tagged template gives us parameter safety. APIs exist only where a client component needs reference data (rare).

---

## 6 · Cadence ownership (who refreshes)

| Cadence | Authority | Owner in NetRate | Refresh trigger |
|---|---|---|---|
| **Annual (Jan 1)** | FHFA, HUD, state assessors | Mac Admin (scheduled task 12/15 each year) | Scheduled tracker instruction reminds David; PC writes an admin UI for the update |
| **Event-driven** | HUD mortgagee letters, VA circulars | PC Dev (on notification) | Mac Dev monitors mortgagee letters; relays to PC when a published update lands |
| **Weekly (rate sheets)** | Lenders | Already automated (GCS → cron → DB) | Existing pipeline handles HECM when REF-12 migrates |

Long-term: a daily **staleness audit** scheduled task (builds on D8 Pass 7 findings) flags any `ref_*` table whose most-recent `effective_from` is past its cadence (e.g., county limits whose newest row is Jan 1 of a past year).

---

## 7 · Build order

Ordered by blast radius of today's staleness + ease of the first cut:

| # | Table | PR | Notes |
|---|---|---|---|
| 1 | `ref_conforming_baselines` + `ref_county_loan_limits` | **This PR** (migration 020) + follow-up consumer PR | Highest blast radius — every pricing path reads limits. First-consumer retirement (`src/data/county-loan-limits.js`) in the follow-up PR keeps this one reviewable. |
| 2 | `ref_fha_ufmip` | follow-up | B3 is already flagged as a live fallback risk (pricer falls to 0.0175 if `rate_lenders.fha_ufmip` is null). High-value retirement. |
| 3 | `ref_fha_annual_mip` | follow-up | Blocked on tracking FHA case number date (§6 Q2). |
| 4 | `ref_state_tax_rates`, `ref_state_closing_costs`, `ref_county_tax_rates` | follow-up | Geographic — natural cluster. |
| 5 | `ref_hecm_*` (limits, ufmip, annual mip, plf, pricing) | follow-up | HECM cluster. `ref_hecm_pricing` also promotes HECM into the main rate-sheet pipeline (REF-12). |
| 6 | `ref_va_funding_fee` | follow-up | Lowest priority — no pricing path charges it today. |

Each follow-up PR is scoped: migration + DAL + retire consumers for that one table family.

---

## 8 · Open questions (for driver)

1. **Case number date on loans.** `ref_fha_annual_mip` lookup needs `case_number_date`. Do we track this today? If not, do we backfill historical loans or only require it on new writes? → Defer until `ref_fha_annual_mip` PR.
2. **VA funding fee — populate now or wait?** Flagged in Pass 8 §6 as "build now or later." Recommend **build the schema empty**, populate when VA pricing is a real product. Empty table is cheap; missing schema is a refactor.
3. **`loan-limits-2025.json` cleanup.** Standalone stale file still referenced by `CountyLoanLimits.js` UI. Retire in the follow-up consumer PR.
4. **Staleness audit task.** Build under D8 Pass 7 follow-up? Or as part of D9d completion?

---

## 9 · Cross-references

- [`PASS-8-REFERENCE-DATA-INVENTORY-2026-04-16.md`](./PASS-8-REFERENCE-DATA-INVENTORY-2026-04-16.md) — full finding catalog
- [`README.md`](./README.md) §D9d — dimension status tracking
- [`DEV-PLAYBOOK.md`](../../../DEV-PLAYBOOK.md) — Neon-branch rehearsal protocol (mandatory for every D9d migration with data; schema-only migrations skip)
