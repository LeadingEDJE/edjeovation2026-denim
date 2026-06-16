# design-sync notes — @denim-fit/design-system

Abercrombie-inspired design system in `packages/design-system`. Tailwind v4
(CSS-first `@theme`). Synced to claude.ai/design project "Denim Fit Design System".

## Build / sync facts
- Shape: **package**. Entry `packages/design-system/dist/index.js`; build with
  `npm run build -w @denim-fit/design-system` (tsup → dist/index.js + .d.ts, then
  `tailwindcss -i src/index.css -o dist/styles.css`).
- `--node-modules` must be the **repo root** `./node_modules` — react/react-dom/
  lucide-react are hoisted there (the package's own node_modules is sparse).
- `cssEntry: dist/styles.css` is the compiled Tailwind output (tokens + only the
  utilities the components use). Tokens are CSS vars from the `@theme` block.
- Wide components use `cardMode: column` (AnnouncementBar, Card, NavBar,
  ProductTile) — their multi-item stories overflow a grid cell otherwise.

## Known render warns (triaged, not new)
- **IconButton — `[RENDER_THIN]` ("no text")**: benign. IconButton is icon-only
  (no text by design); the 4 utility icons paint correctly in the screenshot.

## Re-sync risks / watch-list
- **Webfonts are remote** (`[FONT_REMOTE]`): Oswald + Archivo load via a Google
  Fonts `@import` in `src/fonts.css`. Designs render in fallback fonts if the
  font host is unreachable. To make the bundle self-contained, self-host the
  woff2 and point `cfg.extraFonts` at an `@font-face` css.
- Preview product/editorial imagery uses inline SVG data-URIs (offline-safe), not
  real product photography.
- The web app (`apps/web`) now adopts these tokens; its bespoke palette was
  replaced. A token rename here restyles the dashboard.
