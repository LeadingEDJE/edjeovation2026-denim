# Demo Video Production Plan

This plan turns `demo_walkthrough.md` into a repeatable recording package for a
polished submission video. It assumes a single client-safe video under 5 minutes
that shows both customer and associate flows using the local Docker Compose stack
and the iOS simulator.

## Default decisions

Use these defaults unless the team decides otherwise before recording.

- **Length:** 4:30 target, 5:00 maximum.
- **Audience:** Innovation Days judges first, but safe for client review.
- **Style:** product demo with concise narration, not a technical architecture
  tour.
- **Runtime:** local Compose stack for API, web, PostgreSQL, and WireMock; Xcode
  Simulator for iOS.
- **AI framing:** say "AI-assisted suggestions" and "works with deterministic
  fallback"; do not imply autonomous styling or production readiness.
- **Data framing:** say "mock appointment data" or "demo data" if context is
  needed; do not mention internal fixtures, WireMock, local admin tools, or team
  roles in the video.
- **Client sensitivity:** avoid the iOS Admin screen, API docs, Docker output,
  terminal windows, `.env` files, and hackathon-only labels.

## Proposed story arc

1. Customer starts a guided fitting in iOS.
2. Customer shares occasion, colors, style signals, catalog scope, outfit
   context, store, and time.
3. Customer confirms the appointment and sees the appointment detail.
4. Associate opens the web dashboard and finds the new appointment in Open.
5. Associate reviews the customer snapshot and AI-assisted product suggestions.
6. Associate marks products as pulled and messages the customer.
7. Associate checks in the customer, records notes, writes the recap, and
   completes the appointment.
8. Customer returns to iOS, reads the recap, and submits feedback.

## Recording setup

Run this off-camera before capture:

```sh
docker compose down -v
docker compose up -d --build
npm run demo:preflight
```

Then open:

- iOS: `apps/ios/DenimFit/DenimFit.xcodeproj`, `DenimFit` scheme, iPhone
  simulator.
- Web: `http://localhost:5173`, preferably in a clean browser profile at
  1440x900 or 1512x982.

The iOS simulator segment can be recorded with:

```sh
AUTOPLAY=booking npm run demo:record:ios
```

The helper builds, installs, launches the app on the booted simulator, and
records until you press Ctrl-C. It writes timestamped `.mp4` files under
`docs/submission/demo/captures/`.

Use `AUTOPLAY=booking` for the customer booking flow and `AUTOPLAY=recap` after
the web completion flow if you want a second customer recap/feedback capture.
Set `DEMO_PAUSE_SECONDS=3` for slower, more readable autoplay captures.
For a precise recap take, pass the completed appointment id:

```sh
AUTOPLAY=recap DEMO_APPOINTMENT_ID='<appointment-id>' npm run demo:record:ios
```

The associate web segment can be recorded automatically after the customer has
booked the appointment in iOS:

```sh
DEMO_APPOINTMENT_SEARCH='Everyday denim' npm run demo:record:web
```

Playwright writes the web recording as a `.webm` under `test-results/`. This
script also copies the successful take to `docs/submission/demo/captures/`.
It mutates appointment state by marking products pulled, posting a message,
checking in, saving notes, and completing the appointment, so run it only for
the take you intend to use or after resetting the database.

For a clean client-facing recording, do setup work before pressing record. If an
active mock customer already has an upcoming appointment, reset the database
again with `docker compose down -v && docker compose up -d --build` rather than
showing admin controls on camera.

If the default simulator target is not installed, set `IOS_DESTINATION` before
running the preflight, for example:

```sh
IOS_DESTINATION='platform=iOS Simulator,name=iPhone 17' npm run demo:preflight
```

## Capture checklist

- Use a consistent simulator device, ideally iPhone 16 or iPhone 15 Pro.
- Turn on Do Not Disturb and hide desktop notifications.
- Keep browser bookmarks, extensions, and terminal windows out of frame.
- Increase browser zoom only if labels are not readable in the final export.
- Record iOS and web as separate takes, then edit them into one narrative.
- Leave one second of stillness before and after each take for clean cuts.
- Avoid fast scrolling; pause briefly on labels the narration references.
- Capture the final exported video at 1080p or higher.
- Use `narration_script.md` for voiceover and `demo_captions.srt` if the final
  export needs captions.

After the iOS and web takes are captured, create a draft combined MP4 with:

```sh
npm run demo:assemble
```

By default this combines the current booking, web, and recap captures into
`docs/submission/demo/captures/denim-fit-demo-draft.mp4`. Override `IOS_BOOKING`,
`WEB_FLOW`, `IOS_RECAP`, or `OUTPUT` to assemble different takes.

For a more polished export with title cards, section labels, and generated
voiceover from `polished_voiceover.txt`, run:

```sh
npm run demo:polish
```

This writes `docs/submission/demo/captures/denim-fit-demo-polished.mp4`. Set
`WITH_VOICEOVER=0` to export without generated narration. The default narration
uses `edge-tts` with the Microsoft neural voice `en-US-AvaNeural` at rate
`+0%`. Override with `EDGE_TTS_VOICE` or `EDGE_TTS_RATE` if a different neural
voice is preferred. Set `TTS_ENGINE=say` only as a local macOS fallback.

## Shot List And Narration

### 1. Opening customer context, 0:00-0:20

**Visual:** iOS home and branded fitting landing screen.

**Narration:** "The experience starts before the customer arrives. In the Denim
Fit app, the shopper begins a guided fitting and shares what they want the store
team to prepare."

### 2. Guided booking, 0:20-1:25

**Visual:** Move through the eight booking steps. Show occasion, colors, style
signals with the Muse result, catalog selection, outfit-to-match skip or sample,
store selection, time selection, and review.

**Narration:** "The app collects appointment intent in plain customer language:
occasion, preferred washes, colors to avoid, style signals, catalog scope, and
optional outfit context. Store and time options come from the demo scheduling
data, so the booking flow behaves like a real appointment experience."

**Demo input:** Use a concise occasion such as "Everyday denim for cafe work days
and dinner out." Choose dark wash, cream, and navy as focus colors; avoid neon;
choose a minimal or effortless style group; keep catalog set to Womens; choose
Abercrombie & Fitch SoHo and the first available slot.

### 3. Confirmation and customer detail, 1:25-1:55

**Visual:** Confirmation screen, then Manage Appointment. Briefly show Where,
Your stylist, reminders, messages, and note.

**Narration:** "After confirmation, the customer can manage the appointment,
message the stylist, update notes, and later return here for their recap and
feedback."

### 4. Associate queue, 1:55-2:20

**Visual:** Web dashboard Open view at `http://localhost:5173`. Show tabs,
filters, search, and the new appointment row.

**Narration:** "Inside the store, associates work from an operational dashboard.
Open appointments are grouped and searchable, with store, stylist, status, and
timing visible before the customer arrives."

### 5. Product prep and rationale, 2:20-3:10

**Visual:** Appointment detail. Show the hero, customer snapshot, and Suggested
Products. Pause on product rationale, fit details, sales-floor location, and
to-pull count.

**Narration:** "The associate gets a prepared point of view: customer context,
fit and style signals, and AI-assisted product suggestions with rationale. The
recommendation pipeline first scores the catalog deterministically, then uses
Claude to re-rank and write concise associate-facing reasons when available. If
AI is unavailable, the product still works from the rule-based shortlist."

### 6. Associate actions, 3:10-3:45

**Visual:** Mark one or two products Pulled, add a prep note, show Messages and
Notifications, send a short customer message.

**Narration:** "Prep happens in the same workspace. The associate can mark what
has been pulled, add item notes, coordinate with the customer, and see reminder
records without leaving the appointment."

**Demo input:** Message: "We pulled a few dark wash options and one cream layer
for comparison."

### 7. Check-in, capture, and completion, 3:45-4:25

**Visual:** Click Check In, show In Progress, fill Associate session notes,
Customer recap, and Internal feedback. Save notes, then Complete. Show Completed
view with What Was Pulled and Session Recap.

**Narration:** "When the customer arrives, session capture unlocks. Internal
notes stay separate from the customer-facing recap. Completing the appointment
turns prep work and fitting notes into a durable recap for follow-up."

**Demo input:**

- Associate notes: "High-rise straight fit was strongest; customer preferred
  dark wash with clean hems."
- Customer recap: "Your best fit today was the high-rise straight jean in a dark
  wash, styled with a cream layer for a polished everyday look."
- Internal feedback: "Prepared shortlist matched the customer goals; keep
  straight and clean dark washes for follow-up."

### 8. Customer recap and feedback, 4:25-4:50

**Visual:** Return to iOS appointment detail after refresh. Show Your recap,
rating stars, comment field, and Submit Feedback.

**Narration:** "The customer sees the recap in the same app where they booked,
then submits feedback that closes the loop for the store team."

**Demo input:** Feedback: "Loved having the fit notes and pulled options ready
before I arrived."

### 9. Closing frame, 4:50-5:00

**Visual:** Completed web recap or iOS feedback submitted state.

**Narration:** "The result is a connected guided fitting flow: customer intent,
associate prep, in-store session capture, recap, and feedback in one demo."

## Editing Notes

- Start with the iOS flow, then cut to web; do not interleave until the final
  feedback loop.
- Keep narration business-focused. Avoid explaining implementation details
  unless they are directly tied to trust, such as fallback behavior.
- Use simple lower-third labels only where helpful: "Customer app",
  "Associate dashboard", "AI-assisted suggestions", "Customer recap".
- Remove waits caused by suggestion generation, polling, app launch, or page
  loading unless the state itself is being demonstrated.
- If suggestions are still pending, pause recording and resume when products are
  visible; the final video should show the pending state only if there is time.

## Open Questions Before Final Export

- Should the final video include voiceover, captions, or both?
- Should the client-facing export mention Abercrombie by name throughout, or use
  more generic "store team" phrasing after the opening?
- Should the final artifact include only the edited video, or also the script and
  raw captures?
- Is there a preferred company slide/title card template for the first or last
  frame?
