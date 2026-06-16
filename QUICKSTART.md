# Quick Start

Use this file as the primary setup and run guide for the local Personalized Denim Fitting Experience stack. It is written to be readable by both teammates and LLM coding agents.

## What This Repo Runs

The local stack has four Docker Compose services:

- `web`: React/Vite web dashboard at `http://localhost:5173`
- `api`: Fastify/TypeScript API at `http://localhost:4000`
- `postgres`: PostgreSQL database for guided fitting appointments
- `wiremock`: simulated third-party APIs at `http://localhost:8080`

The iOS app is a SwiftUI guided fitting journey that runs separately through Xcode and talks to the Compose-hosted API at `http://localhost:4000`.

## Prerequisites

- Docker Desktop, Podman Desktop, or another local runtime with Docker Compose v2 support
- Node.js 24+ only if you want to run local type checks outside Docker
- Xcode only if you want to run the iOS simulator app

No local PostgreSQL, WireMock, API server, or web server is required. Compose owns those.

## First Run

From the repo root:

```sh
docker compose up -d --build
```

Then open:

- Web UI: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- API docs: `http://localhost:4000/docs`
- OpenAPI spec: `http://localhost:4000/openapi.json`
- WireMock admin: `http://localhost:8080/__admin`

The API container runs the database migration automatically on startup.

## Verify The Stack

Check containers:

```sh
docker compose ps
```

Check API health:

```sh
curl http://localhost:4000/health
```

Check the OpenAPI spec:

```sh
curl http://localhost:4000/openapi.json
```

Open the interactive API docs in a browser:

```text
http://localhost:4000/docs
```

Load mocked third-party order history through the API:

```sh
curl 'http://localhost:4000/api/customers/cust_avery_001/order-history?scenario=standard'
```

Supported order-history scenarios:

- `standard`
- `denim-heavy`
- `returns`
- `empty`
- `error`

Load simulated store-associate stylist profiles through the API:

```sh
curl 'http://localhost:4000/api/stores'
curl 'http://localhost:4000/api/stores/schedule-patterns'
curl 'http://localhost:4000/api/stylists'
curl 'http://localhost:4000/api/stylists/sty_001'
curl 'http://localhost:4000/api/stylists/availability'
```

Filter stylists by specialty, supported fit, or availability:

```sh
curl 'http://localhost:4000/api/stylists?specialty=petite-proportions'
curl 'http://localhost:4000/api/stylists?fit=wide&availability=available'
```

WireMock owns three mock stores: SoHo, Columbus/Easton, and Los Angeles/Century City. It also exposes weekly store/stylist schedule patterns. The API turns those patterns into the next 10 calendar days of bookable slots, limited to Monday through Thursday from `11:00` through `19:00`.

Load the mocked logged-in loyalty customer:

```sh
curl 'http://localhost:4000/api/me'
```

List available mock customers and switch the active one:

```sh
curl 'http://localhost:4000/api/admin/users'
curl 'http://localhost:4000/api/admin/active-user'
curl -X PUT http://localhost:4000/api/admin/active-user \
  -H 'content-type: application/json' \
  -d '{"customerId":"cust_jordan_002"}'
```

This is an admin-only local testing shortcut, not authentication. The iOS app has an Admin screen that calls these same endpoints.

Load bookable guided fitting appointment slots:

```sh
curl 'http://localhost:4000/api/appointments/slots?storeId=anf_soho_001'
```

Book a guided fitting appointment. First copy one `slotStart` value from `/api/appointments/slots?storeId=<store-id>`, then use it in the payload:

```sh
SLOT_START="<paste a slotStart value here>"

curl -X POST http://localhost:4000/api/appointments \
  -H 'content-type: application/json' \
  -d '{
    "storeId": "anf_soho_001",
    "slotStart": "'"$SLOT_START"'",
    "occasion": "Weekend dinner",
    "focusColors": "dark wash, white, navy",
    "avoidColors": "neon",
    "styleKeywords": ["minimal", "effortless"],
    "guidance": "Prefers easy layers and a clean straight-leg fit.",
    "orderHistoryScenario": "standard"
  }'
```

Expected result: a JSON response with an `appointment`, selected store snapshot, assigned stylist, mapped `museTag`, summarized order-history signals, suggested products for associate prep, and mock confirmation/reminder notification summary.

List booked guided fitting appointments:

```sh
curl 'http://localhost:4000/api/appointments'
```

Load the mocked customer's upcoming appointment:

```sh
curl 'http://localhost:4000/api/appointments/me/upcoming'
```

Update the free-form stylist note for an upcoming appointment:

```sh
curl -X PATCH "http://localhost:4000/api/appointments/<appointment-id>" \
  -H 'content-type: application/json' \
  -d '{"guidance":"Prefers easy layers and wants to avoid low-rise denim."}'
```

Cancel an upcoming appointment:

```sh
curl -X POST "http://localhost:4000/api/appointments/<appointment-id>/cancel" \
  -H 'content-type: application/json' \
  -d '{"cancelReason":"Need to reschedule around work."}'
```

Associate lifecycle actions:

```sh
curl -X PATCH "http://localhost:4000/api/appointments/<appointment-id>/stylist" \
  -H 'content-type: application/json' \
  -d '{"stylistId":"sty_002"}'

curl -X POST "http://localhost:4000/api/appointments/<appointment-id>/check-in"
curl -X POST "http://localhost:4000/api/appointments/<appointment-id>/no-show"

curl -X PATCH "http://localhost:4000/api/appointments/<appointment-id>/session-notes" \
  -H 'content-type: application/json' \
  -d '{"sessionNotes":"Customer preferred the dark straight fit."}'

curl -X POST "http://localhost:4000/api/appointments/<appointment-id>/complete" \
  -H 'content-type: application/json' \
  -d '{
    "sessionNotes":"Customer preferred the dark straight fit.",
    "customerRecap":"The high-rise straight jean in dark wash gave the cleanest fit.",
    "associateFeedback":"Prepared products matched the customer goals."
  }'
```

Messages, notifications, feedback, and product prep:

```sh
curl "http://localhost:4000/api/appointments/<appointment-id>/messages"
curl -X POST "http://localhost:4000/api/appointments/<appointment-id>/messages" \
  -H 'content-type: application/json' \
  -d '{"authorType":"customer","body":"Can you pull dark washes?"}'

curl "http://localhost:4000/api/appointments/<appointment-id>/notifications"

curl -X PUT "http://localhost:4000/api/appointments/<appointment-id>/feedback" \
  -H 'content-type: application/json' \
  -d '{"rating":5,"comment":"Helpful recap and a strong fit."}'

curl -X PATCH "http://localhost:4000/api/appointments/<appointment-id>/suggested-products/<product-id>" \
  -H 'content-type: application/json' \
  -d '{"prepStatus":"pulled","associateNote":"Ready in fitting room 2."}'
```

The API allows only one upcoming scheduled or checked-in appointment per mocked customer. The web dashboard shows booked appointment prep data, filters by store/date/stylist/status, supports date ordering, and keeps open appointments visible even after their scheduled time passes. Completed, cancelled, and no-show records are read-only. The iOS app is the primary customer flow for creating and managing guided fitting appointments.

## Daily Run Commands

Start or rebuild everything:

```sh
docker compose up -d --build
```

View logs:

```sh
docker compose logs -f api web
```

Stop containers:

```sh
docker compose down
```

Stop containers and remove the local database volume:

```sh
docker compose down -v
```

Use `down -v` only when you want to reset all local appointment data.

## Local Type Checks

Docker is the source of truth for running the app. For local checks outside Docker:

```sh
npm install
npm run typecheck
```

Production builds can also be checked locally:

```sh
npm run build
```

## iOS Simulator

1. Start the Compose stack:

   ```sh
   docker compose up -d --build
   ```

2. Open:

   ```text
   apps/ios/DenimFit/DenimFit.xcodeproj
   ```

3. Run the `DenimFit` scheme in an iOS simulator.

The SwiftUI app loads the mocked loyalty customer, shows view-only fit profile context, walks through a fitting questionnaire, lets the user choose a WireMock-backed store and appointment slot, and posts the booking to the API. Appointment detail includes messages, mock confirmation/reminder records, cancellation with a reason, recap viewing, and post-completion feedback.

The SwiftUI app is configured to call `http://localhost:4000`, which maps to the API container from the simulator.

To point the local simulator at the deployed Azure API instead, select the `DenimFit Production API` scheme in Xcode. That scheme sets `DENIM_FIT_API_BASE_URL` to:

```text
https://ca-denimfit-api.delightfulglacier-70865650.centralus.azurecontainerapps.io
```

Use the production API scheme only when you intentionally want simulator actions to read or write deployed data. The default `DenimFit` scheme remains the local-development profile.

## Optional macOS Xcode Setup

Use this section only if you are on macOS and do not have full Xcode installed. Command Line Tools alone are not enough to run the SwiftUI app in the iOS simulator.

Check whether Xcode is installed:

```sh
ls /Applications/Xcode.app
xcodebuild -version
```

If Xcode is missing, install it from the Mac App Store:

```sh
open 'macappstore://apps.apple.com/us/app/xcode/id497799835'
```

Complete the install through the App Store UI. Xcode is a large download, and the install may take a while.

After Xcode finishes installing, select it as the active developer directory:

```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
```

Then verify:

```sh
xcodebuild -version
xcrun simctl list devices available
```

Once that passes, open the SwiftUI project:

```text
apps/ios/DenimFit/DenimFit.xcodeproj
```

## Service Map

| Service | Compose name | Host URL | Purpose |
| --- | --- | --- | --- |
| Web UI | `web` | `http://localhost:5173` | Appointment prep dashboard |
| API | `api` | `http://localhost:4000` | Shared API for web and iOS |
| API docs | `api` | `http://localhost:4000/docs` | Interactive Swagger UI |
| PostgreSQL | `postgres` | `localhost:5432` | Data storage |
| WireMock | `wiremock` | `http://localhost:8080` | Mock third-party customer, order-history, store, stylist, and schedule-pattern services |

Database defaults:

- Database: `denim_fit`
- User: `denim`
- Password: `denim`

## Key Files

- `docker-compose.yml`: full local stack definition
- `apps/api`: TypeScript API source and Dockerfile
- `apps/api/src/routes.ts`: API routes and OpenAPI route schemas
- `apps/web`: React web UI source and Dockerfile
- `apps/ios/DenimFit`: SwiftUI iOS project
- `infra/db/init.sql`: database schema
- `infra/wiremock/mappings`: mocked third-party customer, order-history, store, stylist, and schedule endpoints
- `infra/wiremock/__files`: larger WireMock response payloads, including current customer, store, schedule-pattern, and stylist profile data
- `docs/requirements-review.md`: open product and requirements questions

## Troubleshooting

If `localhost:4000` or `localhost:5173` is already in use, stop the conflicting process or run:

```sh
docker compose down
```

If the API starts but database data looks stale, reset the database volume:

```sh
docker compose down -v
docker compose up -d --build
```

This removes the local PostgreSQL volume and recreates the schema from `infra/db/init.sql`.

If WireMock responses are not changing, rebuild/restart:

```sh
docker compose up -d --build
```

If Xcode command-line builds fail, make sure full Xcode is installed and selected. The app can still be opened and run directly from Xcode.

## LLM Agent Notes

When using an LLM coding agent on this repo, point it at this file first. The expected local runtime path is Docker Compose, not locally launched API/web processes. Do not introduce Aspire. Keep the iOS app as an Xcode-run SwiftUI project that calls the Compose-hosted API.
