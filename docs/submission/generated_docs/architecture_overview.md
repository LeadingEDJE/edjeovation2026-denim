# Architecture & Feasibility Overview

## High-Level Architecture

The system is a TypeScript monorepo (npm workspaces) with three clients/services
around a shared API and database:

```
  iOS app (SwiftUI)  ─┐
                      ├──HTTP──▶  Fastify API (apps/api) ──▶ PostgreSQL (appointments, catalog_products)
  Web dashboard ──────┘                  │
  (React + Vite)                         └──HTTP──▶ Mocked third-party services (WireMock)
                                                      customers · order history · stores · stylists · schedules
                                         │
                                         └──HTTPS──▶ Claude (re-ranking) via LiteLLM gateway / Anthropic SDK
```

- **Clients:** the SwiftUI iOS app (customer booking, intake, messaging, recap,
  feedback) and the React/Vite associate dashboard (appointment prep, lifecycle
  actions, messaging, product prep, recaps) both call the same API.
- **API (`apps/api`):** a Fastify service that persists appointments to
  PostgreSQL, queries the `catalog_products` table for candidates, calls the
  mocked third-party services for customer/order/store/stylist data, and runs the
  two-stage recommendation pipeline. Exposes OpenAPI docs at `/docs`.
- **Data flow for a booking:** client submits intake + slot + catalog selection
  (womens, mens, or both) → API assigns a stylist, maps a Muse tag, summarizes
  order history, **inserts the appointment with an empty suggestion list in
  status `pending` and returns confirmation immediately** → a fire-and-forget
  background task runs the two-stage recommender and writes the products back to
  the row, flipping `suggestions_status` to `ready` (or `failed` on error) →
  associate dashboard reads it for prep, polling
  `GET /api/appointments/:appointmentId` every ~2.5s while a row is `pending`
  so freshly-generated picks appear without a manual refresh → lifecycle actions
  (check-in, complete, etc.) and messages mutate the same record. The
  regenerate-suggestions and attach-outfit-analysis flows follow the same
  pattern: the row is set to `pending` (existing products stay visible), the
  endpoint returns, and the re-rank runs in the background.

## Technologies Used

- **Frontend (web):** React 19, Vite, Tailwind CSS 4, a local
  `@denim-fit/design-system` workspace package.
- **Frontend (mobile):** SwiftUI (iOS), targeting the Xcode simulator.
- **Backend:** Node.js + TypeScript, Fastify, `@fastify/swagger` (OpenAPI).
- **Database:** PostgreSQL 16 (`appointments`, `catalog_products`).
- **Third-party simulation:** WireMock (templated JSON fixtures).
- **AI SDK:** `@anthropic-ai/sdk`, optionally routed through a LiteLLM gateway.
- **Local orchestration:** Docker Compose, with a hot-reload dev override. The
  override also runs a small Alpine sidecar that watches the bind-mounted
  `infra/wiremock/` tree and POSTs `/__admin/mappings/reset` on change, so
  edited stubs/fixtures take effect without restarting the WireMock container.
  API startup runs the idempotent database migration, refreshes the catalog
  snapshot, and seeds deterministic local appointment history for demo/testing.
- **Quality/tooling:** Biome (format/lint), Vitest (unit), Playwright (e2e),
  Husky git hooks, GitHub Actions CI.
- **Cloud (provisioning defined):** Azure Container Apps (api, web, wiremock),
  Azure Container Registry, and Azure Database for PostgreSQL Flexible Server,
  described in `infra/azure/*.bicep`.

## AI Models / Tools Leveraged

- **Model:** Claude (default `claude-opus-4-8` via the native API, or a model the
  configured LiteLLM gateway serves, e.g. `claude-opus-4.7`). **Provider:**
  Anthropic (directly or through an Anthropic-compatible LiteLLM proxy).
- **What it does:** the second stage of the recommendation pipeline
  (`apps/api/src/claude-reranker.ts`). Given the rule-based shortlist plus the
  customer's fit profile, color context, and Muse, Claude re-orders the
  candidates for the specific customer and writes a short per-item rationale.
  Prompt caching is applied to the stable system prompt.
- **Shortlist shaping (no AI):** before re-ranking, the API picks the candidate
  pool based on the outfit-piece intents — a category-diverse shortlist by
  default, or a category-restricted top-N (`rankCandidates`) when every active
  piece is tagged `"similar"` so suggestions stay in like categories.

## Data Sources

| Source | Contents | Real / Mocked / Synthetic | Status |
|---|---|---|---|
| WireMock fixtures (`infra/wiremock/`) | Customers, order history, stores, stylist profiles, weekly schedules | Mocked | Available locally |
| `catalog_products` (PostgreSQL, seeded `infra/db/`) | Abercrombie womens/mens catalog snapshot (name, category, catalog audiences, fit/rise/stretch, price, image URL) | Synthetic (scraped/seeded snapshot) | Available locally |
| `appointments` (PostgreSQL) | Bookings, intake, assigned stylist, suggestions (with `suggestions_status` lifecycle: `pending`/`ready`/`failed`), lifecycle state, messages, recaps | Mixed: app-generated plus deterministic synthetic local seed history | Available locally |
| Anthropic / LiteLLM | Re-ranking + rationale generation | Real external call | Optional; falls back to rule-based |

## Known Limitations & Risks

- **No authentication / identity model.** A mocked "current user" stands in for
  login; consent and privacy handling for measurements is not implemented.
- **Mocked third parties.** Customer, order, store, and stylist data come from
  WireMock; there is no live integration or inventory/availability check. The
  regenerate-suggestions path tolerates a failed third-party customer lookup by
  falling back to the customer snapshot stored in the appointment's
  `source_payload` at booking time, but a real production deployment would still
  need a stable identity source.
- **Catalog is a seeded snapshot**, not a live feed, and may drift from the real
  assortment; sizing rules are simplified and catalog-audience tags are inferred
  from the scraped Abercrombie category path.
- **Appointment history is demo seed data locally.** Historical bookings,
  messages, notifications, feedback, and prep states are deterministic and tied
  to the mocked users/stylists/stores, but they are not real customer records.
- **Single emulated store**, non-peak scope only; stylist-assignment rules are
  basic.
- **AI dependency is bounded** — if the model/gateway is unavailable the engine
  returns the deterministic rule-based ranking, so prep still works, but rationale
  quality is reduced. Some LiteLLM→Bedrock gateway configs reject structured
  output, which the code handles defensively.
- **Background suggestion generation is best-effort.** Suggestion generation
  runs as a fire-and-forget task on the API process: a server crash or restart
  before the task finishes can leave a row stuck on `suggestions_status =
  'pending'` (no durable job queue or retry); the stylist can recover with the
  regenerate-suggestions action, which re-queues the work. The dashboard polls
  every ~2.5s while a row is pending, which is fine at hackathon scale but would
  need replacing with a push channel (e.g. SSE/WebSocket) and a real job
  runner for production load.
- **Notifications are mock records** (no real email/push delivery).
- **Cloud deployment is defined in Bicep but not a hardened, production
  environment** (secrets, scaling, networking would need review).
