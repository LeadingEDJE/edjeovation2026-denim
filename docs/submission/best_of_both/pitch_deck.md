# Pitch Deck — Personalized Denim Fitting Experience

## Slide 1 — Problem

In-store denim fitting is hard to personalize before the customer arrives.

- Customers bring fit goals, style preferences, color constraints, order history, and sometimes a specific outfit they want to build around.
- Associates often start without that context, then spend appointment time discovering needs, finding sizes, and pulling alternatives.
- Denim fit is especially high-friction because rise, cut, stretch, waist, and length can all change the outcome.
- Peak-hour store traffic makes a curated fitting harder to deliver consistently.

## Slide 2 — Solution

A guided fitting experience that prepares both sides before the appointment.

- The iOS customer app lets shoppers choose one of three mocked stores, pick a guided fitting slot, share occasion/color/style signals, select catalog audience, optionally add outfit-to-match context, message the appointment thread, cancel, read a recap, and submit feedback.
- The associate dashboard gives store teams a live appointment queue with Open, In Progress, Completed, Cancelled, and No-show views.
- Associates review customer context, assigned stylist, order-history summary, AI-assisted product suggestions, rationales, sales-floor labels, prep states, messages, notifications, session notes, recaps, and feedback.

## Slide 3 — How It Works

Customer and associate apps share one local demo backend.

- SwiftUI iOS app and React/Vite associate dashboard call a Fastify + TypeScript API.
- PostgreSQL stores appointments, messages, notification records, fit-profile overrides, product prep status, recaps, feedback, and the seeded womens/mens catalog.
- WireMock simulates third-party customer profiles, order history, store data, stylist profiles, weekly schedules, and store inventory for three mocked stores.
- Appointment booking assigns an eligible same-store stylist for the selected slot, creates mock confirmation/reminder records, returns immediately, and starts recommendation generation in the background.
- Implemented lifecycle: scheduled, checked in, completed, cancelled, and no-show.

## Slide 4 — AI Highlight

AI is used as an Integrated enhancement, not a hard dependency.

- Stage 1: deterministic scoring ranks known catalog products using fit, stretch, waist, length, focus colors, avoid colors, selected catalog audience, and category diversity.
- Stage 2: Claude re-ranks the shortlist and writes concise rationales for the associate, constrained to provided product IDs.
- Default model: `claude-opus-4-8` through `@anthropic-ai/sdk`, with optional Anthropic-compatible proxy support via `ANTHROPIC_BASE_URL`.
- Prompt caching is used for stable system prompts.
- If no API key is configured or the model call fails, the app falls back to the rule-based order with scorer-derived reasons.
- Optional outfit photo analysis can turn a customer-provided image into text-only pairing context; image bytes are not persisted.

## Slide 5 — Business Value

Illustrative impact, based on demo assumptions rather than measured production results.

- For associates: fewer cold starts and clearer prep before the customer arrives.
- For customers: a more guided appointment that starts from their goals, history, style signals, messages, and post-visit recap.
- For store leaders: a structured queue for non-peak guided fittings, stylist assignment/reassignment, lifecycle tracking, prep accountability, and session feedback.
- Estimated time savings: if product prep discovery drops by 10 minutes per appointment, 6 guided appointments per week would recover about 1 associate hour weekly per participating store.
- Competitive alternative today is manual prep or generic clienteling notes that do not combine fit profile, order history, store inventory, appointment context, and AI-assisted rationale in one workflow.

## Slide 6 — Team

<!-- TODO: team members and roles -->
