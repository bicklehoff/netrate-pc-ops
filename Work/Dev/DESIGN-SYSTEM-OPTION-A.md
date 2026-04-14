# Design System — Option A

Design language for calculators, pricing tools, and portal pages.
Derived from purchase calculator redesign (2026-04-14).

## Layout

### Two-Column (Desktop)
- **Left column**: inputs, sticky on scroll (`lg:sticky lg:top-6`)
- **Right column**: results, scrolls naturally
- **Stacks vertically on mobile** (inputs first, results below)
- Container: `max-w-6xl mx-auto px-4 sm:px-6`
- Left width: `w-full lg:w-[380px] lg:shrink-0`
- Gap: `gap-8`

```jsx
<div className="flex flex-col lg:flex-row gap-8">
  <div className="w-full lg:w-[380px] lg:shrink-0">
    <div className="lg:sticky lg:top-6 space-y-6">
      {/* Input cards */}
    </div>
  </div>
  <div className="flex-1 space-y-4">
    {/* Results */}
  </div>
</div>
```

## Input Controls

### SliderInput (dual control)
Text field + range slider synced to the same value. For high-impact numeric inputs (price, rate, down payment, property value).

```jsx
<SliderInput
  label="Purchase Price"
  prefix="$"
  value={val}
  onChange={setVal}
  min={100000} max={2000000} step={5000}
/>
```

- Text input: `border border-gray-200 rounded-nr-lg py-2.5 text-sm font-semibold text-ink`
- Range: `mt-2 w-full h-2 rounded-lg appearance-none cursor-pointer accent-brand bg-gray-200`
- Min/max labels: `text-[10px] text-ink-subtle`

### Pill Toggle (replacing dropdowns)
For categorical choices with 2-5 options.

```jsx
<div className="flex flex-wrap gap-2">
  {options.map(opt => (
    <button
      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
        active === opt.key
          ? 'border-brand bg-brand text-white'
          : 'border-gray-200 bg-white text-ink-mid hover:border-brand/40'
      }`}
    />
  ))}
</div>
```

### Segment Toggle (inline options)
For small sets like loan term. Equal-width buttons in a row.

```jsx
<div className="flex gap-2">
  {[15, 20, 25, 30].map(t => (
    <button
      className={`flex-1 py-2 rounded-nr-lg text-sm font-medium border transition-all ${
        active === t
          ? 'border-brand bg-brand/10 text-brand'
          : 'border-gray-200 text-ink-mid hover:border-brand/30'
      }`}
    />
  ))}
</div>
```

### Preset Chips
Quick-select for common values. Show computed dollar amounts when useful.

```jsx
<div className="flex gap-2">
  {[3, 5, 10, 20].map(pct => (
    <button
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
        active === pct
          ? 'border-brand bg-brand/10 text-brand'
          : 'border-gray-200 text-ink-subtle hover:border-brand/30'
      }`}
    >
      {pct}%
      <span className="text-[10px] text-ink-subtle ml-1">{dollar(price * pct / 100)}</span>
    </button>
  ))}
</div>
```

### TextInput (no slider)
For secondary numeric inputs (tax rate, insurance, HOA).

- Same styling as SliderInput text field, without the range control.

### Button Toggles (existing pattern)
For Property Type, Units — keep the existing pattern but align with pill styling:
- Active: `bg-brand text-white border-brand`
- Inactive: `bg-white text-ink-mid border-gray-200 hover:border-brand/40`

## Card Sections

### Input Card
Groups related inputs. Used on the left column.

```jsx
<div className="bg-white rounded-xl border border-gray-200 p-5 shadow-nr-sm">
  <h2 className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-4">
    Section Title
  </h2>
  <div className="space-y-5">
    {/* inputs */}
  </div>
</div>
```

### Result Card (small metric)
For individual data points (P&I, tax, insurance, PMI).

```jsx
<div className="bg-white border border-gray-200 rounded-xl p-4">
  <div className="text-xs text-ink-subtle">Label</div>
  <div className="text-base font-semibold text-ink mt-1 tabular-nums">{value}</div>
</div>
```

### Hero Card
Primary output (payment total, or rate table header).

```jsx
<div className="bg-white border border-gray-200 rounded-xl p-6 shadow-nr-sm">
  <div className="text-xs text-ink-subtle uppercase tracking-wide">Monthly Payment</div>
  <div className="text-4xl font-bold text-ink mt-1 tabular-nums">{value}</div>
</div>
```

### Callout Card (contextual)
For warnings, fees, benchmarks. Color-coded by severity.

- Info/brand: `bg-brand/5 border-brand/10 text-brand`
- Warning: `bg-amber-50 border-amber-200 text-amber-700`
- Success: `bg-green-50 border-green-200 text-green-700`
- Error: `bg-red-50 border-red-200 text-red-700`

## Data Visualization

### Payment Composition Bar
Horizontal stacked bar showing proportions.

```jsx
<div className="flex h-3 rounded-full overflow-hidden">
  {segments.map(seg => (
    <div className={`${seg.color} transition-all duration-300`}
         style={{ width: `${(seg.value / total) * 100}%` }} />
  ))}
</div>
```

Colors: P&I = `bg-brand`, Tax = `bg-go`, Insurance = `bg-sky-400`, PMI = `bg-amber-400`, HOA = `bg-purple-400`

### Live Stats Bar
Compact row of key metrics. Sits between form and results, or as sticky header.

```jsx
<div className="flex gap-1.5">
  <div className="flex-1 bg-brand/10 border border-brand/10 rounded-lg px-2.5 py-1.5">
    <div className="text-[9px] font-bold text-brand uppercase tracking-wider">Label</div>
    <div className="text-sm font-semibold text-ink tabular-nums">{value}</div>
  </div>
</div>
```

## Color Tokens (from tailwind.config)

| Token | Hex | Use |
|-------|-----|-----|
| `brand` | #2E6BA8 | Primary interactive, links, active states |
| `brand-dark` | #24578C | Hover, headers |
| `brand-light` | #E6EEF7 | Subtle backgrounds |
| `go` | #059669 | Primary CTA (Apply, Submit, Get Rates) |
| `go-dark` | #047857 | CTA hover |
| `accent` | #FFC220 | Highlights, badges |
| `ink` | #1A1F2E | Primary text |
| `ink-mid` | #4A5C6E | Secondary text |
| `ink-subtle` | #7A8E9E | Labels, captions |
| `surface` | #FFFFFF | Card backgrounds |
| `surface-alt` | #F5F4F1 | Page sections |
| `surface-page` | #FAFAF7 | Page background |

## Typography Scale

| Use | Classes |
|-----|---------|
| Page title | `text-2xl sm:text-3xl font-bold text-ink` |
| Section header | `text-xs font-semibold text-ink-subtle uppercase tracking-wide` |
| Input label | `text-sm font-medium text-ink` |
| Hero number | `text-4xl font-bold text-ink tabular-nums` |
| Metric value | `text-base font-semibold text-ink tabular-nums` |
| Metric label | `text-xs text-ink-subtle` |
| Caption | `text-[10px] text-ink-subtle` |
| Body | `text-sm text-ink-mid` |

## Border Radius (NetRate scale)

| Token | Value | Use |
|-------|-------|-----|
| `rounded-nr-xs` | 2px | Tiny elements |
| `rounded-nr-sm` | 4px | Chips, badges |
| `rounded-nr-md` | 6px | Buttons |
| `rounded-nr-lg` | 8px | Inputs |
| `rounded-nr-xl` | 12px | Cards |
| `rounded-xl` | 12px | Cards (Tailwind default, same as nr-xl) |
| `rounded-full` | 9999px | Pills, toggles |

## Shadow Scale

| Token | Use |
|-------|-----|
| `shadow-nr-sm` | Cards, input groups |
| `shadow-nr-md` | Elevated cards, modals |
| `shadow-nr-lg` | Dropdowns, popovers |

## CTA Patterns

### Primary CTA (action)
```jsx
<button className="bg-go text-white py-3 rounded-nr-md font-bold text-base hover:bg-go-dark transition-colors">
  Get My Rates →
</button>
```

### Secondary CTA (navigation)
```jsx
<Link className="border-2 border-brand text-brand text-sm font-medium rounded-2xl hover:bg-brand/5 transition-colors px-5 py-2.5">
  Talk to a loan officer
</Link>
```

## Where to Apply

- `/tools/purchase-calculator` — done (Option A committed)
- `/rates` — ScenarioForm + RateResults (two-column with rate table as right column)
- `/refinance-calculator` — RefinanceCalc components
- `/tools/dscr-calculator` — DSCR page
- `/portal/*` — MLO dashboard pages (pipeline, loan detail, contacts)
