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

## BATCH 1.5 — Homepage "De-AI" Redesign (Ship With or Right After Batch 1)

**Problem:** The homepage looks AI-generated. Every section is center-aligned, every content block is a 3-column card grid, every section has identical visual weight. This is the default output pattern of AI code generators and it's increasingly recognizable. A borrower's first impression should be "this looks professional" not "this was made by ChatGPT."

**The fingerprint to break:**
- 5 separate 3-column grids on one page (Why NetRate, Reviews ×2 rows, What We Do)
- 100% center-aligned — every heading, every paragraph, every button
- White-on-white-on-white with no visual texture between sections
- Every section follows the same rhythm: heading → text → cards → button
- No visual hierarchy — every section has equal importance
- No icons, illustrations, or visual interest in card sections
- Generic rounded-corner card borders (default Tailwind)

### Changes — Section by Section

**A) Hero — Break the center, add a rate teaser**
- Left-align the headline and subtext (or use a 2-column layout: text left, rate teaser right)
- Add a live rate teaser on the right: "Today's 30yr Fixed: X.XX%" pulling from the rate API — this is the differentiator, show it immediately
- Add a subtle background element: light geometric pattern, gradient, or brand-color accent shape. Pure white hero = AI flag #1
- Keep the two CTAs but make "Check Today's Rates" visually dominant (larger, filled) and "Apply Now" clearly secondary

**B) Trust Checkmark Bar — Keep as-is**
- This is fine. Subtle, functional, not a problem.

**C) "Live Rates, Updated Daily" — Merge into hero or remove**
- This section says the same thing as the hero. Consolidate. The hero should communicate "we show live rates" and the CTA should go straight to /rates. Having a separate section that says "we have rates, click here to see them" is redundant and adds another generic centered block.

**D) "Why NetRate" Cards — Break the 3-equal-columns pattern**
- Option 1: Feature layout — one large card (left, 60% width) with the strongest message ("Rates Before Applications") + two smaller stacked cards (right, 40%)
- Option 2: Number callouts — lead with big bold numbers: "0 credit pulls required" / "11 wholesale lenders" / "$26.6M funded in 2025" as oversized stat blocks, not paragraph cards
- Option 3: Icon cards — add distinct icons/illustrations to each card to differentiate them visually. Right now they're indistinguishable text blocks.
- **Do NOT use 3 identical cards in a row.** That's the single strongest AI-generated signal.

**E) Reviews Section — Vary the layout**
- Don't show 6 identical cards in a 3×2 grid. Options:
  - Feature 1 large review prominently (bigger card, different background) + 2-3 smaller ones below
  - Horizontal scrolling carousel instead of a grid
  - Pull one quote as a large centered blockquote with attribution, then show 3 smaller cards below it
- The "4.9 out of 5 / Based on 35 Google Reviews" headline area is good — keep that
- Consider adding the Google "G" icon next to the star rating (not just in footer)

**F) "What We Do" — Make it visual, not just text columns**
- Current: 3 text-only columns (Refinance, Purchase, Rate Tool). No icons, no images, no visual distinction.
- Add icons or illustrations for each service
- Consider making these clickable cards with a hover state, not just static text
- Or: consolidate into a 2-column layout where one side is a brief description and the other links to /services

**G) "Licensed. Independent. Direct." — Make it a visual moment**
- This section should feel different from the rest of the page — it's the credibility anchor
- Use a light gray or off-white background to set it apart
- Make the NMLS numbers, founding year, and state count feel like a badge row or stat bar, not flowing text
- Consider: dark background with white text (like the CTA band below it) to create visual weight
- The BBB seal, NMLS logo, and Equal Housing icon should be displayed as actual logos/badges in a row, not text links

**H) Bottom CTA Band — Keep, but differentiate**
- The teal band is actually the most visually distinct element on the page — keep it
- Consider making the heading more specific: "See rates for your scenario in 30 seconds" instead of the current generic copy

**I) Footer — Fine as-is**
- The Google review bar (G + 4.9 + 35 reviews) above the footer is a nice touch

### General Principles

1. **Max 2 instances of 3-column layout per page.** Not 5.
2. **Mix alignment** — left-align at least 2 sections. Not everything centered.
3. **Vary section backgrounds** — alternate white / off-white / light gray / dark. Don't use the same white background for 7 consecutive sections.
4. **Use bold numbers** — "$26.6M funded", "11 lenders", "4.9★", "Founded 2013" as oversized visual elements. Numbers break text monotony and feel designed.
5. **One asymmetric section minimum** — at least one section should NOT be a centered heading + centered content block. Use a 2-column split, offset layout, or sidebar.
6. **Add micro-texture** — subtle background patterns, section dividers that aren't just whitespace, gentle gradients. The goal isn't flashy — it's to prevent the "flat white plane" look.

### What NOT to do
- Don't add stock photography (we already decided this — it makes things worse)
- Don't add animations just for the sake of it (subtle entrance animations are fine, bouncing elements are not)
- Don't switch to a dark theme (works for Bayou's DSCR tool, wrong for a consumer mortgage site)
- Don't over-design — the goal is "feels professionally designed" not "looks like a startup landing page"

**Status:** APPROVED — include in Batch 1 work or ship immediately after. This is a perception issue that affects every visitor.

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
