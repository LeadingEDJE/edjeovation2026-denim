# Requirements Review

The client PDF could not be text-extracted with the tools available in this environment. It appears to be a Google Docs-rendered PDF with encoded embedded fonts, and local OCR tools are not installed. The scaffold therefore reflects the stated product shape and a practical initial domain model for a personalized denim fitting experience.

## Covered In Scaffold

- iOS SwiftUI application scaffold for simulator-based work in Xcode.
- Web UI for reviewing guided appointment prep data.
- API shared by the web UI and iOS app.
- PostgreSQL persistence for guided fitting appointments.
- WireMock simulation of third-party customer, order-history, stylist, and availability services.
- Docker Compose local orchestration for the web UI, API, PostgreSQL, and WireMock.

## Likely Missing Or Needs Product Decisions

- Authentication and user identity model.
- Customer consent and privacy handling for body measurements.
- Data retention policy for appointment intake answers, order-history summaries, and stylist prep data.
- Size-system rules by brand, region, gender/category, and denim collection.
- Inventory availability and store/ecommerce handoff.
- Fit feedback loop after purchase or try-on.
- Admin controls for stylist assignment rules and third-party fallbacks.
- Analytics events and conversion metrics.
- Accessibility requirements for web and iOS.
- Error-state copy and support flows when the third-party service is unavailable.

## Open Questions

1. What third-party API is WireMock replacing: customer profile, order history, stylist scheduling, inventory, or all of these?
2. What customer data can be stored, and for how long?
3. Does the experience require account login, anonymous sessions, or both?
4. Should appointment prep eventually include inventory picks, outfit recommendations, or a complete reserved rack/cart?
