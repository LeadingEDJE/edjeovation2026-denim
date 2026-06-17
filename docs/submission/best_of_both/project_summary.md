# Project Summary

## Project Name

Personalized Denim Fitting Experience

## Team Members

<!-- TODO: team members and roles -->

## Client

Abercrombie & Fitch denim. Built for an Innovation Days submission using mocked/synthetic customer, store, stylist, schedule, appointment, and catalog data.

## Problem Statement

In-store denim fitting is still too manual for a category where rise, cut, wash, stretch, sizing, and styling intent all affect confidence. Customers arrive with goals, fit concerns, color preferences, prior purchases, and sometimes an outfit they want to build around, but the associate usually has little advance context.

That creates trial-and-error sessions for customers and reactive rack pulling for associates. Store teams also lose a chance to turn denim into a prepared clienteling moment, especially when floor coverage interrupts fittings or a less experienced associate owns the appointment.

The problem matters because denim fit is closely tied to purchase confidence and return risk. A guided, prepared appointment can make the store feel more valuable than generic browsing, e-commerce filters, or a cold walk-in fitting room.

## Proposed Solution

The project is a guided denim fitting experience with a SwiftUI customer iOS app, a React associate dashboard, and a Fastify API backed by PostgreSQL and WireMock-mocked third-party systems.

In the iOS app, a customer chooses one of three mocked stores, selects a non-peak appointment slot, and shares concise fitting context: occasion, colors to focus on or avoid, style signals mapped to an Abercrombie Muse, catalog audience preference across womens and mens products, and optional guidance. The app also supports appointment messages, cancellation, recap viewing, post-visit feedback, editable fit profile context, and an optional outfit-to-match flow where a photo or manual description can steer recommendations.

The associate dashboard turns that intake into preparation work. Associates can filter Open, In Progress, Completed, Cancelled, and No-show appointments; open a customer detail view; review fit profile and order-history context; see AI-assisted product suggestions with rationales and mocked sales-floor location labels; mark product prep as suggested, pulled, or skipped; add prep notes; message the customer; reassign eligible same-store stylists; check in customers; mark no-shows; save session notes; complete appointments; and write a customer-facing recap.

Recommendations use an Integrated AI pattern. Deterministic scoring first ranks the seeded catalog using fit, color, catalog audience, order-history, Muse, and outfit context. Claude can then re-rank the shortlist and generate per-item rationales. If Claude is unavailable, the product still works through deterministic fallback.

## Target Users

- **Primary:** Abercrombie in-store stylists and associates preparing and running guided denim appointments.
- **Secondary:** Customers booking a more personal denim fitting and communicating with their stylist.
- **Tertiary:** Store, clienteling, and retail-operations leaders evaluating appointment quality, staffing, and customer experience.

## Key Benefits

- **Prepared appointments:** Associates receive customer context, order-history signals, and product suggestions before the fitting begins.
- **Better customer experience:** Customers get a lightweight booking journey, stylist assignment, messaging, recap, cancellation, and feedback loop.
- **Actionable product prep:** Suggested products include rationales, prep states, associate notes, and mocked sales-floor availability/location context.
- **Operational coverage:** The dashboard supports appointment lifecycle work across open, in-progress, completed, cancelled, and no-show states.
- **Resilient AI assistance:** Claude re-ranking improves personalization when available, while deterministic fallback keeps the experience usable without AI.
