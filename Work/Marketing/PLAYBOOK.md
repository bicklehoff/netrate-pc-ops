# NetRate Mortgage — Marketing Playbook

## Action Items

### Ship Now — Batch 1 (Website Viability)
- [ ] Trust checkmark bar (homepage + rates page): ✓ No application or credit pull · ✓ Real wholesale rates, updated daily · ✓ Compare multiple loan options
- [x] Google Reviews section on homepage (4.9 stars, 35 reviews, 6 curated quotes)
- [ ] "Formerly Locus Mortgage" note near Google review link
- [ ] Google Reviews footer banner (site-wide, dark background, Google G + stars + count)
- [ ] BBB A+ seal — swap generic icon for real embed code (Business ID: 90159653)
- [x] NMLS Consumer Access logo + Equal Housing Opportunity icon
- [ ] Rate Tool "Get This Rate" button per row → lead capture modal
- [ ] Rate Tool "Get This Rate" on Recoup Analysis cards
- [ ] Lead capture modal → Zoho CRM (name, phone, email + scenario data)
- [ ] Homepage bottom form copy → "Not Sure Which Rate? Let Us Help."
- [ ] UTM parameter capture on all lead forms → pass to Zoho CRM
- [x] Favicon — bold "N" on brand teal #0891b2

### Dev Tasks — Batch 2 (After Batch 1 Ships)
- [x] Allow AI crawlers — robots.txt updated (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)
- [x] llms.txt file added
- [x] Schema markup (JSON-LD: FinancialService, Organization, WebSite)
- [ ] Schema markup on rate tool (FinancialProduct per rate row, FAQPage)
- [ ] Answer capsule text block on rates page (dynamic rate range for AI citation)
- [ ] FAQ content structured for AI extraction (5 core questions + FAQPage schema)
- [ ] State landing pages: /colorado-mortgage-rates/, /texas-mortgage-rates/, /oregon-mortgage-rates/
- [ ] "Today's Market" display component (agent-pushed daily market summary)
- [ ] "Last updated" timestamp visible on rates page

### Marketing (Do Now — Free)
- [ ] GBP: Optimize existing profile (categories, services, Q&A, weekly posts)
- [ ] GBP: Rename Locus → NetRate (DEFERRED — do when convenient)
- [ ] Start Reddit participation (r/personalfinance, r/RealEstate, r/FirstTimeHomeBuyer)
- [ ] Weekly rate update posts to GBP + LinkedIn

### Marketing Next Moves — March 2026

**Phase 2: Forward Mortgage Visualization Brief**
- [ ] Brief Dev on borrower-facing forward mortgage visualization tool
  - Similar treatment to HECM Explorer: interactive, transparent, educational
  - Leverage existing Rate Tool engine + Recharts (already installed)
  - Scope: amortization breakdown, total cost comparison, rent-vs-buy, refi break-even viz
  - Deliver as `Work/Marketing/FORWARD-VIZ-DEV-BRIEF.md`

**Phase 3: Blog Infrastructure Brief**
- [ ] Brief Dev on blog system build (routes, templates, SEO structure)
  - Route structure: `/blog/`, `/blog/[slug]`
  - MDX or CMS-lite approach (agent-writable, no external CMS)
  - SEO: auto-generate sitemap entries, schema markup (Article), OG tags
  - Category/tag system for reverse mortgage, forward mortgage, market updates
  - Internal linking to tools (/rates, /tools/reverse-mortgage-calculator)
  - Deliver as `Work/Marketing/BLOG-INFRA-DEV-BRIEF.md`

**Phase 3: Reverse Mortgage Blog Content (5 posts)**
- [ ] Draft post 1: "How Much Does a Reverse Mortgage Actually Cost?" (cost transparency angle — links to HECM Explorer)
- [ ] Draft post 2: "Reverse Mortgage vs. HELOC: Which Makes More Sense?" (comparison, links to calculator)
- [ ] Draft post 3: "Colorado Reverse Mortgage Guide: What Homeowners Need to Know" (state-specific SEO play)
- [ ] Draft post 4: "The Real Math Behind Reverse Mortgages" (show-don't-tell, embedded examples)
- [ ] Draft post 5: "Can You Lose Your Home with a Reverse Mortgage?" (fear-based search query, myth-busting)
- *Note: Blog posts depend on blog infrastructure (Phase 3 brief above). Draft content now, publish when infra ships.*

**Waiting on David:**
- [ ] Answer 4 open questions in HECM Explorer brief (origination fee, target comp, third-party costs, state list)

### David Action Items
- [ ] Contact BBB Denver/Boulder to rename Locus → NetRate (when convenient)
- [ ] Verify MBS Live TOS allows summarized market commentary on website
- [ ] Launch Google Ads + Bing Ads after lead capture ships (~$800-1K/mo)
- [ ] Jamie: Add BBB static seal to email signatures after rename
- [ ] Answer 4 HECM Explorer questions (see `Work/Marketing/HECM-EXPLORER-DEV-BRIEF.md`)

---

## Brand Positioning

**Tagline concept:** "Today's Rates, Zero Pitch"

**Core promise:** See your actual mortgage rate before you apply. No application, no credit pull, just rates.

**Brand voice:** Transparent, direct, no-BS. First person where appropriate. Confident but not salesy. We sound like a smart friend who happens to know mortgage math.

**Size perception:** We intentionally straddle the line between "call center" and "solo broker." The site should feel like a well-run, focused mortgage company — not too big (impersonal), not too small (risky). No individual headshots. No team page. No "meet our team" section. Let the product and professionalism speak. The reality is a lean operation enhanced by automation that performs like a medium-sized team.

**AI policy (FIRM):** ZERO mention of AI, machine learning, automation, or related technology on any consumer-facing content — website, emails, social, marketing materials. Reasons: (1) Not a selling point for mortgage borrowers. (2) Compliance risk — regulators are actively scrutinizing AI claims in financial services. (3) It raises more questions than it answers and could undermine trust. The AI/automation story is fine for industry press, podcasts, or B2B contexts — but NEVER on the consumer-facing site or materials.

**Who we are (internal, never public):** David Burson (LO/owner) + Jamie + AI agents handling operations. Licensed in CA, CO, TX, OR.

---

## Website Trust Signals — Approved for Implementation

### 1. Trust Checkmark Bar (NEW)
- **What:** Horizontal bar with 3 teal checkmarks: ✓ No application or credit pull · ✓ Real wholesale rates, updated daily · ✓ Compare multiple loan options
- **Where:** Homepage (above/below hero CTAs) AND rates page (above rate table)
- **Style:** Light background, teal checkmarks, clean text. Similar to Banking Bridge trust bar treatment.
- **Status:** APPROVED — send to dev

### 2. Google Reviews — Two Components

**Current GBP data:** 4.9 stars, 35 reviews (under "Locus Mortgage" — GBP rename deferred, see below)
**Google Place ID:** `ChIJa5-5jCXza4cRptwJxaP23eU`
**GBP review link:** `https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=ChIJa5-5jCXza4cRptwJxaP23eU`

**a) Curated Reviews Section (Homepage)**
- Reviews strip showing Google star rating (4.9) + 2-3 curated pull quotes + "See all reviews on Google" link
- Below the "Why NetRate Mortgage" cards section
- **Manually curated** — no Google Places API needed at launch. Hardcode rating, count, and quotes.
- Stars, short quotes, first name + last initial only.
- "See all reviews on Google" links to the GBP review link above
- **"Formerly Locus Mortgage"** — subtle text (muted gray, smaller font) near the Google link, explains the name difference visitors will see on Google
- **Status:** APPROVED — send to dev. No GBP rename needed first.

**b) Google Reviews Footer Banner (site-wide)**
- Dark-background site-wide footer banner showing: Google "G" logo + "4.9" star rating + "35 reviews" as link
- Links to same GBP review page
- Compact, single-line. Visible on every page. Persistent social proof.
- Update star rating and count manually as new reviews come in
- **Status:** APPROVED — send to dev. No GBP rename needed first.

### 3. BBB A+ Seal
- **What:** Official BBB Dynamic Seal (JavaScript embed from BBB portal) + NMLS Consumer Access logo (linked) + Equal Housing Opportunity icon
- **Where:** "Licensed. Independent. Direct." section on homepage, horizontal badge row
- **Current BBB profile:** https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653
- **BBB status:** A+ rated, accredited since 9/25/2013 (under Locus Mortgage name)
- **Status:** APPROVED — send to dev (David to provide BBB embed code after rename)

### BBB Seal in Email Signatures
- **What:** Static image version of the BBB A+ seal in David and Jamie's email signatures, linking to the BBB profile page
- **Why:** Every email to a lead or referral partner is a trust touchpoint. The seal quietly reinforces credibility before they read the message.
- **Important:** Use a **static image** (not the Dynamic Seal JavaScript embed) — email clients strip JavaScript. BBB provides static seal images in the portal.
- **Signature layout:**
  ```
  [Name]
  NetRate Mortgage | NMLS #641790
  [phone] | [email]
  netratemortgage.com

  [BBB A+ seal image → links to BBB profile] [Equal Housing icon]
  ```
- **Status:** Jamie to implement after BBB rename completes

### David Action Items (Required Before Dev Can Fully Implement)

**a) BBB Profile Rename**
- Contact Denver/Boulder BBB office to rename "Locus Mortgage" → "NetRate Mortgage"
- Bring DBA documentation / business registration showing name change
- A+ rating and accreditation history (since 2013) will carry over
- After rename: get the BBB Dynamic Seal embed code from BBB portal and send to dev
- BBB phone: Find via bbb.org/local-bbb/bbb-serving-denver-boulder

**b) Google Business Profile Rename — DEFERRED (not blocking)**
- **Decision:** Defer the GBP rename for now. Reviews display on the website proceeds without it (using "Formerly Locus Mortgage" note). David can rename later at his discretion.
- Reviews (35) are tied to Place ID (`ChIJa5-5jCXza4cRptwJxaP23eU`) and WILL carry over whenever rename happens
- When ready: change name ONLY (do not touch address, phone, categories simultaneously)
- May trigger re-verification (postcard, phone, or video) — allow up to 2 weeks
- After rename: update top 20-30 citations/directories, update website review link, remove "Formerly Locus Mortgage" note
- Add service areas: Texas, Oregon, California
- **Full prep checklist:** See "GBP Rename Checklist" on portal (26 directories, 6 phases, citation tracking table)

### 3. Location Reference (Subtle)
- **What:** A light mention of Louisville, CO base — but NOT Colorado-heavy. We serve multiple states and don't want out-of-state prospects feeling like we're a "Colorado lender."
- **Approach:** Keep it to what's already there (footer address, About page). Don't add a map embed or hero-level "Based in Colorado" messaging. The current "Licensed in CO, TX, and OR" treatment is the right balance.
- **Status:** KEEP AS-IS for now. Revisit if we get more state licenses and can list 5+ states (at that point the location becomes a "headquartered in" detail rather than a limiting factor).

### 4. Application-to-Funding Rate (87.7%)
- **Decision:** DO NOT promote on homepage. Borrowers don't have a frame of reference for this number. It's meaningful to industry insiders but doesn't resonate with consumers.
- **Alternative use:** Could be used in B2B contexts, broker-to-broker marketing, or investor communications if relevant later.
- **Status:** DECLINED for consumer-facing site

### 5. Personal Photos
- **Decision:** NO headshots of David or Jamie on the site. Tested previously — made the operation look small. Current ambiguity about team size is a strategic advantage.
- **Status:** DECLINED

---

## Website Trust Signals — Future Consideration

### 6. "As Seen In" / Press Mentions / Partner Logos
- **What:** A small logo bar showing press mentions, podcast appearances, or industry partnerships
- **Current status:** No assets available yet
- **Action item:** Actively pursue opportunities to generate these:
  - **Local press:** Pitch Louisville/Boulder County business publications on the "rate transparency" story — a broker who shows real wholesale rates before asking for an application
  - **Industry podcasts:** Mortgage broker podcasts, fintech podcasts — the rate tool and direct-to-consumer model is a genuinely interesting story. (AI angle is OK for industry/B2B press, NOT for consumer-facing content.)
  - **Content/thought leadership:** Write guest posts for mortgage industry sites about rate transparency, wholesale vs. retail, etc.
  - **Awards:** Apply for local business awards (Boulder County Gold, BBB Torch Awards, etc.)
  - **Lending partner co-marketing:** Check if any wholesale lenders (AmWest, etc.) have broker spotlight programs or co-branding opportunities
- **Goal:** Collect 3-5 logos/mentions that can form a credibility bar on the homepage
- **Status:** ON THE RADAR — pursue over next 6-12 months

---

## Rate Tool — Lead Capture Enhancement (Approved)

### Option A: "Get This Rate" Button Per Row
- Inline CTA button on each row of the rate table
- Opens modal with selected rate pre-filled + Name/Phone/Email form
- Submits to Zoho CRM with lead source "Rate Tool - Selected Rate" + full scenario data

### Option C: "Get This Rate" on Recoup Analysis Cards
- Full-width CTA button below each recoup card
- Same modal flow as Option A
- Highest-intent capture point on the page

### Modal Design
- Headline: "Get Your Exact Quote"
- Shows selected rate, P&I, monthly savings, credit/charge
- Fields: Name, Phone, Email
- CTA: "Send Me My Exact Quote"
- Footer: "No credit pull. No obligation. Just real numbers."
- Zoho CRM fields: name, phone, email, selected rate, loan purpose, property value, loan amount, LTV, credit score range, monthly savings, timestamp, lead source

### Mockup
- File: `D:\mockup-rate-tool-lead-capture.html`
- Status: APPROVED — send to dev

---

## Rate Tool — Quote Delivery (Under Consideration)

### Concept: "Email Me My Quote" / Download PDF
- After user selects a rate, offer to email them a formatted quote (rate, P&I, savings, cost breakdown, recoup analysis)
- Email is the primary delivery method (lower friction, opens follow-up channel)
- PDF download as secondary option after email submission
- Phone field optional on this form (lower friction = higher conversion; voluntary phone = hot lead signal)

### Zoho CRM Integration
- Lead source: "Rate Tool - Quote Requested" (distinct from just browsing)
- Follow-up automation potential: Day 1 quote, Day 3 check-in, Day 7 rate update

### Status: CONCEPT — needs dev scoping and quote template design

---

## Content & Copy Notes

- Homepage bottom form: Update copy from "Get Your Personalized Quote" to **"Not Sure Which Rate? Let Us Help."** — positions it as fallback for people who didn't pick a specific rate from the table
- Avoid language that implies team size in either direction. "We" is fine. "Our team" is fine. No specifics.
- No stock photography. Real or nothing.
- No video testimonials (high effort, low play rate for this audience)
- No live chat widget (can't staff 24/7 with current team)

---

## Tracking & Analytics

### Decision: Custom Standalone Marketing Dashboard (NOT Zoho Analytics)

**Rationale:** Zoho Analytics adds cost, rigidity, and generic dashboards. With agents available to build and maintain, a custom dashboard gives us full control, real-time data, automated alerting, and zero monthly SaaS fees.

**Data Sources:**
- Google Ads API → spend, clicks, CPC, CTR, conversions by keyword/state/campaign
- Microsoft/Bing Ads API → same
- Zoho CRM API → leads, lead source, status, pipeline stage, funded loans
- Rate table lead data (manual input or API if available)
- Website analytics (Google Analytics or Zoho PageSense)

**Dashboard Requirements:**
- Real-time (hourly refresh minimum)
- Full funnel: ad click → site visit → rate tool usage → lead form → Zoho lead → funded loan
- Cost-per-lead and cost-per-funded-loan by channel (Google vs. Bing vs. rate table vs. organic)
- Keyword-level performance (which keywords are generating funded loans, not just clicks)
- State-level breakdown (CO vs. TX vs. OR vs. CA)
- Daily/weekly/monthly trend views
- Automated alerting: CPC spikes, CTR drops, budget pacing, conversion rate changes
- Agent generates daily morning summary + real-time alerts when something needs attention

**Status:** BUILD ITEM — scope after website and lead capture ship. Agent-built standalone dashboard.

### Lead Source Tagging (Zoho CRM)

Tag all lead sources distinctly in Zoho:
- "Rate Tool - Selected Rate" (from rate table CTA buttons)
- "Rate Tool - Quote Requested" (from email quote feature, when built)
- "Contact Form" (from homepage/footer form)
- "Get a Quote Button" (from nav CTA)
- "Google Ads - [Campaign Name]" (via UTM params)
- "Bing Ads - [Campaign Name]" (via UTM params)
- "Rate Table - [Site Name]" (from rate table lead sites)
- "GBP" (from Google Business Profile)
- "Organic" (direct/organic search)

This lets us see which entry point converts best and calculate true cost-per-funded-loan by channel.

---

## Traffic Generation Plan

### The Situation

- New website (netratemortgage.com), essentially zero organic traffic
- Rebranded from Locus Mortgage (2013-2025) — 35 Google reviews on Locus GBP (rename deferred, displaying reviews now)
- Budget: ~$1,000/mo for paid channels
- Loan economics: ~$3,000 net per funded loan, target acquisition cost under $800
- Currently buying rate table leads ($500-1,500/mo) — proven channel, will continue
- Licensed in CO, TX, OR; CA coming 2026
- Core product: refi + purchase (non-realtor-driven). Cash-out refi in soft markets
- No content writing capacity unless it's high-ROI
- Need to generate loans immediately AND build long-term engine

### The Big Idea

The rate tool IS the marketing. Most mortgage sites try to rank with content. We have a live tool that shows real wholesale rates — that's the asset every channel should point to. The strategy is: get the right people to the rate tool, let the tool sell them, capture the lead.

---

### CHANNEL 1: Google Business Profile Optimization (FREE — do first)

**GBP Rename: DEFERRED** — The rename from "Locus Mortgage" to "NetRate Mortgage" is deferred. Website review display uses the existing GBP with a "Formerly Locus Mortgage" note. David can rename later when convenient. Reviews are tied to Place ID (`ChIJa5-5jCXza4cRptwJxaP23eU`) and will carry over whenever the rename happens.

**When ready to rename (future):**
1. Update DBA/trade name and NMLS records FIRST so everything matches
2. Change ONLY the business name on GBP (keep address, phone, categories identical)
3. Wait for Google approval (typically 1-3 days, could trigger re-verification taking up to 2 weeks)
4. After name change is approved, add service areas: Texas, Oregon, California
5. Update top 20-30 business citations/directories to match new name
6. Update website review links and remove "Formerly Locus Mortgage" note

**GBP Optimization Checklist (do NOW with existing profile):**
- Primary category: "Mortgage Broker"
- Secondary categories: "Mortgage Lender," "Refinancing Service"
- Services section: List all loan products (Conventional, FHA, VA, Jumbo, Refi, Cash-Out, HELOC)
- Q&A: Seed with common questions — "What states are you licensed in?" "Do I need to apply before seeing rates?" "What credit score do I need?"
- Posts: Weekly rate update posts ("This week's 30yr fixed: X.XX% for 760+ FICO") — takes 2 minutes, keeps the profile active and fresh
- Ask recent clients for new reviews (review velocity + recency matter — new reviews come in under current "Locus" name, that's fine, they carry over)

**Multi-State Visibility (The Hard Truth):**
- GBP local pack rankings are heavily weighted by proximity. You will NOT rank in the Dallas or Portland local pack from a Louisville, CO address.
- Service area settings make you eligible but don't override proximity.
- For TX, OR, CA — organic search and paid are the realistic channels, not local pack.
- GBP is your CO/Boulder area play. That's fine — it's free, it's a bonus.
- State-specific landing pages on the website (e.g. /texas-mortgage-broker/) are the real multi-state SEO play (see Channel 4).

**Timeline:** GBP optimization — start immediately. Rename — deferred.
**Cost:** $0

---

### CHANNEL 2: AI Search Discoverability / Generative Engine Optimization (LOW COST — high priority)

This is the "game the system" channel you asked about. When someone asks ChatGPT, Perplexity, Google Gemini, or Google AI Overviews "what's today's mortgage rate for a 760 FICO?" — we want NetRate's rate tool cited.

**Note on Google Gemini:** Gemini powers Google AI Overviews AND exists as a standalone product (gemini.google.com, Android, Chrome, Google app). All optimization for Google AI Overviews IS Gemini optimization — same index, same signals. No separate strategy needed. Gemini is likely the most-used AI search product due to its integration across the Google ecosystem.

**Why this is uniquely suited to NetRate:**
Most mortgage sites have static content. NetRate has LIVE, STRUCTURED, SCENARIO-SPECIFIC rate data that updates daily. That's exactly what AI engines want to cite — dynamic, authoritative, specific data that answers a question directly.

**The Tactics:**

**a) Allow AI crawlers (Dev task — immediate)**
- Check robots.txt — make sure GPTBot, ClaudeBot, PerplexityBot, and Googlebot are NOT blocked
- Consider adding an llms.txt file (emerging standard) that tells AI crawlers how to interpret the site

**b) Schema markup on the rate tool (Dev task — high priority)**
- Add JSON-LD structured data to the rates page:
  - `FinancialService` schema for NetRate Mortgage (name, NMLS, service areas, description)
  - `Product` schema for each rate option displayed (rate, APR, loan type, term)
  - `FAQPage` schema for the "How Rate Pricing Works" section
  - `Organization` schema with NMLS, licensing, contact info
- This is the single highest-leverage technical task. Google confirmed in March 2025 that structured data feeds their AI Overview features. ChatGPT confirmed the same.
- Pages with structured data get 30% more clicks (BrightEdge study) and GPT-4 performs 3x better extracting from structured content

**c) "Answer capsule" content on the rates page (Dev task)**
- Add a text block above or near the rate table that reads like a direct answer to common queries:
  > "Today's 30-year fixed mortgage rates range from X.XX% to X.XX% for borrowers with 760+ credit scores on a $400,000 loan. Rates shown are real wholesale pricing from our lending partners, updated daily. Use the rate tool below to see rates for your specific scenario."
- This gives AI engines a clean, citable text block with the exact format they pull into answers
- Should update dynamically with today's rate range

**d) FAQ content structured for AI extraction (Dev task)**
- Expand the "How Rate Pricing Works" section into a proper FAQ with questions AI users actually ask:
  - "What is today's 30-year fixed mortgage rate?"
  - "What rate can I get with a 760 credit score?"
  - "How much does it cost to refinance?"
  - "What's the difference between rate and APR?"
  - "How do mortgage points work?"
- Each answer should be direct, factual, and cite NetRate's data. Wrap in FAQPage schema.

**e) Build mentions on platforms AI engines cite heavily**
- **Reddit:** Perplexity cites Reddit 46.7% of the time. Participate genuinely in r/personalfinance, r/RealEstate, r/FirstTimeHomeBuyer. Don't shill — answer rate questions with real data, link to the rate tool when relevant. "I run a mortgage brokerage, here's what wholesale rates actually look like today: [link]"
- **Quora:** Similar play. Answer mortgage rate questions with genuine expertise.
- These platforms build the third-party mentions that AI engines trust more than your own site.

**f) Keep content fresh**
- AI engines weight recency. The rate tool already updates daily — that's a massive advantage.
- Add a visible "Last updated: [timestamp]" on the rates page.
- The weekly GBP posts (Channel 1) also create fresh, date-stamped content Google indexes.

**Timeline:** Dev tasks in Batch 2 (after trust signals ship). Reddit/Quora participation ongoing.
**Cost:** Dev time only. Reddit/Quora is sweat equity.

---

### CHANNEL 3: Google Ads (PAID — bulk of budget)

**Budget allocation:** $800-1,000/mo

**Campaign structure:**

**a) High-intent search ads (primary spend: ~$700/mo)**

Target keywords by state — these are people actively looking for rates:
- "refinance rates today" + state modifiers (texas, colorado, oregon)
- "mortgage refinance rates [state]"
- "wholesale mortgage rates"
- "compare mortgage rates no application"
- "mortgage rates 760 credit score"
- "cash out refinance rates [state]"

Why these work for NetRate: The landing page IS the rate tool. Most competitors send ads to a lead form. We send them to actual live rates. That's a massive quality score advantage AND a conversion advantage — they see value before giving up info.

Ad copy angle: "See Today's Actual Rates — No Application Required. Compare real wholesale rates by credit score and loan amount. No credit pull."

**b) Competitor/category defense (~$100/mo)**
- Bid on your own brand name (cheap, protects against competitors bidding on "netrate mortgage")
- Bid on rate table site names if allowed (the sites where you currently buy leads — cut out the middleman)

**c) Landing page strategy**
- Send all ads directly to /rates with UTM parameters
- The rate tool IS the landing page — don't build separate landing pages
- Dev should add UTM parameter capture so Zoho CRM knows which ad/keyword generated each lead

**Targeting:**
- Geo: CO, TX, OR (add CA when licensed)
- Device: Desktop and mobile (rate tool needs to work well on mobile)
- Schedule: Mortgage research peaks on weekday evenings and weekends
- Audiences: Layer on homeowner audiences and in-market audiences for refinancing

**Expected math at $800/mo:**
- At $3-5 CPC for mortgage keywords (varies by state and competition), that's ~160-260 clicks/mo
- If 10% use the rate tool and engage: 16-26 engaged prospects
- If 30% of those submit a lead form: 5-8 leads/mo
- At your historical conversion rate from engaged prospects, 2-3 funded loans/mo = $6,000-9,000 revenue on $800 spend
- That's a $270-400 acquisition cost per funded loan — well under the $800 target

**Ad Tracking Dashboard (CRITICAL)**
- Need real-time (daily/hourly) visibility into ad performance
- Set up automated reporting via Google Ads API → dashboard (Google Looker Studio is free and connects natively)
- Key metrics to track in real-time: impressions, clicks, CPC, CTR, conversions (lead form submissions), cost per conversion, by keyword and by state
- UTM parameters on all ad links so Zoho CRM can tie leads back to specific keywords/campaigns
- Dev task: ensure UTM capture on all lead forms, pass through to Zoho CRM
- Agent can monitor dashboard and flag anomalies (CPC spikes, CTR drops, budget pacing issues)
- Weekly automated report comparing Google Ads vs. Microsoft Ads vs. rate table leads

**Timeline:** Launch after rate tool lead capture is live (Batch 1 dev work). No point paying for clicks until the lead capture is in place.
**Cost:** $800-1,000/mo (combined Google + Microsoft)

---

### CHANNEL 3b: Microsoft / Bing Ads (PAID — high-value complement)

**Why Bing is worth it for mortgage specifically:**
- Bing CPCs are 30-70% cheaper than Google. Mortgage keywords on Google run $47-$100+ per click. On Bing, estimated $15-$65 range.
- Bing's audience skews older, higher-income, desktop-heavy — that's your exact refi demographic.
- Bing holds ~18% of US desktop search. That's not nothing.
- Higher CTR on Bing (3.51% for finance vs. ~2% on Google)
- Average ROI on Bing: $5.10 per $1 spent vs. Google's $4.20
- Less competition = better ad positions for less money
- Bing ads also show on Yahoo and MSN financial sites — strong fit for mortgage content
- ChatGPT uses Bing's index for its search feature, so Bing visibility feeds AI search discoverability

**Implementation:**
- Import Google Ads campaigns directly into Microsoft Ads (one-click import feature)
- Same keywords, same ad copy, same landing pages
- Start with 20-30% of paid budget on Bing ($150-250/mo), rest on Google
- If Bing CPA outperforms Google, shift budget accordingly

**Budget split (recommended starting point):**
- Google Ads: $600-750/mo
- Microsoft/Bing Ads: $150-250/mo
- Adjust monthly based on performance data

**Timeline:** Launch same time as Google Ads. Import campaigns to save setup time.
**Cost:** Included in the $800-1,000/mo paid budget

---

### CHANNEL 4: State-Specific Landing Pages (SEO — medium priority)

**What:** Create dedicated pages for each licensed state:
- netratemortgage.com/colorado-mortgage-rates/
- netratemortgage.com/texas-mortgage-rates/
- netratemortgage.com/oregon-mortgage-rates/
- netratemortgage.com/california-mortgage-rates/ (when licensed)

**Why:** These won't crack the GBP local pack, but they CAN rank in organic results for "[state] mortgage rates" queries. They also give Google Ads state-specific landing pages (higher quality score) and give AI engines location-specific content to cite.

**What goes on them:**
- Live rate data from the rate tool (filtered or displayed for that state's defaults)
- State-specific licensing info (NMLS, state license numbers)
- State-specific content: "We're licensed in Texas (NMLS #641790) and shop across 11 wholesale lenders to find you the best rate. No bank markup. No realtor referral required."
- FAQ specific to that state (Texas-specific first-time buyer programs, Oregon housing market context, etc.)
- Schema markup: FinancialService with areaServed set to the specific state

**Don't need to write essays.** 300-500 words of unique state-specific content + the rate tool embed + FAQ. Not blog posts — functional landing pages.

**Timeline:** Batch 2, after core site updates ship.
**Cost:** Dev time only.

---

### CHANNEL 5: Rate Table Lead Sites (EXISTING — continue)

**Keep running** your existing rate table lead spend ($500-1,500/mo). This is a proven channel with known conversion economics. The goal isn't to abandon it — it's to build direct channels (Channels 1-4) that eventually reduce your dependency on it.

**Optimization:**
- Make sure your rate table listings link to netratemortgage.com (not the old locus site)
- Track these leads separately in Zoho CRM: lead source "Rate Table - [Site Name]"
- Compare cost-per-funded-loan against Google Ads monthly to see which is more efficient
- As direct traffic grows, you can strategically reduce rate table spend

**Timeline:** Ongoing.
**Cost:** Current spend ($500-1,500/mo — separate from the $1K traffic budget)

---

### CHANNEL 6: Lightweight Social / Content (LOW EFFORT — supplementary)

**NOT blog posts. NOT content marketing.** Here's what's worth your time:

**a) Weekly rate update posts (~5 min/week)**
- Post to GBP, LinkedIn, and optionally X/Twitter
- Format: "This week's 30yr fixed: 5.625% for 760+ FICO on a $400K loan. That's $392/mo less than 7.125%. See all rate options: [link to rate tool]"
- This takes 5 minutes. It keeps your GBP active, creates fresh indexed content, builds social presence, and gives AI engines date-stamped rate data to cite.

**b) Reddit participation (~30 min/week)**
- r/personalfinance, r/RealEstate, r/FirstTimeHomeBuyer
- Answer questions with real expertise. When relevant, link to the rate tool.
- This is the #1 source Perplexity cites. Worth the time.

**Timeline:** Start now.
**Cost:** Time only.

---

### Channel Priority & Sequencing

| Priority | Channel | Cost | Timeline | Expected Impact |
|----------|---------|------|----------|----------------|
| 1 | GBP migration + optimization | Free | Now — 2 weeks | Foundation for local + AI |
| 2 | AI search / schema markup (incl. Gemini) | Dev time | Batch 2 | Medium-term, compounding |
| 3 | Google Ads + Microsoft/Bing Ads | $800-1K/mo combined | After lead capture ships | Immediate lead flow |
| 4 | Rate table leads | $500-1.5K/mo | Continue | Proven, keep running |
| 5 | State landing pages | Dev time | Batch 2 | Medium-term SEO |
| 6 | Social/Reddit (agent-automated) | Time only | Now | Supplementary, AI citations |

### Monthly Budget Summary

| Item | Monthly Cost |
|------|-------------|
| Google Ads | $600-750 |
| Microsoft/Bing Ads | $150-250 |
| Rate table leads | $500-1,500 (existing, separate) |
| GBP, social, Reddit | $0 (agent time) |
| Dev work (schema, pages) | One-time, included in dev scope |
| **Total new paid spend** | **$800-1,000/mo** |

### Social Posting Automation

- Agent handles weekly rate update posts to GBP, LinkedIn, and optionally X/Twitter
- Zoho Social available for scheduling if needed (similar to Hootsuite)
- Agent monitors engagement and flags anything notable
- Workflow: agent pulls current rate data → drafts post → schedules via Zoho Social or posts directly → monitors responses

### Success Metrics (First 90 Days)

- Leads from rate tool: Track weekly (target: 5-10/mo from Google Ads by month 2)
- Google Ads cost per lead: Target under $100
- Cost per funded loan: Target under $800 (across all channels)
- AI search visibility: Monthly audit — query ChatGPT, Perplexity, Google AI Overviews with target questions, check if NetRate is cited
- GBP impressions and actions: Track weekly post-migration
- Rate table lead cost vs. direct lead cost: Compare monthly

---

### CHANNEL 7: MBS Live Market Data → Daily Website Content (AGENT-AUTOMATED)

**Source:** MBS Live (app.mbslive.net) — paid subscription David already has

**What it provides:**
- Real-time MBS pricing (UMBS, GNMA — the bonds that drive mortgage rates)
- Treasury yields (2yr, 5yr, 10yr, 30yr)
- Lender reprice alerts (when lenders change rates mid-day)
- Daily market commentary (MBS Morning, MBS Recap)

**Why this matters for marketing:**

1. **AI Search Freshness** — Daily updated, timestamped market content is exactly what Gemini/ChatGPT/Perplexity want to cite. When someone asks "should I lock my mortgage rate today?" or "are mortgage rates going up or down?" — our site has a fresh, expert, same-day answer. Most competing broker sites have nothing like this.

2. **Authority Signal** — Showing bond market context behind the rates elevates NetRate above every other broker site that just shows a rate table. We're showing WHY rates are what they are. That's broker-level expertise visible to the consumer without feeling like jargon.

3. **Repeat Visits** — Rate shoppers who found us once now have a reason to check back daily. "Let me see what the market's doing on NetRate today." This builds organic traffic over time.

4. **Content Without Writing** — Agent pulls MBS Live data, generates a 2-3 sentence consumer-friendly market summary. Zero time from David or Jamie. This solves the "I don't have time to write content" problem entirely.

5. **Feeds Social Posts** — Same data repurposed for GBP/LinkedIn. Agent posts: "Bond market rallied today — rates ticking down. 30yr fixed at 5.5% for 760+ FICO. See the full breakdown: [link]"

6. **Feeds the Rate Tool Context** — When someone lands on the rates page, they see not just numbers but a quick "why" — "Rates improved today after weaker jobs data. Good day to lock." That's a trust-builder.

**What gets displayed on the website:**

A "Today's Market" section on the rates page (and optionally homepage). Example output:

> **Market Update — Feb 26, 2026 | 10:45 AM ET**
> 10yr Treasury: 4.32% (↓0.03) | MBS 6.0: 100.28 (↑0.09)
> Bonds rallied overnight on softer economic data. Rates are slightly better today. If you've been watching and waiting, today's pricing is favorable.

Keep it short. 2-3 sentences max. Consumer-friendly, not trader jargon.

**Setup & Implementation:**

| Step | What | Who | Notes |
|------|------|-----|-------|
| 1 | Verify MBS Live subscription terms allow summarized/interpreted data on public site | David | Check TOS — we are NOT republishing raw MBS prices, we are publishing our own expert market commentary informed by the data. Likely fine, but confirm. |
| 2 | Agent (OpenClaw) monitors MBS Live dashboard | Setup/Dev | Agent reads key data points: 10yr yield, direction, MBS coupon prices, any significant moves or reprice alerts |
| 3 | Agent generates daily market summary | Setup/Dev | Template: Date/time, key data points, 2-3 sentence plain-English interpretation. Tone: confident, helpful, not alarmist. No jargon. |
| 4 | Dev builds "Today's Market" display component on rates page | Dev | Needs: API endpoint or simple CMS field that agent can push to. Shows date, timestamp, key metrics, summary text. |
| 5 | Agent pushes summary to website daily (or more often on volatile days) | Setup/Dev | Minimum: once per morning after MBS Live updates. Ideal: update again mid-day if there's a significant move or reprice wave. |
| 6 | Same summary feeds social posts | Setup/Dev | Agent reformats the market summary into GBP/LinkedIn post format and pushes via Zoho Social or direct posting. |

**Update Frequency:**
- **Daily minimum** — Morning update after markets open and MBS Live data refreshes
- **Intraday on volatile days** — If bonds move significantly or there's a reprice wave, agent pushes an update ("Rates just got worse — lenders repricing. If you have a rate you like, lock now.")
- **Weekly recap** — End-of-week summary of rate direction for the week. Feeds GBP post and LinkedIn.

**Compliance Notes:**
- Do NOT republish raw MBS Live data streams or proprietary pricing directly. What we publish is our own market commentary informed by publicly observable market data (Treasury yields are public; our interpretation is original content).
- Include standard disclaimer: "Market commentary is for informational purposes only and does not constitute financial advice. Actual rates depend on individual scenario and are subject to change."
- Verify MBS Live TOS regarding data redistribution before launch.

**Timeline:** Set up after website trust signals and lead capture ship. Agent monitoring can start immediately to build the workflow; website display component is a dev Batch 2 item.
**Cost:** $0 incremental (MBS Live subscription already paid for)

---

*Last updated: March 12, 2026*
