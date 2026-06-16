# Pitch Deck — Personalized Denim Fitting Experience

*A 6-slide digest of the submission documents. Convert to slides (Google
Slides / Canva) for presentation; replace the demo slide note with a screenshot
or link.*

---

## Slide 1 — Problem

- In-store denim fitting is high-friction: fit varies across rise/wash/cut, and
  customers get whichever associate is free — with **no advance context**.
- Result: long trial-and-error sessions, inconsistent advice, abandoned visits,
  and fit-driven returns.
- Associates walk in cold and get pulled away at peak hours.

## Slide 2 — Solution

- Customer books a **non-peak fitting** in an iOS app and completes a short intake
  (occasion, focus/avoid colors, catalog source, style → **Abercrombie Muse**).
- A stylist is assigned and confirmed; order-history signals are combined with the
  intake.
- The associate gets a **prepared, AI-curated shortlist with rationale** to pull
  before the customer arrives — plus full lifecycle management, async messaging,
  and a post-visit recap.

## Slide 3 — How It Works

- Monorepo: **SwiftUI iOS app** + **React/Vite associate dashboard** → **Fastify
  API** → **PostgreSQL**, with **WireMock** standing in for third-party
  customer/order/store/stylist data.
- **Hybrid recommender:** deterministic rule-based scoring builds a diverse
  shortlist from the selected womens/mens catalog audience → **Claude re-ranks**
  it for the customer and writes rationale.
- *(Insert architecture diagram or dashboard screenshot.)*

## Slide 4 — AI Usage Highlight

- **Claude** (`claude-opus-4-8`, or via a LiteLLM gateway) performs constrained
  **re-ranking + structured rationale** over a fixed candidate set, with prompt
  caching.
- **Dependency: Integrated** — graceful fallback to the rule-based ranking when AI
  is unavailable, so prep always works.
- Responsible AI: model can't invent products, associate stays in the loop, only
  necessary signals are sent.

## Slide 5 — Business Value / ROI

*(Illustrative estimates, stated assumptions.)*

- Saves ~10–15 min associate prep per appointment.
- Plausible conversion lift on higher-intent appointments and reduced fit-driven
  returns.
- Deeper clienteling via confirmed stylist, async messaging, and recaps.
- Launchable in **non-peak hours with existing qualified associates** — low risk.

## Slide 6 — Team

<!-- TODO: team members and roles -->
