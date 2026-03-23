# Lead Intake & Automated Quote System

## Overview

Every calculator and rate tool on the site is a lead capture opportunity. When a borrower enters their scenario and sees results, we capture their email and automatically generate + send a personalized PDF quote. No manual intervention — David gets notified of the new lead with the scenario already attached.

## The Funnel

```
Borrower lands on any calculator/rate tool
  → Enters scenario (loan amount, rate, credit, state, etc.)
  → Sees results (rates, payments, savings, opportunity cost)
  → CTA: "Get your personalized quote" or "Email me these results"
  → Enters email (+ optional: name, phone)
  → System auto-generates PDF quote with their exact numbers
  → Email sent via Resend with PDF attached
  → Contact record created/updated in database
  → Strike Rate alert auto-created at par rate for their scenario
  → David notified: "New lead: John, $400K refi, 740 FICO, CO — quote sent"
```

## Strike Rate Placement

**CRITICAL**: The Strike Rate signup must be prominent, not buried at the bottom.

### Placement (priority order):
1. **After rate summary, before full table** — branded card with inline fields
2. **Sticky bar** at top of results section — persistent as user scrolls
3. **Inline prompt in rate table** — contextual row: "Not low enough? Set your target →"
4. **Exit intent** — if user moves to leave, offer Strike Rate as last chance

### Strike Rate Card Design:
```
┌─────────────────────────────────────────────────────┐
│  🎯 Set Your Strike Rate                            │
│                                                      │
│  Not ready to move today? Tell us your target rate   │
│  and we'll email you the moment it's available.      │
│                                                      │
│  [Email________] [Target Rate___%] [Notify Me →]    │
│                                                      │
│  ☐ Also send me weekly rate updates                  │
└─────────────────────────────────────────────────────┘
```

## Email Capture Points

Every calculator gets a "Get Your Quote" CTA. The CTA adapts to the context:

| Page | CTA Text | What's in the Quote |
|------|----------|-------------------|
| /rates | "Email me today's rates" | Rate comparison table, best execution, savings vs current rate |
| /tools/cost-of-waiting | "Get your savings report" | Cost of waiting table + opportunity cost + investment comparison |
| /tools/refi-analyzer | "Email my refi analysis" | Current vs new comparison, breakeven, monthly savings |
| /tools/purchase-calculator | "Get your purchase estimate" | Payment breakdown, DTI analysis, program eligibility |
| /tools/dscr-calculator | "Email my DSCR analysis" | DSCR ratio, eligible programs, estimated rate |
| /tools/reverse-mortgage-calculator | "Get your reverse estimate" | Available equity, payout options, costs |

## Contact Record

When email is captured, create/update a Contact:

```javascript
{
  email: "borrower@email.com",
  name: "John Smith",           // optional at capture, can be added later
  phone: null,                  // optional
  source: "cost-of-waiting",    // which calculator/page

  // Scenario snapshot — what they entered
  scenario: {
    loanAmount: 400000,
    currentRate: 7.25,
    newRate: 6.375,
    creditScore: 740,
    state: "CO",
    loanType: "conventional",
    loanPurpose: "refinance",
    propertyValue: 500000,
  },

  // Auto-created
  strikeRateAlert: {
    targetRate: 6.375,          // par rate from their scenario
    loanType: "conventional",
    active: true,
  },

  // Tracking
  quotesSent: 1,
  lastQuoteSentAt: "2026-03-23T...",
  status: "lead",               // subscriber → lead → applicant → in-process → funded
}
```

## PDF Quote Package

Branded PDF with NetRate logo, generated server-side.

### Pages (toggle on/off per quote type):

1. **Cover Page** — NetRate branding, borrower name, date, "Prepared for you by David Burson, NMLS #641790"

2. **Rate Comparison** — today's best rates for their scenario across lenders. Shows rate, APR, monthly P&I, cost/credit. Highlights best execution.

3. **Cost of Waiting** — their specific numbers: monthly savings, cost of waiting table (1-36 months), opportunity cost table (extra principal, S&P, CDs at 5/10/15/20 years).

4. **Payment Breakdown** — P&I + MI + taxes + insurance + HOA = total PITI. Shows what the real monthly cost is.

5. **Breakeven Analysis** — if there are costs: how many months to recoup, total savings after breakeven.

6. **Program Details** — which program, which lender, key features, what docs are needed to get started.

7. **Next Steps** — "Ready to move forward? Here's what we need from you:" + items checklist. Contact info for David.

### Quote Types by Source:

| Source | Pages Included |
|--------|---------------|
| Rate Tool | Cover, Rate Comparison, Payment Breakdown, Next Steps |
| Cost of Waiting | Cover, Cost of Waiting, Rate Comparison, Next Steps |
| Refi Analyzer | Cover, Rate Comparison, Breakeven, Payment Breakdown, Next Steps |
| Purchase Calc | Cover, Rate Comparison, Payment Breakdown, Program Details, Next Steps |
| DSCR Calc | Cover, Program Details, Rate Comparison, Next Steps |

## Automated Email

Sent via Resend immediately on capture:

```
Subject: Your Personalized Mortgage Quote — NetRate Mortgage
From: david@netratemortgage.com (via Resend)
Reply-To: david@netratemortgage.com

Hi [Name],

Here's your personalized quote based on the scenario you ran on our site.
[Attached: NetRate_Quote_[date].pdf]

Key highlights:
- Best available rate: 6.375% (30yr fixed)
- Monthly payment: $2,495
- Monthly savings vs your current rate: $160

This quote is based on today's wholesale rates. Rates change daily —
I've also set up a rate alert at 6.375% so you'll be notified if
rates improve from here.

Questions? Reply to this email or call me at 303-444-5251.

David Burson
NetRate Mortgage | NMLS #641790
303-444-5251 | david@netratemortgage.com
```

## David Notification

Slack/email/portal notification:

```
New Lead: cost-of-waiting calculator
Email: borrower@email.com
Scenario: $400K refi, 7.25% → 6.375%, 740 FICO, CO
Monthly savings: $160
Quote sent automatically
Strike Rate alert created at 6.375%
```

## Tech Stack

- **PDF Generation**: `@react-pdf/renderer` (React components → PDF) or Puppeteer (HTML → PDF)
- **Email**: Resend (already integrated for Strike Rate)
- **Storage**: Vercel Blob (save generated PDFs for David to access later)
- **Database**: Prisma Contact model (extends existing Borrower or new table)
- **Notifications**: Resend to David, or portal dashboard alert

## Implementation Priority

1. **Move Strike Rate CTA up** on rates page — immediate UX fix
2. **Email capture component** — reusable across all calculators
3. **Contact record creation** — on email capture, with scenario snapshot
4. **PDF generation** — start with Cost of Waiting quote (most compelling)
5. **Automated email send** — Resend with PDF attachment
6. **David notification** — new lead alert
7. **Expand to other calculators** — Rate Tool, Refi Analyzer, Purchase Calc
8. **Portal view** — David sees all leads + scenarios + quotes in MLO portal

## Connection to Other Systems

| System | Connection |
|--------|-----------|
| Pricing Engine | Generates rate data for the quote |
| Strike Rate | Auto-created when email is captured |
| Product Library | Provides program details + docs checklist for "Next Steps" page |
| Calculators | Each calculator has a "Get Your Quote" CTA |
| MLO Portal | David views/manages leads + quotes |
| Resend | Sends quote emails + Strike Rate alerts |
| Vercel Blob | Stores generated PDFs |
