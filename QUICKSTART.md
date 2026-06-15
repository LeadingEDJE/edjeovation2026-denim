# Quick Start

Use this file as the primary setup and run guide for the local Personalized Denim Fitting Experience stack. It is written to be readable by both teammates and LLM coding agents.

## What This Repo Runs

The local stack has four Docker Compose services:

- `web`: React/Vite web UI at `http://localhost:5173`
- `api`: Fastify/TypeScript API at `http://localhost:4000`
- `postgres`: PostgreSQL database for fitting sessions and recommendations
- `wiremock`: simulated third-party fit recommendation API at `http://localhost:8080`

The iOS app is a SwiftUI project that runs separately through Xcode and talks to the Compose-hosted API at `http://localhost:4000`.

## Prerequisites

- Docker Desktop, Podman Desktop, or another local Docker Compose-compatible runtime
- Node.js 24+ only if you want to run local type checks outside Docker
- Xcode for the iOS simulator

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

Create a sample fitting session:

```sh
curl -X POST http://localhost:4000/api/fitting-sessions \
  -H 'content-type: application/json' \
  -d '{
    "customerName": "Avery",
    "heightInches": 67,
    "waistInches": 29,
    "hipInches": 39,
    "inseamInches": 30,
    "fitPreference": "straight",
    "stretchPreference": "comfort-stretch"
  }'
```

Expected result: a JSON response with a `session` and `recommendation`, including a size like `29W x 30L`.

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

Use `down -v` only when you want to reset all local fitting-session data.

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

The SwiftUI app is configured to call `http://localhost:4000`, which maps to the API container from the simulator.

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
| Web UI | `web` | `http://localhost:5173` | Fitting-session form and recommendation display |
| API | `api` | `http://localhost:4000` | Shared API for web and iOS |
| API docs | `api` | `http://localhost:4000/docs` | Interactive Swagger UI |
| PostgreSQL | `postgres` | `localhost:5432` | Data storage |
| WireMock | `wiremock` | `http://localhost:8080` | Mock third-party recommendation service |

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
- `infra/wiremock/mappings/fit-recommendation.json`: mocked third-party recommendation endpoint
- `docs/requirements-review.md`: open product and requirements questions

## Troubleshooting

If `localhost:4000` or `localhost:5173` is already in use, stop the conflicting process or run:

```sh
docker compose down
```

If the API starts but database data looks stale, reset the database:

```sh
docker compose down -v
docker compose up -d --build
```

If WireMock recommendations are not changing, check the mapping file:

```text
infra/wiremock/mappings/fit-recommendation.json
```

Then rebuild/restart:

```sh
docker compose up -d --build
```

If Xcode command-line builds fail, make sure full Xcode is installed and selected. The app can still be opened and run directly from Xcode.

## LLM Agent Notes

When using an LLM coding agent on this repo, point it at this file first. The expected local runtime path is Docker Compose, not locally launched API/web processes. Do not introduce Aspire. Keep the iOS app as an Xcode-run SwiftUI project that calls the Compose-hosted API.
