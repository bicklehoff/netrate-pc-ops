# Payroll Portal — Spec

## What
Top-level page in the MLO portal (`/portal/mlo/payroll`) that shows all funded loan payroll data across all loans, filterable and exportable. The "accounting view" — how much did we earn, who earned it, when does it get paid.

## Data Source
- `Loan` model: funded/settled loans with `brokerCompensation`, `lenderCredits`, `totalClosingCosts`, `fundingDate`, `closingDate`
- `CompensationSection` already calculates: commission amount, processor amount, final amount, wire info
- `PayrollSection` already extracts CD data: loan amount, rate, cash to close, closing costs
- `Mlo` model: LO assignment per loan

## Page Layout

### Filters (top bar)
- **LO**: dropdown (All LOs / David Burson / Jamie Cunningham)
- **Quarter**: Q1/Q2/Q3/Q4 + Year selector (default: current quarter)
- **Status**: Funded / Settled / All
- **Date range**: optional override (funding date range)

### Summary Cards (below filters)
```
| Total Funded | Total Volume | Gross Comp | Net to MLO | Net to Company | Avg Comp % |
| 12 loans     | $4.2M        | $48,500    | $32,200    | $16,300        | 1.15%      |
```

### Loan Table (main content)
| Funded | Borrower | Loan # | Lender | Amount | Rate | Gross Comp | MLO Split | Company Split | Status |
|--------|----------|--------|--------|--------|------|------------|-----------|---------------|--------|
| 3/27   | Piper    | 1179   | Provident | $630K | 5.875% | $7,245 | $4,832 | $2,413 | Paid |

- Sortable by any column
- Click row → goes to that loan's Payroll/CD section
- Export to CSV button

### Quarterly Totals (bottom)
Bar chart or simple table showing month-by-month funded volume + comp for the selected period.

## API Route
`GET /api/portal/mlo/payroll?lo=all&quarter=Q1&year=2026`

Returns:
```json
{
  "summary": { "totalLoans": 12, "totalVolume": 4200000, "grossComp": 48500, ... },
  "loans": [{ "id": "...", "borrowerName": "...", "fundingDate": "...", "loanAmount": ..., "brokerCompensation": ..., ... }]
}
```

## Dependencies
- No new models needed — all data exists on Loan model
- Comp calculation logic already in CompensationSection — extract to shared utility
- MLO list already available from session/API

## Sidebar Nav
Add "Payroll" to the main portal sidebar (alongside Pipeline, Borrowers, Leads, etc.) — not just the loan-level sidebar.

## Future
- PDF payroll reports per quarter
- Automated payroll processing triggers (funded → calculate comp → flag for approval)
- Integration with TrackerPortal payroll on Mac side
