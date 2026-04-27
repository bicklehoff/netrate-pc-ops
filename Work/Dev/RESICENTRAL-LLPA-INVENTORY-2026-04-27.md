---
date: 2026-04-27
author: pc-dev
doc: ResiCentral LLPA inventory — D9c.6 parser pre-build
companion_doc: Work/Dev/PRICING-ARCHITECTURE.md (§10 multi-lender DSCR integration)
status: inventory — pending David's review of decisions before D9c.6.2 starts
source_xlsx: 67370_04242026_1128199760.xlsx (effective 2026-04-24)
---

# ResiCentral DSCR — LLPA Inventory

This document is the inventory required by §10.3's D9c.6 step ("inventory-first") and the *Required patterns / Inventory-before-parser* rule in `GOVERNANCE.md §Coding Principles`. It maps every LLPA section in ResiCentral's wholesale rate sheet that the DSCR parser will consume, classifies each by extraction pattern, and locks the in-scope vs out-of-scope decisions before any parser code is written.

**Why this is here:** an earlier inventory + parser build (PR-1, 2026-04-26) was lost when an uncommitted worktree was pruned between sessions. This is the rebuild. The lesson — commit inventory first, parser code second — is now baked into the PR sequencing (D9c.6.1 = this doc; D9c.6.2+ = parser sub-PRs).

---

## 1. Source workbook overview

| Property | Value |
|---|---|
| File | `67370_04242026_1128199760.xlsx` (676 KB) |
| Effective date | 2026-04-24 (encoded in filename: `04242026`) |
| Lender ID prefix | `67370` (ResiCentral's GCS file pattern) |
| Total sheets | 59 |
| In-scope (DSCR) | 4 programs × 2 tabs = **8 sheets** |
| Out of scope | 51 sheets (Conv/FHA/VA/Jumbo/NonQM-other/Bank Statement, plus DSCR Elite FN) |

ResiCentral's workbook is structured one tab per (program, kind) pair where kind ∈ {rate sheet, LLPA sheet}. Each program has exactly two tabs: e.g. `DSCR Premier` (rate sheet) + `DSCR Premier LLPAs` (adjustments).

---

## 2. In-scope tabs

| # | Program | Rate sheet tab | LLPA tab | nonqm tier name (proposed) |
|---|---------|----------------|----------|----------------------------|
| 1 | Premier | `DSCR Premier` | `DSCR Premier LLPAs` | `premier` |
| 2 | Investor Premier | `DSCR Investor Premier` | `DSCR Investor Premier LLPAs` | `investor_premier` |
| 3 | Elite | `DSCR Elite` | `DSCR Elite LLPAs` | `elite` |
| 4 | Select | `DSCR Select` | `DSCR Select LLPA` (note: singular) | `select` |

`tier` value lands in `nonqm_rate_products.tier` and `nonqm_adjustment_rules.tier`. Snake-case lower per existing Everstream pattern (`elite_1`, `elite_2`, `elite_5`). ResiCentral tier names don't share semantics with Everstream's (per AD-3 — lender-scoped tiers, no global model).

---

## 3. Out-of-scope tabs

| Tab | Why skipped |
|-----|-------------|
| `DSCR Elite FN` + `DSCR Elite FN LLPAs` | Foreign National. Per memory: skip — YAGNI. Add later if product need arises. |
| All Conv/FHA/VA tabs (15 sheets) | Forward agency products — handled by `src/lib/rates/parsers/`, not the NonQM pipeline. |
| All Jumbo tabs (8 sheets) | Out of scope for D9c phase. May land in a future Jumbo expansion. |
| All other NonQM tabs (NQM Premier PRIME/PLUS, Bank Statement Elite, NQM Select Expanded/Choice/Plus/Global, etc. — ~16 sheets) | Out of scope for D9c. Bank Statement Elite is highest-value follow-on per `PLATFORM-2026/RESICENTRAL-NONQM-BANKSTATEMENT` backlog item. |
| `SOFR 30Day` + `Sheet1` (empty) | Index/ref sheets only. |

---

## 4. Rate sheet structure (per program)

Each DSCR rate sheet tab follows the same column-structured layout. Header rows 0-13 are boilerplate (ResiCentral branding, lock cutoffs, "Indicative pricing" disclaimer). Real data starts at row 12 with the program name.

### 4.1 Header row (row 14) — product variants

Three variant columns per program. The variants differ slightly across programs:

| Program | Variant 1 (col B) | Variant 2 (col H) | Variant 3 (col N) |
|---------|-------------------|-------------------|-------------------|
| Premier | 30 Year Fixed | 30 Year Fixed IO | 40Yr Fixed/40Yr Fixed IO |
| Investor Premier | 30 Year Fixed | 30 Year Fixed IO | 40 Year Fixed IO |
| Elite | 30 Year Fixed | 30 Year Fixed IO | 40 Year Fixed IO |
| Select | 30 Year Fixed & 30 Year IO | 15 Year Fixed | 40 Year Fixed IO |

### 4.2 Days-to-Lock + price rows (rows 15-16)

Each variant column splits into 3 sub-columns: 30 / 45 / 60 day lock prices. Row 16 carries the `Rate` label for the rate axis and `30 / 45 / 60` headers for the lock-day columns.

### 4.3 Rate ladder (row 17 onward)

50+ rates from ~5.49% up through ~12% in 0.125 increments. For each rate, three lock prices per variant. Spot-check confirms variants share the *same base price* per rate (LLPAs in the LLPA tab differentiate them).

### 4.4 Variant filter (in scope per memory rules)

| Variant | In scope? | Reason |
|---------|-----------|--------|
| 30-Year Fixed | ✅ Yes | Default DSCR program; primary product |
| 30-Year Fixed **IO** | ❌ Skip | IO YAGNI rule (memory) |
| 40-Year Fixed (Premier only) | ✅ Yes | Fully-amortized 40-yr; not IO |
| 40-Year Fixed **IO** | ❌ Skip | IO YAGNI rule |
| Select 15-Year Fixed | ✅ Yes | Fully-amortized; not IO |
| Select "30 Year Fixed & 30 Year IO" combined col | ✅ Yes (treat as 30-yr fixed; IO variant differentiated by LLPA) |

**Resulting product variants (per program):**

| Program | 30-yr Fixed | 40-yr Fixed | 15-yr Fixed | Variants in scope |
|---------|:-----------:|:-----------:|:-----------:|:-----------------:|
| Premier | ✅ | ✅ | — | 2 |
| Investor Premier | ✅ | — (40-yr IO only) | — | 1 |
| Elite | ✅ | — (40-yr IO only) | — | 1 |
| Select | ✅ | — (40-yr IO only) | ✅ | 2 |

**Total `nonqm_rate_products` rows:** 6 in-scope (term × program) combinations × 3 lock days × ~50 rates ≈ **~900 rate rows**.

---

## 5. LLPA structure (per program)

All four LLPA tabs share the same canonical sections, with minor row-index variation. Sections classified by extraction pattern:

### 5.1 FICO × LTV grid — `rule_type = 'fico_cltv_grid'`

Same shape as Everstream's FICO×CLTV grid:
- **Rows:** FICO bands (e.g. `780-999`, `760-779`, `740-759`, …, down to lower scores)
- **Columns:** 9 LTV bands (`0-50.00%`, `50.01-55%`, `55.01-60%`, `60.01-65%`, `65.01-70%`, `70.01-75%`, `75.01-80%`, `80.01-85%`, `85.01-90%`)
- **Values:** signed decimal LLPAs in points; `"NA"` strings for unsupported (FICO, LTV) combos

Maps to `nonqm_adjustment_rules` with `fico_min`, `fico_max`, `cltv_min`, `cltv_max`, `llpa_points`. `not_offered = TRUE` when value is `"NA"`.

| Program | Section start row | FICO band count |
|---------|:----------------:|:----------------:|
| Premier | 16 | ~11 |
| Investor Premier | 16 | ~11 |
| Elite | 16 | ~11 |
| Select | 14 | ~9 |

### 5.2 Product Feature × LTV grid — multiple `rule_type` values

A single grid in the sheet that mixes several conceptually-distinct adjustment categories under one block. The parser must classify each row by feature label and emit appropriate `rule_type`.

**Sub-categories observed in DSCR Premier LLPAs (rows 32-67):**

| Sub-category | Sample rows | Proposed `rule_type` | Schema fields |
|--------------|-------------|----------------------|----------------|
| DSCR ratio bands | "No Ratio", "DSCR 0.75-0.89", "DSCR 0.90-0.99", "DSCR 1.00-1.24", "DSCR 1.25-1.49", "DSCR ≥ 1.50" | `dscr_ratio` | `dscr_ratio_min`, `dscr_ratio_max` |
| Loan size (UPB) bands | "UPB <=150K", "UPB >150K - 250K", "UPB 250,001-350,000", … up to "UPB >2.5mm - 3.0mm" | `loan_size` | `loan_size_min`, `loan_size_max` |
| Loan purpose | "Cash Out / Debt Consolidation" | `loan_purpose` | `loan_purpose = 'cashout'` |
| Property type | "Non-Warrantable Condo", "Condo", "2 Unit Property", "3-4 Unit Property" | `property_type` | `property_type` enum |
| Prepay TERM (years) | "5yr PPP", "4yr PPP", "3yr PPP", "2yr PPP", "1yr PPP", "No PPP" | `prepay` | `prepay_years` |
| Prepay STRUCTURE | "Declining Prepay", "5% Flat Prepay", "Standard 6 Months Interest Prepay" | `prepay_structure` | `feature` (matches existing pricer's `prepay_structure` filter) |
| Term + IO feature | "30 YR IO", "40 YR IO", "40yr Fully Amortized" | `feature` | `feature` enum (`io_30`, `io_40`, `term_40_amortized`) |
| Pricing special | "Pricing Special (700+ FICO, ≥1 DSCR)" | `feature` | `feature = 'pricing_special'` (gated by FICO + DSCR conditions in note) |

**LTV-banded for all sub-categories.** Each row carries 9 LLPAs across the same LTV bands as §5.1.

**Critical pattern:** Sub-categories are layered (per existing Everstream pricer model). Pricer applies one match per sub-category, summing LLPAs. Multi-feature scenarios (e.g. cash-out + 2-unit + 5yr PPP) sum all three.

**Investor Premier / Elite / Select** have similar structure but slightly different sub-category lists (e.g. Select adds "Escrow Waiver" and "Florida" — see §6).

### 5.3 Loan Amount Adj — `rule_type = 'loan_size_secondary'`

A SEPARATE table (rows 75+ in Premier) listing flat LLPAs by loan amount band:

| Band | LLPA |
|------|------|
| `Min Loan Amount-$199,999` | -0.015 |
| `$200,000-$749,999` | 0 |
| `$750,000-$999,999` | +0.00125 |
| `$1MM-$1,999,999` | +0.0025 |
| `$2MM-$3,000,000` | +0.00375 |

**Important:** the cut-points here are DIFFERENT from §5.2's UPB rows. Both apply additively. Need a distinct `rule_type` to avoid the pricer treating them as conflicting matches.

> **Open question (D9c.6.2 author's call):** introduce `loan_size_secondary` as a new rule_type, or fold these flat LLPAs into the existing `loan_size` semantics with an additional bool/discriminator column? Lean toward new rule_type — keeps schema unchanged, parser maps each block to its own rule_type.

### 5.4 Max Price caps — drives `nonqm_adjustment_rules.price_cap`

A small table per program (rows 76-81 in Premier) tying price caps to PPP term:

| PPP term | Max Price (Premier) |
|----------|---------------------|
| 5yr PPP | 103.65 |
| 4yr PPP | 103.15 |
| 3yr PPP | 103.15 |
| 2yr PPP | 101.9 |
| 1yr PPP | 100.9 |
| No PPP | 100.9 |

Maps to a `prepay`-keyed rule (matching `prepay_years` and program tier) with `price_cap` populated. Pricer caps `final_price` at this value (existing Everstream behavior — see `price-dscr.js:333-337`).

Caps differ across programs — Premier caps higher (103.65) than Elite (TBD per Elite's "Max Price Elite" header).

### 5.5 Misc Adjustments — `rule_type = 'feature'` (special cases)

Premier has (rows 82-84):
- `Guideline Exception: -0.0025` — flat LLPA when manual exception applied
- `January Pricing Special (700+ FICO & LTV ≤ 80): 0.005` — date-bounded special

Investor Premier has its own Misc section. Elite + Select may or may not — see §6 per-program differences.

These are flat (not LTV-banded). Treat as `feature` rule with `feature = 'guideline_exception'` etc.

### 5.6 Lender fees — OUT OF SCOPE

Section 5 (rows 75-79 in Premier) lists lender flat fees:
- Lender Fee/Application Fee: $1,595
- Flood Cert Fee: $5.25
- Tax Service Fee: $75
- MERS Registration Fee: $24.95

**Deferred** to `PLATFORM-2026/ESTIMATED-FEES-ARCHITECTURE` (Tier 4 backlog item — state × product × lender fee coverage). Parser SHOULD NOT write these to `nonqm_adjustment_rules`; they're not LLPAs.

### 5.7 Notes / disclaimer rows — informational only

Rows like "*Where no prepay penalty allowed, No PPP pricing applies", "Minimum loan amount of $100,000", "Acceptable structures include the following: ...". Parser ignores these strings.

---

## 6. Per-program differences

| Program | Notable differences from canonical |
|---------|------------------------------------|
| Premier | Canonical / reference. Has Misc Adjustments section (Guideline Exception + January Special). |
| Investor Premier | Smaller LLPA grid (84 rows vs Premier's 89). Ends with Misc Adjustments. |
| Elite | Larger grid (101 rows). Adds prepay structure rules specific to MS, NJ. Notes about "soft prepayment penalties" priced as no-prepay. Max Price caps under "Max Price Elite" header. |
| Select | **Different shape**: smallest LLPA grid (71 rows). FICO×LTV section starts row 14 (not 16). Has Escrow Waiver LLPA. Adds Florida-specific LLPA (and "Detached Condos treated as SFR" rule). 15-yr Fixed product variant unique to Select. |

**Implication for parser:** the four programs share enough structure that ~80% of code is shared (FICO×LTV grid extractor, Product Feature × LTV grid extractor, Max Price extractor). The per-program differences are isolated to:
- Variant column count + IO filtering (rate sheet)
- Sub-category list (Product Feature grid — Select adds Florida + Escrow Waiver)
- Misc section (presence + entries vary)
- Anchor row indices (Select's grids start earlier)

Anchor-by-text-marker (search for "FICO Score" / "Product Feature" / "Max Price" / "Misc Adjustments") instead of fixed row numbers — more robust to per-program layout shifts.

---

## 7. State-licensed filter (per AD-7)

NetRate is licensed in **CA, CO, OR, TX**. Per AD-7 the loader skips a lender entirely when scenario.state isn't covered, so per-state LLPAs landing in `nonqm_adjustment_rules` should be **filtered to LICENSED_STATES at parse time** to avoid storing rules that can never match a real scenario.

ResiCentral's LLPA tabs reference state-specific adjustments inline (e.g. Select tab mentions "Florida" — out of our coverage; "MS" and "NJ" mentioned in Elite tab — also out of coverage). Parser drops these rows.

The licensed-states constant ships in `src/lib/pricing-nonqm/lender-display.js` (D9c.2). Parser imports `LENDER_INFO['resicentral'].licensedStates` as the filter list.

---

## 8. Schema mapping summary

ResiCentral data lands in the existing `nonqm_*` tables — no schema changes needed. Mapping:

| ResiCentral concept | DB table | Column / value |
|---------------------|----------|---------------|
| Rate sheet header | `nonqm_rate_sheets` | `lender_code = 'resicentral'`, `effective_at = 2026-04-24`, `has_dscr = TRUE` |
| Per-rate / per-term / per-lock product | `nonqm_rate_products` | `loan_type = 'dscr'`, `tier ∈ {premier, investor_premier, elite, select}`, `term ∈ {15, 30, 40}`, `lock_days ∈ {30, 45, 60}`, `note_rate`, `final_base_price`, `product_type = 'fixed'` |
| FICO×LTV grid LLPA | `nonqm_adjustment_rules` | `rule_type = 'fico_cltv_grid'` |
| DSCR ratio band LLPA | `nonqm_adjustment_rules` | `rule_type = 'dscr_ratio'` |
| Loan size (UPB) band LLPA | `nonqm_adjustment_rules` | `rule_type = 'loan_size'` |
| Loan Amount Adj (separate) | `nonqm_adjustment_rules` | `rule_type = 'loan_size_secondary'` *(new — see §5.3 open question)* |
| Property type LLPA | `nonqm_adjustment_rules` | `rule_type = 'property_type'` |
| Loan purpose LLPA | `nonqm_adjustment_rules` | `rule_type = 'loan_purpose'` |
| Prepay term LLPA | `nonqm_adjustment_rules` | `rule_type = 'prepay'`, `prepay_years` |
| Prepay structure LLPA | `nonqm_adjustment_rules` | `rule_type = 'prepay'`, `feature` (e.g. `'fixed_5'`, `'declining'`) |
| Term + IO feature | `nonqm_adjustment_rules` | `rule_type = 'feature'`, `feature ∈ {io_30, io_40, term_40_amortized}` |
| State SRP | `nonqm_adjustment_rules` | `rule_type = 'state_srp'`, `state` (filtered to LICENSED_STATES) |
| Misc Adjustments | `nonqm_adjustment_rules` | `rule_type = 'feature'`, `feature = 'guideline_exception'` etc. |
| Max Price caps | `nonqm_adjustment_rules` | `rule_type = 'prepay'`, `price_cap` |
| Lender fees | **out of scope** | (deferred to ESTIMATED-FEES backlog) |

---

## 9. Decisions locked (require David's review before D9c.6.2)

1. **In-scope products:** 4 DSCR programs (Premier, Investor Premier, Elite, Select). Skip Elite FN (Foreign National, YAGNI).
2. **Skip IO products** entirely — 30-yr IO and 40-yr IO variants of every program. Per memory rule.
3. **In-scope term variants:** 30-yr fixed (all 4 programs), 40-yr fully-amortized fixed (Premier only — others are IO-only at 40), 15-yr fixed (Select only).
4. **Filter state-specific LLPAs to LICENSED_STATES** (CA/CO/OR/TX) at parse time.
5. **Lender fees out of scope** — Lender Fee, Flood Cert, Tax Service, MERS. Defer to ESTIMATED-FEES backlog.
6. **Anchor by text markers** (not fixed row indices) — robust to per-program layout shifts and minor rate sheet revisions.
7. **`tier` values in nonqm_rate_products:** `premier`, `investor_premier`, `elite`, `select`. Snake-case lower per Everstream pattern. No mapping to Everstream tier names (per AD-3 lender-scoped tiers).
8. **New `rule_type = 'loan_size_secondary'`** for the standalone Loan Amount Adj table (separate from §5.2 UPB rows). Avoids conflict with the LTV-banded UPB LLPAs that share `rule_type = 'loan_size'`.

## 10. Open questions

1. **Loan Amount Adj rule_type naming** (per §5.3) — `loan_size_secondary` vs collapse into `loan_size` with a discriminator? Lean: new rule_type. Confirm.
2. **Combined Select 30-yr column** — "30 Year Fixed & 30 Year IO" shares one rate ladder. Parser treats as 30-yr fixed; IO variant differentiated by LLPA. Confirm this matches intent.
3. **Pricing Special with two conditions** — "700+ FICO, ≥1 DSCR, max LTV ≤ 80%". Single LLPA value `+0.00875` per row 67. Pricer applies as a `feature` rule; conditions enforced via FICO/DSCR/LTV gates on the rule. Confirm this fits the existing pricer's match model.
4. **Prepay TERM + Prepay STRUCTURE additivity** — sheet note says "Prepay structure LLPAs additive to PPP Term LLPA (i.e. 5% Flat Prepay would be added to 5yr PPP LLPA)". Existing `priceOne` applies one match per `rule_type`; need to either (a) emit both as `prepay` rule_type and ensure additivity logic in pricer, or (b) split into `prepay_term` + `prepay_structure` rule_types. Lean: split.

## 11. Estimated parser sub-PRs (D9c.6.x)

| # | Scope | Estimated lines | Risk |
|---|-------|-----------------|------|
| **D9c.6.1** | **This inventory document** | ~330 lines doc | Low (docs-only) |
| **D9c.6.2** | Shared utilities — `fico-ltv-grid.js`, `feature-ltv-grid.js`, `effective-date.js`, anchor-by-text helper. Unit tests. | ~400 + 200 tests | Medium |
| **D9c.6.3** | Refactor `everstream-llpas.js` to use shared utilities (parity zero-change). | ~150 net | Medium |
| **D9c.6.4** | ResiCentral rates parser (`resicentral-rates.js`) — extracts the 6 in-scope (program, term) ladders × 3 lock days. | ~250 | Medium |
| **D9c.6.5** | ResiCentral LLPAs parser (`resicentral-llpas.js`) — extracts §5.1 FICO×LTV + §5.2 Feature×LTV + §5.3 Loan Amount Adj + §5.4 Max Prices + §5.5 Misc per program. | ~500 | High |
| **D9c.6.6** | Top-level orchestrator + ingest function rename + CLI runner. | ~150 | Low |
| **D9c.6.7** | 50+ scenario parity check — hand-calculate 50 representative scenarios from the spreadsheet, compare against parser output. | ~200 tests | Medium |

Total estimated effort: **5–7 sessions** (matches the original PR-1 estimate).

## 12. Verification log

| Claim | Evidence |
|---|---|
| 59 sheets in workbook | xlsx enumeration 2026-04-27 |
| 4 DSCR programs in scope (premier, investor_premier, elite, select) | Sheet name enumeration 2026-04-27 |
| Each DSCR program has 2 tabs (rates + LLPAs) | Sheet name enumeration 2026-04-27 |
| Rate sheet header structure (rows 12-16) consistent across programs | Inspection of all 4 DSCR rates tabs 2026-04-27 |
| FICO×LTV grid is the first LLPA section in all 4 programs | Inspection of all 4 LLPA tabs 2026-04-27 |
| Premier LLPA section row indices: FICO@16, Feature@32, Fees@75, Misc@82 | Direct row inspection 2026-04-27 |
| Investor Premier indices: FICO@16, Feature@32, Fees@70, Misc@77 | Direct row inspection 2026-04-27 |
| Elite indices: FICO@16, Feature@32, Fees@77 | Direct row inspection 2026-04-27 |
| Select indices: FICO@14, Feature@25, Fees@55 — different layout | Direct row inspection 2026-04-27 |
| Sample base prices: Premier @ 6.625% rate = 100.125 / 99.975 / 99.675 (30/45/60 lock) | Direct row inspection 2026-04-27 |
| Select has 15-yr fixed, others don't | Direct row inspection 2026-04-27 |
| Investor Premier + Elite + Select 40-yr column is IO-only | Direct row inspection 2026-04-27 |
| Premier 40-yr column includes fully-amortized variant | Direct row inspection 2026-04-27 |

⚠️ Inferred (not directly verified):
- Variant base prices match across same-rate cells in all 4 rate sheets (only spot-checked top 2 rows per program). Will verify across full ladder during D9c.6.4.
- ResiCentral's licensed states actually include CA/CO/OR/TX. The sheet doesn't enumerate licensed states; we infer from David's prior session note "CA/CO/OR/TX for both today" + ResiCentral being approved as a NetRate broker. Confirm with David before parser ships.
