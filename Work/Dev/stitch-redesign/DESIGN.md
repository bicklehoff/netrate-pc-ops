# Design System: The Financial Architect

## 1. Overview & Creative North Star
**Creative North Star: "The Transparent Editorial"**

To disrupt the cluttered, anxiety-inducing landscape of mortgage lending, this design system adopts the persona of a high-end financial journal. We move beyond the "generic SaaS" look by prioritizing extreme legibility, intentional white space, and a layered architectural depth. 

The system rejects the "boxed-in" feeling of traditional banking interfaces. Instead of rigid grids and heavy outlines, we use **asymmetric compositions** and **tonal shifts** to guide the user. The goal is to make the mortgage process feel like a curated journey—professional enough to handle a life-altering investment, yet open enough to invite a first-time homebuyer in.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a crisp, breathable light mode that uses cool-toned neutrals to instill a sense of calm.

### The Palette (Material Logic)
*   **Primary (`#00647c`):** Our "Trust Anchor." Used for high-priority actions.
*   **Primary Container (`#007f9d`):** A more vibrant teal used for highlights and interactive hover states.
*   **Surface (`#f7f9fb`):** The global canvas. A neutral, soft slate that prevents screen fatigue.
*   **Surface Container Lowest (`#ffffff`):** Reserved exclusively for interactive cards and floating modules to provide maximum contrast.

### The "No-Line" Rule
**Designers are strictly prohibited from using 1px solid borders for sectioning.** 
Structural boundaries must be defined solely through:
1.  **Background Shifts:** Placing a `surface_container_low` section against a `surface` background.
2.  **Negative Space:** Using the Spacing Scale (specifically 12, 16, or 20) to create "islands" of information.
3.  **Tonal Transitions:** A subtle shift from a bright surface to a dim surface conveys a change in context without the visual "noise" of a line.

### Glass & Gradient Soul
To ensure the UI feels "bespoke" rather than "templated":
*   **The Signature Gradient:** Primary actions should utilize a subtle linear gradient from `primary` to `primary_container` (at a 135° angle). This provides a tactile, "clickable" quality.
*   **Functional Glassmorphism:** For sticky navigation bars or floating action panels, use `surface_container_lowest` with a 70% opacity and a `24px` backdrop-blur. This keeps the user grounded in their current context.

---

## 3. Typography: The Editorial Voice
We use **Inter** not as a system font, but as a precision tool. The hierarchy is designed to mirror a financial broadsheet—authoritative and clear.

*   **Display (Large/Med):** Used for "Big Numbers" (e.g., Interest Rates, Loan Totals). Tighten letter spacing by `-0.02em` to give it a premium, custom feel.
*   **Headline (Sm/Md):** Used for section starts. These should always use `on_surface` (Deep Navy) to command attention.
*   **Body (Lg):** Our primary reading grade. Set with generous line-height (`1.6`) to ensure complex mortgage terms are easy to digest.
*   **Labels:** Always uppercase with `+0.05em` letter spacing when used for metadata or overlines.

---

## 4. Elevation & Depth: The Layering Principle
Depth is not an effect; it is information. We use **Tonal Layering** to communicate hierarchy.

1.  **Stacking Order:** 
    *   **Level 0 (Background):** `surface`
    *   **Level 1 (Sectioning):** `surface_container_low`
    *   **Level 2 (Content Cards):** `surface_container_lowest` (#FFFFFF)
2.  **Ambient Shadows:** When a card must "float" (e.g., a mortgage calculator results card), use a custom shadow: 
    *   *Offset: 0 12px | Blur: 32px | Color: `on_surface` at 4% opacity.*
    *   This mimics natural light and avoids the "dirty" look of high-contrast drop shadows.
3.  **The "Ghost Border" Fallback:** If a border is required for accessibility in forms, use `outline_variant` at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons & Pill Shapes
*   **Primary Button:** Full-pill (`rounded-full`). Gradient fill (`primary` to `primary_container`). White text. No shadow.
*   **Secondary Button:** Ghost style. No background, `primary` text, and a `Ghost Border` (15% opacity `outline_variant`).
*   **Action Chips:** Use `secondary_container` with `on_secondary_container` text. These are pill-shaped and used for selecting loan terms (e.g., "30-Year Fixed").

### Input Fields & Data Entry
*   **Styling:** Inputs should use `surface_container_low` as a background with a `bottom-border` only (2px) using `primary` when focused. This creates a "fill-in-the-blanks" editorial feel.
*   **Validation:** Error states use `error` text, but the input container should shift to `error_container` at 20% opacity to highlight the area softly.

### Cards & Lists (The "No Divider" Rule)
*   **Rule:** Forbid the use of horizontal divider lines in lists. 
*   **Implementation:** Separate list items using `8px` of vertical white space (Spacing 2). For high-density data, use alternating row backgrounds between `surface` and `surface_container_low`.

### Specialized Mortgage Components
*   **The "Rate Pop" Chart:** Use a `primary` to `cyan` gradient for bar charts. Use `surface_container_highest` for the empty state background of the chart to show "potential" or "limits."
*   **The Transparency Badge:** A pill-shaped badge using `tertiary_fixed` (soft amber) to highlight "Verified" or "Low-Rate" guarantees.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical margins (e.g., wider left margins for headlines) to create a premium editorial feel.
*   **Do** use `1.5rem` (md) to `2rem` (lg) corner radii on all cards to maintain the "Consumer Friendly" vibe.
*   **Do** use `primary_fixed` for subtle background highlights behind important data points.

### Don’t:
*   **Don’t** use pure black (`#000000`) for text. Always use `on_surface` (Deep Navy) to keep the look sophisticated.
*   **Don’t** use standard 4px or 8px "box shadows." If it looks like a default component, it’s wrong.
*   **Don’t** crowd the interface. If you are unsure, add more `Spacing 10` or `Spacing 12`.
*   **Don’t** use sharp 90-degree corners. Everything must feel approachable and "human-centric."