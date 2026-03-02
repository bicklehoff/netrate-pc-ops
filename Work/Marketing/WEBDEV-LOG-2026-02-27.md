# WebDev Log — Marketing Site Review
**Date:** February 27, 2026
**From:** Marketing
**Re:** Homepage review after latest push — what's live vs. what's still needed from Dev Brief Batch 1

---

## Summary

Great progress. The Google Reviews section and the "What We Do" section are solid additions. The page flow makes sense and the copy tone is on-brand. There are 6 items from the dev brief that still need attention — some are missing entirely, some need tweaks.

---

## What's Live & Looking Good

**Hero section** — "See your actual mortgage rate before you apply." is strong. CTAs work. Subtext is clean.

**Google Reviews section** — 6 review cards in a 3x2 grid, 4.9/5 stars, "Based on 35 Google Reviews" headline, "Read All 35 Reviews on Google" link at the bottom. This looks great and is a huge improvement.

**"Why NetRate Mortgage" cards** — Rates Before Applications / Wholesale Access, Broker Pricing / 50 Loans Funded in 2025. Clear value props.

**"What We Do" section** — Refinance / Purchase / Rate Tool columns with descriptions and links. Clean.

**"Licensed. Independent. Direct." section** — NMLS numbers, licensing info, Founded 2013, Direct-to-consumer, 11 wholesale lending partners. BBB/NMLS/Equal Housing icons present.

**Footer** — David Burson contact info, NMLS, address, services links, legal links, compliance disclaimer. All looks correct.

---

## What Still Needs Work — Punch List

### 1. Trust Checkmark Bar — NOT BUILT YET
**Dev Brief ref:** Batch 1, Item #1

This is the horizontal bar with 3 teal checkmarks that should appear in TWO places:
- **Homepage:** Above or just below the hero CTA buttons ("Check Today's Rates" / "Apply Now")
- **Rates page:** Above the rate table (just below the "Your Scenario" section)

Copy:
- ✓ No application or credit pull
- ✓ Real wholesale rates, updated daily
- ✓ Compare multiple loan options

Style: Light background (#f5f7fa or similar), teal checkmark icons, clean sans-serif text, horizontally spaced.

This is a high-visibility trust signal right at the decision point. Priority item.

---

### 2. BBB Seal — NEEDS SWAP TO REAL EMBED CODE
**Dev Brief ref:** Batch 1, Item #3

The current BBB icon in the "Licensed. Independent. Direct." section appears to be a generic placeholder icon, not the official BBB seal. Replace with the actual BBB embed code:

```html
<a href="https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653/#sealclick" target="_blank" rel="nofollow"><img src="https://seal-alaskaoregonwesternwashington.bbb.org/seals/blue-seal-200-42-bbb-90159653.png" style="border: 0;" alt="Locus Mortgage BBB Business Review" /></a>
```

This is a static image seal (200x42, blue, horizontal) that links to the BBB profile. Drop it in where the current BBB icon is. It currently says "Locus Mortgage" in the alt text — that's fine for now, we'll update after the BBB name change goes through.

---

### 3. "Formerly Locus Mortgage" Note — MISSING
**Dev Brief ref:** Batch 1, Item #2

The "Read All 35 Reviews on Google" link at the bottom of the reviews section links to the Google Business Profile, which still shows "Locus Mortgage" (not "NetRate Mortgage"). Visitors who click through will see a different company name and may be confused.

**Fix:** Add subtle text near the "Read All 35 Reviews on Google" link:
> Formerly Locus Mortgage

Style: Muted gray, smaller font size than the link text. Not prominent — just enough context so someone who clicks through isn't surprised.

The review link URL should be:
```
https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=ChIJa5-5jCXza4cRptwJxaP23eU
```

Confirm the current link points here (or to the equivalent GBP page).

---

### 4. Google Reviews Footer Banner — NOT BUILT YET
**Dev Brief ref:** Batch 1, Item #2b

There should be a **site-wide footer banner** (visible on every page, not just homepage) showing:
- Google "G" logo (official Google logo icon)
- Star icon + "4.9"
- "35 reviews" as a clickable link → same GBP review link as above

Style: Dark background (#1a2b3c or similar to existing dark footer), white text, Google "G" in official colors, gold/yellow star. Compact — single line, not tall. Should sit above or be integrated into the existing dark footer section.

This is persistent social proof that follows visitors across the site.

---

### 5. Bottom CTA Section Copy — STILL OLD
**Dev Brief ref:** Batch 1, Item #6

Current copy on the teal "Ready to get started?" section:
> **Ready to get started?**
> Apply online in minutes, or get a no-commitment quote first.
> [Apply Now] [Get a Free Quote]

Should be updated to:
> **Not Sure Which Rate? Let Us Help.**
> Tell us about your situation and we'll send you a personalized recommendation with full fee breakdown, cash to close, and savings analysis.

This repositions the bottom CTA as a fallback for people who browsed the rate tool but didn't pick a specific rate — rather than pushing "apply" again (which the hero and nav already do).

Note: The CTA buttons on this section may also need updating depending on what form they link to. The "Get a Free Quote" button should ideally lead to a contact/quote form, not the application.

---

### 6. Rate Tool Lead Capture ("Get This Rate" Buttons + Modal) — NOT BUILT YET
**Dev Brief ref:** Batch 1, Item #4

This is the big one — the rate tool currently shows rates but has no way to capture leads at the point of interest. Needs:

- **"Get This Rate" outlined button** on EACH row of the rate table
- **"Get This Rate" solid button** on EACH recoup analysis card
- Both open a **modal** with the selected rate pre-filled

**Modal specs:**
- Headline: "Get Your Exact Quote"
- Displays: selected rate, P&I, monthly savings, credit/charge, loan type context
- Form fields: Full Name, Phone Number, Email Address
- CTA button: "Send Me My Exact Quote"
- Footer text: "No credit pull. No obligation. Just real numbers."
- Submits to Zoho CRM with all scenario data (see dev brief Item #4 for full field list)

**Interactive mockup:** Open `D:\mockup-rate-tool-lead-capture.html` in a browser to see the full design with working buttons and modal.

This is the primary lead capture mechanism for the entire site. Without it, the rate tool is just informational with no way to convert interest into a lead.

---

### 7. UTM Parameter Capture — CONFIRM
**Dev Brief ref:** Batch 1, Item #5

All forms on the site (rate tool modal when built, "Get a Quote" page, bottom-of-page contact form) need to capture UTM parameters from the URL and pass them to Zoho CRM. This is critical for ad tracking when we launch Google Ads and Bing Ads.

UTM fields: utm_source, utm_medium, utm_campaign, utm_term, utm_content

If this is already implemented on the existing contact form, great — just make sure it carries over to the rate tool modal when that's built.

---

## Marketing Observations (Non-Blocking, For Future Consideration)

**"Live Rates, Updated Daily" section feels redundant with the hero.** Both sections say "see your rates" with a CTA button. Consider merging or cutting the standalone "Live Rates" section to shorten the page and reduce duplicate messaging. Not urgent — just something to consider in a future pass.

**"What We Do" Refinance/Purchase columns overlap** with the "Why NetRate Mortgage" cards above. The Rate Tool column is the most useful one. Could be tightened in a future revision.

**No inline form on homepage.** Currently the bottom CTA buttons link out to separate pages. In a future iteration, an inline name/email/phone form below the "Not Sure Which Rate?" headline would capture warm leads who aren't ready to click through to a whole new page. Not a Batch 1 item — just noting for later.

---

### 8. Favicon — WRONG COLOR, REPLACE
**Not in dev brief — new item from today's review**

The current favicon (`/icon.svg`) uses `#0d9488` (green-teal) which doesn't match the site's brand color `#0891b2` (blue-teal). It reads as green in the browser tab.

**Replace with the new favicon SVG file:** `D:\netrate-favicon.svg`

New SVG code (drop-in replacement for `/icon.svg`):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="7" fill="#0891b2"/>
  <text x="16" y="23" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="20" fill="white">N</text>
</svg>
```

**What changed:**
- Color: `#0d9488` → `#0891b2` (matches site buttons, logo, and all teal elements)
- Letter: "NR" → "N" (reads cleaner at 16px tab size)
- Weight: 700 → 800 (bolder for small sizes)
- Font size: 16 → 20 (larger single letter fills the space better)
- Corner radius: 6 → 7 (slightly softer)

This is a one-file swap — just replace the contents of `/icon.svg`. Should also generate a `favicon.ico` from it for older browser compatibility if not already handled by the framework.

---

## Reference Files

- **Full dev brief (all Batch 1 & 2 specs):** `D:\netrate-dev-brief.md`
- **Marketing playbook (strategy context):** `D:\netrate-marketing-playbook.md`
- **Rate tool lead capture mockup:** `D:\mockup-rate-tool-lead-capture.html`
- **New favicon SVG:** `D:\netrate-favicon.svg`
- **Questions:** Ask marketing
