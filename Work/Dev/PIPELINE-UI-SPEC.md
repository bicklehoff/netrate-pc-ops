# Pipeline Page UI Update — Spec

## Changes (from Stitch mockup)

### 1. Summary Cards (replace pill buttons)
Current: `Active 16` `Settled 774` `Cancelled 10` `All 883` as pill toggle buttons
New: Big-number cards in a row at the top, clickable to filter:
```
| ACTIVE    | SETTLED   | CANCELLED | ALL       |
| 16        | 774       | 10        | 883       |
```
Cards are white with bold number + label. Active card highlighted with brand border.

### 2. Borrower Column — Add Email
Current: Name + SSN last 4 + address
New: Name + email underneath (smaller, gray). Drop the SSN from the list view.
```
Jay Piper
jay.piper@email.com
```

### 3. LO Column — Avatar + Name
Current: Just text "Jamie Cunningham"
New: Small avatar circle (initials via ui-avatars.com) + shortened name
```
[JC] J. Cunningham
```

### 4. Pagination
Current: All 883 loans rendered at once (slow)
New: 25 per page, page controls at bottom right
```
< 1 2 3 ... 35 >
```
Client-side pagination (data already loaded, just slice the visible array).

### 5. Filter + Export Buttons
Current: Saved Views dropdown + Columns gear icon
New: Keep those, but add explicit "Filter" and "Export CSV" buttons

### 6. Row Spacing
Current: Tight rows `py-3`
New: Slightly more breathing room `py-3.5` with subtle hover background

## Files to Modify
- `src/components/Portal/PipelineTable.js` — all changes here

## Not Changing
- Column filters (already working)
- Inline editing (already working)
- Sortable columns (already working)
- Column visibility picker (already working)
- Bulk selection (already working)
- Status badges (already solid from confidence pass)
