# Ahrefs Re-crawl Verification

**Date:** 2026-04-21
**Baseline relay:** [`cmnyxd91f07kn6ro5`](https://tracker.netratemortgage.com/relay) (Claw, 2026-04-14)
**Backlog:** [#87](https://tracker.netratemortgage.com/backlog) — Ahrefs re-crawl verification
**Driver:** PC Dev

## 1 · Baseline (2026-04-14)

Claw ran Ahrefs Webmaster Tools free site audit on `netratemortgage.com` and flagged 43/100 score with seven findings:

1. Sitemap contained 7 URLs that 3xx redirected
2. 11 of 14 internal URLs returned 3xx redirects
3. 1 canonical tag pointing to a redirect
4. 1 redirect chain (A → B → C)
5. 2 HTTP → HTTPS redirects in internal links
6. 1 schema.org validation error
7. Only 3 pages returning 200

Root cause cluster: internal URLs inconsistently used bare-domain + `http://` form; the sitemap was hand-curated with some entries going through 3xx.

## 2 · Remediations shipped since baseline

| PR | Change |
|---|---|
| [#83](https://github.com/bicklehoff/netrate-pc-ops/pull/83) | `aggregateRating` JSON-LD added (SEO-20); CA licensing block; company + auth constants extraction |
| [#84](https://github.com/bicklehoff/netrate-pc-ops/pull/84) | Ship-now SEO remediations (GBP rename, sitemap `/rates/dscr`, equity meta framing) |
| [#99](https://github.com/bicklehoff/netrate-pc-ops/pull/99) | **Canonicalize all 47 internal URLs to `https://www.netratemortgage.com`** |
| [#100](https://github.com/bicklehoff/netrate-pc-ops/pull/100) | `/resources` hub auto-includes published `content_pages` |
| [#101](https://github.com/bicklehoff/netrate-pc-ops/pull/101) | Strip incoming brand suffix before appending (no double-branded `<title>`) |
| Sitemap | DB-driven via `content_pages` — no hand-curated 3xx entries |

## 3 · Re-crawl methodology

Can't drive the actual Ahrefs tool from here, but the 80% equivalent is to crawl every URL in our sitemap directly. Script at `Work/Dev/audits/scripts/ahrefs-recrawl.sh` (inline below) does:

1. Fetch `https://www.netratemortgage.com/sitemap.xml`
2. For each `<loc>` entry:
   - HEAD request — record status code
   - If 200: GET body, extract `<link rel="canonical" href="...">`, flag any mismatch vs the sitemap URL
   - If 3xx: record the `Location` header
3. Report totals and exceptions

## 4 · Results (post-remediation, pre-this-PR)

- **Total URLs in sitemap:** 54
- **200 OK:** 53 (98%)
- **3xx redirects:** 1
- **Errors:** 0
- **Canonical mismatches:** 1

### 4.1 Redirects (1)

| URL | Status | Note |
|---|---|---|
| `/tools/hecm-optimizer` | 307 | MLO-auth-gated tool; Next.js middleware returns 307 to the login path for unauthenticated crawlers. Not a real redirect in the sitemap-chain sense, but Ahrefs can't tell the difference. |

### 4.2 Canonical mismatches (1)

| URL | Canonical tag points to | Expected |
|---|---|---|
| `/licensing` | `https://netratemortgage.com/licensing` (bare) | `https://www.netratemortgage.com/licensing` (www) |

Root cause: `src/lib/constants/company.js` exported `COMPANY_DOMAIN = 'netratemortgage.com'` (bare). PR #99 normalized all *hardcoded* canonical URLs to `www.` but missed the constants-driven one.

## 5 · Fixes shipping in this PR

1. **`COMPANY_DOMAIN` → `www.netratemortgage.com`.** Propagates to `/licensing` canonical and the four JSON-LD `@id` URLs in `src/app/layout.js`. Brings the constants-based path into line with the hardcoded-path canonicalization from PR #99.
2. **Remove `/tools/hecm-optimizer` from public sitemap.** It's an MLO tool. Unauthenticated crawlers shouldn't see it; Ahrefs shouldn't flag its 307 as a sitemap-redirect issue. Inline comment documents the exclusion.

## 6 · Expected post-fix state

- **54 URLs → 53 URLs in sitemap** (hecm-optimizer removed)
- **53 of 53 returning 200** (100%)
- **0 redirects** in public sitemap
- **0 canonical mismatches**

## 7 · Next step

Run Ahrefs Webmaster Tools site audit again after this PR merges. Expected new score: **≥70** (vs. 43/100 baseline). File a follow-up if the score remains low — may indicate issues Ahrefs sees that direct crawling can't (e.g., page speed, Core Web Vitals, content-quality signals, external-link profile).

## 8 · Script — `ahrefs-recrawl.sh`

Included here for reproducibility on the next re-crawl cycle.

```bash
#!/bin/bash
curl -s https://www.netratemortgage.com/sitemap.xml -o /tmp/sitemap.xml
URLS=$(grep -oE '<loc>[^<]+</loc>' /tmp/sitemap.xml | sed 's/<loc>//;s/<\/loc>//')

while IFS= read -r url; do
  [ -z "$url" ] && continue
  CODE=$(curl -sw "%{http_code}" -o /dev/null -I "$url")
  if [ "$CODE" = "200" ]; then
    BODY=$(curl -sL "$url" | head -c 5000)
    CANON=$(echo "$BODY" | grep -oE '<link rel="canonical"[^>]+href="[^"]+"' | grep -oE 'href="[^"]+"' | sed 's/href="//;s/"//')
    [ -n "$CANON" ] && [ "$CANON" != "$url" ] && echo "CANON MISMATCH: $url -> $CANON"
  elif [[ "$CODE" =~ ^3[0-9]{2}$ ]]; then
    LOC=$(curl -sI "$url" | grep -iE '^location: ' | sed 's/^[Ll]ocation: //' | tr -d '\r')
    echo "REDIRECT $CODE: $url -> $LOC"
  else
    echo "ERROR $CODE: $url"
  fi
done <<< "$URLS"
```
