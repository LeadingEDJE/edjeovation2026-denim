# Market & Impact Statement

## Target Customer / Client Persona

**Primary buyer:** a regional or store-level **clienteling / retail experience
leader** at a specialty apparel brand (emulated here as Abercrombie & Fitch),
responsible for conversion, return rates, and the quality of in-store service at
stores staffed with qualified styling associates.

**Primary user:** the **in-store stylist / associate** who preps and runs guided
denim fittings during non-peak hours (Mon–Thu).

- **Context:** mid-to-large specialty retailer; stores with associates who range
  from highly skilled stylists to people for whom it's "just a job," so
  consistency of prep matters.
- **Pain points:** associates walk into fittings cold; denim fit is hard and
  return-prone; peak-hour interruptions kill the experience; no structured way to
  capture customer intent before arrival or to communicate async afterward.
- **What they want:** a repeatable way to give a *prepared, personalized* fitting
  that lifts conversion and confidence and lowers returns — without adding heavy
  process for the associate or burning out the customer with a long intake. The
  catalog source can vary by shopping mission, so customers may ask for womens,
  mens, or both catalogs on a given appointment.

## Business Value / ROI

*All figures are illustrative estimates with stated assumptions — not measured
results from this hackathon build.*

- **Associate prep time saved:** if AI-curated, rationale-backed shortlists save
  ~10–15 minutes of manual rack-pulling and guesswork per appointment, a store
  running 5 non-peak fittings/day saves ~1 hour/day of associate time.
- **Conversion lift:** a better-prepared, personalized session plausibly improves
  fitting-to-purchase conversion; even a few points on appointment-driven sales is
  meaningful given denim's basket size. *(Assumption: appointments are already
  higher-intent than walk-ins.)*
- **Return reduction:** anchoring suggestions to fit profile + sizing should
  reduce fit-driven returns, which are a major cost center in denim. *(Assumption:
  fit is the dominant return reason.)*
- **Experience / loyalty:** a confirmed stylist, async messaging, and a post-visit
  recap deepen the clienteling relationship and repeat visits.

To validate in a pilot: prep-time delta, appointment conversion vs. walk-in,
return rate on appointment purchases, and repeat-booking rate.

## Competitive Alternatives

- **Do nothing / manual prep:** associates improvise from memory and walk-in
  context — inconsistent and time-consuming. We provide structured intent +
  curated, explained suggestions.
- **Generic clienteling / appointment apps (e.g. booking + CRM tools):** handle
  scheduling and notes but aren't denim-fit-aware and don't generate
  rationale-backed product shortlists from fit + style signals.
- **E-commerce recommenders / virtual try-on:** optimize online browsing, not an
  in-store, associate-led fitting; they don't prep a human stylist.

**Why ours is better/different:** it is purpose-built for the *associate-led,
in-store denim fitting* — combining a lightweight customer intake (mapped to
Abercrombie Muses), per-booking catalog selection, order-history signals, and a
hybrid (rules + Claude) recommender that outputs a curated shortlist *with
talking points*, plus the full appointment lifecycle and async messaging.

## Why This Matters Right Now

- **AI maturity:** models can now produce reliable, constrained re-ranking and
  natural-language rationale cheaply (with prompt caching), making per-appointment
  curation economical.
- **Retail differentiation:** brands are leaning into high-touch, personalized
  in-store experiences to defend against pure e-commerce; denim fit is a flagship
  use case.
- **Operational fit:** focusing on non-peak hours means brands can launch this
  with existing qualified associates and no new headcount — a low-risk way to test
  a premium clienteling experience today.
