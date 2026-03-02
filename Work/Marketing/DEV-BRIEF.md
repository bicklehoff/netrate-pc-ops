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
- **Where:** Below the "Why NetRate Mortgage" cards section on homepage
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

## Reference

- Full marketing playbook: `D:\netrate-marketing-playbook.md`
- Rate tool lead capture mockup: `D:\mockup-rate-tool-lead-capture.html`
- Questions: Ask marketing (this doc's author)
