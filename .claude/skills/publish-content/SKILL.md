---
name: publish-content
description: "Deploy content pages to the NetRate website. Use when the user says 'publish', 'deploy page', 'publish article', 'build page from markdown', or when a relay arrives from Claw with content for the publish queue. Handles: markdown → Next.js page component, SEO markup, schema, sitemap, nav, and APR compliance check on all rate mentions."
---

# Content Publisher

Build and deploy content pages from markdown to the NetRate Mortgage website. Enforces compliance rules before publishing.

## Working Directory

`D:\PROJECTS\netrate-pc-ops`

## Source Content

Content arrives from Claw via the publish queue:
- **Repo:** `netrate-claw-ops`
- **Path:** `Work/Marketing/publish-queue/` (or `Work/Marketing/content/`)
- **Format:** Markdown with frontmatter (URL, meta title, meta description)
- **Notification:** Relay from Claw with file path and deployment instructions

Always `git pull` the claw repo first to get latest content.

## Pre-Publish Compliance Checks

Run these checks BEFORE building the page. Flag violations to David.

### APR Rule (MANDATORY — Reg Z)

**Every mortgage rate published on the site MUST have an APR next to it.**

- **Formula:** APR = Rate + 0.369%
- **Format:** `X.XX% (X.XXX% APR)`
- **Examples:**
  - `6.4%` → `6.4% (6.769% APR)`
  - `3.25%` → `3.25% (3.619% APR)`
  - `8.5%` → `8.5% (8.869% APR)`

**What counts as a rate (needs APR):**
- Any specific mortgage interest rate presented as an actual or hypothetical loan rate
- Rates in comparison tables
- Rates in examples or scenarios
- Rates in meta descriptions if they reference a specific mortgage rate

**What does NOT need APR:**
- LTV percentages (75% LTV, 85-90% CLTV)
- FICO scores (680+, 780)
- DTI ratios (43-50%)
- Reserve allocations (10%, 15%)
- Investor concentration ratios (50% investor-owned)
- Review percentages (40% of transactions)
- Generic thresholds without a specific rate ("rates below 5%", "rates above 12%")

### State Licensing

Every page must include the licensing disclaimer:
> Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861.

### Not Financial Advice

Educational content must include:
> This is educational content, not financial advice.

## Build Process

For each content page:

### 1. Create Page Component

- Directory: `src/app/{url-slug}/page.js`
- Follow existing page pattern (see `src/app/reverse-mortgage/page.js` as reference)
- Layout: `max-w-3xl mx-auto px-6 py-16`
- Breadcrumb nav: Home / Page Name
- Headings: h1 (3xl/4xl), h2 (2xl), h3 (xl)
- Body: `space-y-8 text-gray-700 leading-relaxed`
- Internal links to state pages where relevant (CO, CA, TX, OR)
- CTA button linking to `/rates` at bottom

### 2. Metadata Export

```js
export const metadata = {
  title: '...',
  description: '...',
  openGraph: {
    title: '...',
    description: '...',
    url: 'https://netratemortgage.com/{slug}',
    siteName: 'NetRate Mortgage',
    type: 'article',
    publishedTime: '...',
  },
  twitter: {
    card: 'summary_large_image',
    title: '...',
    description: '...',
  },
  alternates: {
    canonical: 'https://netratemortgage.com/{slug}',
  },
};
```

### 3. Schema Markup

Add as JSON-LD script tag:
- **Article** schema (headline, dates, author/publisher as NetRate Mortgage)
- **FAQPage** schema — extract 3-5 natural Q&A pairs from the content

### 4. Sitemap

Add entry to `src/app/sitemap.js` in the educational content section:
```js
{
  url: `${BASE_URL}/{slug}`,
  lastModified: new Date(),
  changeFrequency: 'monthly',
  priority: 0.7,
},
```

### 5. Navigation

Add to both locations in `src/app/layout.js`:
- **Header:** Resources dropdown (before the divider/Why NetRate section)
- **Footer:** Resources column (before Why NetRate)

### 6. Verify

- Run dev server and navigate to the page
- Check for console errors
- Verify content renders with correct styling
- Screenshot top, middle (tables/lists), and bottom (CTA/disclaimer)
- Verify nav dropdown shows new link

### 7. Commit and Deploy

- Commit with descriptive message
- Push to main (auto-deploys to Vercel)
- Verify live site

### 8. Confirm Back

- Ack the relay from Claw
- Send relay back with live URL: `https://netratemortgage.com/{slug}`

## Post-Publish

Log the deployment in `Work/SESSION-LOG.md` with:
- Page URL
- Source content path
- Schema types added
- Any compliance fixes applied
