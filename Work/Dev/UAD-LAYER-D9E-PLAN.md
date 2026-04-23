# D9e Layer Migration Plan — `loans` → modular satellite architecture

**Status:** 🔍 scoped 2026-04-23 · execution: Phase 1 next session
**Driver:** PC Dev
**Supersedes:** nothing (first plan for D9e)

**Related docs:**
- [UAD-SPEC.md §7 — Application modules](UAD-SPEC.md)
- [Work/Dev/audits/DB-STRUCTURE-2026-04-23.md — DB structure audit](audits/DB-STRUCTURE-2026-04-23.md)
- [UAD-LAYER-1-MIGRATION-PLAN.md — D9a predecessor](UAD-LAYER-1-MIGRATION-PLAN.md)

---

## 1. Summary

D9e is the retrofit of the `loans` table into a modular satellite architecture aligned to MISMO 3.4. The prior framing ("massive data migration, multi-PR cutover") turned out to be wrong once the DB audit and LDox UI tour revealed the actual state:

- 13 satellite tables already exist (most empty)
- `loans` has 97 columns — 58 are 100% empty (speculative vibe-code + MISMO-placeholder)
- The real work is **wiring the application to write to satellites instead of flat `loans` columns**, not migrating data

The **system architecture** lands as two layers:

| Layer | Role | Scope |
|---|---|---|
| **Core DB** (this plan) | MISMO 3.4-complete schema in satellites | Full data fidelity for export/roundtrip |
| **Core UI** (implied) | Lean quote + intake surface, ~50 fields total | MLOs only touch what's needed pre-LOS |
| **LDox** (out of scope) | Full LOS, ~500 fields | Takes over post-handoff |

Core captures the quote + intake, exports to LDox, LDox fills in processing fields, re-import brings it back. No field loss on roundtrip.

---

## 2. Architecture decisions (captured 2026-04-23 from interactive scoping)

Each decision is concrete and load-bearing for Phase 1 execution. Referenced back to UAD-SPEC where applicable.

| ID | Decision | Rationale |
|---|---|---|
| **AD-D9e-1** | **Keep `loans` table name** — do not rename to `deals`. | Churn for symbolism. David's domain language is "loans." UAD-SPEC AD-5 ("Deal is the application") updated implicitly — concept stays, table name doesn't change. |
| **AD-D9e-2** | **Two-layer system: Core = lean UI + MISMO-complete back end** | Core is the pre-LOS system of record; LDox is the LOS. Mirror MISMO structure underneath; surface only quote-relevant fields in UI. |
| **AD-D9e-3** | **Satellite FK = `contact_id` (Option B)** — per-person satellite rows key off `(loan_id, contact_id)` directly | Matches LDox UI's per-person tab model. Simpler reads (1 hop vs 2). Clone-deal query is direct. Referential integrity enforced at app layer. |
| **AD-D9e-4** | **Retire `loan_borrowers` in favor of `loan_participants`** | 851 rows vs 28 rows; clean junction shape vs snapshot-heavy. Decided by the data. |
| **AD-D9e-5** | **Three distinct person/company tables:** `contacts`, `staff`, `service_provider_contacts` (plus `service_provider_accounts`) | Per UAD AD-3, AD-4, AD-14, AD-16. Different relationship targets → different tables. |
| **AD-D9e-6** | **Single `phone` field — merge cell and home** | David's preference ("I just use one"). Drop `loan_borrowers.cell_phone` during retirement. |
| **AD-D9e-7** | **Keep all 13 defined loan statuses** — do not prune based on current data | Current data is historical-skewed (761/846 loans are `settled`). Prune would lock out future lifecycle stages. Lifecycle-triggered workflows (email/notification/automation) motivate all 13 eventually. |
| **AD-D9e-8** | **Soft-delete (`deleted_at`) on top-level tables only:** `loans`, `contacts`, `scenarios`, `loan_participants` | Satellites cascade from parent — no independent soft-delete needed. Avoid universal `deleted_at` column noise. |
| **AD-D9e-9** | **Clone-deal workflow deferred to post-Phase-1 session** | Spec'd in UAD §7.2. Build UX after schema restructure stabilizes. |
| **AD-D9e-10** | **Application LITE field reference = LDox UI, not 1003-BUILD-SPEC.md** | 1003-BUILD-SPEC is outdated vibe-code era. LDox's actual UI + MISMO 3.4 schema are the authoritative references. |
| **AD-D9e-11** | **Staff assignments = `loan_staff_assignments` junction** (Phase 1), not fixed FKs on `loans` | Flexible for 1-role today (MLO), 10-role on LDox roundtrip (LDox has Loan Officer, Loan Assistant, Loan Processor, Underwriter, Wholesale Processor, Closer, Funder, Post Closer, AE, Account Manager). Junction absorbs without schema change. |
| **AD-D9e-12** | **MCR/HMDA regulatory fields stay on `loans`** — not split to `loan_regulatory` satellite | Loan-level facts, not person/event. MCR export wants them in one place. Satellite adds a JOIN for no benefit. |
| **AD-D9e-13** | **Operational fields (`cd_*`, `work_drive_*`, `prequal_letter_data`) → `loan_operational` satellite** | Workflow state, not loan facts. Keep `loans` as "the loan"; put processing-artifact state in its own place. |

---

## 3. Current state snapshot

### 3.1 What exists in prod (schema inventory)

| Table | Rows | Cols | Status |
|---|---|---|---|
| `loans` | 846 | 97 | 22 dense, 1 mid, 16 sparse, **58 empty** |
| `loan_participants` | 851 | 12 | ✅ clean junction — KEEP |
| `loan_borrowers` | 28 | 30 | ⚠ snapshot-heavy — **RETIRE** in Phase 1 |
| `loan_dates` | 588 | 34 | ✅ wired satellite |
| `loan_fha` | 1 | 11 | seed/test data |
| `loan_hecm` | 1 | 20 | seed/test data |
| `loan_conv` | 0 | 8 | schema-ready, ARM fields |
| `loan_va` | 0 | 9 | schema-ready |
| `loan_dscr` | 0 | 9 | schema-ready |
| `loan_transactions` | 0 | 17 | schema-ready, closing-cost lines |
| `loan_employments` | 0 | 14 | schema-ready, **FKs `loan_borrower_id`** ← needs rewire |
| `loan_incomes` | 0 | 13 | schema-ready |
| `loan_assets` | 0 | 10 | schema-ready |
| `loan_liabilities` | 0 | 11 | schema-ready, **needs field additions** |
| `loan_reos` | 0 | 13 | schema-ready |
| `loan_declarations` | 0 | 18 | schema-ready, **FKs `loan_borrower_id`** ← needs rewire |

### 3.2 Gaps surfaced by LDox tour

Satellites that don't exist but MISMO/LDox requires. Each is its own Phase 2 migration when needed.

| Gap | Purpose | Per-person or loan-level? |
|---|---|---|
| `loan_housing_history` | Current + previous addresses + residency tenure | Per-person *(Phase 1 — needed for loan_borrowers retirement)* |
| `loan_staff_assignments` | Multi-role staff (MLO, processor, LDox roles) | Loan-level, multi-row *(Phase 1)* |
| `loan_operational` | CD extraction, WorkDrive, prequal state | Loan-level 1:1 *(Phase 1)* |
| `loan_demographics` | HMDA (ethnicity/race/sex) per person | Per-person |
| `loan_military_service` | VA eligibility per person | Per-person |
| `loan_credit_pulls` | Per-bureau credit scores per person per pull | Per-person, multi-row |
| `loan_credit_inquiries` | Last-90-days credit inquiries | Per-person |
| `loan_counseling` | HECM/FHA counseling certs per person | Per-person |
| `loan_aus` | LPA/DU findings + recommendation | Loan-level, multi-run |

### 3.3 Outstanding data-quality issues

- `loan_employments.loan_borrower_id` + `loan_declarations.loan_borrower_id` FK to the retirement-target table
- `loan_assets.borrower_type` + `loan_liabilities` (account_owner via `loan_borrower_id`? — verify) same issue
- `contacts` missing MISMO-extras: `suffix`, `middle_name`, `preferred_contact_method`, `language_preference`, `us_citizenship_indicator`, `date_citizenship_established`
- `loan_liabilities` missing: `linked_reo_id`, `paid_at_closing`, `omit_from_dti`, `resubordinate`, `source`
- `loan_incomes` missing: `income_type` enum, `source_name`, `since_date`, `is_primary`
- `loan_assets` missing: `balance_date`, `institution_name`, `account_number_last_4`
- `loans` has 58 empty columns — **most are MISMO-legit** and should MOVE to satellites, not drop

---

## 4. Phase 1 — Foundation (codable next session)

**Goal:** put the schema on sound footing + wire app writes to existing satellites. Unblocks D9c and every downstream phase.

### 4.1 Migration sequence

Seven migrations, naturally grouped into 3-4 PRs by risk profile.

#### Migration 039 — `loan_housing_history` satellite (NEW)

```sql
CREATE TABLE loan_housing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  housing_type TEXT NOT NULL CHECK (housing_type IN ('current', 'previous')),
  address JSONB NOT NULL,              -- { street, city, state, zip, county }
  residency_type TEXT,                 -- own | rent | live_with_family | military_housing
  years INTEGER,
  months INTEGER,
  monthly_rent NUMERIC(10,2),          -- when renting; distinct from DSCR rental income
  ordinal INTEGER NOT NULL DEFAULT 0,  -- for N previous addresses
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loan_housing_history_loan_id        ON loan_housing_history (loan_id);
CREATE INDEX idx_loan_housing_history_contact_id     ON loan_housing_history (contact_id);
CREATE INDEX idx_loan_housing_history_loan_contact   ON loan_housing_history (loan_id, contact_id);
```

**Why now:** needed for `loan_borrowers` retirement (migration 043 moves address+tenure data here).

#### Migration 040 — `loan_staff_assignments` junction (NEW)

```sql
CREATE TABLE loan_staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id),
  role TEXT NOT NULL,                  -- mlo | loan_assistant | processor | admin |
                                       -- underwriter | closer | funder |
                                       -- account_executive | account_manager
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loan_id, staff_id, role)
);

CREATE INDEX idx_loan_staff_assignments_loan_id  ON loan_staff_assignments (loan_id);
CREATE INDEX idx_loan_staff_assignments_staff_id ON loan_staff_assignments (staff_id);

-- Backfill from loans.mlo_id as primary MLO
INSERT INTO loan_staff_assignments (loan_id, staff_id, role, is_primary)
SELECT id, mlo_id, 'mlo', true
FROM loans
WHERE mlo_id IS NOT NULL;
```

**Why now:** foundational junction. Even though Core today only tracks MLO, LDox import (Phase 3) needs 10 role slots. Junction absorbs them without schema changes. `loans.mlo_id` stays as a denorm shortcut for the hot "who's the primary MLO" read.

#### Migration 041 — `contacts` MISMO column additions

```sql
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS suffix TEXT,
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT
    CHECK (preferred_contact_method IS NULL OR preferred_contact_method IN ('email', 'phone', 'sms')),
  ADD COLUMN IF NOT EXISTS language_preference TEXT,
  ADD COLUMN IF NOT EXISTS us_citizenship_indicator TEXT
    CHECK (us_citizenship_indicator IS NULL OR us_citizenship_indicator IN ('us_citizen', 'permanent_resident', 'non_permanent_resident')),
  ADD COLUMN IF NOT EXISTS date_citizenship_established DATE;
```

**Why now:** small additive change; targets columns needed for MISMO roundtrip + LDox import fidelity. Citizenship becomes a Contact property (not per-loan).

#### Migration 042 — Rewire satellite FKs to `contact_id`

```sql
-- loan_employments
ALTER TABLE loan_employments ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
UPDATE loan_employments le
SET contact_id = lb.contact_id
FROM loan_borrowers lb
WHERE le.loan_borrower_id = lb.id AND le.contact_id IS NULL;
-- Verify: all rows have contact_id
-- Then:
ALTER TABLE loan_employments ALTER COLUMN contact_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loan_employments_contact_id ON loan_employments (contact_id);
CREATE INDEX IF NOT EXISTS idx_loan_employments_loan_contact ON loan_employments (loan_id, contact_id);
-- Leave loan_borrower_id for soak period; drop in migration 043

-- Same pattern for loan_declarations
ALTER TABLE loan_declarations ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
UPDATE loan_declarations ld
SET contact_id = lb.contact_id
FROM loan_borrowers lb
WHERE ld.loan_borrower_id = lb.id AND ld.contact_id IS NULL;
ALTER TABLE loan_declarations ALTER COLUMN contact_id SET NOT NULL;
CREATE INDEX ...

-- loan_assets, loan_liabilities, loan_reos currently use loan_id + borrower_type (text)
-- Convert borrower_type → contact_id by looking up via loan_participants.role+loan_id
-- (May need ordering logic: borrower_type='primary' → role='primary_borrower' in participants)
```

**Why now:** unblocks `loan_borrowers` retirement. Requires backfill; keep old FK column for soak week before drop in 043.

**Risk note:** both employments + declarations are empty today (0 rows). No backfill required for those. Only assets/liabilities/reos need borrower_type mapping logic, and those are also empty. So in practice: additive column + constraint setup only. Pure schema.

#### Migration 043 — Retire `loan_borrowers`

Data transform. Move 18 snapshot columns out, then drop table.

**Target map for loan_borrowers columns:**

| loan_borrowers column | Destination | Notes |
|---|---|---|
| `citizenship` | `contacts.us_citizenship_indicator` (if not already set) | Contact-level |
| `suffix` | `contacts.suffix` (if not already set) | Contact-level |
| `marital_status` | `contacts.marital_status` (confirm already there) | Contact-level |
| `cell_phone` | — DROP (merged into single `contacts.phone`) | |
| `current_address`, `address_years`, `address_months` | `loan_housing_history` row, `housing_type='current'` | Per-loan |
| `previous_address`, `previous_address_years`, `previous_address_months` | `loan_housing_history` row, `housing_type='previous'` | Per-loan |
| `monthly_rent` | `loan_housing_history.monthly_rent` | Per-loan (current housing) |
| `mailing_address` | `contacts.mailing_address` (add column if not there) | Contact-level |
| `employment_status`, `employer_name`, `position_title`, `years_in_position` | `loan_employments` row | Per-loan, per-person |
| `monthly_base_income` | `loan_incomes` row, `income_type='employment'`, `is_primary=true` | Per-loan |
| `other_monthly_income`, `other_income_source` | `loan_incomes` row, `income_type='other'` | Per-loan |
| `declarations` (JSONB) | `loan_declarations` structured columns | Parse JSON |
| `borrower_type`, `ordinal`, `relationship`, `loan_id`, `contact_id` | — already on `loan_participants` | Already there |

**Script:** data migration in SQL with CTE per-row; not a DO block because we need cross-table INSERTs.

**After migration:**
```sql
ALTER TABLE loan_employments  DROP COLUMN loan_borrower_id;
ALTER TABLE loan_declarations DROP COLUMN loan_borrower_id;
DROP TABLE loan_borrowers;
```

**Rehearsal mandatory.** Neon branch first. 28-row data transform — manageable but non-trivial.

#### Migration 044 — Soft-delete columns

```sql
ALTER TABLE loans             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE contacts          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE scenarios         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE loan_participants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial indexes speed not-deleted queries (the common case)
CREATE INDEX IF NOT EXISTS idx_loans_live             ON loans (organization_id)             WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_live          ON contacts (organization_id)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scenarios_live         ON scenarios (organization_id)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loan_participants_live ON loan_participants (loan_id, contact_id) WHERE deleted_at IS NULL;
```

**App layer:** update DELETE handlers for those tables to set `deleted_at = NOW()` instead of hard delete. Add `WHERE deleted_at IS NULL` to default read paths.

#### Migration 045 — Drop truly-dead (non-MISMO) `loans` columns

**Scope:** only the speculative vibe-code leftovers. MISMO-legit columns stay (or move to satellite — tracked as Phase 2 per-field moves).

**Candidate drop list — needs David redline before coding:**

| Column | Reason |
|---|---|
| `cd_file_name` | Duplicates `cd_work_drive_file_id`; unused |
| `mailing_address` (on loans) | Mailing address is Contact-level, not loan-level; migrated in 043 |
| (TBD per review) | |

**Small, <10 columns.** Most of the 58 empty columns are MISMO and move to satellites in Phase 2.

### 4.2 PR structure

| PR | Migrations | Risk | Rehearsal? |
|---|---|---|---|
| **PR 1 — Additive schema** | 039 (housing_history) + 040 (staff_assignments) + 041 (contacts cols) + 044 (soft-delete) | LOW — pure additive | Skip |
| **PR 2 — FK rewire** | 042 | MEDIUM — empty tables, but adds NOT NULL after backfill | Optional |
| **PR 3 — loan_borrowers retirement + code** | 043 + app-layer changes (XML import + DAL updates + soft-delete wiring) | HIGH — 28-row data transform + table drop | **Mandatory** |
| **PR 4 — Dead column drop** | 045 | LOW — only after code review confirms no reads | Skip (idempotent) |

**Total estimate:** 3-4 working sessions, spread over ~1 week.

### 4.3 Code changes required

1. **`src/app/api/portal/mlo/loans/import/route.js`** (XML import) — map MISMO `PARTY → EMPLOYMENT → ...` tree to satellite INSERTs, not flat `loans` columns. Biggest code lift.
2. **`src/lib/loans/satellites/`** (new module) — DAL for each satellite (CRUD + bulk upsert).
3. **`src/components/Portal/Core/sections/*`** — component reads that currently fetch from `loans.*` shift to fetch from satellites for the moved fields.
4. **Soft-delete wiring** — update all DELETE handlers for loans/contacts/scenarios/loan_participants.
5. **Staff assignments** — update loan detail page to read from `loan_staff_assignments` (with `loans.mlo_id` fallback for backward compat during soak).

---

## 5. Phase 2 — MISMO satellite gaps (sketches)

Each ships as its own small PR when the first import/export flow needs it. No ordering dependency.

### 5.1 `loan_demographics` — HMDA

```sql
CREATE TABLE loan_demographics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  ethnicity JSONB,                     -- { not_hispanic: bool, hispanic: bool, mexican: bool, puerto_rican: bool, cuban: bool, other: bool, other_description: text }
  race JSONB,                          -- { white: bool, black: bool, american_indian: bool, asian: [...], pacific_islander: [...], other_description: text } — multi-select
  sex TEXT CHECK (sex IN ('male', 'female', 'neither', 'refused', 'not_applicable')),
  refused_to_provide BOOLEAN NOT NULL DEFAULT false,
  collected_via TEXT CHECK (collected_via IN ('visual_observation', 'borrower_provided', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loan_id, contact_id)
);
```

**Note:** HMDA ethnicity + race use nested subcategories (5+ checkboxes each). JSONB vs. normalized child tables — JSONB wins here (values are checkbox sets, not entities with relationships).

### 5.2 `loan_military_service` — VA

```sql
CREATE TABLE loan_military_service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  served BOOLEAN NOT NULL,
  branch TEXT,                         -- army | navy | air_force | marines | coast_guard | space_force
  status TEXT,                         -- active | reserve | national_guard | retired | discharged | deceased
  service_expected_completion_date DATE,
  separated BOOLEAN,
  reserve_national_guard_never_activated BOOLEAN,
  spousal_va_benefits_eligibility BOOLEAN,
  certificate_of_eligibility TEXT,     -- COE number
  va_funding_fee_exempt BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loan_id, contact_id)
);
```

### 5.3 `loan_credit_pulls` — per-bureau scores per pull

```sql
CREATE TABLE loan_credit_pulls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  bureau TEXT NOT NULL CHECK (bureau IN ('equifax', 'experian', 'transunion')),
  score INTEGER CHECK (score IS NULL OR (score >= 300 AND score <= 850)),
  pulled_at TIMESTAMPTZ NOT NULL,
  expires_at DATE,                     -- typically pulled_at + 120 days for conforming
  provider TEXT,                       -- factual_data | credxchange | etc
  tradeline_count INTEGER,
  puller_staff_id UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loan_id, contact_id, bureau, pulled_at)
);

CREATE INDEX idx_loan_credit_pulls_loan_contact ON loan_credit_pulls (loan_id, contact_id);
```

### 5.4 `loan_credit_inquiries` — last-90-days

```sql
CREATE TABLE loan_credit_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  creditor_name TEXT,
  inquiry_type TEXT,                   -- hard | soft
  inquiry_date DATE,
  source_pull_id UUID REFERENCES loan_credit_pulls(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.5 `loan_counseling` — HECM/FHA counseling certs

```sql
CREATE TABLE loan_counseling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  counseling_type TEXT,                -- hecm | fha_first_time_buyer | homeownership | pre_purchase
  counselor_name TEXT,
  counselor_phone TEXT,
  certificate_number TEXT,
  completed_at DATE,
  hud_counselor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.6 `loan_aus` — Automated Underwriting System findings

Loan-level, not per-person. Multiple runs per loan.

```sql
CREATE TABLE loan_aus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  aus_type TEXT NOT NULL CHECK (aus_type IN ('lpa', 'du', 'gus')),   -- LPA=Freddie, DU=Fannie, GUS=USDA
  recommendation TEXT,                 -- approve_eligible | refer_with_caution | refer | ineligible
  response_code TEXT,                  -- AUS-specific response code
  case_file_identifier TEXT,           -- AUS run ID
  findings_file_url TEXT,              -- vercel blob link to findings PDF
  run_at TIMESTAMPTZ NOT NULL,
  run_by_staff_id UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.7 `loan_operational` — workflow/integration state

```sql
CREATE TABLE loan_operational (
  loan_id UUID PRIMARY KEY REFERENCES loans(id) ON DELETE CASCADE,
  -- CD extraction
  cd_approved_at TIMESTAMPTZ,
  cd_approved_by UUID REFERENCES staff(id),
  cd_processed_at TIMESTAMPTZ,
  cd_work_drive_file_id TEXT,
  cd_file_name TEXT,
  cd_extracted_data JSONB,
  -- WorkDrive folder tracking
  work_drive_folder_id TEXT,
  work_drive_subfolders JSONB,
  -- Prequal letter
  prequal_letter_data JSONB,
  -- Payroll
  payroll_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

1:1 with `loans`. Migration: move these columns from `loans` to `loan_operational` (all currently empty, so no data migration required — just schema shift + app update).

### 5.8 POA — fields on `loan_participants`, not satellite

Simpler than a whole satellite for the 1-or-0 case. Add to `loan_participants`:

```sql
ALTER TABLE loan_participants
  ADD COLUMN IF NOT EXISTS has_poa BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS poa_signer_name TEXT,
  ADD COLUMN IF NOT EXISTS poa_signer_title TEXT,
  ADD COLUMN IF NOT EXISTS poa_signer_email TEXT;
```

### 5.9 Field additions to existing satellites (no new tables)

**`loan_liabilities`** — DTI math + liability-REO linkage:
```sql
ALTER TABLE loan_liabilities
  ADD COLUMN linked_reo_id UUID REFERENCES loan_reos(id),
  ADD COLUMN paid_at_closing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN omit_from_dti BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN resubordinate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN source TEXT
    CHECK (source IS NULL OR source IN ('credit_report', 'manual', 'imported'));
```

**`loan_incomes`** — structure the type + primary flag:
```sql
ALTER TABLE loan_incomes
  ADD COLUMN income_type TEXT
    CHECK (income_type IN ('employment', 'self_employment', 'rental', 'investment', 'social_security', 'pension', 'retirement', 'disability', 'alimony', 'child_support', 'other')),
  ADD COLUMN source_name TEXT,
  ADD COLUMN since_date DATE,
  ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT false;
```

**`loan_assets`** — richer account detail:
```sql
ALTER TABLE loan_assets
  ADD COLUMN balance_date DATE,
  ADD COLUMN institution_name TEXT,
  ADD COLUMN account_number_last_4 TEXT;
```

### 5.10 When to ship which

Demographics + Military + Credit Pulls: ship with the first **Phase 3 import** flow (LDox import populates them).
Counseling + AUS: ship when HECM pipeline starts (separate HECM project) or when we start running AUS in Core (unlikely pre-LDox).
Field additions: ship with the first UI surface that needs them (liability DTI display surfaces `paid_at_closing` first).

---

## 6. Phase 3 — Export / Import layer (sketch)

Separate scoping session when Core's quote flow starts landing real loans and the LDox handoff is blocking.

### 6.1 Deliverables

1. **`POST /api/portal/mlo/loans/[id]/export-mismo`** — reads full satellite tree → emits MISMO 3.4 XML. Returns Vercel Blob URL.
2. **`POST /api/portal/mlo/loans/import-mismo`** — accepts MISMO 3.4 XML (today's XML import route upgraded). Parses → populates satellites.
3. **Bidirectional LDox roundtrip:**
   - Core exports initial application → LDox imports
   - LDox runs processing (AUS, credit pulls, UW, conditions, CD)
   - LDox exports back → Core re-imports, merge-not-overwrite semantics
4. **Floify integration review** — decide sunset vs keep. Today Floify collects intake docs from borrower; could be replaced by Core's borrower portal + LDox.

### 6.2 Pre-work audit — MISMO field coverage

Before building export, one more research pass: for each MISMO 3.4 required field, confirm we have a schema home. Output: `Work/Dev/audits/MISMO-COVERAGE-<date>.md`. Gaps found → add as Phase 2 satellites.

### 6.3 Merge-not-overwrite import semantics

When LDox re-imports a loan we originated, we don't want to wipe Core's quote data. Rules:
- Core-originated fields (loan purpose, borrower identity, quote terms): Core wins on conflict
- LDox-originated fields (AUS findings, UW conditions, final CD, lock confirmation): LDox wins on conflict
- Timestamps always win-by-newer

Define per-field ownership in a `MISMO-FIELD-OWNERSHIP.md` reference.

---

## 7. Remaining open questions

Resolve before Phase 1 PR 3 (the high-risk one). None block PR 1-2 (additive).

| # | Question | Lean |
|---|---|---|
| 1 | Exact `loans` drop list — which of the 58 empty columns are MISMO-legit (move to satellite in Phase 2) vs speculative (drop in migration 045)? | Need column-by-column review. Err on "move to satellite" for anything that looks MISMO. |
| 2 | `loan_borrowers.declarations` JSONB structure — how do the 28 existing rows parse into `loan_declarations` structured columns? | Inspect the JSONB shape, write per-key → column mapping. |
| 3 | Soft-delete cascade — when a `loan` is soft-deleted, do we need a `WHERE loan_id IN (SELECT ... WHERE deleted_at IS NULL)` everywhere satellites join to loans? Or trust the app layer to not read deleted loans? | Trust app layer; DAL enforces `WHERE deleted_at IS NULL` on loans reads; satellites don't need their own flag. |
| 4 | `loan_staff_assignments.role` enum finalized? — what roles does David's operation actually have today/soon? | `mlo` + `processor` + `admin` for now; expand as needed from LDox import. |
| 5 | `num_borrowers` on `loans` — derivable from `loan_participants`, drop the column? | Yes — drop in 045. Derive with `COUNT(*) WHERE role LIKE '%borrower%'`. |

---

## 8. Execution plan — next session kickoff

Pre-work for the next D9e session:

1. ☐ David reviews + redlines this plan (esp. §4.1 Phase 1 migration list + §5 Phase 2 ordering)
2. ☐ Walk §7 open questions — answer 1-5
3. ☐ Inspect `loan_borrowers.declarations` JSONB shape (for migration 043)
4. ☐ Column-by-column review of 58 empty `loans` columns → final drop list
5. ☐ Confirm Phase 1 PR split (1 bundled additive PR + 1 FK rewire PR + 1 retirement PR + 1 drop PR)

Then: execute PR 1 first. All-additive, low-risk, validates the plan direction without touching existing functionality.

---

## 9. Decisions captured for the MCP decision log

Each AD-D9e-1 through AD-D9e-13 (§2) will be logged via `log_decision` on Mac side to persist across sessions. Topic: `d9e`, `application-modules`, `unified-architecture`.

---

## 10. Appendix — scoping session artifacts

- **Pre-flight queries:** `scripts/_d9e-scope-data.mjs`
- **LDox UI tour captured:** Loan + Property, Borrowers, Financials, Additional Data, Loan Dates, Disclosure, Overview, UW/Conditions, Documents, Tasks — 10 pages reviewed 2026-04-23
- **DB audit:** `Work/Dev/audits/DB-STRUCTURE-2026-04-23.md`

---

*This plan supersedes any prior D9e scoping notes. Status: ready for execution pending §8 pre-work completion.*
