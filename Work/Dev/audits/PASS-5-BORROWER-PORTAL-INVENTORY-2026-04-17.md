# D8 Inventory Pass 5 - Borrower Portal + Application Intake Flow

**Audit:** Site Audit 2026 - Dimension 8 (Static data / stale-by-deploy) - Pass 5
**Date:** 2026-04-17
**Status:** Complete - Catalog phase only. Findings identified, no code changes.
**Scope:** Borrower-facing portal, application intake flow, lead capture forms, rate alerts

---

## Key Findings Summary

### Critical

**BP-9: LOAN_TYPES Divergence (3+ places)**
- StrikeRateForm: [conv, fha, va, usda, jumbo, dscr]
- MLO QuoteScenarioForm (Pass 6): [conv, fha, va, usda, dscr, bankstatement]
- Risk: New product type added to DB will silently omit from UI
- Fix: Extract to src/lib/constants/loan-types.js as single source

### High

**BP-5, BP-6: PROPERTY_TYPE/OCCUPANCY/UNIT Duplication**
- Enum lists appear in both Step2Purchase.js and Step2Refinance.js
- Risk: Adding property type requires edits in 2+ files
- Fix: Extract to src/lib/constants/application-enums.js

**BP-2: LTV Slider Policy Hardcoded**
- Minimum 50% LTV (5% down) hardcoded in Step2Purchase.js:214-230
- Risk: Policy change (e.g., allow 3% down) requires code edit, not config
- Fix: Move to ref_ltv_bounds table (D9d), deferred per section 2c

### Medium (9 findings)

**BP-1:** STATE_DEFAULTS closing cost estimates hardcoded (CO=$2800, TX=$3200, OR=$2600, CA=$3500)
**BP-3:** Refi LTV color thresholds hardcoded (green <=80%, amber 80-90%, red >90%)
**BP-4:** PURPOSE_OPTIONS in Step 1 (purchase/refinance only)
**BP-7:** EMPLOYMENT_OPTIONS in Step 4 (already consolidated in 1 file)
**BP-8:** BANKRUPTCY_CHAPTER and other URLA declaration enums
**BP-10:** NMLS and state licenses hardcoded (NMLS #641790, #1111861, "Licensed in CA, CO, TX, OR")
**BP-11:** No state-specific disclosures in intake form
**BP-12:** Anonymous intake (no Contact pre-requisite)
**BP-13:** Borrower model (becomes Contact in D9)

---

## Application Field Mapping vs UAD Spec

**All Layer 1 fields captured (checkmark):**
- Contact: first_name, last_name, email, phone, dob, ssn, current_address
- Employment: current_employer, title, employment_type, total_monthly_gross_income
- Assets: down_payment_source (amount only)
- Property: address, property_type, occupancy, estimated_value, units
- Loan: loan_purpose, loan_amount, property_value, ltv
- Co-borrower: linked Contact + employment/income
- Declarations: URLA Section 8 (full 5a/5b)

**Assessment:** Pass 5 inventory confirms full coverage of UAD Application LITE Layer 1 scope.

---

## Static Data Catalog (By Type)

### Fee Defaults
| ID | Location | Data | Risk | D9 Path |
|---|---|---|---|---|
| BP-1 | closing-costs.js:6-11 | STATE_DEFAULTS dict | MEDIUM | ref_closing_cost_defaults table |

### Loan Bounds
| ID | Location | Data | Risk | D9 Path |
|---|---|---|---|---|
| BP-2 | Step2Purchase.js:214 | LTV slider 50-100% | HIGH | ref_ltv_bounds table |
| BP-3 | Step2Refi.js:124-150 | Color thresholds (80/90%) | MEDIUM | Constants + ref_ltv_bounds |

### Picklist Duplications
| ID | Feature | Instances | Risk | Fix |
|---|---|---|---|---|
| BP-5 | PROPERTY_TYPE | 2 (purchase+refi) | HIGH | Extract to constants |
| BP-6 | OCCUPANCY | 2 (purchase+refi) | HIGH | Extract to constants |
| BP-9 | LOAN_TYPES | 3+ | CRITICAL | Extract to single source NOW |

### Compliance & Auth
| ID | Issue | Location | Risk | D9 Path |
|---|---|---|---|---|
| BP-10 | NMLS + licenses hardcoded | contact/page.js | MEDIUM | ref_license_states table |
| BP-11 | No state disclosures | All steps | MEDIUM | ref_state_disclosures table |
| BP-12 | Anonymous intake | ApplicationContext | MEDIUM | Contact-based draft (Layer 2) |

---

## Ship-Immediately Candidates

**BP-9 only** - if audit confirms a product in DB is missing from all UI picklists.

Audit query:
```sql
SELECT DISTINCT loan_type FROM scenarios WHERE created_at > now() - '30 days'::interval
UNION
SELECT DISTINCT loan_type FROM rate_products WHERE status = 'active'
ORDER BY loan_type;
```

All others deferred per section 2c (D9 absorbs findings).

---

## Files Scanned

**Application intake:** src/app/portal/apply/{page.js,[step]/page.js,steps/{Step2Purchase,Step2Refinance,Step3Address,Step4Employment,Step5Declarations,Step6Review}.js}

**Components:** src/components/Portal/{ApplicationContext,FormFields,BorrowerTabs,CoBorrowerNav,CoBorrowerPrompt,CoBorrowerIdentityForm}.js

**Lead capture:** src/app/contact/page.js, src/components/RateTool/{LeadCapture,StrikeRateForm}.js

**Validation & config:** src/lib/validations/application.js, src/lib/rates/closing-costs.js, src/lib/quotes/fee-builder.js

---

## Summary

**D8 Pass 5 complete.** Found 13 findings across borrower portal + application intake.

- **Critical:** 1 (LOAN_TYPES divergence)
- **High:** 3 (LTV policy hardcoding, enum duplication)
- **Medium:** 9 (state licensing, closing costs, auth model, other enums)

**Top 3 ship-immediate candidates (if triggered by audit):**
1. BP-9: Extract LOAN_TYPES to src/lib/constants/loan-types.js (if DB audit finds divergence)
2. None others meet section 2c criteria; D9 absorbs most findings

**Key assessment:** Application field mapping matches UAD spec. All Layer 1 fields captured. PII handling correct. Auth model clean for intake phase; D9 Layer 2 will add draft resumption.

**Deliverable:** /d/PROJECTS/netrate-pc-ops/Work/Dev/audits/PASS-5-BORROWER-PORTAL-INVENTORY-2026-04-17.md
