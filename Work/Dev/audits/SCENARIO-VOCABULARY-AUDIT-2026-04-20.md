# Scenario Vocabulary Audit

**Date:** 2026-04-20
**Scope:** Every field that flows through `scenario → pricing engine → loan persistence → MLO display → downstream export (MISMO, MCR)`.
**Problem:** Multiple parallel vocabularies in active write paths for the same field. Caused by organic growth: apply-flow, MLO-portal, and LDOX/corebot pipelines were built at different times and each settled on its own strings.
**Driver:** PC Dev · worktree `silly-bardeen-53aaac` · branch `fix/loan-data-cleanup`
**Supersedes:** partial intent of migration 014 (which unified MLO surfaces to `single_family` / `2-4unit` — wrong direction, reversed below).

---

## 1 · Principle

Our database column values are **our** canonical. Lender rate sheets arrive in whatever lender-specific encoding (`SFR`, `1-Unit Detached`, `NOO NCO Refi`, etc.); parsers translate those to our canonical. Outputs to MISMO / MCR / LDOX get translated at the export boundary (`mismo-builder.js`, `mcr/push`, etc.). Between those two boundaries — everything in our system — one vocabulary per field.

---

## 2 · Canonical proposal (all fields)

| Field | Canonical | Values |
|---|---|---|
| `property_type` | **pricing-native** | `sfr` / `condo` / `townhome` / `pud` / `multi_unit` / `manufactured` |
| `occupancy` | **agency-native** | `primary` / `secondary` / `investment` |
| `scenarios.loan_purpose` (pricing-shaped, flat) | **4-value** | `purchase` / `rate_term` / `cashout` / `streamline` |
| `loans.purpose` (URLA-shaped, level 1) | **2-value** | `purchase` / `refinance` |
| `loans.refi_purpose` (URLA level 2, only when `purpose='refinance'`) | **4-value** | `rate_term` / `limited` / `cashout` / `streamline` |
| `loans.cashout_reason` (URLA level 3, only when `refi_purpose='cashout'`) — **new column** | **3-value** | `home_improvement` / `debt_consolidation` / `other` |
| `loan_type` | **already canonical** | `conventional` / `fha` / `va` / `usda` / `jumbo` / `dscr` / `bankstatement` / `heloc` / `hecm` / `other` (ref_loan_types) |
| `loan_term` (months OR years??) | **YEARS** | `10, 15, 20, 25, 30, 40` (all rate tables use years) |
| `product_type` / `amortization_type` | **already canonical** | `fixed` / `arm` (rate_products dominant values) |
| `lien_status` | **single-value/sparse** | `first` / `second` — only 1 row persists today |

---

## 3 · Per-field findings

### 3.1 · `property_type`

**DB (loans):** `single_family` 687 · `condo` 42 · `pud` 3 · `manufactured` 2 · `2-4unit` 1 · `null` 110 (post-migration-014).

**Three active vocabularies:**

| Vocab | Values | Writers |
|---|---|---|
| **Pricing-native** | `sfr`, `2unit`, `3unit`, `4unit`, `condo`, `pud`, `townhome`, `mfr` | Rate parsers (everstream, swmc, tls, etc.), pricing engine (`pricing-v2.js:494`), DSCR pricer, RateTool, my-rates page, dscr-calculator |
| **Apply-flow** | `sfr`, `condo`, `townhome`, `multi_unit`, `manufactured` | ZOD `validations/application.js`, Step2Purchase/Refinance, lead-quote default, mismo-parser |
| **MLO-portal** | `single_family`, `condo`, `townhouse`, `multi_unit`, `manufactured`, `SFH-Detached`, `SFH-Attached` | picklists.js (post-PR #122), OverviewSection, LoanInfoSection, ApplicationSection propMap, mismo-builder, crm-migration, MCR push |

**Canonical:** `sfr` / `condo` / `townhome` / `pud` / `multi_unit` / `manufactured`

Rate parsers already emit this; ZOD already enforces it; MISMO + MCR exporters already translate from it. Only the MLO-portal surfaces diverge — 3 files to update + picklists reversal.

**Migration:** `UPDATE loans SET property_type='sfr' WHERE property_type IN ('single_family','SFH-Detached','SFH-Attached','sitebuilt','sfr')` (~687 rows after collapse). `UPDATE loans SET property_type='multi_unit' WHERE property_type='2-4unit'` (1 row).

**Code surgery:**
- `src/lib/constants/picklists.js` — canonical values `single_family`→`sfr`, `2-4unit`→`multi_unit`
- `src/components/Portal/Core/sections/OverviewSection.js:36` — drop `SFH-Detached`/`SFH-Attached` options
- `src/components/Portal/Core/sections/LoanInfoSection.js:47` — drop `SFH-Detached`
- `src/components/Portal/Core/sections/ApplicationSection.js:68` — propMap key `single_family`→`sfr`
- `src/lib/mismo-builder.js:62` — key `single_family`→`sfr`
- `scripts/crm-migration/import-loans.mjs:85` — output `sfr` instead of `single_family`
- `src/app/api/portal/mlo/mcr/push/route.js:107` — verify default still produces a valid MCR string

---

### 3.2 · `occupancy`

**DB (loans, scenarios, rate_products):** `primary` / `secondary` / `investment` — clean.

**Two active vocabularies:**

| Vocab | Values | Writers |
|---|---|---|
| **Agency-native** | `primary` / `secondary` / `investment` | Everstream/Windsor/Amwest/TLS/Keystone agency parsers, ZOD validator, pricing-v2.js, MLO portal, DB |
| **NonQM-pricing** | `primary` / `second` / `noo` | `src/lib/pricing-nonqm/parsers/everstream-llpas.js:57-65`, `src/lib/pricing-nonqm/price-dscr.js` scenario contract, `DscrRateWidget.js:60` scenario write, `/api/pricing/dscr` docstring |

**Canonical:** `primary` / `secondary` / `investment` (agency-native; matches DB + ZOD).

**Migration:** none — DB is already clean.

**Code surgery:**
- `src/lib/pricing-nonqm/parsers/everstream-llpas.js` — rewrite scenario-key mapping to emit `investment` instead of `noo`, `secondary` instead of `second`
- `src/lib/pricing-nonqm/price-dscr.js` — accept canonical vocab
- `src/components/DscrRateWidget.js:61` — write `investment` / `secondary` not `noo` / `second`
- `src/app/tools/dscr-calculator/page.js` — same
- `src/app/api/pricing/dscr/route.js:22` — update docstring

**Risk:** nonqm-internal logic may key further tables on `noo` / `second`. Grep required before migration. If llpa_adjustments rows are keyed on `noo`, those need a parallel UPDATE or the engine needs to translate at read time.

---

### 3.3 · `loan_purpose` / `loans.purpose` / `loans.refi_purpose`

**The messiest field by a wide margin.** Same concept spread across three columns and four vocabularies.

**DB state:**
- `scenarios.loan_purpose`: `purchase` 49 · `refinance` 7 · (no `cashout` rows yet)
- `loans.purpose`: `purchase` 274 · `refinance` 532 (no `cashout` bucket — cashout is split into `refi_purpose`)
- `loans.refi_purpose`: `Rate and Term Change` 35 · `Other` 27 · `Debt Consolidation` 21 · `Home Improvement` 12 · null 437 (82% of refis unclassified)

**Active vocabularies:**

| Vocab | Values | Writers |
|---|---|---|
| **Portal 3-value** | `purchase` / `refinance` / `cashout` | MLO portal forms (leads/id, quote wizard), scenarios table, picklists.js, pricing engine |
| **ZOD 2-step** | Step1: `purchase` / `refinance`. Step2 (only if refinance): `refiPurpose` = `rate_term` / `cash_out` / `streamline` | borrower apply flow |
| **LDOX human-readable** | `Rate and Term Change` / `Other` / `Debt Consolidation` / `Home Improvement` | corebot/ingest + historical LDOX imports → writes to `loans.refi_purpose` |
| **NonQM pricing** | `purchase` / `nco_refi` / `co_refi` | `src/lib/pricing-nonqm/parsers/everstream-llpas.js`, `price-dscr.js`, DSCR widget/calculator |

**Schema inconsistency:** scenarios have `loan_purpose`; loans have `purpose` + optional `refi_purpose`. Different column names for the same concept. 82% of refi loans have no refi_purpose sub-classification at all.

**Canonical proposal:** two-tier.
- **Top-level** (both `scenarios.loan_purpose` and `loans.purpose`) = `purchase` / `refinance` / `cashout`
- **Sub-field** (`loans.refi_purpose`, only when `purpose IN ('refinance','cashout')`) = `rate_term` / `cash_out` / `streamline` (matches ZOD)

Rename `loans.purpose` → `loans.loan_purpose` for column-name alignment with scenarios (follow-up migration; not required for vocab unification).

**Final hierarchy (confirmed 2026-04-20):**
- Level 1 `loans.purpose`: `purchase` / `refinance`
- Level 2 `loans.refi_purpose` (refinance-only): `rate_term` / `limited` / `cashout` / `streamline`
- Level 3 `loans.cashout_reason` (cashout-only, **new column**): `home_improvement` / `debt_consolidation` / `other`
- Pricing scenarios flatten to `purchase` / `rate_term` / `cashout` / `streamline` — `limited` bucketed into `rate_term` at pricing time (no LLPA difference); `streamline` + `loan_type={fha,va}` selects FHA Streamline or IRRRL product
- Standardize on `cashout` (no underscore) everywhere — update ZOD `cash_out` → `cashout`

**Schema migration:**
```sql
ALTER TABLE loans ADD COLUMN cashout_reason TEXT;
```

**Data migration (value normalization):**
- `refi_purpose='Rate and Term Change'` (35) → `refi_purpose='rate_term'` (purpose stays refinance)
- `refi_purpose='Debt Consolidation'` (21) → `refi_purpose='cashout'`, `cashout_reason='debt_consolidation'`
- `refi_purpose='Home Improvement'` (12) → `refi_purpose='cashout'`, `cashout_reason='home_improvement'`
- `refi_purpose='Other'` (27) → `refi_purpose=NULL` (David: "never could figure out what Other was, not helpful, ignore")
- Also update `corebot/ingest` STATUS_MAP/refiPurposeMap to drop `'Other'` mapping — don't re-ingest it
- `scenarios.loan_purpose` — 7 refinance rows → `rate_term` (no cashout signals in those scenarios); 49 purchase rows unchanged

**NonQM parser rewrite:** emit canonical sub-types. `'NCO Refi'` → sub-type `rate_term` (no cashout). `'CO Refi'` → sub-type `cashout`. Stop using `nco_refi` / `co_refi`.

---

### 3.4 · `loan_type`

**DB:** `conventional` 833 · `other` 4 · `va` 2 · `hecm` 1 (post-migration 014 case-fix).

**Already canonical** — `ref_loan_types` seed matches + migration 012/014 closed outliers.

**Outstanding:** `scenarios.loan_type` has only `conventional` (43) and `fha` (13) in the DB so far — no divergence.

**No action needed this audit.**

---

### 3.5 · `loan_term`

**DB (loans, MONTHS):** `360` 659 · `180` 77 · `240` 23 · `348` 9 · `300` 6 · `120` 6 · `480` 3 · `336` 2 · `228` 2 · `144` 2 · `30` 1.

**DB (scenarios, YEARS):** `30` 56.

**DB (rate_products, YEARS):** `30` 363 · `15` 94 · `20` 69 · `10` 30 · `25` 3.

**Unit inconsistency:** loans stores months; scenarios + rate_products store years. Ambiguous: the `30` row in loans is either 30 months (unusual) or 30 years (a unit-mismatch bug from an import).

**Anomalous values in loans:** 228 (19yr), 336 (28yr), 348 (29yr) look like "remaining term" values from refi scenarios, not original loan terms. Rows are from Jul 2024 imports.

**Canonical proposal: YEARS** across all three tables. Migrate loans column months → years.

**Migration:** `UPDATE loans SET loan_term = loan_term / 12 WHERE loan_term >= 120`. The `30` outlier is likely years already — leave as-is. Non-divisible-by-12 values (228, 336, 348) require inspection — may actually be years if 228/12=19 is meant. Walk through each:
- 120/12 = 10yr ✓
- 144/12 = 12yr (non-standard, but valid custom term)
- 180/12 = 15yr ✓
- 228/12 = 19yr (likely remaining-term from a refi, should be 30yr)
- 240/12 = 20yr ✓
- 300/12 = 25yr ✓
- 336/12 = 28yr (likely remaining-term)
- 348/12 = 29yr (likely remaining-term)
- 360/12 = 30yr ✓
- 480/12 = 40yr ✓

**Risk:** remaining-term values are a semantic problem — the column is holding two meanings (original term vs remaining term). Proper fix requires adding a `remaining_term` column or clarifying scope. Out of scope for this audit; flag as follow-up.

---

### 3.6 · `product_type` / `amortization_type`

**DB (scenarios):** `fixed` 56. **DB (rate_products):** `fixed` 498 · `arm` 61. **DB (loans.amortization_type):** empty.

**Vocabulary:** `fixed` / `arm` — consistent across tables.

**No action needed.**

---

### 3.7 · `lien_status`

**DB:** `first` 1. Column is almost entirely empty.

**Not a vocabulary issue** — it's a sparse column. No action needed this audit. Relevant for HELOC/second-lien products later (D6 scope).

---

## 4 · Consolidated migration plan

**Migration 015 (property_type):**
```sql
UPDATE loans SET property_type = 'sfr' WHERE property_type IN ('single_family', 'SFH-Detached', 'SFH-Attached', 'sitebuilt');
UPDATE loans SET property_type = 'multi_unit' WHERE property_type = '2-4unit';
-- Already clean: condo, pud, manufactured, Condo (fixed in 014)
```

**Migration 016 (loans.purpose + refi_purpose normalization):**
```sql
-- Promote cashout sub-purposes to top-level 'cashout'
UPDATE loans SET purpose = 'cashout', refi_purpose = 'cash_out'
 WHERE refi_purpose IN ('Debt Consolidation', 'Home Improvement');

-- Rate-term refis keep 'refinance', normalize sub-code
UPDATE loans SET refi_purpose = 'rate_term'
 WHERE refi_purpose = 'Rate and Term Change';

-- 'Other' refis — insufficient info, null the sub-code (keep purpose='refinance')
UPDATE loans SET refi_purpose = NULL WHERE refi_purpose = 'Other';
```

**Migration 017 (loan_term months → years, conservative):**
```sql
-- Only migrate rows where division by 12 produces a standard term.
UPDATE loans SET loan_term = loan_term / 12
 WHERE loan_term IN (120, 180, 240, 300, 360, 480);
-- Leave 228 / 336 / 348 / 144 / 30 for manual inspection — may be remaining-term.
```

**No migration for occupancy, loan_type** — DB is clean; only parser output needs realignment (code-only change).

---

## 5 · Consolidated code surgery

| File | Change |
|---|---|
| `src/lib/constants/picklists.js` | PROPERTY_TYPES canonical → `sfr`/`condo`/`townhome`/`pud`/`multi_unit`/`manufactured` |
| `src/components/Portal/Core/sections/OverviewSection.js` | Drop `SFH-Detached`/`SFH-Attached`; use canonical |
| `src/components/Portal/Core/sections/LoanInfoSection.js` | Drop `SFH-Detached`; use canonical |
| `src/components/Portal/Core/sections/ApplicationSection.js` | propMap: `single_family`→`sfr` key |
| `src/lib/mismo-builder.js` | `single_family`→`sfr` key in property-type map |
| `scripts/crm-migration/import-loans.mjs` | Output `sfr` instead of `single_family` |
| `src/app/api/portal/mlo/mcr/push/route.js` | Verify default continues to produce valid MCR output |
| `src/lib/pricing-nonqm/parsers/everstream-llpas.js` | Emit `investment`/`secondary` instead of `noo`/`second`; `refinance`+`cash_out` sub instead of `nco_refi`/`co_refi` |
| `src/lib/pricing-nonqm/price-dscr.js` | Accept canonical occupancy + loan_purpose vocab |
| `src/components/DscrRateWidget.js` | Write `investment`+`cashout` not `noo`+`co_refi` |
| `src/app/tools/dscr-calculator/page.js` | Same |
| `src/app/api/pricing/dscr/route.js` | Update docstring |

---

## 6 · PR shape decision

Two options:

**Option A — One big PR.**
Migrations 015+016+017 + all code surgery. Pros: atomic cutover, no intermediate broken state. Cons: huge PR, hard to review, risk compounds.

**Option B — Split by field.**
PR 1: property_type (migration 015 + 7 files).
PR 2: loan_purpose/refi_purpose (migration 016 + nonqm parser rewrite).
PR 3: loan_term (migration 017, small).
PR 4: occupancy nonqm parser realignment (code-only).

**Recommend Option B.** Each PR has narrower blast radius. Migration 015 + 016 are independent; 017 is tiny; 4 is pure code with no migration. Smoke-test each on preview before the next.

---

## 7 · Open questions

1. **Semantic call on Debt Consolidation / Home Improvement refi_purpose values.** Are all 33 rows actually cashout, or could some have been rate-term with a sub-note? Need David's call before migration 016.
2. **Remaining-term rows in loans.loan_term (228, 336, 348, 144).** Skip unit conversion, or migrate with a best-guess round to the nearest standard term? Need David's call.
3. **NonQM pricing engine sanity check.** If we rewrite nonqm parsers to emit canonical occupancy/purpose, does the downstream DSCR price lookup still work? The scenario-to-rule matching logic needs inspection.
4. **Rename loans.purpose → loans.loan_purpose?** For column-name alignment with scenarios. Low priority; flag for follow-up.

---

## 8 · Risks

- **Pricing regressions.** Changing nonqm parser output could break DSCR pricing if downstream rule-matching isn't updated in lock-step. Mitigation: run `scripts/_test-price-dscr.mjs` or similar before deploy.
- **MCR report regressions.** MCR pulls from loans table directly; migration must preserve MCR semantic correctness. Mitigation: `mcr/push/route.js` has its own translation layer from our codes to MCR codes — verify map covers every canonical value we write.
- **MISMO XML regression.** `mismo-builder.js` translates at export. Migration must preserve round-trip fidelity for existing data. Mitigation: before/after compare XML output for a sample loan.
- **Historical data (LDOX imports) carries semantic nuance we don't see.** `Other` (27 rows) and `Home Improvement` (12) specifically could have been mis-classified at the LDOX side. Not our bug to fix now, but flag the 27 `Other` rows as data-quality debt.

---

## 9 · Priority & next step

**Ship order:** property_type (PR 1) first — largest surface, most-broken user-facing (MLO dropdown round-trip), migration is clean. Then nonqm parser realignment (PR 4 — code-only, reduces future migration risk). Then loan_purpose/refi_purpose (PR 2 — needs semantic sign-off). Then loan_term (PR 3 — trivial, conservative migration).
