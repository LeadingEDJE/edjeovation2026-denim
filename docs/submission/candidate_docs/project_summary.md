# Project Summary

## Project Name

Personalized Denim Fitting Experience

## Team Members

- Terry Welsh - Meat-bag as a Service
- Jeremy Fensch - Principal Human-AI Systems Architect
- Nicole Hoying - Suggestion Engineer
- Tim Williams - Splashzone Expert
- Ted Cegelka - K-pop Bug Hunter
- Wesley King - UX Specialist

## Client

Abercrombie & Fitch denim. Built for an Innovation Days submission using mocked/synthetic customer, store, stylist, schedule, appointment, and catalog data.

## Problem Statement

In-store denim fitting is still too manual for a product category where fit, rise, cut, wash, stretch, and styling intent all matter. Customers often arrive with a loose goal, but the associate has little advance context about their size profile, prior purchases, returns, preferred style, color direction, or whether they want womens, mens, or mixed-catalog options.

That creates a painful session for everyone. Customers spend more time trying random pairs and explaining themselves in the fitting room. Associates start cold, pull products reactively, and may be interrupted during normal floor coverage. Store leaders lose a chance to turn a high-consideration category into a more personal, confidence-building appointment.

The problem matters because denim fit drives purchase confidence and return risk. A guided, prepared appointment can make the store feel more valuable than generic browsing or e-commerce filters.

## Proposed Solution

The project is a guided denim fitting experience made of two surfaces: a SwiftUI customer iOS app and a React associate dashboard backed by a Fastify API, PostgreSQL, and WireMock-mocked third-party systems.

In the iOS app, a customer chooses one of three mocked stores, selects an available non-peak appointment slot, and shares concise fitting context: occasion, colors to focus on or avoid, style signals mapped to an Abercrombie muse, catalog audience preference across womens and mens products, and optional guidance. The app also supports appointment messages, cancellation, recap viewing, feedback after completion, and an optional outfit-to-match flow where a photo or manual outfit description can steer recommendations.

The associate dashboard turns that intake into preparation work. Associates can filter appointments, open a customer detail view, review fit profile and order-history context, see AI-assisted product suggestions with rationales, mark product prep as suggested, pulled, or skipped, add prep notes, message the customer, reassign stylists, check in the customer, mark no-shows, save session notes, complete the appointment, and write a customer-facing recap.

Recommendations use an Integrated AI pattern, not a core dependency. A deterministic scoring engine first ranks the seeded catalog using fit, color, catalog audience, order-history, muse, and outfit context. Claude can then re-rank the shortlist and generate per-item rationales. If Claude is unavailable or no API key is configured, the product still works through the deterministic fallback.

## Target Users

- **Primary:** Abercrombie in-store stylists and associates preparing and running guided denim appointments.
- **Secondary:** Customers booking a more personal denim fitting and communicating with their stylist.
- **Tertiary:** Store, clienteling, and retail-operations leaders evaluating appointment quality, staffing, and customer experience.

## Key Benefits

- **Prepared appointments:** Associates receive customer context, order-history signals, and product suggestions before the fitting begins.
- **Better customer experience:** Customers get a structured but lightweight booking journey, stylist assignment, messaging, recap, and feedback loop.
- **Actionable product prep:** Suggested products include rationales, prep states, associate notes, and sales-floor availability/location context.
- **Operational coverage:** The dashboard supports appointment lifecycle actions across open, in-progress, completed, cancelled, and no-show states.
- **Resilient AI assistance:** Claude re-ranking improves personalization when available, while deterministic fallback keeps the experience usable without AI.
