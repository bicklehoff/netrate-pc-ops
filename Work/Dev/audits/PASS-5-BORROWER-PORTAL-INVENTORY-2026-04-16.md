# D8 Inventory Pass 5 — Borrower Portal + Application Flow

**Audit:** Site Audit 2026 · Dimension 8 (Static data / stale-by-deploy) · Pass 5
**Date:** 2026-04-16
**Status:** Complete — Catalog phase only. Findings identified, no code changes.
**Feeds:** D9 Layer 1 redesign checklist (portal rebuild on Contact/Deal schema)
**Scope:** `src/app/portal/auth/**`, `src/app/portal/apply/**`, `src/app/portal/dashboard/**`, `src/app/portal/my-rates/**`, `src/app/portal/quote/**`, and borrower-facing Portal components

---

## Scope Walked

**Primary files:**
- `src/app/portal/apply/page.js` + `src/app/portal/apply/[step]/page.js`
- `src/app/portal/apply/steps/Step1`, `Step2Purchase.js`, `Step2Refinance.js`, `Step3Address.js`, `Step4Employment.js`, `Step5Declarations.js`, `Step6Review.js`
- `src/app/portal/apply/success/page.js`
- `src/app/portal/auth/login/page.js`, `auth/verify/page.js`, `auth/verify-phone/page.js`
- `src/app/portal/dashboard/page.js`
- `src/app/portal/my-rates/page.js` + `my-rates/access/page.js`
- `src/app/portal/quote/[id]/page.js`
- `src/contexts/ApplicationContext.js`
- `src/lib/validations/application.js`

**Not walked:** MLO portal (Pass 6 done), public marketing pages (Pass 3 pending), API routes.

---

## Findings Catalog

### A. Hardcoded Application Form Picklists (Duplicated Across Steps)

| ID | Location | Content | Risk | D9 Status |
|---|---|---|---|---|
| **BP-1** | `portal/apply/page.js:20` + `steps/Step2Purchase.js:13-17` + `Step2Refinance.js:12-30` + `Step5Declarations.js:22-33` | PURPOSE_OPTIONS, OCCUPANCY_OPTIONS, PROPERTY_TYPE_OPTIONS duplicated in 4 files with slight label variations (`"Primary Residence"` vs `"Primary"`; `"Townhome"` vs `"Townhouse"`). 8 separate constants total. | **HIGH** | D9d DB-ifies; D9 Layer 1 moves loan data to Contact/Deal where picklists become enums |
| **BP-2** | `portal/my-rates/page.js:9-13` | LOAN_TYPE_LABELS, PURPOSE_LABELS, FREQ_LABELS, DAY_NAMES, PROP_LABELS — 7 separate label objects | **MEDIUM** | D9 Layer 1 absorbs into Contact+Deal; labels → `src/lib/constants/` first, DB by D9d |
| **BP-3** | `src/lib/validations/application.js:39-42, 47-62` | Zod enums hardcode `['purchase','refinance']`, `['primary','secondary','investment']`, `['sfr','condo','townhome','multi_unit','manufactured']`, `['rate_term','cash_out','streamline']` | **MEDIUM** | D9 Layer 1 refactors validation; enums reference DB-sourced constants |
| **BP-4** | `portal/mlo/contacts/[id]/page.js:586-589` + `leads/[id]/page.js:30-33` + `contacts/page.js:378-381` | STATE_OPTIONS = CA/CO/TX/OR hardcoded in 3 MLO-side files. Borrower apply flow does NOT restrict states | **MEDIUM** | D9 Layer 1 absorbs; inconsistency: borrower can apply in NY but MLO can't enter NY contact |

### B. Hardcoded Auth Flow Constants

| ID | Location | Content | Risk | D9 Status |
|---|---|---|---|---|
| **BP-5** | `portal/auth/login/page.js:65` + `auth/verify-phone/page.js:112` | Magic link expiry "15 minutes", SMS code "10 minutes", "3 incorrect attempts will lock for 15 minutes" — all hardcoded in display copy | **HIGH** | Survives D9. Extract to `src/lib/constants/auth.js`. Risk: display copy drifts from API implementation |
| **BP-6** | `portal/auth/verify-phone/page.js:82` | OTP hardcoded as 6-digit (`maxLength={1}` on 6 inputs) | **MEDIUM** | Config constant — survives D9. Add `SMS_OTP_LENGTH` to constants |

### C. Hardcoded Contact Details + Company Info (Copy)

| ID | Location | Content | Risk | D9 Status |
|---|---|---|---|---|
| **BP-7** | `portal/apply/page.js:235` + `success/page.js:67-69` + `dashboard/page.js` + `quote/[id]/page.js:110, 226-238, 260, 289` | David Burson contact info hardcoded: phone `303-444-5251`, email `david@netratemortgage.com`, address `357 S McCaslin Blvd #200, Louisville, CO 80027`. Appears 5+ times in borrower portal copy | **HIGH** | Survives D9. Create `src/lib/constants/company.js` — overlaps with Pass 2 HP-3a |
| **BP-8** | `portal/quote/[id]/page.js:284, 289` + multiple layout.js | "NetRate Mortgage" + NMLS #1111861 hardcoded multiple times; format varies | **LOW** | Portal is clean of "Locus" refs (good). Should use shared `COMPANY_NAME` constant |

### D. Fee & Loan Amount Assumptions (Hardcoded Defaults / Bounds)

| ID | Location | Content | Risk | D9 Status |
|---|---|---|---|---|
| **BP-9** | `portal/apply/steps/Step2Purchase.js:49, 213-230` | LTV default 80%, slider min 50% max 100%. No validation of min/max loan amount. Zod allows any positive number | **MEDIUM** | D9 Layer 1 absorbs into Deal model. D9d `ref_loan_limits` per REF-1 already flagged |
| **BP-10** | `portal/apply/steps/Step2Refinance.js:67-75, 129-144` | LTV computed on-the-fly; color thresholds `≤80 green, ≤90 amber, else red` hardcoded. No max-LTV-by-product enforcement | **MEDIUM** | D9 Layer 1 + D9d `ref_ltv_limits` per loan_type |
| **BP-11** | `portal/apply/steps/Step2Purchase.js:234` | Helper text "Most lenders require at least 3-5% down" — vague, not product-specific | **LOW** | D9d reference data. Should reference NetRate product minimums |

### E. Step Ordering / Sequencing Assumptions

| ID | Location | Content | Risk | D9 Status |
|---|---|---|---|---|
| **BP-12** | `portal/apply/[step]/page.js:20, 22-28` + `ApplicationContext.js:103-126` | STEPS array hardcoded (6 steps: About You, Property, Address, Employment, Declarations, Review). isStepComplete coupled to order | **MEDIUM** | D9 Layer 1 will redesign. Consider moving to step registry / DB |
| **BP-13** | `ApplicationContext.js:97-98` (PII_FIELDS) | Step 1 PII (SSN, DOB) intentionally NOT persisted to sessionStorage for security. Refresh = re-enter | **LOW** | D9 Layer 1 may revisit with new auth model. Security principle should remain. Intentional tradeoff |

### F. Hardcoded Copy / Numeric Claims

| ID | Location | Content | Risk | D9 Status |
|---|---|---|---|---|
| **BP-14** | `portal/apply/success/page.js:51-62` | "We'll review within 1 business day" SLA — no monitoring; if David is overwhelmed, broken promise | **MEDIUM** | Survives D9. Add SLA monitoring + escalation alert |
| **BP-15** | `portal/quote/[id]/page.js:245` | Legal disclosure: "Lender credits cannot result in cash back to the borrower" hardcoded in JSX | **LOW** | Survives D9 (legal/regulatory copy). Move to `src/lib/constants/copy.js` or CMS |
| **BP-16** | `Step2Purchase.js:234` + `Step5Declarations.js:214-215` | "Most lenders require 3-5% down" duplicated as prose. Inaccurate for FHA (3.5%), VA (0%), USDA (0%) | **MEDIUM** | D9 Layer 1 absorbs; helper text should be product-specific |

### G. Address / Region Logic

| ID | Location | Content | Risk | D9 Status |
|---|---|---|---|---|
| **BP-17** | `portal/apply/steps/Step2Purchase.js:106, 283-296` | "No, still looking" → address literal string `"TBD"` persisted to DB. Queries that filter CO addresses match TBD rows | **MEDIUM** | D9 Layer 1 absorbs. Use DB boolean `property_address_identified` + nullable `property_address` |
| **BP-18** | `Step3Address.js:90-108` | Current address required for refi, optional for purchase. "TBD" property leaves state undefined but county-based logic assumes state is known | **LOW** | D9 Layer 1 absorbs. Edge-case hardening |

---

## D9 Layer 1 Redesign Checklist

When D9 Layer 1 (Contact + Deal + Scenario architecture) ships, the portal rebuild should:

1. **Picklist Centralization (BP-1, BP-2, BP-3)** — Move all PURPOSE_OPTIONS / OCCUPANCY_OPTIONS / PROPERTY_TYPE_OPTIONS / LOAN_TYPES to shared constants or DB enums. Zod schemas reference constants, not inline strings.

2. **State Restrictions Consistency (BP-4)** — Decide: should borrower flow restrict to CA/CO/OR/TX or allow any US state? Current: borrower unrestricted, MLO restricted. Document decision.

3. **Contact Info / Company Constants (BP-7, BP-8)** — Create `src/lib/constants/company.js`:
   - `COMPANY_NAME = "NetRate Mortgage"`
   - `COMPANY_NMLS = "1111861"`
   - `PRINCIPAL_OFFICER_*` fields
   - `OFFICE_ADDRESS`

4. **Loan Amount / LTV Bounds (BP-9, BP-10, BP-11)** — D9d `ref_loan_limits` table (county + loan_type → min/max). Form fetches on state/county change.

5. **Auth Constants (BP-5, BP-6)** — Extract to `src/lib/constants/auth.js`, audit API routes for consistency.

6. **Copy / SLA Strings (BP-14, BP-15, BP-16)** — Move to `src/lib/constants/copy.js`. Consider SLA monitoring.

7. **TBD Address Handling (BP-17, BP-18)** — Refactor to DB boolean flag + nullable address, not string sentinel.

8. **Step Definition Registry (BP-12)** — Move STEPS to `src/lib/constants/application-steps.js` or DB.

---

## Cross-References

**With Pass 6 (MLO portal):** BP-1/2/3 duplicate MLO-side picklists (MLO-1/4/5). D9d unifies.
**With Pass 8 (Reference Data):** BP-9/10 overlap REF-1, REF-11. D9d absorbs.
**With Pass 2 (Homepage UI):** BP-7/8 branding — Pass 2 HP-3 flagged Locus refs in Maps URL; portal itself is clean.

---

## D9-Absorbed vs Ship-Immediately

**Defer to D9 Layer 1:** BP-1, BP-2, BP-3, BP-4, BP-9, BP-10, BP-11, BP-12, BP-13, BP-17, BP-18

**Ship immediately per §2c (survives D9):**
- BP-5 + BP-6 (auth constants) — Extract to `src/lib/constants/auth.js`, audit API consistency. 1-2 hour PR.
- BP-7 + BP-8 (company info) — Extract to `src/lib/constants/company.js`, consolidate portal/footer/email. Could bundle with BP-5/6.

**Lower priority:** BP-14, BP-15, BP-16 (copy) — post-D9 copy audit.

---

## Open Questions for Driver

1. **BP-4 (State restrictions):** Borrower unrestricted, MLO CA/CO/OR/TX only — intentional?
2. **BP-9 (Default LTV):** 80% default — should it be product-specific (Conv 80%, FHA 96.5%, VA 100%)?
3. **BP-14 (1 business day SLA):** Tracked? Escalation if missed?
4. **BP-5/6 (Auth constants):** Do API routes (`api/portal/auth/*`) use same expiry/OTP constants as displayed?

---

## Summary

- **Total findings:** 18 (BP-1 through BP-18)
- **D9-absorbed:** 11
- **Ship-immediately candidates:** BP-5/6 (auth constants) + BP-7/8 (company info) — bundle into one small PR
- **Status:** Catalog complete. No code changes.

Most portal findings are naturally absorbed by D9 Layer 1 rebuild on Contact/Deal schema. Auth constants + company info extraction can ship now as small survives-D9 refactors.
