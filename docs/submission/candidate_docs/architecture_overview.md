# Architecture & Feasibility Overview

## High-Level Architecture

Personalized Denim Fitting Experience is a monorepo with a shared Fastify API serving two user experiences: a React associate dashboard and a SwiftUI iOS customer app. The backend persists appointment state and catalog data in PostgreSQL, and it calls WireMock to simulate the third-party systems that would normally provide customers, order history, stores, stylist profiles, schedules, and sales-floor inventory.

```text
SwiftUI iOS app ─┐
                 ├── HTTP/JSON ──> Fastify API ──> PostgreSQL
React web app ───┘                 apps/api       appointments, messages,
apps/web                                            notifications, catalog

                                   ├── HTTP ──> WireMock mocked services
                                   │           customers, orders, stores,
                                   │           stylists, schedules, inventory
                                   │
                                   └── HTTPS ─> Claude via @anthropic-ai/sdk
                                               optional reranking and outfit analysis
```

The implemented scope covers customer booking in the iOS app, associate appointment prep in the web dashboard, three mocked stores, womens/mens catalog audience selection, appointment lifecycle actions, two-way appointment messages, suggested-product prep status, customer-visible recaps, internal associate feedback, post-appointment customer feedback, deterministic recommendation fallback, Claude re-ranking, and optional outfit-to-match analysis.

## How do the components connect?

- `apps/ios` is the customer-facing SwiftUI app. It calls the API for the mocked current user, fit-profile updates, store and slot selection, appointment booking, upcoming/past appointment detail, cancellation, messaging, feedback, and optional outfit analysis.
- `apps/web` is the associate dashboard. It calls the same API to list and filter appointments, open an appointment detail view, reassign stylists, check in customers, mark no-shows, save session notes, manage product prep, send messages, complete appointments, and review recaps.
- `apps/api` is a Node.js/TypeScript Fastify service. It exposes OpenAPI docs at `/docs` and `/openapi.json`, reads and writes PostgreSQL, fetches mocked third-party data from WireMock, and orchestrates recommendations.
- `infra/db` defines PostgreSQL schema and seeded catalog data. `appointments`, `appointment_messages`, `appointment_notifications`, `customer_fit_profile_overrides`, and `catalog_products` are the core tables.
- `infra/wiremock` provides local HTTP fixtures for mocked customers, order histories, stores, stylists, schedule patterns, and store inventory.
- `packages/design-system` provides shared React UI primitives and styling for the web app.
- Docker Compose runs the local web, API, PostgreSQL 16, and WireMock services. Azure Bicep files describe a possible Container Apps, Container Registry, and PostgreSQL Flexible Server deployment, but the project should still be treated as hackathon/demo infrastructure rather than production-hardened infrastructure.

## What does data flow look like?

1. The customer opens the iOS app, selects a catalog audience (`womens`, `mens`, or both), optionally adds an outfit-to-match, selects one of the three mocked stores, and books a generated slot.
2. The iOS app posts the appointment request to the Fastify API.
3. The API loads the mocked active customer, stores, schedule patterns, stylist list, and order history from WireMock. It validates the selected store/slot, assigns an eligible stylist, maps style keywords to a Muse tag, summarizes order history, and inserts the appointment into PostgreSQL with `suggestions_status = 'pending'`.
4. The API returns the booking immediately. A fire-and-forget background task builds suggestions, stores them on the appointment, and flips `suggestions_status` to `ready` or `failed`.
5. Suggestion generation queries `catalog_products`, filters by selected catalog audience, applies deterministic scoring, optionally calls Claude to re-rank the shortlist and generate rationales, enriches products with mocked sales-floor inventory/location data, and writes the result back to PostgreSQL.
6. The web dashboard lists appointment rows from PostgreSQL and polls selected pending appointments until suggestion generation finishes. Associates can update lifecycle state, messages, session notes, prep status (`suggested`, `pulled`, `skipped`), recap, and internal feedback.
7. The iOS app reads upcoming/past appointment state, messaging threads, customer recaps, and feedback state from the same API.

Optional outfit-to-match flow: the iOS app can send a downscaled base64 image to `/api/outfit-analysis`. The API uses Claude to produce a text-only outfit analysis, suggested colors/keywords, pairing context, and optionally a hidden body-shape signal when the customer explicitly marks the photo as themselves. The image bytes are not stored; only the normalized text analysis can be persisted on the appointment and used to regenerate recommendations.

## Technologies Used

- **Monorepo/package management:** npm workspaces.
- **Web frontend:** React 19, Vite, TypeScript, Tailwind CSS 4, `lucide-react`, local `@denim-fit/design-system`.
- **Mobile frontend:** SwiftUI iOS app, Xcode simulator support, configurable API base URL.
- **Backend:** Node.js, TypeScript, Fastify 5, `@fastify/cors`, `@fastify/swagger`, `@fastify/swagger-ui`, Zod.
- **Database:** PostgreSQL 16 with SQL schema and seed files in `infra/db`.
- **Mocked third-party APIs:** WireMock with mappings and JSON fixtures in `infra/wiremock`.
- **AI integration:** `@anthropic-ai/sdk`, with optional `ANTHROPIC_BASE_URL` for an Anthropic-compatible proxy such as LiteLLM.
- **Local orchestration:** Docker Compose with a development override for API/web hot reload and WireMock fixture reloading.
- **Testing/tooling:** Biome, Vitest, Playwright, Husky, GitHub Actions CI.
- **Cloud provisioning:** Azure Bicep definitions for Azure Container Apps, Azure Container Registry, Log Analytics, managed identity, and Azure Database for PostgreSQL Flexible Server.

## AI Models / Tools Leveraged

| Model / Tool | Provider | Where used | Role |
|---|---|---|---|
| Claude, configured by `RECOMMENDER_MODEL` and defaulting in code to `claude-opus-4-8` | Anthropic, directly or through an Anthropic-compatible proxy | `apps/api/src/claude-reranker.ts` | Re-ranks a deterministic product shortlist and writes concise per-item rationales. |
| Claude vision/message API, same configured model | Anthropic, directly or through an Anthropic-compatible proxy | `apps/api/src/outfit-analysis.ts` | Optional outfit-to-match analysis from an uploaded image; returns text-only garment, color, style, and pairing context. |
| Deterministic recommendation scorer | Local TypeScript rules, not AI | `apps/api/src/recommendation-scoring.ts` | Scores catalog products by fit, stretch, waist, length, focus colors, avoid colors, and category diversity before any Claude call. |

The AI dependency level is integrated, not core. If `ANTHROPIC_API_KEY` is missing or the Claude call fails, recommendation endpoints still return usable products in deterministic rule-based order with scorer-derived rationales. Outfit analysis similarly falls back to a sample analysis so the demo flow remains usable offline. Claude prompts are constrained to known catalog candidates and use prompt caching on stable system prompts.

## Data Sources

| Source | Data | Real, mocked, or synthetic | Current status |
|---|---|---|---|
| PostgreSQL `catalog_products` | Abercrombie womens/mens catalog snapshot with product metadata, images, prices, categories, audience tags, colors, sizes, fit/rise/stretch, and raw scraped payload | Synthetic seeded snapshot from scraped catalog data | Available locally via `infra/db/seed-catalog.sql` |
| PostgreSQL `appointments` | Bookings, store snapshot, stylist assignment, style context, catalog audiences, order-history summary, suggested products, suggestion lifecycle, outfit analysis, session notes, recap, feedback, status timestamps | App-generated demo data plus deterministic local seed history | Available locally |
| PostgreSQL `appointment_messages` | Customer/associate appointment thread messages | App-generated demo data | Available locally |
| PostgreSQL `appointment_notifications` | Mock confirmation and reminder records | Mocked records; no actual email or push delivery | Available locally |
| PostgreSQL `customer_fit_profile_overrides` | Local measurement/preference overrides layered over mocked users | App-generated mock data | Available locally |
| WireMock customers and active user | Mock customer identities, measurements, preferences, loyalty IDs | Mocked/synthetic | Available locally |
| WireMock order history | Standard, denim-heavy, returns, empty, and error scenarios | Mocked/synthetic | Available locally |
| WireMock stores | SoHo, Columbus/Easton, and Los Angeles/Century City stores | Mocked/synthetic | Available locally |
| WireMock stylist profiles and schedules | Stylist specialties, supported fits, availability, and weekly schedule patterns | Mocked/synthetic | Available locally |
| WireMock store inventory | Product availability, quantity, low-stock flag, and location labels | Mocked/synthetic | Available locally |
| Anthropic or compatible gateway | Claude re-ranking and optional image analysis | Real external AI service when configured | Optional; fallback exists |

## Known Limitations & Risks

- The system has no production authentication, authorization, consent management, or durable customer identity model. A mocked active user and local admin switching stand in for login.
- Third-party integrations are simulated with WireMock. Customer data, order history, store inventory, stylist availability, and schedule patterns are not connected to real enterprise systems.
- Catalog data is a seeded scraped snapshot, not a live product feed. Prices, availability, images, size runs, and audience classification can drift from the real assortment.
- Suggestions run in a fire-and-forget background task inside the API process. A server crash or restart during generation could leave an appointment pending until a user retries regeneration; there is no durable job queue.
- Polling is used to approximate real-time updates for selected pending appointments and dashboard state. Production would likely need WebSocket/SSE updates and stronger concurrency handling.
- AI output is constrained and optional, but it can still be unavailable, slow, or lower quality than the deterministic ranking. The fallback preserves function but reduces personalization and rationale quality.
- Outfit analysis stores only text, not images, but production use would still need explicit privacy review, retention policy, and careful handling for body-related inferences.
- Notifications are database records only. There is no real email, SMS, or push delivery.
- The local demo is scoped to three mocked stores and non-peak guided fitting flows. It does not model full workforce scheduling, inventory reservation, checkout, returns, or omnichannel fulfillment.
- Azure infrastructure is defined as a deployment path, but secrets, networking, observability, scaling, backup/restore, and compliance controls would need hardening before production.
