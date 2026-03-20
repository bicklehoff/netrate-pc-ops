# Refinance Scenario Modeler — Spec

**Route:** `/tools/refi-analyzer` (rebuild of current breakeven-only calc)
**Source content:** Claw's `refinance-cash-flow.md` (The Refinance Playbook)
**Status:** Project — major rebuild required

---

## Vision

Real-time refi scenario modeler. Every variable is connected — when one moves, everything recalculates across all 4 options. Sliders for each variable, graphs showing breakeven timeline, monthly cash flow, total interest over time. Pop-out option to expand graphs to full view.

This is the most helpful refi tool on the internet if we get it right.

---

## INPUTS (shared across all 4 options)

- Current loan balance
- Current payoff amount (balance + accrued interest)
- Current rate
- Current monthly P&I payment
- Current monthly escrow (taxes + insurance)
- Home value / appraised value
- New rate (per option — varies; "Pull Rate" mini picker from rate sheet data)
- Loan term (30yr default)
- State (for closing cost calc — pulls from state closing cost calculator)

---

## DERIVED / CALCULATED

- Current LTV
- New LTV (per option)
- Lender credit amount (from rate sheet, rate-dependent)
- Hard costs — Sections A & B (lender fees + title/settlement)
- Soft costs — escrow setup + prepaids
- Prepaid interest (per diem × days to first payment)
- Old escrow refund (from current servicer)

---

## OUTPUTS PER OPTION

| | Balance-to-Balance | Roll Everything In | Split the Difference | Buy Down |
|---|---|---|---|---|
| New loan amount | = current payoff | payoff + all costs | payoff + partial costs | = current payoff |
| New rate | par or near-par | par or near-par | slightly higher (⅛+) | lower (paid points) |
| Lender credit | covers A+B | covers A+B | covers A+B + some soft | negative (you pay) |
| Cash to close | escrow + prepaids | $0 | reduced or $0 | escrow + prepaids + points |
| Points cost | $0 | $0 | $0 | $X upfront |
| New monthly P&I | lower | lower (but higher loan) | slightly higher than B2B | lowest |
| Monthly savings | immediate | immediate | immediate | immediate (largest) |
| Missed payment cash back | 1 month | 1-2 months | 1 month | 1 month |
| Old escrow refund | ~80% of new escrow | keep it all | partial | ~80% of new escrow |
| Net out-of-pocket | ~$0 (after refunds) | $0 | ~$0 | points + net escrow |
| New LTV | same | higher | slightly higher | same |
| Breakeven | immediate | immediate | immediate | X months |
| Total interest (life of loan) | baseline | higher (bigger loan) | slightly higher | lowest |

---

## TIME-SERIES GRAPHS (sliders + pop-out charts)

- **Monthly cash flow timeline (month 0-36):** cash out at closing → refunds in → cumulative savings
- **Breakeven curve** (especially for Option 4 — Buy Down)
- **Total cost comparison** over 1yr, 3yr, 5yr, 10yr, life of loan
- **Net wealth comparison** (equity + cash saved) across all 4 options

---

## DEPENDENCIES

- **State closing cost calculator** — feeds hard/soft cost estimates per state
- **Rate sheet data (GCS pipeline)** — feeds "Pull Rate" picker and lender credit calc
- **PMI/MIP data** — if LTV > 80% on any option

---

## UI CONCEPT

- Sliders for key variables (rate, home value, cash preference)
- All 4 options visible simultaneously (columns or tabs)
- Change one variable → all 4 options recalculate
- Graphs inline or pop-out to full view
- Mobile: swipeable cards per option, graphs stack

---

## REFERENCE

- Content source: `netrate-claw-ops/Work/Marketing/content/refinance-cash-flow.md`
- Claw relay spec: `cmmxtftlt0003y45n0rauuy8s`
- Claw cost-of-waiting clarification: `cmmz970aw0006y4bffhr0op9a`

---

*Created: 2026-03-20 | Actor: pc-dev*
