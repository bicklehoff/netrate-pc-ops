# NetRate Mortgage — Design System

**Locked April 2026.** This file is a human-readable mirror of `tailwind.config.js`. When in doubt, `tailwind.config.js` wins — update this file whenever tokens change.

Any UI work (pages, components, emails, PDFs, notification templates) must use these tokens. No cyan `#0891b2`, no teal `#024c4f`, no ad-hoc hex values.

---

## Color Tokens

### Brand (blue — primary interactive accent)
Used for: headers, link colors, status dots, "Live Rates" ticker background, small badges.

| Token | Hex | Use |
|---|---|---|
| `brand.DEFAULT` | `#2E6BA8` | Primary interactive, link text |
| `brand.dark` | `#24578C` | Hover states |
| `brand.light` | `#E6EEF7` | Badge backgrounds, subtle fills |

### Go (green — primary forward-motion CTA)
Used for: Apply Now, Submit, See My Rate, Send, any "go forward" action button.
**Not brand blue, not yellow.** Go green is the primary CTA everywhere.

| Token | Hex | Use |
|---|---|---|
| `go.DEFAULT` | `#059669` | Primary CTA button background |
| `go.dark` | `#047857` | CTA hover |
| `go.light` | `#D1FAE5` | Success-state backgrounds |

### Accent (yellow — highlights only)
Used for: "LIVE RATES" chip label, featured-row tags, eyebrow text on brand backgrounds.
**Never used for primary CTAs.** Sparingly for attention-catching highlights.

| Token | Hex | Use |
|---|---|---|
| `accent.DEFAULT` | `#FFC220` | Highlight accents |
| `accent.dark` | `#FFD04A` | Hover |
| `accent.light` | `rgba(255,194,32,0.10)` | Subtle accent fill |

### Ink (text)
| Token | Hex | Use |
|---|---|---|
| `ink.DEFAULT` | `#1A1F2E` | Primary body text, dark fill |
| `ink.mid` | `#4A5C6E` | Secondary text |
| `ink.subtle` | `#7A8E9E` | Tertiary text, disclaimers |

### Surface (backgrounds)
| Token | Hex | Use |
|---|---|---|
| `surface.DEFAULT` | `#FFFFFF` | Card backgrounds |
| `surface.alt` | `#F5F4F1` | Subtle panel, stripe rows |
| `surface.page` | `#FAFAF7` | Page-level background |

### Legacy alias
- `deep` → `#1A1F2E` (alias for `ink.DEFAULT` — kept for unmigrated components)

---

## Border Radius

Additive scale (Tailwind defaults also available):
- `nr-xs` → `2px`
- `nr-sm` → `4px`
- `nr-md` → `6px` — **default for buttons**
- `nr-lg` → `8px` — cards, larger containers
- `nr-xl` → `12px` — hero cards

---

## Shadows

- `nr-sm` → `0 1px 3px rgba(26,31,46,0.05)` — subtle
- `nr-md` → `0 1px 6px rgba(26,31,46,0.07), 0 2px 12px rgba(26,31,46,0.05)` — cards
- `nr-lg` → `0 2px 8px rgba(26,31,46,0.08), 0 4px 24px rgba(26,31,46,0.06)` — modals, hero

---

## Typography

- Sans: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Mono: `var(--font-mono), 'JetBrains Mono', 'Fira Code', monospace`

---

## Canonical Usage Patterns

Reference live examples in `src/app/page.js`:

**Ticker bar:**
```jsx
<div className="bg-brand border-b border-white/10">
  <span className="bg-brand-dark text-accent">LIVE RATES</span>
  <span className="text-white/70">...</span>
</div>
```

**Primary CTA button:**
```jsx
<a className="block text-center py-3 bg-go text-white rounded-nr-md text-sm font-bold hover:bg-go-dark">
  Apply Now
</a>
```

**Status badge:**
```jsx
<div className="bg-brand/10 border border-brand/20 text-brand rounded-full px-3 py-1">
  <span className="bg-brand rounded-full animate-pulse" />
  Rates updated
</div>
```

**Accent link on brand background:**
```jsx
<a className="text-accent hover:text-accent/80">Rate Watch →</a>
```

---

## Email Templates

Emails can't use Tailwind classes — use inline styles with these exact hex values. Current examples:
- `src/lib/email-templates/lead-confirmation.js` — borrower form confirmation
- `src/lib/email-templates/inbound-lead-alert.js` — David lead notification

Pattern for emails:
- Header: `background-color:#2E6BA8` (brand)
- Primary button: `background-color:#059669;color:#ffffff` (go + white)
- Accent eyebrow text on brand bg: `color:#FFC220;text-transform:uppercase;font-weight:700`
- Body text: `color:#4A5C6E` (ink.mid)
- Footer: `background-color:#F5F4F1;color:#4A5C6E` (surface.alt + ink.mid)

---

## When tokens change

1. Update `tailwind.config.js` (source of truth)
2. Update this file to match
3. Grep for old hex values and migrate: `Grep(pattern: "#2E6BA8|#059669|#FFC220|...")` in `src/`
4. Update the memory file `project_homepage_retheme.md` so future sessions pick up the change
