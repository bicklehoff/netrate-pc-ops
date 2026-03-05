# NetRate Mortgage — Dev Brief
**Date:** February 27, 2026 (updated)
**From:** Marketing
**Full context:** See `D:\netrate-marketing-playbook.md` for complete strategy and rationale

---

## BATCH 1 — Ship ASAP (Website Viability)

### 1. Trust Checkmark Bar (NEW — see competitor reference)
- **What:** Horizontal bar with 3 teal/green checkmarks reinforcing the core value props
- **Copy:**
  - ✓ No application or credit pull
  - ✓ Real wholesale rates, updated daily
  - ✓ Compare multiple loan options
- **Where:** TWO placements:
  - **Homepage:** Above or just below the hero CTA buttons
  - **Rates page:** Above the rate table (just below the "Your Scenario" section)
- **Style:** Light background (#f5f7fa or similar), teal checkmark icons, clean sans-serif text, horizontally spaced. Subtle but confidence-building. Reference: similar to the Banking Bridge trust bar at the bottom of their rate widget (screenshot provided separately).

### 2. Google Reviews — Two Components

**Current data:** 4.9 stars, 35 reviews
**GBP is currently under "Locus Mortgage"** — rename deferred. Use "Formerly Locus Mortgage" note where linking to Google.
**Review link URL:** `https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=ChIJa5-5jCXza4cRptwJxaP23eU`

**a) Curated Reviews Section (Homepage)**
- **What:** Reviews strip showing Google star rating + 2-3 curated pull quotes + "See all reviews on Google" link
- **Where:** Below the Tools & Calculators grid on homepage (see Batch 1.5 page flow)
- **Implementation:** Manually hardcoded — no Google Places API needed. Just hardcode the star rating, count, and quotes below.
- **Star rating:** 4.9 (display as filled/partial stars)
- **Review count:** 35
- **Link:** "See all reviews on Google" → points to the review link URL above
- **"Formerly Locus Mortgage"** — Add this as subtle text (muted gray, smaller font size) near the Google link. This explains why Google shows "Locus Mortgage" instead of "NetRate Mortgage." Will be removed after GBP rename.
- **Reviews to display (first name + last initial only):**
  - "Working with David was a pleasure. He is knowledgeable, helpful, friendly and always ready to go the extra mile."
  - "I recently refinanced... and had the best mortgage experience ever."
  - "I refer all of my clients to NetRate Mortgage, and I trust their work so much that I have obtained all of my own loans through them as well."
- **Alternate reviews (dev can swap in as needed):**
  - "He is very knowledgeable, extremely responsive, and truly a wonderful person who helps you through the entire loan process."
  - "Some of the best mortgage rates around... very knowledgeable, totally straight forward, friendly, available off hours/weekends."

**b) Google Reviews Footer Banner (site-wide — persistent social proof)**
- **What:** Dark-background bottom banner showing:
  - Google "G" logo (official Google logo icon)
  - Star icon + "4.9"
  - "35 reviews" as link → same review link URL above
- **Where:** Site-wide footer banner, above or integrated into the existing dark footer. Should be visible on every page.
- **Style:** Dark background (#1a2b3c or similar to existing footer), white text, Google "G" in official colors, gold/yellow star. Compact — single line, not tall.
- **Note:** Rating and count are hardcoded. Update manually as new reviews come in. Can add Google Places API later for auto-updating.

### 3. BBB A+ Seal + NMLS + Equal Housing Icons
- **What:** Badge/logo row with:
  - **BBB Accredited Business seal** — embed code provided below. Currently shows "Locus Mortgage" — will auto-update after BBB processes the name change.
  - **NMLS Consumer Access logo** (links to https://www.nmlsconsumeraccess.org/ with NMLS #641790 / #1111861)
  - **Equal Housing Opportunity icon** (already in footer text, add the visual logo icon)
- **Where:** In the "Licensed. Independent. Direct." section on homepage, displayed as a horizontal row of badges

**BBB Seal Embed Code (ready to use):**
```html
<a href="https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653/#sealclick" target="_blank" rel="nofollow"><img src="https://seal-alaskaoregonwesternwashington.bbb.org/seals/blue-seal-200-42-bbb-90159653.png" style="border: 0;" alt="Locus Mortgage BBB Business Review" /></a>
```
- **Note:** Alt text says "Locus Mortgage" — update to "NetRate Mortgage BBB Business Review" after BBB rename. The image URL and link will auto-update on BBB's end.
- **BBB Business ID:** 90159653
- **BBB profile URL (current):** https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653

### 4. Rate Tool Lead Capture — "Get This Rate" Buttons
- **Mockup:** Open `D:\mockup-rate-tool-lead-capture.html` in a browser — fully interactive, click buttons to see modal
- **What's new:**
  - "Get This Rate" outlined button on EACH row of the rate table
  - "Get This Rate" solid button on EACH recoup analysis card
  - Both open a modal with the selected rate pre-filled

- **Modal specs:**
  - Headline: "Get Your Exact Quote"
  - Displays: selected rate, P&I, monthly savings, credit/charge, loan type context
  - Form fields: Full Name, Phone Number, Email Address
  - CTA button: "Send Me My Exact Quote"
  - Footer text: "No credit pull. No obligation. Just real numbers."

- **Zoho CRM submission — include ALL of the following:**
  - Name, Phone, Email (from form)
  - Lead Source: `"Rate Tool - Selected Rate"`
  - Selected Rate (e.g. `5.625%`)
  - Loan Purpose (from scenario, e.g. `Rate/Term Refinance`)
  - Property Type (from scenario)
  - Property Value (from scenario)
  - Loan Amount (calculated)
  - LTV (calculated)
  - Credit Score Range (from scenario)
  - Monthly P&I (from selected rate row)
  - Monthly Savings (from selected rate row)
  - Credit/Charge (from selected rate row)
  - Net Cost (from selected rate row)
  - Timestamp (auto)
  - UTM params if present (for ad tracking)

### 5. UTM Parameter Capture on ALL Lead Forms
- **What:** All forms on the site (rate tool modal, "Get a Quote" page, bottom-of-page contact form) must capture UTM parameters from the URL and pass them to Zoho CRM
- **Why:** We're launching Google Ads and Bing Ads — we need to trace every lead back to the campaign/keyword that generated the click
- **UTM fields to capture:** utm_source, utm_medium, utm_campaign, utm_term, utm_content
- **Store in Zoho CRM:** As custom fields or in the lead notes

### 6. Bottom Form Copy Update
- **Change:** "Get Your Personalized Quote" → **"Not Sure Which Rate? Let Us Help."**
- **Subtext change:** "These rates are approximate. I'll send you an exact quote with full fee breakdown, cash to close, and savings analysis." → "Tell us about your situation and we'll send you a personalized recommendation with full fee breakdown, cash to close, and savings analysis."

---

## BATCH 2 — After Batch 1 Ships

### 7. AI Crawler Access
- **Check robots.txt** — ensure GPTBot, ClaudeBot, PerplexityBot, and Googlebot are NOT blocked
- **Add llms.txt** file (emerging standard for AI crawlers) — marketing will provide content

### 8. Schema Markup (JSON-LD) on Rates Page
- `FinancialService` schema for NetRate Mortgage (name, NMLS, service areas, description)
- `FinancialProduct` schema for each rate option displayed (rate, APR, loan type, term)
- `FAQPage` schema for the "How Rate Pricing Works" section
- `Organization` schema with NMLS, licensing, contact info
- Marketing will provide the specific JSON-LD templates

### 9. "Answer Capsule" Text Block on Rates Page
- **What:** A dynamically-updated text block above or near the rate table:
  > "Today's 30-year fixed mortgage rates range from X.XX% to X.XX% for borrowers with 760+ credit scores on a $400,000 loan. Rates shown are real wholesale pricing from our lending partners, updated daily. Use the rate tool below to see rates for your specific scenario."
- **Must update dynamically** with today's actual rate range from the rate data
- **Include:** machine-readable datetime element with "Last updated: [date/time]"

### 10. FAQ Expansion
- Expand "How Rate Pricing Works" into full FAQ section with these questions (answers to be provided):
  - "What is today's 30-year fixed mortgage rate?"
  - "What rate can I get with a 760 credit score?"
  - "How much does it cost to refinance?"
  - "What's the difference between rate and APR?"
  - "How do mortgage points work?"
- Wrap in FAQPage schema (see #8)

### 11. State-Specific Landing Pages
- Create pages:
  - `/colorado-mortgage-rates/`
  - `/texas-mortgage-rates/`
  - `/oregon-mortgage-rates/`
  - `/california-mortgage-rates/` (placeholder until licensed)
- Each page includes: rate tool embed, state-specific licensing info, 300-500 words state content (marketing will provide), FAQ, FinancialService schema with areaServed
- These also serve as Google Ads landing pages for state-targeted campaigns

### 12. "Today's Market" Display Component
- **What:** A section on the rates page (and optionally homepage) showing daily market summary
- **Data:** Pushed by agent via API endpoint or simple CMS field
- **Display:** Date/timestamp, key market metrics (10yr yield, direction), 2-3 sentence market commentary
- **Needs:** An endpoint or CMS mechanism that the agent can push content to (POST to update, GET to display)
- **Example output:**
  > **Market Update — Feb 26, 2026 | 10:45 AM ET**
  > 10yr Treasury: 4.32% (↓0.03) | MBS 6.0: 100.28 (↑0.09)
  > Bonds rallied overnight on softer economic data. Rates are slightly better today.

---

## BATCH 1.5 — Homepage Data Hub Redesign (Ship With or Right After Batch 1)

**Mockup:** Open `Work/Marketing/mockups/homepage-redesign.html` in a browser — this is the reference for the entire page layout.

**Concept shift:** The homepage is now an **information hub**, not a brochure. Instead of selling ("why choose us"), it shows data — rates, trends, market updates, tools. The previous "Why NetRate" cards, "What We Do" services section, and "Live Rates Updated Daily" section are all removed. The homepage answers: "What are rates today? Where are they going? What tools are available?"

### Page Flow — Top to Bottom

**A) Nav**
- Links: Rates, Tools, Market, About, Apply Now (teal CTA button)
- Sticky on scroll

**B) Hero — 2-column, left-aligned text + rate teaser card**
- Background: subtle gradient wash (teal-tinted, not pure white). Faint radial glows for texture. NO stock photos.
- **Left column:**
  - Eyebrow badge: green pulsing dot + "Rates updated today" — pill-shaped, teal tint
  - Headline: "See your actual mortgage rate **before you apply.**" (bold accent on the second part, brand color)
  - Subtext: "Most lenders make you fill out an application before they show you numbers. We show you rates first — with the math behind them."
  - Sub-subtext (lighter): "No application. No credit pull. Just rates."
  - Two CTAs: "Check Today's Rates" (filled teal, primary) + "Apply Now" (outlined, secondary)
  - **Trust strip below buttons** (separated by top border):
    - Google badge: "G" icon (blue bg) + 5 gold stars + **4.9** + "· 35 reviews"
    - Divider
    - BBB badge: "BBB" icon (blue bg) + "A+ Rated" — dev should use real BBB seal (embed code in Batch 1 item #3)
    - Divider
    - NMLS badge: "N" icon (dark bg) + "NMLS #641790"
    - Sizing: icons 32px, text ~15px, stars 16px. These need to be clearly visible, not tiny footnote text.
- **Right column — Rate teaser card:**
  - White card with shadow + subtle border
  - Header: "TODAY'S 30-YEAR FIXED" (teal label, uppercase) + green "● LIVE" badge
  - Rate: large bold number (e.g., 5.875%) — pulls from rate API
  - Detail line: "760+ FICO · $400K loan · Rate/Term Refi"
  - Comparison bar (green bg): "↓ 0.50% below national average (Freddie Mac X.XX%)" — pull Freddie Mac PMMS weekly average
  - Meta row: P&I Payment, Points, Lenders (3 columns)
  - Updated timestamp: "Updated today at 9:15 AM ET · Live wholesale pricing"
  - CTA button: "See All Rate Options →" (teal, links to /rates)

**C) Trust Checkmark Bar — Keep as-is**
- 3 checkmarks: No application or credit pull / Real wholesale rates, updated daily / Compare multiple loan options
- Light gray background, subtle borders top and bottom

**D) Today's Rates — Full product table**
- Section header: "Today's Mortgage Rates" (left) + scenario context (right, gray text: "March 4, 2026 · 760+ FICO · $400K loan")
- Table columns: Product | Rate | APR | Change | Mo. Payment | Action
- 6 products:
  - 30-Year Fixed
  - 15-Year Fixed
  - FHA 30-Year
  - VA 30-Year
  - Jumbo 30-Year (note: payment based on $800K)
  - DSCR (Investor)
- Change column: green down arrow = rate dropped, red up arrow = rate rose, gray dash = unchanged
- Action column: "See options →" link (teal) — links to /rates with that product pre-selected
- Footer disclaimer: scenario assumptions, "Updated daily from wholesale pricing"
- **Data source:** Same rate engine that powers /rates. Rates are the day's best-execution for the default scenario.

**E) Rate Trends + Market Updates — 2-column**
- Light gray background section
- **Left card: "30-Year Rate Trend"**
  - Bar chart (sparkline-style) showing 8 weeks of rates
  - Current rate highlighted as the last bar
  - Summary text below: trend direction + brief outlook
  - Data source: weekly rate snapshots from the rate engine or manually curated
- **Right card: "Market Updates"**
  - List of 4-5 market headlines with color-coded status dots:
    - Green = positive for rates
    - Amber = watch / mixed
    - Blue = informational
  - Each item has a date
  - Data source: curated by marketing/agent, pushed via API endpoint or CMS field (same mechanism as Batch 2 item #12)

**F) Tools & Calculators — 4-column grid**
- Header: "Tools & Calculators" (left) + "Real math, no guesswork." (right, gray)
- 6 cards in a 4-column grid (first row: 4, second row: 2 + empty space):
  1. **Rate Tool** (teal icon) — "Live wholesale rates across 11 lenders. See rate, points, payment, and lender credits side by side." → /rates
  2. **DSCR Calculator** (green icon) — "Investment property? Enter rental income and expenses to see if your deal qualifies for a DSCR loan." → /dscr-calculator
  3. **Reverse Mortgage** (amber icon) — "See how much equity you could access with a reverse mortgage. Age, home value, and rate — that's all we need." → /reverse-mortgage
  4. **Refi Analyzer** (purple icon) — "Is refinancing worth it? Enter your current loan and we'll show the break-even timeline and total savings." → /rates (refi scenario)
  5. **Purchase Calculator** (pink icon) — "Estimate your monthly payment, cash to close, and how much home you can afford." → /purchase-calculator
  6. **Apply Online** (blue icon) — "Ready to go? Start your secure application. Takes about 15 minutes." → application link
- Each card: colored gradient icon, title, description, arrow CTA
- Hover: teal border, slight lift + shadow

**G) Reviews — Compact, featured layout**
- Gray background section
- Header: Google "G" icon + **4.9** + 5 stars + "35 Google Reviews · Read all →" + "(Formerly Locus Mortgage)" in small gray text
- Layout: 1 featured card (larger, teal border, "FEATURED" badge) + 4 supporting cards
  - Featured card spans 2 rows in a 3-column grid
  - Supporting cards fill remaining spots
- Link goes to GBP: `https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=ChIJa5-5jCXza4cRptwJxaP23eU`
- Reviews to display — see Batch 1 item #2 for the curated quotes list

**H) Credentials — Dark background band**
- Keep as current: "Licensed. Independent. Direct."
- Stats row: NMLS #641790 / CO, TX, OR (CA coming soon) / Founded 2013 / Direct-to-Consumer
- Badge row: BBB A+ (use real seal), NMLS Consumer Access, Equal Housing Opportunity

**I) Bottom CTA — Teal band**
- Headline: "See rates for your scenario in 30 seconds."
- Subtext: "Tell us about your situation and we'll send you a personalized recommendation with full fee breakdown, cash to close, and savings analysis."
- Two buttons: "Get a Free Quote" (white) + "Apply Now" (white outline)

**J) Footer Review Bar + Footer — Keep as-is**
- Google G + 4.9 + 35 reviews bar above footer

### Sections Removed (vs. current live site)
- ❌ "Live Rates, Updated Daily" section — redundant with hero + rates table
- ❌ "Why NetRate Mortgage" 3-column cards — generic "why us" doesn't belong on a data hub
- ❌ "What We Do" 3-column services — replaced by Tools grid with actual links
- ❌ Loan production numbers — removed per owner feedback
- ❌ "11 wholesale lenders" trust badge — confusing to consumers

### Design Principles
1. **Data first, selling second.** Show rates, trends, tools. Let the data do the convincing.
2. **Vary section backgrounds** — alternate white / gray / dark. No 7 consecutive white sections.
3. **Left-align headings and content** where appropriate (hero, rates header, tools header). Not everything centered.
4. **Max 1 traditional 3-column layout** (tools grid uses 4-column). Break the AI-generated 3-column pattern.
5. **No stock photography.** No animations beyond subtle hover states.
6. **Trust signals above the fold** — the hero trust strip is intentional. Borrowers need to see credibility instantly.

### What NOT to Do
- Don't add stock photography
- Don't switch to a dark theme (works for DSCR tools, wrong for a consumer mortgage homepage)
- Don't over-design — "professionally built information site" not "startup landing page"
- Don't add the old "Why NetRate" or "What We Do" sections back — they're brochure patterns

**Status:** APPROVED — include in Batch 1 work or ship immediately after. Mockup is ready for reference.

---

## BATCH 3 — After Batch 2 Ships

### 13. AI Rate Advisor (Contextual Chat on Rate Tool)

**Concept:** An AI chat widget embedded on the rates page that reads the borrower's current scenario (loan type, amount, credit score, down payment, purpose) and surfaces contextual guidance, comparisons, and answers. Think Banking Bridge "AI Advisor" — but native to our rate engine, our voice, and our lead capture.

**Competitive reference:** Banking Bridge offers this as a SaaS widget to lenders ($$$). Five Star Mortgage uses it. David previously subscribed, dropped it when he realized we could build it ourselves. The screenshots below describe what their version does — ours should match or exceed this.

**What it does:**
- Detects the active loan program (VA, FHA, Conventional, Jumbo) and surfaces 3-4 contextual quick-start questions. Examples for VA:
  - "Am I exempt from the VA funding fee?"
  - "What fees are lenders charging me?"
  - "How does my VA entitlement work?"
  - "Would a 15-year save me more money?"
- Answers are scenario-aware — references the borrower's exact loan amount, down payment, rate, and P&I from the rate tool
- Can run live comparisons by re-querying the rate API with different parameters (e.g., VA vs Conventional side-by-side for the same scenario)
- Comparison output includes: rate, points, P&I for each program, monthly savings delta, and a "Bottom Line for You" recommendation with recoup analysis
- After each answer, offers follow-up quick-reply buttons to guide the conversation deeper (no typing required)
- Notices when points don't apply (e.g., "No PMI ever — but you're already at 20% down, so this doesn't apply to you currently")

**Architecture:**
- **Frontend:** Chat widget component on the rates page, below or beside the rate table
- **AI backend:** Claude API (Anthropic) with tool-calling — the AI can call the rate API as a function to pull/compare rates
- **Tools available to the AI:**
  - `get_rates(params)` — query rate engine with specific scenario parameters
  - `compare_programs(program_a, program_b, scenario)` — pull rates for two loan types and compute deltas
  - `calculate_recoup(cost, monthly_savings)` — recoup analysis math
  - `get_scenario()` — read the borrower's current rate tool inputs
- **Knowledge base:** Mortgage program rules (VA funding fee schedule, FHA MIP rules, conventional PMI thresholds, jumbo requirements, etc.) — provided as system prompt context, not hardcoded responses
- **Lead capture integration:** Conversations can end with a soft CTA ("Want a personalized quote? Enter your info") that opens the existing lead capture modal with scenario pre-filled

**Quick-start questions by loan type:**

| Loan Type | Suggested Quick Questions |
|-----------|--------------------------|
| VA | Funding fee exemption, VA vs conventional, entitlement, COE process |
| FHA | MIP removal timeline, FHA vs conventional, credit score thresholds, down payment assistance |
| Conventional | PMI removal at 80% LTV, points vs no-points tradeoff, 15yr vs 30yr, rate buydown math |
| Jumbo | Jumbo vs conforming limit, reserve requirements, rate premium explanation, ARM vs fixed |

**Key design principles:**
- Scenario-aware — every response references the borrower's actual numbers, not generic info
- Quick-reply buttons — minimize typing friction, guide the conversation
- No hallucination on rates — AI MUST call the rate API for any pricing data, never guess
- Lead capture is a natural endpoint, not a hard gate — the conversation itself is the value
- Our voice — confident, direct, helpful, no corporate-speak (matches existing site tone)
- Compliance: include disclaimer footer in chat ("For informational purposes only. Actual rates depend on individual qualification.")

**Why this matters:**
- Borrowers browsing rates have questions but aren't ready to call. This fills the gap.
- Every chat interaction is a soft engagement signal — higher intent than passive browsing
- Scenario-aware comparisons (VA vs Conventional with actual numbers) are a genuine conversion tool
- Differentiator: most broker sites have nothing like this. Banking Bridge charges lenders monthly for an inferior version that isn't even connected to their actual pricing.

**Dependencies:** Batch 1 lead capture must ship first (the advisor's CTA opens the existing modal). Rate API must be stable and queryable.

**Status:** APPROVED CONCEPT — scope and build after Batch 2.

---

## Reference

- Full marketing playbook: `D:\netrate-marketing-playbook.md` (also at `Work/Marketing/PLAYBOOK.md`)
- Rate tool lead capture mockup: `D:\mockup-rate-tool-lead-capture.html` (also at `Work/Marketing/mockups/`)
- GBP rename checklist: Portal at `/portal/mlo/gbp-checklist`
- Questions: Ask marketing (this doc's author)
