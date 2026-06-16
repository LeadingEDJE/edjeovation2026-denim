# Personalized Denim Fitting Experience

Monorepo scaffold for an iOS SwiftUI app, React web UI, TypeScript API, PostgreSQL, and WireMock-based third-party simulation.

For setup and full-stack run instructions, start with [QUICKSTART.md](QUICKSTART.md).

## Structure

- `apps/api`: Fastify API used by the web UI and iOS app.
- `apps/web`: React/Vite associate dashboard for guided fitting appointment prep, lifecycle actions, messages, recaps, and product prep.
- `apps/ios`: SwiftUI iOS app scaffold for Xcode simulator work.
- `infra/db`: PostgreSQL initialization SQL.
- `infra/wiremock`: WireMock mappings for simulated customers, order history, stores, stylist profiles, and weekly schedule patterns.

## Documentation

- `docs/requirements/`: Source requirements — the AnF denim fitting plan and reqs PDFs.
- `docs/requirements-review.md`: Notes reviewing the requirements.
- `docs/submission/`: Submission deliverables — project summary, architecture overview, pitch deck, market & impact statement, AI usage explanation, and the `demo/` walkthrough.

## Local Run

1. Start the full local stack:

   ```sh
   docker compose up --build
   ```

2. Open:

- Web UI: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- API docs: `http://localhost:4000/docs`
- OpenAPI spec: `http://localhost:4000/openapi.json`
- WireMock admin: `http://localhost:8080/__admin`
- PostgreSQL: `localhost:5432`, database `denim_fit`, user/password `denim`

For local-only TypeScript checks outside Docker:

```sh
npm install
npm run typecheck
```

## Current Workflow

- iOS customers choose a store, pick a store-scoped appointment slot, see view-only fit profile context, message the appointment thread, cancel scheduled visits with a reason, read the customer recap, and submit feedback after completion.
- The web dashboard supports Open, In Progress, Completed, Cancelled, and No-show views with store/date/stylist/status filters and date ordering. Open keeps active appointments visible even after their slot time has passed.
- Associates can reassign scheduled appointments to eligible same-store stylists, check in customers, mark no-shows, save internal notes, manage suggested-product prep states, post messages, write customer-visible recaps, and complete appointments.
- Booking creates mock confirmation and reminder notification records only; no email or push delivery is attempted.

## iOS

Open `apps/ios/DenimFit/DenimFit.xcodeproj` in Xcode and run the `DenimFit` scheme in a simulator. The app points at `http://localhost:4000` by default for simulator use.
