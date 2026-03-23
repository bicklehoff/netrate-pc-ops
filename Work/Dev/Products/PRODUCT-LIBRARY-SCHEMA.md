# Product Library Schema

## Overview

The Product Library is the operational knowledge base for all mortgage products across all lenders (active, prospect, and inactive). It powers:

1. **MLO Portal** — David on the phone: "What fits this borrower?" → instant product lookup with operational playbook
2. **Pricing Engine** — filters eligible programs, routes to correct LLPAs
3. **Market Intelligence** — which lenders offer what, who should we sign up with
4. **Content/SEO** — product pages, guideline content, borrower education
5. **Future: Public chatbot** — trained on this library to answer borrower questions

---

## Data Model

### 1. Lenders

The lender entity. Includes active partners AND prospects we're evaluating.

```prisma
model Lender {
  id              String   @id @default(cuid())
  name            String   // "AmWest Funding Corp."
  shortName       String   // "amwest" — matches rate sheet parser lenderId
  status          String   // "active" | "prospect" | "inactive"
  signedUp        Boolean  @default(false)
  hasRateSheet    Boolean  @default(false)
  rateSheetFormat String?  // "csv" | "xlsx" | "pdf" | null

  // Contact
  accountRep      String?  // "Neal Johnson"
  repEmail        String?  // "neal@amwest.com"
  repPhone        String?
  portalUrl       String?  // wholesale portal login URL

  // Fees
  originationFee  Float?   // standard origination/UW fee in dollars
  feeNotes        String?  // "Non-DPA, non-streamline"

  // Operational
  lockDays        Json?    // [15, 30, 45, 60] — available lock periods
  typicalCloseTime Int?    // average days to close
  servicingRetained Boolean? // do they retain servicing?

  // Intelligence
  strengths       String?  // "Best jumbo pricing, Fast Track program"
  weaknesses      String?  // "Slow turn times on conditions"
  signUpReason    String?  // why we signed up or why we're considering
  evaluationNotes String?  // notes from evaluating this lender

  // Relationships
  products        LenderProduct[]
  guidelines      Guideline[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 2. Products

The product concept — independent of any lender. "DSCR 30yr Fixed" is one product regardless of how many lenders offer it.

```prisma
model Product {
  id              String   @id @default(cuid())
  name            String   // "DSCR 30yr Fixed"
  slug            String   @unique // "dscr-30yr-fixed"

  // Classification
  category        String   // "agency" | "nonqm" | "heloc" | "reverse"
  subcategory     String?  // "conventional" | "fha" | "va" | "usda" | "jumbo" | "dscr" | "bankstatement" | "itin" | "foreignnational"
  loanType        String   // "conventional" | "fha" | "va" | "usda" | "nonqm"

  // Structure
  termOptions     Json?    // [10, 15, 20, 25, 30] — available terms
  productType     String   // "fixed" | "arm" | "heloc" | "reverse"
  armStructure    String?  // "5/6 SOFR" | "7/6 SOFR" | null

  // Borrower-facing
  displayName     String   // "Investment Property Loan (DSCR)"
  shortDescription String  // one-liner for search results
  longDescription String?  // full explanation for product page
  idealBorrower   String?  // "Real estate investors who want to qualify based on rental income, not personal income"
  keyBenefit      String?  // "No tax returns, no W-2s, no income verification"

  // Qualification method
  qualMethod      String?  // "fullDoc" | "dscr" | "bankStatement" | "assetDepletion" | "altDoc" | "noDoc"

  // SEO
  targetKeywords  Json?    // ["dscr loan", "investor mortgage", "rental property loan"]
  contentPageUrl  String?  // "/products/dscr-loans" — if we have a content page

  // Relationships
  lenders         LenderProduct[]
  guidelines      Guideline[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 3. LenderProducts (Junction)

A specific lender's offering of a specific product. This is where the operational playbook lives.

```prisma
model LenderProduct {
  id              String   @id @default(cuid())
  lenderId        String
  productId       String
  lender          Lender   @relation(fields: [lenderId], references: [id])
  product         Product  @relation(fields: [productId], references: [id])

  // Program identification (matches rate sheet parser output)
  programCode     String?  // "FNMA_CONV_30YR_FIXED" — internal code
  rateSheetName   String?  // "FNMA Conforming Fast Track 30 Yr Fixed" — as it appears on rate sheet

  // Eligibility (high-level — details in Guidelines)
  minFico         Int?     // minimum credit score
  maxLtv          Float?   // maximum LTV
  maxCltv         Float?   // maximum CLTV
  minLoanAmount   Float?   // minimum loan amount
  maxLoanAmount   Float?   // maximum loan amount
  allowedStates   Json?    // ["CO", "CA", "TX", "OR"] or null = all states
  excludedStates  Json?    // states this program doesn't serve
  allowedOccupancy Json?   // ["primary", "secondary", "investment"]
  allowedPropertyTypes Json? // ["sfr", "condo", "2unit", "3unit", "4unit", "manufactured"]

  // Program-specific flags
  isFastTrack     Boolean  @default(false)
  isStreamline    Boolean  @default(false)
  isBuydown       Boolean  @default(false)
  isInterestOnly  Boolean  @default(false)
  requiresW2      Boolean  @default(false) // false = self-employed OK
  allowsSubFinancing Boolean @default(true)

  // Operational Playbook
  docsRequired    Json?    // structured checklist — see below
  itemsNeededEmail String? // email template for initial docs request
  processNotes    String?  // "Submit to DU first, then lock. AE prefers email over portal."
  conditionTips   String?  // "They always ask for VOE — send it upfront to avoid a condition"
  typicalTimeline Int?     // days to close for this specific lender+product

  // Pricing link
  hasLLPAs        Boolean  @default(false)
  llpaSheetName   String?  // "FT_LLPAS" — which sheet in the rate file

  // Intelligence
  competitiveNotes String? // "Best in class for 720+ FICO, loses to TLS below 700"
  lastReviewed    DateTime? // when we last verified this info is current

  // Status
  isActive        Boolean  @default(true) // lender still offers this product?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([lenderId, productId])
}
```

### 4. Guidelines

Rules that govern eligibility and requirements. Can be scoped at agency level, lender level, or lender+product level. Cuts across products by dimension (property type, state, borrower type, etc.).

```prisma
model Guideline {
  id              String   @id @default(cuid())

  // Scope
  scope           String   // "agency" | "lender" | "lenderProduct"
  agencySource    String?  // "fannie" | "freddie" | "fha" | "va" | "usda" | null
  lenderId        String?  // null for agency-level
  lender          Lender?  @relation(fields: [lenderId], references: [id])
  productId       String?  // null if applies across products
  product         Product? @relation(fields: [productId], references: [id])

  // What dimension does this guideline address?
  dimension       String   // "propertyType" | "occupancy" | "state" | "borrowerType" | "loanFeature" | "documentation" | "general"
  dimensionValue  String   // "condo" | "manufactured" | "TX" | "selfEmployed" | "subordinateFinancing" | "escrowWaiver"

  // The rule
  title           String   // "Condo Reserve Requirements"
  description     String   // human-readable explanation
  rules           Json     // structured rules — see format below

  // Source
  sourceDocument  String?  // "Fannie Mae LL-2026-03" | "AmWest Guidelines v4.2"
  effectiveDate   DateTime? // when this rule takes effect
  expirationDate  DateTime? // if temporary

  // Override chain
  overrides       String?  // ID of the agency guideline this lender overlay modifies
  isOverlay       Boolean  @default(false) // true = this modifies an agency rule

  // Status
  status          String   @default("active") // "active" | "superseded" | "pending"

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## Guidelines Rules JSON Format

The `rules` field in Guidelines stores structured, queryable rules:

```json
{
  "type": "propertyRequirement",
  "conditions": [
    {
      "field": "reserves",
      "operator": ">=",
      "value": 15,
      "unit": "percent",
      "label": "HOA reserves must be at least 15% of annual budget"
    },
    {
      "field": "investorConcentration",
      "operator": "<=",
      "value": 49,
      "unit": "percent",
      "label": "No more than 49% investor-owned units"
    },
    {
      "field": "singleEntityOwnership",
      "operator": "<=",
      "value": 25,
      "unit": "percent",
      "label": "No single entity owns more than 25% of units"
    }
  ],
  "requiredDocs": ["condo questionnaire", "HOA budget", "insurance dec page"],
  "flags": {
    "warrantable": true,
    "nonWarrantable": false,
    "projectApprovalRequired": true
  }
}
```

---

## Docs Required JSON Format

The `docsRequired` field in LenderProducts stores the items-needed checklist:

```json
{
  "categories": [
    {
      "name": "Income",
      "required": true,
      "items": [
        { "doc": "2 most recent paystubs", "notes": "Must show YTD earnings" },
        { "doc": "W-2s (2 years)", "notes": null },
        { "doc": "Tax returns (2 years)", "notes": "All pages, all schedules, signed" }
      ]
    },
    {
      "name": "Assets",
      "required": true,
      "items": [
        { "doc": "Bank statements (2 months)", "notes": "All pages, all accounts for down payment + reserves" },
        { "doc": "Retirement account statements", "notes": "If using for reserves" }
      ]
    },
    {
      "name": "Property",
      "required": false,
      "items": [
        { "doc": "Purchase contract", "notes": "For purchase transactions" },
        { "doc": "Insurance dec page", "notes": "Current homeowner's insurance" }
      ]
    },
    {
      "name": "Identity",
      "required": true,
      "items": [
        { "doc": "Driver's license", "notes": "Front and back, not expired" },
        { "doc": "SSN authorization", "notes": "Signed borrower authorization" }
      ]
    }
  ],
  "programSpecific": [
    { "doc": "VOE (Verification of Employment)", "notes": "AmWest requires upfront — send with initial submission to avoid condition" }
  ]
}
```

---

## MLO Portal Queries

### "What fits this borrower?"

```sql
-- Input: creditScore=680, loanAmount=400000, propertyType='condo',
--        occupancy='investment', state='CO', qualMethod='dscr'

SELECT lp.*, l.name as lenderName, l.status as lenderStatus, p.name as productName
FROM LenderProduct lp
JOIN Lender l ON lp.lenderId = l.id
JOIN Product p ON lp.productId = p.id
WHERE lp.isActive = true
  AND (lp.minFico IS NULL OR lp.minFico <= 680)
  AND (lp.maxLtv IS NULL OR lp.maxLtv >= 80)
  AND (lp.minLoanAmount IS NULL OR lp.minLoanAmount <= 400000)
  AND (lp.maxLoanAmount IS NULL OR lp.maxLoanAmount >= 400000)
  AND (p.qualMethod = 'dscr' OR p.qualMethod IS NULL)
ORDER BY l.status ASC, l.name ASC
-- Returns active lenders first, then prospects
-- David sees: "3 active lenders offer this, plus 2 prospects worth signing up with"
```

### "Can I do a condo loan in this building?"

```sql
-- Check agency condo guidelines + lender overlays
SELECT g.*, l.name as lenderName
FROM Guideline g
LEFT JOIN Lender l ON g.lenderId = l.id
WHERE g.dimension = 'propertyType'
  AND g.dimensionValue = 'condo'
  AND g.status = 'active'
ORDER BY g.scope ASC  -- agency first, then lender overlays
-- Returns: Fannie condo rules, then each lender's overlay
-- CoreBot can check the specific building's docs against these rules
```

### "Which lenders should we sign up with?"

```sql
-- Find prospect lenders that offer products none of our active lenders have
SELECT l.name, p.name as productName, lp.competitiveNotes
FROM LenderProduct lp
JOIN Lender l ON lp.lenderId = l.id
JOIN Product p ON lp.productId = p.id
WHERE l.status = 'prospect'
  AND p.id NOT IN (
    SELECT lp2.productId FROM LenderProduct lp2
    JOIN Lender l2 ON lp2.lenderId = l2.id
    WHERE l2.status = 'active' AND lp2.isActive = true
  )
-- Returns: "Jet offers ITIN and Foreign National — no active lender has these"
```

---

## Data Flow

```
Claw reads lender email/guideline
  → Creates/updates Lender, Product, LenderProduct, Guideline records
  → Flags new products or guideline changes for review

OC pulls rate sheets daily
  → PC parser extracts rates → pricing engine
  → Rate sheet program names map to LenderProduct.rateSheetName

David on the phone
  → MLO Portal: enters borrower scenario
  → Pricing engine: returns eligible programs with rates
  → Product Library: shows operational playbook for selected program
  → One click: generates items-needed email from docsRequired template

David evaluates new lender
  → Browses prospect lenders in Product Library
  → Sees which unique products they offer
  → Decision: sign up → status flips to active → OC starts pulling sheets
```

---

## Implementation Priority

1. **Lender + Product + LenderProduct tables** — the core data model
2. **Seed with our 5 active lenders** — populate from rate sheet analysis
3. **MLO Portal product lookup** — basic search/filter UI
4. **Docs Required / Items Needed** — operational playbooks per LenderProduct
5. **Guidelines table** — start with condo rules (Claw already analyzing LL-2026-03)
6. **Prospect lender tracking** — Jet, Orion, and any new lenders from emails
7. **CoreBot integration** — guideline-aware document review
8. **Public content generation** — product pages from Product.longDescription

---

## Connection to Existing Systems

| System | Connection |
|--------|-----------|
| Pricing Engine | LenderProduct.rateSheetName maps to parsed rate sheet programs |
| Rate Sheet Parsers | Parser lenderId matches Lender.shortName |
| LLPA Data | LenderProduct.llpaSheetName references LLPA JSON files |
| County Loan Limits | Used by pricing engine for program eligibility, shared with Product Library |
| Strike Rate | Alert checks use pricing engine, which uses Product Library eligibility |
| Calculators | Pull best execution from pricing engine, which filters by Product Library |
| Claw Marketing | Creates Product/Guideline records from lender emails |
| CoreBot | Queries Guidelines for document review |
| MLO Portal | Primary UI consumer of Product Library data |
