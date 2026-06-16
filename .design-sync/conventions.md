# Denim Fit Design System — conventions

An Abercrombie-inspired retail design system: deep slate-navy brand color,
square corners, generous whitespace, and a condensed, lightly-tracked grotesque
type system. Built with **Tailwind v4 (CSS-first `@theme`)** + React.

## Setup

Import the stylesheet once at the app root, then use components directly — they
are self-contained and need **no provider/context wrapper**:

```tsx
import { Button, ProductTile, NavBar } from "@denim-fit/design-system";
import "@denim-fit/design-system/styles.css";
```

The stylesheet ships the brand tokens (as CSS variables) and the Tailwind
utilities the components use. Fonts (Oswald + Archivo, as Trade Gothic
substitutes) load via a webfont `@import` inside it.

## Styling idiom — Tailwind utilities from the brand `@theme`

Style your own layout glue with Tailwind utilities. The brand tokens generate
these utilities (use them, don't invent hex values):

| Family | Real utilities |
|---|---|
| Brand color | `bg-ink` `text-ink` `border-ink` (signature navy #253746), `bg-ink-deep` (hover), `bg-navy` / `text-navy` / `ring-navy` (secondary + focus) |
| Neutrals | `text-body` (copy) `text-muted` (meta) `border-line` `border-line-subtle` `bg-surface-subtle` `bg-surface-muted` |
| Sale / status | `bg-sale` `text-sale` (clearance red #981420), `text-success`, `text-disabled` |
| Type | `font-display` (Oswald — headings/wordmarks) `font-body` (Archivo — everything else) |
| Size step | `text-2xs` (11px, fine print/eyebrows) — plus Tailwind's `text-xs…text-3xl` |
| Tracking | `tracking-cta` (buttons/nav, ~0.6px) `tracking-label` (uppercase eyebrows/badges) |

Square corners are the signature: use `rounded-none` (default for DS controls);
reserve `rounded-full` for circular chips. Eyebrows/labels are `uppercase` +
`tracking-label` in `text-2xs`.

## Where the truth lives

- Brand tokens + the full utility set: `_ds/<folder>/styles.css` (read it before styling).
- Per-component API + usage: each component's `.d.ts` and `.prompt.md`.

## Idiomatic example

A category strip — DS components for the parts, Tailwind utilities for layout:

```tsx
<NavBar brand="DENIM & CO." bagCount={2}
  links={[{ label: "Women", href: "/w", active: true }, { label: "Clearance", href: "/s", sale: true }]} />

<section className="mx-auto max-w-[1440px] px-6 py-8">
  <p className="text-2xs font-bold uppercase tracking-label text-muted">New Arrivals</p>
  <h2 className="font-display text-3xl tracking-tight text-ink">The Denim Edit</h2>
  <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
    {products.map((p) => (
      <ProductTile key={p.id} name={p.name} imageSrc={p.image}
        price={p.price} originalPrice={p.was} badge={p.isNew ? "New" : undefined}
        rating={p.rating} reviewCount={p.reviews} colors={p.colors} />
    ))}
  </div>
  <div className="mt-8 flex justify-center">
    <Button size="lg">Shop All Denim</Button>
  </div>
</section>
```
