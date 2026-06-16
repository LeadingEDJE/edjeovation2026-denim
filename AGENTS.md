# AGENTS.md — Submission Documentation Generation

This file instructs AI coding agents (Claude Code and the automated PR workflow)
on how to keep the **Innovation Days submission artifacts** in `docs/submission/`
accurate as the project evolves.

A GitHub Actions workflow (`.github/workflows/generate-submission-docs.yml`)
invokes an agent on every pull request. The agent reads this file, determines
which submission docs are affected by the PR's changes, regenerates **only those
docs**, and commits the result back to the PR branch.

> **Important:** The files in `docs/submission/` currently contain the *template
> instructions* (the required sections), not real content. The first time the
> agent runs against a doc, it should **replace** the template with a real
> drafted document that follows the section structure the template describes.

---

## Project quick facts (ground truth — do not re-derive)

Use these instead of guessing. Verify against the repo before writing; correct
this list in the same PR if it has drifted.

- **Project:** Personalized Denim Fitting Experience — guided in-store denim
  fitting for Abercrombie women's, with an associate dashboard and a customer
  iOS app.
- **Monorepo layout:**
  - `apps/api` — Fastify + TypeScript API; talks to PostgreSQL and the mocked
    third-party services.
  - `apps/web` — React 19 + Vite associate dashboard (appointment prep,
    lifecycle actions, messaging, recaps, product prep). Uses Tailwind CSS 4 and
    the local `@denim-fit/design-system` package.
  - `apps/ios` — SwiftUI customer app (store/slot selection, fit profile,
    messaging, feedback).
  - `packages/` — shared workspaces (e.g. `design-system`).
  - `infra/db` — PostgreSQL schema + catalog seed.
  - `infra/wiremock` — simulated third-party APIs (customers, order history,
    stores, stylist profiles, weekly schedules).
- **AI usage — hybrid recommendation pipeline:**
  - Stage 1: deterministic rule-based scoring — `apps/api/src/recommendation-scoring.ts`.
  - Stage 2: **Claude re-ranking** — `apps/api/src/claude-reranker.ts`, using the
    `@anthropic-ai/sdk`. Default model `claude-opus-4-8` (`RECOMMENDER_MODEL`).
    Orders the shortlist for the specific customer and writes a per-item
    rationale. Uses **prompt caching** on the stable system prompt.
  - **Graceful fallback:** if no `ANTHROPIC_API_KEY` is set or the call fails,
    the endpoint returns the rule-based order with scorer-derived reasons. So the
    product works without AI — classify dependency as **Integrated**, not Core.
  - Supports an Anthropic-compatible proxy (e.g. LiteLLM) via `ANTHROPIC_BASE_URL`.
- **Data sources (all mocked/synthetic for the hackathon):**
  - Customers, order history, stores, stylists, schedules → WireMock fixtures in
    `infra/wiremock/`.
  - Product catalog → `catalog_products` table seeded from a scraped Abercrombie
    women's catalog (`infra/db/`).
  - Appointments → `appointments` table in PostgreSQL.
- **Stack:** TypeScript, Fastify, React 19, Vite, Tailwind CSS 4, PostgreSQL 16,
  WireMock, Docker Compose (with a hot-reload dev override), Biome, Vitest,
  Playwright, Husky git hooks, GitHub Actions CI, SwiftUI (iOS).
- **Local URLs:** web `http://localhost:5173`, API `http://localhost:4000`
  (`/docs`, `/openapi.json`), WireMock admin `http://localhost:8080/__admin`.

---

## The submission artifacts

| File | Purpose | Primary repo sources |
|---|---|---|
| `docs/submission/project_summary.md` | Non-technical front door: problem, solution, users, key benefits | `README.md`, `QUICKSTART.md`, `docs/requirements/`, web/iOS features |
| `docs/submission/architecture_overview.md` | Architecture, tech stack, AI models, data sources, limitations | `apps/**`, `infra/**`, `docker-compose*.yml`, `packages/**`, `apps/api/src/**` |
| `docs/submission/ai_usage_explanation.md` | Where/why AI is used, dependency level, responsible-AI | `apps/api/src/claude-reranker.ts`, `recommendation-scoring.ts`, `config.ts` |
| `docs/submission/market_impact_statement.md` | Persona, ROI, competitive alternatives, timing | `docs/requirements/`, `README.md`, product features |
| `docs/submission/pitch_deck.md` | 5–7 slide summary (optional) | All of the above (it's a digest) |
| `docs/submission/demo/demo_walkthrough.md` | Annotated walkthrough of key user flows / demo link | `apps/web/**`, `apps/ios/**`, `README.md` "Current Workflow" |

Each template lists **Required sections** — follow that structure exactly,
including any stated word limits (e.g. Problem Statement ≤ 200 words, Proposed
Solution ≤ 300 words in `project_summary.md`).

---

## Relevance mapping — which docs a PR should regenerate

The workflow regenerates a doc **only if the PR touches files that feed it.**
Use this mapping; when in doubt, include the doc rather than skip it.

| If the PR changes… | Regenerate |
|---|---|
| `apps/api/src/claude-reranker.ts`, `recommendation-scoring.ts`, `config.ts`, any prompt text | `ai_usage_explanation.md`, `architecture_overview.md` |
| `apps/api/**` (other), `infra/**`, `docker-compose*.yml`, `packages/**`, dependency/build config | `architecture_overview.md` |
| `infra/wiremock/**`, `infra/db/**` (data sources) | `architecture_overview.md` (Data Sources section) |
| `apps/web/**`, `apps/ios/**` (user-facing flows/features) | `project_summary.md`, `demo/demo_walkthrough.md` |
| `README.md`, `QUICKSTART.md`, `docs/requirements/**` | `project_summary.md`, `market_impact_statement.md` |
| Changes to product scope / value proposition (new feature areas) | `market_impact_statement.md`, `project_summary.md` |
| Any of the above materially changes the story | `pitch_deck.md` (keep it a digest of the others) |

If a PR touches **only** `docs/submission/**`, tests, CI config, or formatting,
regenerate **nothing** — exit cleanly.

---

## How to generate each doc (per-doc guidance)

General approach for every doc:
1. Read the existing file. If it's still the template, replace it; if it's real
   content, **update in place** — preserve human edits and only revise sections
   the PR actually affects.
2. Read the listed primary sources from the repo to gather facts.
3. Write to the template's required section structure and honor word limits.

- **project_summary.md** — Lead with the in-store fitting problem for
  Abercrombie associates/customers. Solution = associate dashboard + iOS app +
  AI-assisted product suggestions. Primary user: in-store stylist/associate;
  secondary: the customer; tertiary: store/retail ops. Keep it jargon-free.
- **architecture_overview.md** — Describe the monorepo and the request/data flow
  (iOS/web → Fastify API → PostgreSQL + WireMock-mocked third parties). List the
  full stack. In **AI Models / Tools**, name the model (`claude-opus-4-8` via
  `@anthropic-ai/sdk`), provider (Anthropic), and role (re-ranking + rationale).
  In **Data Sources**, mark everything mocked/synthetic with status. Be candid in
  **Known Limitations** (mocked data, no real auth/delivery, scraped catalog,
  single-store demo).
- **ai_usage_explanation.md** — Walk the two-stage pipeline; pattern = re-ranking
  + structured generation (rationales) with prompt caching. **Dependency level =
  Integrated** (rule-based fallback keeps it working without AI). For Responsible
  AI, cover at least three: hallucination handling (constrained to a known
  candidate shortlist; deterministic fallback), human oversight (associate
  reviews/edits suggestions and prep states), transparency, and out-of-scope
  handling.
- **market_impact_statement.md** — Persona = retail store/clienteling leader or
  in-store stylist. Quantify ROI **only as clearly-labeled estimates with stated
  assumptions** (e.g. time saved per appointment). Competitive alternatives =
  manual prep / generic clienteling tools. Timing = AI maturity + retail
  personalization push.
- **pitch_deck.md** — 6 slide-sections (Problem, Solution, How It Works, AI
  Highlight, Business Value, Team). Digest the other docs; don't introduce new
  claims.
- **demo/demo_walkthrough.md** — Narrate the happy path: associate opens the Open
  view → selects an appointment → reviews AI suggestions + rationale → preps
  products / messages / completes. Reference real UI elements. If screenshots
  aren't available in CI, leave clearly-marked `<!-- SCREENSHOT: ... -->`
  placeholders describing what to capture.

---

## Guardrails (apply to every doc)

- **Never fabricate facts.** No invented metrics, customers, benchmarks, or
  performance numbers. Label all ROI/impact figures as estimates with assumptions.
- **Team Members:** do not invent names. If unknown, insert a
  `<!-- TODO: team members and roles -->` placeholder.
- **Don't claim production-readiness.** Data is mocked/synthetic; say so.
- **Don't overstate AI dependency** — it's Integrated (works via fallback).
- **Preserve human edits.** Update only what the PR changed; don't rewrite
  sections wholesale or churn unrelated content.
- **No secrets.** Never read or echo `.env`, API keys, or tokens into docs.
- **Stay within scope.** Only modify files under `docs/submission/`.

---

## Running manually (without the workflow)

From a checkout, ask Claude Code:

> "Following AGENTS.md, regenerate the submission docs relevant to my current
> branch's diff against `main`, and show me the changes."

Or target one doc:

> "Following AGENTS.md, draft `docs/submission/ai_usage_explanation.md` from the
> current codebase."

---

## Automation summary

`.github/workflows/generate-submission-docs.yml` runs on `pull_request`
(`opened`, `synchronize`, `reopened`). It:
1. Checks out the PR branch.
2. Determines files changed vs. the base branch.
3. Runs the Claude Code Action with this file as its guide, scoped to the
   relevance mapping above.
4. Commits any updated `docs/submission/**` files back to the PR branch.

The workflow runs through the project's **LiteLLM gateway** (Anthropic-compatible)
so it reuses the same key as the recommender. Configure these in repo settings:

| Name | Kind | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | secret | LiteLLM key (sent as `x-api-key`) — same key as the recommender |
| `ANTHROPIC_BASE_URL` | secret | LiteLLM gateway URL |
| `RECOMMENDER_MODEL` | secret | Model the gateway serves; reused as the main model (falls back to `claude-opus-4.7`) |
| `LITELLM_SMALL_FAST_MODEL` | variable (optional) | Haiku-class model for lightweight calls; falls back to the main model |

`ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, and `RECOMMENDER_MODEL` already exist
as repo secrets (shared with the recommender), so no new setup is needed beyond
the optional `LITELLM_SMALL_FAST_MODEL` variable.

PRs from forks are skipped (no secret access, can't push). Commits are pushed
with the workflow's `GITHUB_TOKEN`, which does **not** re-trigger the workflow,
so there's no loop.
