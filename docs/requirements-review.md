# Requirements Review

This review tracks the MVP scope for the personalized denim fitting experience and the product gaps that remain after the current appointment-workflow slice.

## Covered In Scaffold

- iOS SwiftUI application scaffold for simulator-based work in Xcode.
- Web associate dashboard for reviewing guided appointment prep data, filtering by store/date/stylist/status, managing open appointment lifecycle, messaging, product prep, recaps, and feedback display.
- API shared by the web UI and iOS app.
- PostgreSQL persistence for guided fitting appointments.
- WireMock simulation of third-party customer, order-history, store, stylist, and schedule-pattern services.
- Docker Compose local orchestration for the web UI, API, PostgreSQL, and WireMock.
- iOS booking flow with store selection, store-scoped slots, fit profile context, messages, mock notification records, cancellation reasons, recap viewing, and customer feedback after completion.

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
