# Demo Walkthrough

A screenshot-and-narration walkthrough of the key guided fitting flows. Replace each `<!-- SCREENSHOT: ... -->` placeholder with a captured image, or swap this artifact for a live demo link or recorded video under 5 minutes.

> **Run locally:** `docker compose up --build`, then open the associate dashboard at `http://localhost:5173`. The API runs at `http://localhost:4000`; OpenAPI docs are available at `/docs`.

---

## Happy path

### 1. Customer books a fitting in the iOS app

The customer opens the Denim Fit app, sees the branded `A&F` / `stylist` splash, and starts from the landing screen: **Personalized fitting**, **A better fitting room starts before you arrive.**, and **Start Your Fitting**.

The booking wizard captures the context an associate needs before the visit:

- **Step 1 of 8: What are you shopping for?** The customer types an occasion or chooses a starter moment.
- **Step 2 of 8: Any colors in mind?** The customer marks colors to **Focus on** or **Avoid**.
- **Step 3 of 8: Pick your style signals** The app maps selected signals into **Your muse**.
- **Step 4 of 8: Which catalog should your stylist pull from?** The customer chooses Womens, Mens, or Womens + Mens.
- **Step 5 of 8: Want us to style around something?** The customer can add or skip an outfit-to-match photo/description.
- **Step 6 of 8: Choose a store** The app lists the three mocked stores: Abercrombie & Fitch SoHo, Abercrombie & Fitch Columbus/Easton, and Abercrombie & Fitch Century City.
- **Step 7 of 8: Pick a time** The app shows only store-scoped slots with available stylists.
- **Step 8 of 8: Review & confirm** The customer reviews **When**, **Store**, **Muse**, **Catalog**, **Shopping for**, and **Colors**, adds an optional **Note for your stylist**, then taps **Confirm Appointment**.

After booking, the confirmation screen says **Confirmed** and **You're booked.** It includes the assigned stylist, store, appointment time, and selected catalog. The customer can tap **Manage Appointment** to open the appointment detail.

<!-- SCREENSHOT: iOS splash with A&F mark and stylist wordmark -->
<!-- SCREENSHOT: iOS landing screen with Start Your Fitting -->
<!-- SCREENSHOT: iOS booking wizard showing occasion, colors, muse, catalog, store, slot, and review screens -->
<!-- SCREENSHOT: iOS confirmation screen showing assigned stylist and Manage Appointment -->

*Why it matters:* the customer provides useful intent before arriving, while the mock scheduling layer keeps the demo realistic across three store locations.

### 2. Customer manages the appointment in iOS

From **Appointments**, the customer sees their upcoming fitting card with the store, assigned stylist, muse tag, and occasion. The appointment detail shows **Your fitting**, **Where**, **Your stylist**, optional **Outfit to match**, **Reminders & updates**, **Messages**, and **Note for your stylist**.

Before the visit, the customer can message the stylist with **Message your stylist…** and **Send**, update the stylist note with **Save Note**, or use **Cancel Appointment**. The cancel alert confirms **Cancel this appointment?**, includes an optional **Reason optional** field, and separates **Cancel Appointment** from **Keep Appointment**.

After the associate completes the session, the same detail becomes the customer recap experience. It shows **Your recap**, **Note from [stylist]**, **Your note**, and **How was your fitting?** The customer chooses a star rating, can add **Tell your stylist what worked… (optional)**, and taps **Submit Feedback**.

<!-- SCREENSHOT: iOS Appointments home with upcoming appointment and fit profile context -->
<!-- SCREENSHOT: iOS appointment detail with Where, Your stylist, Messages, and Save Note -->
<!-- SCREENSHOT: iOS Cancel Appointment confirmation alert -->
<!-- SCREENSHOT: iOS completed appointment detail with recap and Submit Feedback -->

*Why it matters:* the customer app is not just booking; it supports messaging, appointment management, recap review, and post-visit feedback.

### 3. Associate opens the Open view

The associate opens the web dashboard at **Appointment Prep** under **Denim Fit · Guided Fitting**. The dashboard navigation includes **Open**, **In Progress**, **Completed**, **Cancelled**, and **No-shows**.

The happy path starts in **Open**, where active scheduled appointments remain visible even if their slot time has passed. The associate can filter with **Store**, **Stylist**, and **Sort** controls, use **Search customer or stylist**, and review appointments grouped by **Today**, **Upcoming**, and **Earlier**. Queue rows show the appointment time, customer name, occasion, muse tag, stylist, store, status, and a count in each view tab.

<!-- SCREENSHOT: web dashboard Appointment Prep header and Open view tabs -->
<!-- SCREENSHOT: Open appointment list with Store, Stylist, Sort, and Search customer or stylist filters -->

*Why it matters:* the associate starts from an operational queue that supports a real store workflow instead of a one-off demo screen.

### 4. Associate selects an appointment and reviews AI-assisted suggestions

The associate selects an appointment row. The detail hero shows **Appointment · #[id]**, the customer name, muse tag, appointment time, store, and occasion. For scheduled appointments, the primary lifecycle actions are **Check In** and **No-Show**.

The centerpiece is **Suggested Products**. Each suggestion includes a ranked product link, product thumbnail, fit/rise/stretch/price details when available, a customer-specific rationale, sales-floor availability, and a location label. The list also shows how many items are still **to pull**.

Suggestions are generated by the hybrid recommendation pipeline: deterministic scoring builds the shortlist, and Claude re-ranks it with rationales when available. If generation is still running, the panel shows **Preparing your picks… this can take a moment.** If generation fails, it shows **We couldn't generate suggestions. Use Regenerate to try again.** The associate can use **Regenerate** to refresh the shortlist.

<!-- SCREENSHOT: appointment detail hero with Check In and No-Show actions -->
<!-- SCREENSHOT: Suggested Products panel with ranked items, rationale, sales-floor location, and to-pull count -->
<!-- SCREENSHOT: Suggested Products pending state with Preparing your picks… this can take a moment. -->
<!-- SCREENSHOT: Suggested Products failed state with Regenerate retry copy -->

*Why it matters:* the associate gets a prepared point of view with explainable product choices, while the workflow still works if AI re-ranking is unavailable.

### 5. Associate preps products and messages the customer

In **Suggested Products**, the associate sets each product prep state with **Suggested**, **Pulled**, or **Skip**. They can add an item-level prep note in **Add a prep note…**.

The detail view also includes the customer snapshot, current stylist, a **Reassign** selector limited to eligible same-store stylists, **Messages**, and **Notifications**. In **Messages**, associate messages are labeled **You**, customer messages are labeled **Customer**, and the associate sends a note with **Message customer…** and **Send**. **Notifications** shows mock confirmation/reminder records only; no real email or push delivery is attempted.

The selected appointment polls for appointment detail, messages, and notifications every 5 seconds. Pending suggestion generation is also polled in the background, so the list updates in place.

<!-- SCREENSHOT: product prep controls showing Suggested, Pulled, Skip, and Add a prep note… -->
<!-- SCREENSHOT: customer snapshot, stylist, and Reassign selector -->
<!-- SCREENSHOT: Messages panel with customer and associate thread -->
<!-- SCREENSHOT: Notifications panel with mock confirmation/reminder records -->

*Why it matters:* product prep, messaging, and reassignment happen in the same workspace the associate uses for the appointment.

### 6. Associate checks in the customer and captures the session

When the customer arrives, the associate clicks **Check In**. The appointment moves to **In Progress**, and **Session Capture** unlocks.

The associate records **Associate session notes**, writes a customer-visible **Customer recap**, and adds **Internal feedback**. The footer explains: **Save Notes persists associate notes. Recap and internal feedback save on completion.** The associate can use **Save Notes** during the appointment, then **Complete** once the customer recap is ready.

<!-- SCREENSHOT: checked-in appointment in In Progress view -->
<!-- SCREENSHOT: Session Capture unlocked with Associate session notes, Customer recap, and Internal feedback -->
<!-- SCREENSHOT: sticky action footer with Save Notes and Complete -->

*Why it matters:* the system separates internal notes from the customer-facing recap and prevents completion until the recap is ready.

### 7. Associate completes the appointment and reviews the recap

After the fitting, the associate clicks **Complete**. The appointment moves to **Completed** and becomes read-only in the dashboard.

The completed view shows **What Was Pulled**, including pulled products and prep notes, then **Session Recap** with **Customer recap**, **Associate notes**, and **Internal feedback**. If the customer submits iOS feedback, the completed view also shows **Customer Rating** with the customer comment.

<!-- SCREENSHOT: Completed appointment view showing What Was Pulled -->
<!-- SCREENSHOT: Session Recap with Customer recap, Associate notes, and Internal feedback -->
<!-- SCREENSHOT: Customer Rating displayed after iOS feedback is submitted -->

*Why it matters:* the demo closes the loop from booking and prep through visit outcome, recap, and customer feedback.

---

## Edge cases to show

- **No-show:** from a scheduled appointment, click **No-Show**. The record moves to **No-shows** and becomes read-only.
  <!-- SCREENSHOT: No-Show action and resulting No-shows view -->

- **Reassign stylist:** use **Reassign** to move a scheduled appointment to another eligible stylist at the same mocked store.
  <!-- SCREENSHOT: Reassign selector with same-store stylist options -->

- **Cancelled appointment:** from iOS, tap **Cancel Appointment**, enter an optional reason, then confirm **Cancel Appointment**. The dashboard shows the record under **Cancelled**.
  <!-- SCREENSHOT: iOS cancel alert and web Cancelled view -->

- **AI unavailable or failed generation:** suggestions still have a deterministic fallback path. Show the failed banner and **Regenerate**, or run without an AI key to show scorer-derived suggested products.
  <!-- SCREENSHOT: failed suggestions banner and Regenerate button -->

- **Empty messaging/notification states:** new appointments can show **No messages yet.** and **No notification records.** until activity exists.
  <!-- SCREENSHOT: empty Messages and Notifications panels -->

---

## Demo tips

- Start with the iOS booking only long enough to create context, then move quickly to the associate **Open** view.
- Narrate the business value at each step: customer intent capture, associate preparedness, product prep, lifecycle tracking, recap, and feedback.
- Keep screenshots focused on real UI labels so judges can follow the flow without needing the codebase.
