# AI Usage Explanation

## How AI Is Used

AI appears in one focused, high-value place: the **second stage of the catalog
recommendation pipeline** that prepares product suggestions for each appointment.

1. **Stage 1 — deterministic shortlist (no AI).**
   `apps/api/src/recommendation-scoring.ts` scores catalog products against the
   customer's fit profile (fit, rise, stretch, sizes), the appointment's color
   context, and the customer's per-booking catalog selection (womens, mens, or
   both), then assembles a **category-diverse shortlist** (bottoms, dresses,
   tops, outerwear). Pure, testable functions — no model involved.

2. **Stage 2 — Claude re-ranking + rationale (AI).**
   `apps/api/src/claude-reranker.ts` sends the shortlist plus the customer's fit
   profile, color preferences, and Muse tag (Clean / Romantic / Boyish /
   Statement Maker) to **Claude** (`claude-opus-4-8`, or a model served by the
   configured LiteLLM gateway) via the `@anthropic-ai/sdk`.
   - **Tool / model:** Claude (Anthropic), optionally through an
     Anthropic-compatible LiteLLM proxy.
   - **What it does:** re-orders the candidates for *this* customer and writes a
     short, human-readable **rationale** per item that the associate can use when
     prepping and talking to the customer.
   - **Pattern:** constrained **re-ranking + structured generation** over a fixed
     candidate set (not open-ended retrieval), with **prompt caching** on the
     stable system prompt to cut cost/latency.

## Why AI Is the Right Fit

- **Without AI:** the product can only offer the rule-based ordering — correct on
  hard constraints (size, color, fit) but blind to nuance like how a customer's
  Muse, occasion, and stated style should trade off across items, and with generic
  reasons.
- **Why AI is better:** ranking subjective style fit and writing a persuasive,
  customer-specific rationale is exactly the kind of qualitative judgment a model
  does well and rules do poorly. AI turns a filtered list into a *curated* one
  with talking points, which is the whole value of the "prepared stylist"
  experience.

## Level of AI Dependency

**Integrated.** AI is a significant component that materially improves the core
"prepared stylist" experience, but it is **not** required for the product to
function: if no API key is configured or the call fails, the endpoint returns the
rule-based ordering with scorer-derived reasons. The app, booking, prep, and
lifecycle all work without AI — only suggestion quality and rationale richness
degrade. It is therefore Integrated, not Core/AI-dependent.

## Responsible AI Considerations

- **Hallucinations / incorrect outputs:** Claude can only **re-order a known
  candidate shortlist** and is asked for a structured response; it cannot invent
  products. Outputs are validated, and any parsing/availability failure falls back
  to the deterministic ranking. Reasons why fallback occurs are logged for
  diagnosis.
- **Human oversight:** the associate is always in the loop — they review, can
  ignore or override suggestions, set product-prep states, and ultimately decide
  what to pull and recommend. AI prepares; the human decides.
- **User data protection:** only the signals needed for ranking (fit profile,
  color/style preferences, Muse, order-history *summary*) are sent; no secrets or
  credentials are included. Third-party data is mocked in this build. (Production
  would need explicit consent and retention policies — see limitations.)
- **Out-of-scope / edge cases:** an empty or low-quality shortlist, a missing API
  key, an unreachable gateway, or a gateway that rejects structured output all
  resolve to the rule-based path rather than failing the appointment.
- **Transparency:** suggestions are presented as system-generated prep aids for
  the associate, not as autonomous decisions to the customer.
