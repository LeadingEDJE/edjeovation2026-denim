# @denim-fit/design-system

An **Abercrombie-inspired** design system: original React components in a clean,
editorial retail aesthetic — deep slate-navy brand color, square corners,
generous whitespace, and a condensed, lightly-tracked grotesque type system.

> Original work inspired by the visual language of abercrombie.com. It does not
> copy Abercrombie's proprietary components, brand assets, logos, or photography.

## Usage

```tsx
import { Button, ProductTile } from "@denim-fit/design-system";
import "@denim-fit/design-system/styles.css";

<Button variant="primary" size="lg">Add to Bag</Button>;
```

## Styling idiom

Built with **Tailwind v4 (CSS-first)**. Brand tokens live in a `@theme` block in
`src/theme.css` and generate real utilities: colors (`bg-ink`, `text-sale`,
`border-line`), fonts (`font-display`, `font-body`), the extra `text-2xs` step,
and tracking (`tracking-cta`, `tracking-label`). Components compose these
utilities directly.

- **In an app that already runs Tailwind v4** (like `apps/web`): `@import` the
  shared theme and add the package as a `@source` so its utilities compile into
  your one stylesheet — see the monorepo note below.
- **Anywhere else**: import the precompiled `dist/styles.css`.

## Components

`Button`, `IconButton`, `Badge`, `Price`, `ColorSwatch`, `Rating`,
`ProductTile`, `Card`, `TextField`, `AnnouncementBar`, `NavBar`.

## Build

```sh
npm run build   # tsup → dist/index.js + dist/index.d.ts, then dist/styles.css
```
