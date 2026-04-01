# Quote Engine — Next Steps Spec

## What's Built (This Session)

- MLO Quote Generator: 3-step wizard (Scenario → Rate Selection → Fees & Preview)
- Pricing engine integration: all rates from DB, no hardcoded fallbacks
- Eligibility checks with config warnings
- Program view with sweet spot highlighting (buy-down + credit)
- 3-page RT-format PDF (comparison, fee detail, dates)
- Send to borrower (email + PDF attachment + portal link)
- Borrower-paid toggle (see rates without comp)
- Fixed/ARM amortization selector
- Zip → county auto-resolve (via FCC Census API)

## Remaining Items

### 1. Fee Template System (Priority: High)

**Problem:** No fee templates in the DB yet. Fees show as $0 with a config warning.

**Build:**
- Seed script: `scripts/seed-fee-templates.mjs` — insert rows for CO, CA, TX, OR (purchase + refinance)
- Fee data from David's RT spreadsheet (page 2 of the quote PDF):
  - Section A: Lender Fees (UW fee, origination) — comes from `rate_lenders.uwFee`
  - Section B: Third Party (appraisal $750, credit report $97, MERS $25, flood $17, tax service $57, title endorsement $0)
  - Section C/E: Title & Recording (lender's title policy $950, CPL $25, settlement agent $200, recording $5, county recording $196)
  - Section F/G/H: Prepaids & Escrow (insurance, taxes, escrow reserves)
- Admin UI: editable fee template per state/county/purpose in MLO portal settings
- All fees should be editable per-quote (already built — `QuoteFeeEditor` allows line-item overrides)

**DB:**
- `fee_templates` table already exists in schema
- Need INSERT statements with real CO data as baseline
- Consider: should fee templates vary by lender? Currently state/county/purpose only.

### 2. Escrow Calculation from Dates (Priority: High)

**Problem:** Escrow reserves (insurance + tax months) should be calculated from closing date → first payment date, not hardcoded months.

**Build:**
- `calculateEscrow({ closingDate, firstPaymentDate, annualTax, annualInsurance })`:
  - Insurance months in escrow = months from closing to first anniversary + 2 month cushion
  - Tax months in escrow = months from closing to next tax due date + 2 month cushion
  - Prepaid daily interest = (rate / 365) × days from closing to end of month
- Wire into fee builder: when closing date is provided, calculate escrow dynamically instead of using template defaults
- Show on PDF page 3: closing date, funding date, first payment, days interest (already showing, just needs real data)

**Data needed:**
- Tax due dates per county (CO = April 30 first half, June 15 second half, varies by county)
- Insurance: assume 14 months prepaid (12 months + 2 month escrow cushion)

### 3. Lead Integration (Priority: High)

**Problem:** Quotes exist independently — they should create/link to leads so David can track borrower engagement.

**Build:**
- When creating a quote with borrower name + email (no existing lead):
  - Auto-create a Lead record with source = "quote_generator"
  - Link quote to lead via `BorrowerQuote.leadId`
  - Set lead status to "quoted"
- When creating a quote from an existing lead (`?leadId=...`):
  - Pre-fill scenario from lead data (name, email, phone, state, loan amount, etc.)
  - Link quote to lead
  - Update lead status to "quoted"
- When creating a quote from an existing contact:
  - Pre-fill from contact data
  - Link via `BorrowerQuote.contactId`
- Lead fields that map to quote scenario:
  - `name`, `email`, `phone` → borrower info
  - `loanAmount`, `propertyValue`, `fico`, `state`, `county` → scenario
  - `loanType`, `purpose` → scenario
- Leads page should show quote history per lead (link to quote detail)
- "Generate Quote" button on lead detail page (already planned, URL param pre-fill works)

**DB changes:**
- Lead model may need new fields: `fico`, `loanType`, `propertyValue` (check if they exist)
- BorrowerQuote already has `leadId`, `contactId`, `loanId` fields

### 4. PMI Calculation (Priority: Medium)

**Problem:** PMI shows as $0 on the quote. Need real PMI rates for LTV > 80%.

**Build:**
- PMI rate lookup: FICO × LTV grid (standard MI rate cards)
- Apply when: conventional, LTV > 80%, not borrower-paid MI
- Monthly PMI = (loan amount × PMI rate) / 12
- Show in monthly payment comparison on PDF
- Consider: LPMI (lender-paid MI) option where PMI is baked into the rate

### 5. ARM Rate Display (Priority: Medium)

**Problem:** ARM products exist in rate sheets but may not be showing in quotes.

**Check:**
- Are ARM products parsed and seeded for EverStream?
- Does `productType: 'arm'` filter correctly in the pricing engine?
- ARM products need additional display: initial rate, margin, index, caps, fully-indexed rate

### 6. Multi-Lender Comparison (Priority: Medium)

**Problem:** Only EverStream has rates seeded. Other 5 lenders have parsers but no adjustment rules.

**Build:**
- Seed adjustment rules for remaining lenders (AmWest, Keystone, TLS, SWMC, Windsor)
- Quote generator should show best rate per lender so MLO can compare across lenders
- Program view already groups by program — could also group by lender

### 7. Quote Revisions (Priority: Low)

**Problem:** When MLO re-sends a quote, it should create a new version, not overwrite.

**Build:**
- On "Revise & Resend": create new BorrowerQuote with `parentQuoteId` → original, `version` incremented
- Original quote keeps its status for audit trail
- Borrower portal shows latest version
- Quote list shows version badges

### 8. Website Style/Voice (Priority: Low)

**Problem:** David wants a "confident" style applied consistently across the portal.

**Define:**
- Dark section headers (bg-gray-900)
- Teal accents (brand cyan-600)
- Monospace numbers (Courier/font-mono)
- Bold uppercase section labels
- Trading-terminal density on data screens
- Clean white cards for input forms
- Apply to: quote generator (done), pipeline, loan detail, lead detail
