---
date: 2026-04-27
author: pc-dev
doc: ResiCentral LLPA inventory — D9c.6 parser pre-build
companion_doc: Work/Dev/PRICING-ARCHITECTURE.md (§10 multi-lender DSCR integration)
status: inventory — open questions resolved 2026-04-27, ready for D9c.6.2
source_xlsx: 67370_04242026_1128199760.xlsx (effective 2026-04-24)
amendments:
  - 2026-04-27 pc-dev — §10 open questions resolved with David. Q1 confirmed (new `loan_size_secondary` rule_type). Q2 confirmed (Select combined column treated as 30-yr fixed; IO skipped). Q3 confirmed (new `pricing_special` rule_type with FICO/DSCR/LTV gates). Q4 confirmed (split prepay into `prepay_term` + `prepay_structure` rule_types). Borrower-vs-MLO surface split clarified — parser captures all variants; UI layer chooses what to expose. Memory rule "skip IO products" updated: skip means don't extract 30-yr IO rate-sheet column as separate product (variant cols share base prices); IO LLPAs still captured as feature rows so MLO calc (D9d.1) can apply them.
  - 2026-04-27 pc-dev — §6 inventory gap discovered during D9c.6.5 implementation. Premier and Investor Premier share an identical Feature×LTV layout (single label in col 3, 9 LTV bands in cols 4-12, 10 FICO bands). Elite uses a 2-column label scheme (category in col 3, sub-label in col 4) with 7 LTV bands in cols 5-11 — fundamentally different. Select uses col 2 for category labels, col 3 for sub-labels, 7 LTV bands in cols 4-10 — also distinct. Inventory §6 noted "different shape" but didn't capture that the difference precludes shared extraction. Per AD: D9c.6.5 ships Premier + Investor Premier (structurally compatible); Elite parser deferred to D9c.6.5b; Select parser deferred to D9c.6.5c. ResiCentral DSCR coverage in production until 6.5b/c land = 2 of 4 tiers (premier, investor_premier). Investor Premier uses "N/A" cell marker (not "NA"); `isNa()` extended to match both.
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

## 10. Resolved decisions (locked 2026-04-27 with David)

1. **Loan Amount Adj rule_type naming** — **new `rule_type = 'loan_size_secondary'`** (separate from §5.2 UPB rows which keep `rule_type = 'loan_size'`). Pricer adds one extra `.find()` block; both LLPAs sum into `llpa_total`. Schema columns unchanged.
2. **Combined Select 30-yr column** — treated as the 30-yr fixed price ladder. The IO half of the column header is irrelevant because IO products are filtered out at the parser entry (§4.4). The IO LLPA in the LLPAs tab handles the IO variant for downstream consumers (MLO calc in D9d.1) — borrower calc never opts in.
3. **Pricing Special** — **new `rule_type = 'pricing_special'`**. Stores FICO/DSCR/LTV conditions in the existing `fico_min`, `dscr_ratio_min`, `cltv_max` columns. Pricer adds one auto-applied `.find()` block (not gated by `scenario.features` — fires when conditions match). Same shape applies to "January Pricing Special" and any future date- or scenario-bounded specials. Graceful no-op when row is absent.
4. **Prepay TERM + Prepay STRUCTURE additivity** — **split into `prepay_term` + `prepay_structure` rule_types**. Term rows use `rule_type='prepay_term'` (matches by `prepay_years`). Structure rows use `rule_type='prepay_structure'` (matches by `feature`, e.g. `'fixed_5'`, `'declining'`, `'six_month_interest'`). Pricer adds two `.find()` blocks; both LLPAs sum. Existing Everstream `prepay` rule_type left untouched for now; cleanup migration scheduled separately as a small follow-up PR after ResiCentral lands.

### 10.5 Borrower-vs-MLO surface split (clarified in Q4 review)

The parser data model is **the same** for borrower calc and the future MLO calc (D9d.1) — parser captures every prepay term, every prepay structure, every IO LLPA, every feature LLPA. The decision about what to expose lives at the API/calc layer, not the parser layer.

| Layer | Borrower calc | MLO calc (D9d.1, future) |
|---|---|---|
| API request | Hardcoded defaults: `prepay_years=5, prepay_structure='fixed_5', features=[]` | All toggles exposed: prepay term + structure + IO + ARM period + tier + lock days |
| Pricer behavior | Applies matching `prepay_term` + `prepay_structure` rules; IO LLPA never matches because `features=[]` | Applies whatever rules match MLO's selected scenario |

This validates AD-9. One parser feeds both surfaces; UIs filter independently.

## 10.6 Per-program layout addendum (2026-04-27, post-implementation)

The inventory's §6 high-level note about Elite + Select having "different shape" turned out to understate the difference. Direct inspection during D9c.6.5 shows three distinct Feature×LTV layouts:

| Program | Label cols | Data start col | LTV band count | Cell marker |
|---------|------------|----------------|----------------|-------------|
| Premier | col 3 (single) | col 4 | 9 (`0-50%` … `85.01-90%`) | `NA` |
| Investor Premier | col 3 (single) | col 4 | 9 (same as Premier) | `N/A` |
| Elite | col 3 (category) + col 4 (sub-label) | col 5 | 7 (`0-50%` … `75.01-80%`) | `NA` |
| Select | col 2 (category) + col 3 (sub-label) | col 4 | 7 (same as Elite) | `NA` |

Premier + Investor Premier are flat-label tables — every row's `col 3` is a self-contained category like "DSCR 1.25 - 1.49" or "5yr PPP". The shared `extractFeatureLtvGrid` works directly with `classifyResicentralLabel(label)`.

Elite + Select are 2-col label tables where `col 3` (Elite) or `col 2` (Select) carries a category header that **forward-fills** for the rows below it, and the sub-label varies per row:

```
[col 3]              [col 4]
DSCR Additional      >=1.25     0.005   0.005   ...
                     1.00-1.24  0       0       ...
                     0.75-0.99 -0.005  -0.00625 ...
Housing History      1x30x12   -0.0025 -0.0025  ...
                     0x60x12   -0.01   -0.01    ...
```

This pattern doesn't match the shared util's single-label model. Two paths forward (decided when 6.5b/c are scheduled):
1. Extend `extractFeatureLtvGrid` with optional `categoryCol` + forward-fill behavior — generalize the shared util.
2. Write program-specific extractors that walk the rows themselves and only delegate cell parsing to `parseCell`/`isNa`.

Path 1 keeps consistency with Premier's wiring; path 2 isolates per-program quirks (NJ Prepay overrides in Elite, Florida tier in Select). To be decided at D9c.6.5b kickoff with the Elite workbook in hand.

### State-specific rules confirmed

- **Elite** has rows like `State / CT, IL, NJ, NY` (r59 in 2026-04-24 sheet) and a separate "Other Price Adjustments" block with NJ Prepay Penalty overrides + state-specific max prices.
- **Select** has `Tier 2 States: Other**` (Tier 1 = NV/LA/GA/...; Tier 2 = everything else minus FL) and a standalone "Florida" LLPA that's additive to all others.

ResiCentral's actual licensed states aren't enumerated in the workbook. The parser should still apply the LICENSED_STATES filter (CA/CO/OR/TX) at parse time when these blocks land in 6.5b/c.

## 11. Estimated parser sub-PRs (D9c.6.x)

| # | Scope | Status | PR(s) | Notes |
|---|-------|--------|-------|-------|
| **D9c.6.1** | This inventory document | ✅ Shipped | [#217](https://github.com/bicklehoff/netrate-pc-ops/pull/217), [#218](https://github.com/bicklehoff/netrate-pc-ops/pull/218) | Amendment in #218 closed open Q1–Q4 with David |
| **D9c.6.2** | Shared utilities (`fico-ltv-grid.js`, `feature-ltv-grid.js`, `effective-date.js`, `anchor-by-text.js`, `cells.js`) + unit tests | ✅ Shipped | [#219](https://github.com/bicklehoff/netrate-pc-ops/pull/219) | 48 unit tests; per-folder `package.json` with `type:module` scopes ESM |
| **D9c.6.3** | Refactor `everstream-llpas.js` to use shared utilities | ✅ Shipped | [#220](https://github.com/bicklehoff/netrate-pc-ops/pull/220) | Parity zero-change verified by integration test |
| **D9c.6.4** | ResiCentral rates parser (`resicentral-rates.js`) | ✅ Shipped | [#221](https://github.com/bicklehoff/netrate-pc-ops/pull/221) | 588 products against 2026-04-24 sheet; 6 in-scope ladders, 0 unintended skips. **Fixed-only scope** — ARM expansion deferred (see follow-ups) |
| **D9c.6a** | Pricer wiring for new rule_types (`prepay_term`, `prepay_structure`, `pricing_special`, `loan_size_secondary`) + tier auto-discovery | ✅ Shipped | [#224](https://github.com/bicklehoff/netrate-pc-ops/pull/224) | Backward-compat with Everstream's `prepay`; null-purpose fix in [#230](https://github.com/bicklehoff/netrate-pc-ops/pull/230); pricing-special stacking in [#231](https://github.com/bicklehoff/netrate-pc-ops/pull/231); deterministic tier order in [#226](https://github.com/bicklehoff/netrate-pc-ops/pull/226) |
| **D9c.6.5** | ResiCentral LLPAs parser (Premier + Investor Premier only) | ✅ Shipped | [#223](https://github.com/bicklehoff/netrate-pc-ops/pull/223) | 769 rules; locked-decision implementation Q1–Q4. Elite + Select deferred per §10.6. Units fix [#229](https://github.com/bicklehoff/netrate-pc-ops/pull/229) (×100 to convert workbook decimal-fraction → points) |
| **D9c.6.5b** | ResiCentral Elite LLPAs parser | ✅ Shipped | (this PR) | Extended `extractFeatureLtvGrid` with optional `categoryCol` + forward-fill (backward-compatible — Premier/InvPremier unchanged). New `classifyEliteFeatureLabel(subLabel, { category })` covers DSCR Additional / Housing History / Housing Event Seasoning / Loan Balance / Purpose / Property Type / Amortization / Prepayment Penalty / 5% Fixed / Other. State row (CT/IL/NJ/NY) and "Other Price Adjustments" NJ Prepay override block dropped at parse — out-of-license. Elite prepay rules emit as `prepay_joint` (term × structure matrix, like Everstream) — NOT `prepay_term` + `prepay_structure` — because each cell is a distinct LLPA per (term, structure) combination, not decomposable into independent additive parts. 348 Elite rules / 9 rule_types verified against 2026-04-24 sheet (smoke test in `scripts/_smoke-elite-llpas.mjs`). |
| **D9c.6.5c** | ResiCentral Select LLPAs parser | ✅ Shipped | (this PR) | Cols 2+3 layout via shared `extractFeatureLtvGrid`. Side blocks at different positions from Premier/Elite — `parseMaxPriceBlock`, `parseLoanAmountAdjBlock`, `parseMiscAdjustments` parameterized with `labelCol` / `valueCol` / `rowSpan` opts. New `parseSelectPrepayLlpaBlock` for the flat term-only "Investor Only" prepay block (no LTV banding, no structure dimension — emits `prepay_term` rows with `llpa_points`). Max-Price "2-4yr PPP" range row expanded into three `prepay_term` rules with same `price_cap`. Out-of-license: Florida Condo + Florida property rows dropped. Tier 2 States row emitted as auto-firing `pricing_special` (LTV-banded LLPA always applies for CA/CO/OR/TX). 178 Select rules / 8 rule_types verified against 2026-04-24 sheet. |
| **D9c.6.6** | Top-level orchestrator + ingest function rename + CLI runner | ✅ Shipped | [#225](https://github.com/bicklehoff/netrate-pc-ops/pull/225) | `parseResicentralXlsx`, `ingestNonqmSheet`, `scripts/ingest-resicentral.mjs` |
| **D9c.7** | Production ingest + activation | ✅ Shipped | (operational, not a PR) | 588 products + 769 rules ingested, sheet activated 2026-04-27. LS-confirmed parity to the thousandth on canonical Premier scenario |
| **D9c.6.7** | 50+ scenario regression suite | ⏭ Deferred | — | Hand-calculate 50 representative scenarios, compare against parser output. Single-scenario LS validation (D9c.7) confirmed parser+pricer correctness end-to-end; broader regression deferred until Elite + Select parsers land |
| **D9c.X-public** | Public-projection layer — strip lender attribution from `/api/pricing/dscr` | ✅ Shipped | [#232](https://github.com/bicklehoff/netrate-pc-ops/pull/232) | IP firewall at API boundary; no `lender_code`/`tier`/`raw_product_name` exposed to public callers; `meta.lenders[]` → `meta.as_of`; calc + widget badges neutralized |

### Phase summary (as of 2026-04-27 close)

ResiCentral DSCR live in production for Premier + Investor Premier programs alongside Everstream. Visitor-facing surfaces compliant (no lender attribution). Pricer correctly applies all 4 ResiCentral-introduced rule_types. End-to-end LS parity validated.

### Phase summary update (D9c.6.5b, 2026-04-27)

Elite LLPAs parser shipped. Three of four DSCR tiers now in production. Two architectural artifacts worth carrying forward:

1. **Joint-vs-additive prepay model is per-program, not per-lender.** Premier + InvPremier use the additive `prepay_term` + `prepay_structure` model (independent rows summed by the pricer). Elite uses the joint `prepay_joint` model (single LLPA for each (term, structure) combination — same as Everstream). The two co-exist in the pricer; classifier maps program-specific layouts to the correct rule_type. Don't assume a lender's prepay shape is uniform across its programs.
2. **2-col forward-fill extractor proven.** `extractFeatureLtvGrid` now supports both 1-col (Premier shape) and 2-col category+sub-label (Elite shape) layouts via the `categoryCol` opt. Same util will serve Select (cols 2+3) by passing `categoryCol: 2, labelCol: 3, startCol: 4`.

### Phase summary update (D9c.6.5c, 2026-04-27)

Select LLPAs parser shipped. **All four DSCR tiers now in production** — D9c.6 phase complete for the rate-sheet portion. Three architectural artifacts to carry forward:

1. **Three distinct prepay models in one lender's workbook.** Select adds a third pattern: flat term-only LLPAs (no LTV banding, no structure dimension). Together with Premier's additive (`prepay_term` + `prepay_structure`) and Elite's joint (`prepay_joint`) models, ResiCentral demonstrates that mortgage rate sheets routinely encode the same business concept (prepay penalty pricing) in mutually-exclusive shapes. The pricer absorbs all three through separate `find()` blocks that gracefully no-op when the relevant rules aren't present for the matched tier.
2. **Side-block parsers parameterized via opts.** `parseMaxPriceBlock` / `parseLoanAmountAdjBlock` / `parseMiscAdjustments` now take `{ labelCol, valueCol, rowSpan }` overrides. Defaults match Premier/InvPremier/Elite (cols 6/7, 9/11, 3/4); Select passes overrides for its shifted layout (cols 9/10, 2/3, 9/10). Will simplify if a future ResiCentral-shaped lender appears.
3. **`pricing_special` as the auto-fire mechanism for state-default LLPAs.** Select's "Tier 2 States: Other" row is conceptually a state-keyed adjustment, but with NetRate's license entirely in Tier 2 (CA/CO/OR/TX), it always fires. Modeled as `pricing_special` with no FICO/DSCR gates, only LTV bounds — the rule_type's auto-fire semantics handle the "always-on" case cleanly without introducing a new `state_default` rule_type.

**Verified counts (2026-04-24 sheet):** Premier 400 + InvPremier 369 + Elite 348 + Select 178 = **1,295 ResiCentral LLPA rules** alongside Everstream's 82 prepay_joint + grid rules.

### Open follow-ups (queued, not blocking borrower value)

1. **ResiCentral ARM rates expansion** (parser scope grow) — workbook has 7/6 + 5/6 + 10/6 ARM ladders per program; current parser stops at the ARM section header. Borrower calc + widget default to ARM, so until this lands ResiCentral only contributes when borrowers explicitly switch to fixed (no toggle yet).
2. **Borrower-facing fixed/ARM toggle** (alt path) — surface ResiCentral fixed without parser expansion.
3. **D9c.6.5b** Elite LLPAs parser (2-col layout, in-license categories only).
4. **D9c.6.5c** Select LLPAs parser (cols 2+3 layout, Tier 2 LLPAs only — drop FL + NV/LA/GA per license).
5. **D9c.6.7** 50+ scenario regression suite.
6. **AD-7 license filter wiring** — `isLicensedInState()` defined but unused. Wire in pricer when 3rd lender lands.
7. **`prepay` rule_type cleanup** — migrate Everstream's existing `prepay` rules to `prepay_term` + `prepay_structure` so the dual-handling code in the pricer can be retired.

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
