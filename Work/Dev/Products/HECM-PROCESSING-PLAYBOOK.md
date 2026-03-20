# HECM (Reverse Mortgage) Processing Playbook

**Source:** Devoe file (FHA HECM, Finance of America Reverse, March 2026)
**Lender:** Finance of America Reverse LLC (FAR)
**Last Updated:** March 18, 2026

This playbook captures the full HECM processing lifecycle from conditional approval through funding. Use it as a template for every reverse mortgage file.

---

## Processing Philosophy

1. **Resolve approval blockers BEFORE ordering appraisal.** The appraisal costs ~$800 (borrower-paid). Don't order until you're confident the file will close.
2. **Plan all conditions up front.** Even if you can't act on everything yet, map out every condition, who's responsible, and what's needed. Prevent surprises.
3. **Execute in 4 parallel lanes** once approval blockers clear.
4. **The appraisal is a procedural blocker, not an approval blocker.** It gates the timeline but doesn't determine if the loan works.

---

## Phase 0: Approval Blocker Analysis

**Do this FIRST on every HECM approval. Do not proceed to Phase 1 until blockers are resolved.**

### What to look for:
- **Residual Income (RI) shortfall** — HECM requires financial assessment. If RI is negative or below the geographic threshold, UW will condition for additional income or assets. This is the #1 approval killer.
- **Credit issues** — delinquencies in last 24 months on property charges or installment debt
- **Property charge history** — delinquent taxes, insurance lapses
- **LESA requirement** — if financial assessment fails, a Life Expectancy Set-Aside may be required, reducing proceeds and potentially killing the deal

### Devoe Example:
- RI shortfall: -$1,869.49/mo (required: $998/mo for West region, household size 2)
- Condition 101.1: "Provide additional income or assets (short $2,803.66/mo)"
- **This must resolve before ordering appraisal or spending time on other conditions**

### Resolution paths for RI shortfall:
1. Additional employment income not yet documented
2. Social Security or pension income (common for HECM-age borrowers)
3. Asset dissipation — retirement accounts, investment accounts dissipated over life expectancy
4. Rental income
5. If none available → loan may not work. Have honest conversation with borrower early.

---

## Phase 1: Condition Planning (Day of Approval)

Map every condition into the 4 lanes. Do this the same day you receive the approval.

### Lane 1: Borrower (items only they can provide)

| Category | Typical Items | Doc Prefix | Notes |
|---|---|---|---|
| Income — W2s | Prior year W2s for all borrowers | INC-W2 | Usually 1-2 years |
| Income — Paystubs | 30 days most recent for all borrowers | INC-PAYSTUB | Must be current |
| Income — Additional | SS award letters, pension statements, asset statements | INC-SS, INC-PENSION, AST | Key for RI shortfall |
| Payment proof | Recent mortgage/lien payment evidence | AST-BANK | Statement showing auto-pay or cleared check |
| LOE | Letters of explanation (business at property, credit events, gaps) | LOE | Must be signed and dated |
| Disclosures | Corrected/completed application docs, alternate contact form | DOC | Borrower re-signs |
| VOE cooperation | May need to authorize employer contact | — | Verbal or written |

**Borrower communication template:**
> "Congratulations — your reverse mortgage has been conditionally approved. To keep things moving, I need the following items from you: [list]. The most important item is [approval blocker]. Once we confirm that, we'll order the appraisal and be on track to close by [date]."

### Lane 2: Broker (you order/coordinate)

| Category | Typical Items | When to Order | Notes |
|---|---|---|---|
| Appraisal | FHA appraisal + invoice + XML | **After approval blockers clear** | ~$800 borrower-paid, 2-3 week turnaround |
| VOE | Verification of employment for all borrowers | After approval blockers clear | Order from employers directly |
| Tax cert | Current year property tax certificate | Anytime | Order from county assessor |
| Insurance | Evidence of Insurance (EOI) with lender mortgagee clause | Anytime | Contact borrower's insurance agent |
| Redisclosure | RESPA VCC if value changes | After appraisal | Generate in LOS |
| FHA case number | Verify/correct case number details | Lender handles, but verify | Check property type, year built match |

**Mortgagee clause (FAR):**
> Finance of America Reverse LLC, ISAOA
> P.O. Box 39457
> Solon, OH 44139-0457

**Closing Protection Letter address (FAR):**
> Finance of America Reverse LLC, ISAOA
> 8023 East 63rd Place, Suite 700
> Tulsa, OK

### Lane 3: Title Company

| Item | Details | Notes |
|---|---|---|
| Title commitment | Insured as: "[Lender Name] ISAOA", amount = TBD until final value | Order early |
| Closing protection letter | With lender mortgagee clause | Title provides |
| Payoff statements | All existing liens on title | Order early — payoffs expire |
| Vesting deed | Last recorded deed showing current ownership | Title pulls from county |
| Appraisal delivery cert | Certification of delivery + ECOA waiting period | After appraisal |

### Lane 4: Lender Internal (track but don't act)

| Item | Details | Your Role |
|---|---|---|
| LDP/SAM verification | Exclusion list check for appraiser | Monitor |
| FHA case number validation | Corrections to case assignment | Provide info if asked |
| Appraisal logging | Lender logs appraisal, runs case query, SSR | Monitor — triggers 2nd appraisal determination |
| Financial Assessment in FHAC | Lender completes at CTC | Monitor |
| Disaster area check | Closer/funder verifies | Automated |

---

## Phase 2: Execute (After Approval Blockers Clear)

### Immediate (same day blockers clear):
1. Order appraisal
2. Order VOEs for all borrowers
3. Send title order (if not already open)
4. Contact insurance agent for EOI

### Within 48 hours:
5. Order tax cert from county
6. Send corrected disclosures to borrower for re-signing
7. Request LOEs from borrower

### Track and wait:
8. Monitor appraisal turnaround (2-3 weeks typical)
9. Monitor lender internal conditions
10. Watch expiration dates (credit, title, PLL)

---

## Phase 3: Post-Appraisal

1. **Submit appraisal** to lender (report + invoice + XML)
2. **Check if 2nd appraisal required** — HUD may require based on value/area. Lender determines after logging.
3. **Final value determination** — unlocks TBD amounts (insurance dwelling, title insured amount, proceeds check)
4. **ECOA appraisal delivery** — borrower must receive copy, 3-day waiting period before close (unless waived at application)
5. **Redisclose** if value changed from initial estimates
6. **Verify proceeds meet RI** — Closer condition, but you should pre-check

---

## Phase 4: Clear to Close (CTC)

### Closer handles:
- Pay off all existing liens at closing
- ECOA timing compliance
- Proceeds verification against RI threshold
- Disaster area check
- Disclosures/LOEs in closing package

### Funder handles:
- Final disaster area check
- VOE re-verification (within 10 days of disbursement)
- Signed disclosures confirmation

---

## Key Expiration Dates to Track

| Item | Typical Expiration | Devoe Example |
|---|---|---|
| Counseling certificate | 180 days from counseling | 09/02/2026 |
| Credit report | 120 days from pull | 07/10/2026 |
| Title commitment | ~90 days | 06/25/2026 |
| PLL (Principal Limit Lock) | Varies | 07/14/2026 |
| Appraisal | 120 days (FHA) | TBD |
| Payoff statements | 30 days typically | Re-order if stale |

---

## HECM-Specific Concepts

### Financial Assessment (FA)
- Required on all HECMs since 2015
- Evaluates: credit history, property charge history, residual income
- Residual income thresholds vary by region and household size
- If FA fails → LESA required (reduces borrower proceeds)
- Asset dissipation: non-retirement assets / (life expectancy in months) = imputed monthly income

### Life Expectancy Set-Aside (LESA)
- Fully Funded: lender sets aside funds from proceeds to pay taxes/insurance for life
- Partially Funded: covers only the shortfall amount
- Drastically reduces cash available to borrower
- Can kill deals where proceeds are already tight

### Principal Limit & Utilization
- Principal Limit = max loan amount based on age, rate, property value
- Initial Disbursement Limit = 60% of PL in first 12 months (with exceptions for mandatory obligations)
- Mandatory obligations (payoffs, closing costs, IMIP) can exceed 60% limit
- PLU% = how much of the principal limit is used

### Programs (FAR example)
| Program | Rate Type | Notes |
|---|---|---|
| Monthly CMT Cap5 | Adjustable (5% annual cap) | Most common, best proceeds |
| Monthly CMT Cap10 | Adjustable (10% annual cap) | Lower proceeds, higher cap |
| Fixed | Fixed rate | Lump sum only, worst proceeds |
| HomeSafe | Proprietary (non-FHA) | No MIP, higher rates, no FHA protections |

---

## Borrower Portal Integration (Future)

### What borrowers see in their checklist:
- Items from Lane 1 only (things they need to provide)
- Clear descriptions in plain English (not UW jargon)
- Upload capability for each item
- Status indicators (needed / received / approved)

### What MLO sees in dashboard:
- All 4 lanes with status tracking
- Approval blocker flag (red) vs procedural conditions (yellow)
- Expiration date warnings
- Condition-to-document mapping (which uploaded doc satisfies which condition)

### Automation opportunities:
- Auto-generate borrower checklist email from approval conditions
- Auto-flag RI shortfall as approval blocker
- Auto-track expiration dates with warnings at 30/15/7 days
- Template order-out emails for appraisal, title, insurance, VOE
- Auto-map uploaded documents to conditions via CoreBot

---

## Devoe File — Specific Action Plan

### Priority 1: Approval Blocker
- [ ] **Condition 101.1** — Borrowers need to show additional income or assets to cover $2,803.66/mo RI shortfall
  - Ask about: Social Security (both are 62+), pension, retirement accounts, other employment
  - Run asset dissipation calc if they have retirement accounts

### Priority 2: Borrower Docs (request now, in parallel with blocker resolution)
- [ ] 2024 W2s — both borrowers (101.2)
- [ ] 30 days paystubs — both (101.3)
- [ ] 3/2026 US Bank #9128 payment proof (100)
- [ ] LOE — "Absolute Renovation" business at subject (121)
- [ ] Corrected 1009 App + Alternate Contact Form (122)

### Priority 3: Order after blocker clears
- [ ] Appraisal — FHA, Jefferson County (App1) — ~$800
- [ ] VOE — both borrowers' employers (101.4)
- [ ] Tax cert — Jefferson County (102)
- [ ] EOI — with FAR mortgagee clause, dwelling TBD (110)

### Priority 4: Title company
- [ ] Title commitment — FAR ISAOA, amount TBD (130)
- [ ] Closing protection letter (131)
- [ ] Payoffs — US Bank #7603001051863 and #5156850289128 (132)
- [ ] Vesting deed — Alan R. and Cree A. Devoe (133)

### Priority 5: After appraisal received
- [ ] Submit to lender for logging (App1)
- [ ] Check if 2nd appraisal required (150)
- [ ] ECOA appraisal delivery + waiting period (149)
- [ ] Redisclose based on final value (120)
- [ ] Finalize insurance dwelling amount (110)
- [ ] Finalize title insured amount (130)

### Key Dates
- Application: 03/09/2026
- Approval: 03/16/2026
- Estimated Closing: 04/29/2026
- Counseling Expires: 09/02/2026
- Credit Expires: 07/10/2026
- Title Expires: 06/25/2026
- PLL Expires: 07/14/2026
