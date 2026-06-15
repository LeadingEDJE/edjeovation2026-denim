# Personalized Denim Fitting Experience

Monorepo scaffold for an iOS SwiftUI app, React web UI, TypeScript API, PostgreSQL, and WireMock-based third-party simulation.

For setup and full-stack run instructions, start with [QUICKSTART.md](QUICKSTART.md).

## Structure

- `apps/api`: Fastify API used by the web UI and iOS app.
- `apps/web`: React/Vite web UI for viewing and creating fitting sessions.
- `apps/ios`: SwiftUI iOS app scaffold for Xcode simulator work.
- `infra/db`: PostgreSQL initialization SQL.
- `infra/wiremock`: WireMock mappings for simulated third-party fit recommendations.

## Local Run

1. Start the full local stack:

   ```sh
   docker compose up --build
   ```

2. Open:

- Web UI: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- WireMock admin: `http://localhost:8080/__admin`
- PostgreSQL: `localhost:5432`, database `denim_fit`, user/password `denim`

For local-only TypeScript checks outside Docker:

```sh
npm install
npm run typecheck
```

## iOS

Open `apps/ios/DenimFit/DenimFit.xcodeproj` in Xcode and run the `DenimFit` scheme in a simulator. The app points at `http://localhost:4000` by default for simulator use.
