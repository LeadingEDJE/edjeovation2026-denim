# Requirements Review

The client PDF could not be text-extracted with the tools available in this environment. It appears to be a Google Docs-rendered PDF with encoded embedded fonts, and local OCR tools are not installed. The scaffold therefore reflects the stated product shape and a practical initial domain model for a personalized denim fitting experience.

## Covered In Scaffold

- iOS SwiftUI application scaffold for simulator-based work in Xcode.
- Web UI for creating fitting sessions and viewing recommendations.
- API shared by the web UI and iOS app.
- PostgreSQL persistence for fitting sessions and recommendations.
- WireMock simulation of a third-party recommendation service.
- Docker Compose local orchestration for the web UI, API, PostgreSQL, and WireMock.

## Likely Missing Or Needs Product Decisions

- Authentication and user identity model.
- Customer consent and privacy handling for body measurements.
- Data retention policy for measurements and recommendations.
- Size-system rules by brand, region, gender/category, and denim collection.
- Inventory availability and store/ecommerce handoff.
- Fit feedback loop after purchase or try-on.
- Admin controls for recommendation rules and third-party fallbacks.
- Analytics events and conversion metrics.
- Accessibility requirements for web and iOS.
- Error-state copy and support flows when the third-party service is unavailable.

## Open Questions

1. What third-party API is WireMock replacing: sizing engine, customer profile, inventory, recommendations, or all of these?
2. What customer data can be stored, and for how long?
3. Does the experience require account login, anonymous sessions, or both?
4. Are recommendations expected to return one best size, multiple ranked products, or a complete outfit/cart?
