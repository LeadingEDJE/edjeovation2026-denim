# Demo Walkthrough

A screenshot-and-narration walkthrough of the key flows. Replace the
`<!-- SCREENSHOT -->` placeholders with captured images (or swap this file for a
live demo link / recorded video, ≤ 5 minutes).

> **Run locally:** `docker compose up --build`, then open the associate dashboard
> at `http://localhost:5173` (API at `http://localhost:4000`, OpenAPI at `/docs`).

---

## Happy path

### 1. Customer books a fitting (iOS app)

The customer selects a store, picks a non-peak appointment slot, and completes a
short intake: occasion, colors to focus on or avoid, and a style description that
maps to an Abercrombie **Muse** (Clean / Romantic / Boyish / Statement Maker).
They receive a confirmation with their assigned stylist.

The iOS app is styled to the **Denim Fit brand system** — a navy/ink palette,
square corners, bordered white cards on a neutral canvas, a navy full-bleed
landing and confirmation, a navy hero on the appointment detail with grouped
cards and chat bubbles, a 4-up fit-profile stat strip, a key/value review table,
a six-step segmented progress bar across the booking wizard, and tappable
swatch grids for the color step. The SwiftUI theme mirrors the tokens in
`packages/design-system/src/theme.css` so the customer app and associate web
dashboard share one visual language.

<!-- SCREENSHOT: iOS landing (navy full-bleed) -->
<!-- SCREENSHOT: iOS store selection + slot picker -->
<!-- SCREENSHOT: iOS intake — occasion + color swatch grids + style keywords (with step progress bar) -->
<!-- SCREENSHOT: iOS review screen (key/value table) -->
<!-- SCREENSHOT: iOS confirmation showing assigned stylist (navy full-bleed) -->
<!-- SCREENSHOT: iOS appointment detail (navy hero + grouped cards, chat bubbles) -->
<!-- SCREENSHOT: iOS fit profile stat strip -->


*Why it matters:* a lightweight intake captures customer intent up front without
burning them out, and the combined order-history + intake gives the store real
context before arrival.

### 2. Associate reviews upcoming appointments (web dashboard)

The associate opens the dashboard's **Open** view, filters by store / date /
stylist / status, and selects an appointment to prep. On phone and small-tablet
widths the view nav becomes a horizontal scroll rail with a right-edge fade, and
each queue row collapses into a stacked **mobile card** (time + status, avatar +
customer name + occasion, muse tag + stylist footer) so the same flow works on a
handheld; on ≥ 1040 px the desktop multi-column data row returns.

<!-- SCREENSHOT: dashboard Open list with filters (desktop) -->
<!-- SCREENSHOT: dashboard Open list on a phone (scrollable view nav + queue cards) -->

### 3. Associate reviews AI-curated suggestions

The appointment detail shows the customer's profile and a **Suggested products**
list — each item with a **thumbnail**, attributes (fit / rise / stretch / price),
and a **rationale** explaining why it fits this customer. The shortlist is built
by the rule-based scorer and re-ranked by Claude. On phones, **Suggested
Products lead** (the customer-snapshot column drops below them via a CSS grid
order swap), the hero **Check In / No-Show** buttons go full-width, and the
**Save / Complete** action bar sticks to the bottom of the viewport so the next
step is always reachable. Above 1040 px the layout returns to the two-column
desk frame (snapshot left, suggestions + messaging + capture right).

<!-- SCREENSHOT: appointment detail with suggested products + rationale (desktop) -->
<!-- SCREENSHOT: appointment detail on a phone (suggestions first, sticky action bar) -->

*Why it matters:* the associate arrives prepared with a curated set and talking
points, not a cold start.

### 4. Associate preps, messages, and runs the appointment

The associate sets **product-prep states**, exchanges **async messages** with the
customer via the shared stylist inbox, and uses lifecycle actions to **check in**
the customer.

<!-- SCREENSHOT: product-prep states -->
<!-- SCREENSHOT: appointment messaging thread -->

### 5. Associate completes the visit and writes a recap

After the fitting, the associate **marks the appointment complete** and writes a
**customer-facing recap** (regardless of whether the customer purchased).

<!-- SCREENSHOT: complete + recap entry -->

---

## Edge cases to show

- **No-show / reassignment:** mark a customer **no-show**, or **reassign** a
  scheduled appointment to another eligible same-store stylist.
  <!-- SCREENSHOT: reassign stylist / no-show action -->
- **Regenerate suggestions:** trigger a re-rank to refresh the shortlist.
  <!-- SCREENSHOT: regenerate suggestions -->
- **AI-unavailable fallback:** with no API key configured, suggestions still
  appear using the deterministic rule-based ranking (rationale is scorer-derived).

---

## Demo tips

- Show the happy path first, then the edge cases.
- Narrate *why* each step matters (preparedness, personalization, resilience).
- If recording, keep it under 5 minutes and get to the dashboard quickly.
