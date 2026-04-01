# 1003 Full Application Build — Spec

## Context
NetRate Core is a lite LOS skin over LenDox. Core handles the daily workflow — application intake, pipeline management, processing, lender submission. LenDox handles AUS (DU/LP) and credit reports (bureau credentials). Core needs to import/export MISMO XML bidirectionally with LenDox.

## What Core Does
- Collect and store full 1003 application data
- Display/edit all loan fields in a dense, editable UI
- Export MISMO 3.2 XML to LenDox (for AUS + credit)
- Export MISMO 3.2 XML to lenders (submission packages)
- Track pipeline, processing, conditions, documents
- MCR reporting, payroll/comp

## What Stays in LenDox
- AUS submissions (DU/LP) — Fannie/Freddie credentials
- Credit reports — bureau credentials
- MERS registration
- Disclosure generation (LE/CD) — we extract CD data back

## Data Flow
```
Borrower applies on website → Core DB
Core → export XML → LenDox → run AUS/credit
LenDox → webhook/XML → Core (results, updated fields)
Core → export XML → Lender submission
```

## New Prisma Models

### LoanEmployment (1:many per LoanBorrower)
- loanBorrowerId, isPrimary (current vs previous)
- employerName, employerAddress (JSON), employerPhone
- position, startDate, endDate, yearsOnJob, monthsOnJob
- selfEmployed (boolean)

### LoanIncome (1:1 per LoanBorrower)
- loanBorrowerId
- baseMonthly, overtimeMonthly, bonusMonthly, commissionMonthly
- dividendsMonthly, interestMonthly, rentalIncomeMonthly
- otherMonthly, otherIncomeSource

### LoanAsset (1:many from Loan)
- loanId, borrowerType (primary/co-borrower/joint)
- institution, accountType (checking/savings/CD/stocks/retirement/other)
- accountNumber, balance
- isJoint (boolean)

### LoanLiability (1:many from Loan)
- loanId
- creditor, accountNumber
- type (revolving/installment/mortgage/collection/other)
- monthlyPayment, unpaidBalance, monthsRemaining
- paidOffAtClosing (boolean)

### LoanREO (1:many from Loan)
- loanId
- address (JSON), propertyType
- presentMarketValue, mortgageBalance, mortgagePayment
- grossRentalIncome, netRentalIncome
- insuranceTaxesMaintenance
- status (retained/sold/pending_sale)

### LoanDeclaration (1:1 per LoanBorrower)
- loanBorrowerId
- outstandingJudgments, bankruptcy, bankruptcyType, bankruptcyDate
- foreclosure, foreclosureDate, partyToLawsuit
- loanDefault, alimonyObligation, delinquentFederalDebt
- coSignerOnOtherLoan, intentToOccupy
- ownershipInterestLastThreeYears, propertyTypeOfOwnership

### LoanTransaction (1:1 from Loan)
- loanId
- purchasePrice, alterationsAmount, landValue
- refinanceOriginalCost, yearAcquired, existingLiens
- closingCostsEstimate, discountPoints, pmiMip
- sellerConcessions, subordinateFinancing
- cashFromBorrower, sourceOfDownPayment

## Existing Model Updates

### LoanBorrower — add fields
- dob (encrypted), citizenship, housingType (own/rent/free), monthlyRent
- previousAddress (JSON), previousAddressYears, previousAddressMonths
- cellPhone, suffix

### Loan — add fields
- amortizationType (fixed/ARM/balloon)
- titleHeldAs, estateHeldIn
- armIndex, armMargin, armInitialCap, armPeriodicCap, armLifetimeCap, armAdjustmentPeriod

## UI — Full 1003 Page
New section in loan sidebar: "Application" or "1003"
One dense page with all fields, grouped by section, all editable.
Same inline-strip style as the Overview redesign.

Sections on the page:
1. Borrower Info (per borrower tab)
2. Employment (current + previous)
3. Income
4. Assets (repeating rows, add/remove)
5. Liabilities (repeating rows, add/remove)
6. REO (repeating rows, add/remove)
7. Transaction Details
8. Declarations (checkboxes)
9. Loan Details (ARM fields if applicable)

## XML Export (Core → LenDox)
- POST /api/portal/mlo/loans/[id]/export-xml
- Generates MISMO 3.2 compliant XML from all Core data
- Download as file or push directly to LenDox API

## XML File Import
- Drag-drop .xml file on loan detail page
- Parse MISMO 3.2 / Fannie 3.2 format
- Map fields to all new models
- Show diff of what will change before saving
- Merge logic: new fields fill in, existing fields show conflict

## Build Order
Session 1: Schema + migration + basic UI (field display)
Session 2: Editable fields + XML file import parser
Session 3: XML export to LenDox + polish
