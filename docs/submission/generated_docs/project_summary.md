# Project Summary

## Project Name

Personalized Denim Fitting Experience — a guided, appointment-based denim
fitting service for Abercrombie & Fitch customers, pairing a customer iOS app
with an associate prep dashboard and AI-assisted suggestions from the selected
womens and/or mens catalog.

## Team Members

<!-- TODO: team members and roles (e.g. Tech Lead, Designer, Product) -->

## Client

Abercrombie & Fitch denim. Built for this Innovation Days exercise against an
emulated single-store environment; all third-party systems are mocked.

## Problem Statement

Buying denim in store is high-friction: fit varies wildly across rises, washes,
and cuts, and a walk-in customer usually works with whichever associate is free —
who has no advance context on the customer's goals, sizing, or taste. The result
is long trial-and-error sessions, inconsistent advice, abandoned visits, and
returns.

Customers are affected by a frustrating, impersonal experience. Associates are
affected because they walk into each fitting cold and get pulled away during peak
hours, so they can't deliver a curated session. The store is affected through
lower conversion, higher returns, and a missed clienteling opportunity.

This matters because denim fit is the single biggest driver of denim purchase
confidence and returns, and because a personalized in-store experience is exactly
what differentiates a brand from generic e-commerce. Concentrating these
appointments in non-peak hours (Mon–Thu) lets a qualified associate give an
undivided, high-touch experience. (~150 words)

## Proposed Solution

The customer books a non-peak fitting slot in an iOS app and answers a short
intake — occasion, colors to focus on or avoid, preferred catalog source
(womens, mens, or both), and a style description that maps to an Abercrombie
"Muse" (Clean, Romantic, Boyish, Statement Maker). That intake is combined with
the customer's order-history signals so the store has a clear picture of intent
before arrival.

The system assigns a store stylist near booking time and confirms the appointment
and stylist to the customer. Confirmation is **immediate** — the (slower) AI
re-rank runs in the background after booking, so the customer never waits on a
model call to learn their slot is locked. Associates work a web dashboard that
lists upcoming appointments and, for each one, presents a **curated, AI-assisted
set of product suggestions with a per-item rationale** to pull in advance. A
deterministic rule-based engine scopes the catalog to the customer's per-booking
selection, scores it against the fit profile and color context, and builds a
diverse shortlist; Claude then re-ranks it for the specific customer and writes
the rationale. While the picks are still being generated the detail view shows a
"Preparing your picks…" banner and refreshes itself when they arrive. If AI is
unavailable the rule-based order is used, so prep always works.

Associates manage the full appointment lifecycle (check-in, no-show, complete),
reassign stylists when needed, track product-prep states, exchange async messages
through a shared stylist inbox, and write a customer-facing recap after the
visit — purchase or not. This beats both "do nothing" (cold, manual prep) and
generic clienteling tools by being denim-fit-specific and grounded in real
customer signals. (~250 words)

## Target Users

- **Primary:** Abercrombie & Fitch in-store stylists / associates who prep and run
  guided fitting appointments.
- **Secondary:** The customer booking the fitting and communicating with their
  stylist.
- **Tertiary:** Store and clienteling/retail-operations leadership who staff
  qualified associates and care about conversion, returns, and experience quality.

## Key Benefits

- **Associates arrive prepared** with an AI-curated, rationale-backed product
  shortlist tailored to each customer's intent and history.
- **Customers get a personalized, low-friction experience** from a short intake to
  a confirmed stylist and an undivided non-peak session.
- **Catalog choice matches the shopping mission** — customers can default to one
  source but choose womens, mens, or both catalogs for each booking.
- **Higher confidence, fewer returns** by anchoring suggestions to the customer's
  fit profile, color preferences, and Muse.
- **Async communication** via a shared stylist inbox keeps the customer connected
  without requiring the associate to be available in real time.
- **Works on the floor** — the associate dashboard reflows to phone and tablet
  screens (queue cards, scrollable view nav, sticky action bar) so a stylist can
  prep, message, and complete an appointment from a handheld device, not just a
  back-room workstation.
- **One brand voice across surfaces** — the customer iOS app and the associate
  web dashboard share the same Denim Fit visual system (navy/ink palette, square
  corners, bordered white cards on a neutral canvas), with the SwiftUI theme
  mirroring the tokens in `packages/design-system` so the experience feels like
  one product, not two.
- **Resilient by design** — the recommendation engine degrades gracefully to a
  deterministic ranking when AI is unavailable.
- **Snappy booking, no waiting on the model** — booking confirmation returns as
  soon as the slot and stylist are saved; the AI re-rank runs in the background
  and the dashboard surfaces a "Preparing your picks…" state that updates in
  place when suggestions are ready.
