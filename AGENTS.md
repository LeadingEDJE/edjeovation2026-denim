# AGENTS.md - Submission Documentation

This file instructs AI coding agents on how to keep the **Innovation Days
submission artifacts** accurate as the project evolves.

The submission docs are maintained directly in `docs/submission/`. There is no
generated-docs tree and no workflow that regenerates submission docs. Do not
create `docs/submission/generated_docs/`, and do not reintroduce an automated
submission-doc generation workflow unless explicitly requested.

---

## Project quick facts (ground truth - do not re-derive)

Use these instead of guessing. Verify against the repo before writing; correct
this list in the same PR if it has drifted.

- **Project:** Personalized Denim Fitting Experience - guided in-store denim
  fitting for Abercrombie women's, with an associate dashboard and a customer
  iOS app.
- **Monorepo layout:**
  - `apps/api` - Fastify + TypeScript API; talks to PostgreSQL and the mocked
    third-party services.
  - `apps/web` - React 19 + Vite associate dashboard (appointment prep,
    lifecycle actions, messaging, recaps, product prep). Uses Tailwind CSS 4 and
    the local `@denim-fit/design-system` package.
  - `apps/ios` - SwiftUI customer app (store/slot selection, fit profile,
    messaging, feedback).
  - `packages/` - shared workspaces (e.g. `design-system`).
  - `infra/db` - PostgreSQL schema + catalog seed.
  - `infra/wiremock` - simulated third-party APIs (customers, order history,
    stores, stylist profiles, weekly schedules).
- **AI usage - hybrid recommendation pipeline:**
  - Stage 1: deterministic rule-based scoring - `apps/api/src/recommendation-scoring.ts`.
  - Stage 2: **Claude re-ranking** - `apps/api/src/claude-reranker.ts`, using the
    `@anthropic-ai/sdk`. Default model `claude-opus-4-8` (`RECOMMENDER_MODEL`).
    Orders the shortlist for the specific customer and writes a per-item
    rationale. Uses **prompt caching** on the stable system prompt.
  - **Graceful fallback:** if no `ANTHROPIC_API_KEY` is set or the call fails,
    the endpoint returns the rule-based order with scorer-derived reasons. So the
    product works without AI - classify dependency as **Integrated**, not Core.
  - Supports an Anthropic-compatible proxy (e.g. LiteLLM) via `ANTHROPIC_BASE_URL`.
- **AI tooling used by the team:** Codex, Claude, Claude Design, and NotebookLM
  were used during project development, design exploration, research synthesis,
  and submission-document preparation. These are development/submission tools,
  not runtime app dependencies.
- **Data sources (all mocked/synthetic for the hackathon):**
  - Customers, order history, stores, stylists, schedules -> WireMock fixtures in
    `infra/wiremock/`.
  - Product catalog -> `catalog_products` table seeded from a scraped
    Abercrombie catalog (`infra/db/`).
  - Appointments -> `appointments` table in PostgreSQL.
- **Stack:** TypeScript, Fastify, React 19, Vite, Tailwind CSS 4, PostgreSQL 16,
  WireMock, Docker Compose (with a hot-reload dev override), Biome, Vitest,
  Playwright, Husky git hooks, GitHub Actions CI, SwiftUI (iOS).
- **Local URLs:** web `http://localhost:5173`, API `http://localhost:4000`
  (`/docs`, `/openapi.json`), WireMock admin `http://localhost:8080/__admin`.

---

## The submission artifacts

Submission artifacts live directly under `docs/submission/`:

| File | Purpose | Primary repo sources |
|---|---|---|
| `docs/submission/project_summary.md` | Non-technical front door: problem, solution, users, key benefits | `README.md`, `QUICKSTART.md`, `docs/requirements/`, web/iOS features |
| `docs/submission/architecture_overview.md` | Architecture, tech stack, AI models/tools, data sources, limitations | `apps/**`, `infra/**`, `docker-compose*.yml`, `packages/**`, `apps/api/src/**` |
| `docs/submission/ai_usage_explanation.md` | Where/why AI is used, tooling used, dependency level, responsible-AI | `apps/api/src/claude-reranker.ts`, `recommendation-scoring.ts`, `config.ts` |
| `docs/submission/market_impact_statement.md` | Persona, ROI, competitive alternatives, timing | `docs/requirements/`, `README.md`, product features |
| `docs/submission/pitch_deck.md` | 5-7 slide summary | All of the above (it's a digest) |
| `docs/submission/demo/demo_walkthrough.md` | Annotated walkthrough of key user flows / demo link | `apps/web/**`, `apps/ios/**`, `README.md` "Current Workflow" |

---

## Editing guidance

- Update the relevant submission docs directly in `docs/submission/`.
- Preserve human edits and avoid unrelated rewrites.
- Follow the existing section structure in each file and honor any word limits
  already stated in the document.
- When product scope, architecture, AI behavior, or user flows change, update
  any affected summary/digest docs so the story remains consistent.
- Do not fabricate facts. No invented metrics, customers, benchmarks, or
  performance numbers. Label ROI/impact figures as estimates with assumptions.
- Do not claim production-readiness. Data is mocked/synthetic; say so.
- Do not overstate AI dependency. The runtime recommendation dependency is
  **Integrated** because deterministic fallback keeps the product working.
- No secrets. Never read or echo `.env`, API keys, or tokens into docs.

## Per-doc reminders

- **project_summary.md** - Lead with the in-store fitting problem for
  Abercrombie associates/customers. Solution = associate dashboard + iOS app +
  AI-assisted product suggestions. Primary user: in-store stylist/associate;
  secondary: the customer; tertiary: store/retail ops. Keep it jargon-free.
- **architecture_overview.md** - Describe the monorepo and request/data flow
  (iOS/web -> Fastify API -> PostgreSQL + WireMock-mocked third parties). In
  **AI Models / Tools**, include both runtime AI and team AI tooling.
- **ai_usage_explanation.md** - Walk the recommendation pipeline, Claude
  re-ranking and rationales, prompt caching, Integrated dependency level,
  Responsible AI considerations, and team AI tooling used for development and
  submission preparation.
- **market_impact_statement.md** - Persona = retail store/clienteling leader or
  in-store stylist. Quantify ROI only as clearly labeled estimates with stated
  assumptions.
- **pitch_deck.md** - Keep it a digest of the other docs; don't introduce new
  unsupported claims.
- **demo/demo_walkthrough.md** - Narrate the happy path: associate opens the Open
  view -> selects an appointment -> reviews AI suggestions + rationale -> preps
  products / messages / completes.

## Team Members

Do not invent names. Use:

- Terry Welsh - Meat-bag as a Service
- Jeremy Fensch - Principal Human-AI Systems Architect
- Nicole Hoying - Suggestion Engineer
- Tim Williams - Splashzone Expert
- Ted Cegelka - K-pop Bug Hunter
- Wesley King - UX Specialist
