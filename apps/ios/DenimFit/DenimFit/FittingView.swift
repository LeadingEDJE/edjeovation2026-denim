import SwiftUI

struct FittingView: View {
    @State private var currentUser: CurrentUser?
    @State private var users: [CurrentUser] = []
    @State private var stores: [Store] = []
    @State private var selectedStore: Store?
    @State private var slots: [AppointmentSlot] = []
    @State private var selectedSlot: AppointmentSlot?
    @State private var appointment: Appointment?
    @State private var detailAppointment: Appointment?
    @State private var pastAppointments: [Appointment] = []
    @State private var appointmentMessages: [AppointmentMessage] = []
    @State private var appointmentNotifications: [AppointmentNotification] = []
    @State private var screen: AppScreen = .home
    @State private var step: JourneyStep = .landing
    @State private var occasion = ""
    @State private var focusColors = Set<String>()
    @State private var avoidColors = Set<String>()
    @State private var selectedKeywords = Set<String>()
    @State private var guidance = ""
    @State private var messageDraft = ""
    @State private var cancelReason = ""
    @State private var feedbackRating = 5
    @State private var feedbackComment = ""
    @State private var status = "Loading your profile"
    @State private var isLoading = false

    private let apiClient = APIClient()
    private let styleOptions = StyleOption.all
    private let colorOptions = [
        "No preference",
        "Black",
        "White",
        "Cream",
        "Light wash",
        "Medium wash",
        "Dark wash",
        "Grey",
        "Navy",
        "Green",
        "Pink",
        "Red"
    ]
    private let noColorPreference = "No preference"

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if screen == .booking && step != .landing && step != .confirmation {
                    ProgressView(value: step.progress)
                        .padding(.horizontal)
                        .padding(.top)
                }

                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .navigationTitle(navigationTitle)
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if screen == .booking {
                        Button("Exit") {
                            exitBooking()
                        }
                    }
                    Button("Home") {
                        Task { await refreshCustomerData() }
                    }
                    Button("Admin") {
                        screen = .admin
                    }
                }
            }
            .task {
                await loadInitialData()
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch screen {
        case .home:
            home
        case .booking:
            bookingContent
        case .appointmentDetail:
            if let detailAppointment {
                existingAppointment(detailAppointment)
            } else {
                home
            }
        case .admin:
            admin
        }
    }

    @ViewBuilder
    private var bookingContent: some View {
        switch step {
        case .landing:
            newJourneyLanding
        case .occasion:
            questionPage(
                eyebrow: "Step 1 of 5",
                title: "What are you shopping for?",
                subtitle: "Share any event, trip, or wardrobe moment so your stylist can prepare with purpose."
            ) {
                TextField("Upcoming event or shopping goal", text: $occasion, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3, reservesSpace: true)
            }
        case .colors:
            questionPage(
                eyebrow: "Step 2 of 5",
                title: "Any color guardrails?",
                subtitle: "Tell us what to focus on and what to avoid."
            ) {
                ColorMultiSelect(label: "Focus on", selections: $focusColors, options: selectableColorOptions)
                ColorMultiSelect(label: "Avoid", selections: $avoidColors, options: selectableColorOptions)
            }
        case .style:
            questionPage(
                eyebrow: "Step 3 of 6",
                title: "How would you describe your style?",
                subtitle: "Choose the words that feel most like you."
            ) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 132), spacing: 10)], spacing: 10) {
                    ForEach(styleOptions) { option in
                        Button {
                            toggleKeyword(option.value)
                        } label: {
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: selectedKeywords.contains(option.value) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(selectedKeywords.contains(option.value) ? Color.teal : Color.secondary)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(option.label)
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.primary)
                                    Text(option.muse)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(selectedKeywords.contains(option.value) ? Color.teal.opacity(0.12) : Color(.secondarySystemGroupedBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(selectedKeywords.contains(option.value) ? Color.teal : Color(.separator), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                Text("Muse: \(derivedMuse)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        case .store:
            questionPage(
                eyebrow: "Step 4 of 6",
                title: "Choose a store",
                subtitle: "Pick the fitting room location before choosing a time."
            ) {
                if stores.isEmpty {
                    ContentUnavailableView("No stores available", systemImage: "mappin.slash")
                } else {
                    ForEach(stores) { store in
                        Button {
                            Task { await selectStore(store) }
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: selectedStore?.storeId == store.storeId ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(selectedStore?.storeId == store.storeId ? Color.teal : Color.secondary)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(store.name)
                                        .font(.headline)
                                    Text("\(store.address) · \(store.phone)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .padding()
                            .background(selectedStore?.storeId == store.storeId ? Color.teal.opacity(0.12) : Color(.secondarySystemGroupedBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(selectedStore?.storeId == store.storeId ? Color.teal : Color(.separator), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        case .schedule:
            questionPage(
                eyebrow: "Step 5 of 6",
                title: "Choose a time",
                subtitle: "We only show times when at least one stylist is scheduled."
            ) {
                if slots.isEmpty {
                    ContentUnavailableView("No slots available", systemImage: "calendar.badge.exclamationmark")
                } else {
                    List(slots) { slot in
                        Button {
                            selectedSlot = slot
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(slotLabel(slot))
                                        .font(.headline)
                                    Text("\(slot.availableStylistCount) stylist\(slot.availableStylistCount == 1 ? "" : "s") available")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if selectedSlot == slot {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.teal)
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .frame(minHeight: 320)
                }
            }
        case .review:
            review
        case .confirmation:
            confirmation
        }
    }

    private var home: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Upcoming appointments")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                if let currentUser {
                    Label(currentUser.displayName, systemImage: "person.crop.circle")
                        .foregroundStyle(.secondary)
                    fitProfileContext(currentUser)
                }

                if let appointment {
                    Button {
                        Task { await openAppointmentDetail(appointment) }
                    } label: {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(displayDate(appointment.slotStart))
                                        .font(.headline)
                                    Text("with \(appointment.assignedStylist.displayName)")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                    Text(appointment.store.name)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundStyle(.secondary)
                            }
                            HStack {
                                Text(appointment.museTag)
                                Text(appointment.occasion)
                            }
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.teal)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                } else {
                    ContentUnavailableView("No upcoming appointments", systemImage: "calendar")
                    Button {
                        startBooking()
                    } label: {
                        Text("Start your fitting journey")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(currentUser == nil || stores.isEmpty)
                }

                Divider()

                Text("Past appointments")
                    .font(.title2)
                    .fontWeight(.bold)
                if pastAppointments.isEmpty {
                    Text("No past fitting appointments yet.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(pastAppointments) { pastAppointment in
                        Button {
                            Task { await openAppointmentDetail(pastAppointment) }
                        } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(displayDate(pastAppointment.slotStart))
                                        .font(.headline)
                                    Spacer()
                                    Text(pastAppointment.status.capitalized)
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.secondary)
                                }
                                Text("with \(pastAppointment.assignedStylist.displayName)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                if !pastAppointment.sessionNotes.isEmpty {
                                    Text(pastAppointment.sessionNotes)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                            .background(Color(.secondarySystemGroupedBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                }

                Text(status)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
        .refreshable {
            await refreshCustomerData()
        }
    }

    private var newJourneyLanding: some View {
        VStack(alignment: .leading, spacing: 24) {
            Spacer()
            Text("Abercrombie personalized fitting")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(.teal)
            Text("A better fitting room starts before you arrive.")
                .font(.largeTitle)
                .fontWeight(.bold)
            Text("Answer a few focused questions, choose a time, and we will prepare a stylist with your preferences before your appointment.")
                .foregroundStyle(.secondary)
            if let currentUser {
                Label(currentUser.displayName, systemImage: "person.crop.circle")
                    .foregroundStyle(.secondary)
            }
            Button {
                startBooking()
            } label: {
                Text("Start your fitting journey")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(currentUser == nil || stores.isEmpty)
            Text(status)
                .font(.footnote)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(24)
    }

    private var admin: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Admin")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                Text("Switch the active mock customer for local testing.")
                    .foregroundStyle(.secondary)
                ForEach(users, id: \.customerId) { user in
                    Button {
                        Task { await setActiveUser(user) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.displayName)
                                    .font(.headline)
                                Text(user.loyaltyId)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if user.customerId == currentUser?.customerId {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.teal)
                            }
                        }
                        .padding()
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoading)
                }
                Text(status)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
    }

    @ViewBuilder
    private func existingAppointment(_ appointment: Appointment) -> some View {
        let isActive = appointment.status == "scheduled" || appointment.status == "checked_in"
        let canEdit = isActive
        let canCancel = appointment.status == "scheduled" && isFuture(appointment.slotStart)
        let canSendMessage = isActive
        let canFeedback = appointment.status == "completed"

        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(isActive ? "Appointment" : "Appointment history")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(.teal)
                    Text(isActive ? "Your fitting journey" : "Your fitting recap")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    Text(isActive ? "You can update the note your stylist sees and message the store team until the appointment closes." : "This appointment is read-only except post-visit feedback.")
                        .foregroundStyle(.secondary)
                    SummaryRow(label: "Appointment", value: displayDate(appointment.slotStart))
                    SummaryRow(label: "Store", value: "\(appointment.store.name)\n\(appointment.store.address)\n\(appointment.store.phone)")
                    SummaryRow(label: "Stylist", value: "\(appointment.assignedStylist.displayName), \(appointment.assignedStylist.title)")
                    if let bio = appointment.assignedStylist.bio {
                        SummaryRow(label: "Stylist profile", value: bio)
                    }
                    if let specialties = appointment.assignedStylist.specialties, !specialties.isEmpty {
                        SummaryRow(label: "Stylist specialties", value: specialties.joined(separator: ", "))
                    }
                    SummaryRow(label: "Status", value: appointment.status.capitalized)
                    SummaryRow(label: "Muse", value: appointment.museTag)
                    SummaryRow(label: "Occasion", value: appointment.occasion)
                    SummaryRow(label: "Colors", value: "Focus: \(appointment.focusColors.isEmpty ? "None" : appointment.focusColors). Avoid: \(appointment.avoidColors.isEmpty ? "None" : appointment.avoidColors).")
                    if let currentUser {
                        fitProfileContext(currentUser)
                    }
                    notificationStatus
                    messageThread(canSendMessage: canSendMessage)
                    if canEdit {
                        TextField("Note for your stylist", text: $guidance, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(4, reservesSpace: true)
                    } else {
                        SummaryRow(label: "Your note", value: appointment.guidance.isEmpty ? "None" : appointment.guidance)
                        SummaryRow(label: "Recap", value: appointment.customerRecap.isEmpty ? "Not added yet" : appointment.customerRecap)
                    }
                    if canCancel {
                        TextField("Optional cancellation reason", text: $cancelReason, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(3, reservesSpace: true)
                    }
                    if canFeedback {
                        feedbackForm(appointment)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
            }
            HStack {
                if canCancel {
                    Button("Cancel appointment", role: .destructive) {
                        Task { await cancelAppointment() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(isLoading)
                }
                Spacer()
                if canEdit {
                    Button {
                        Task { await updateAppointmentGuidance() }
                    } label: {
                        if isLoading {
                            ProgressView()
                        } else {
                            Text("Save note")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isLoading)
                } else {
                    Button("Done") {
                        detailAppointment = nil
                        screen = .home
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding(20)
            .background(.regularMaterial)
        }
        .refreshable {
            await refreshCustomerData()
        }
    }

    private func fitProfileContext(_ user: CurrentUser) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Fit profile")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(.secondary)
            Text("Height \(user.measurements.heightInches) in · Waist \(formattedMeasurement(user.measurements.waistInches)) in · Hip \(formattedMeasurement(user.measurements.hipInches)) in · Inseam \(formattedMeasurement(user.measurements.inseamInches)) in")
                .font(.subheadline)
            Text("Prefers \(user.preferences.fitPreference) fits with \(user.preferences.stretchPreference) denim.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var notificationStatus: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Mock notifications")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(.secondary)
            if appointmentNotifications.isEmpty {
                Text("No notification records.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(appointmentNotifications) { notification in
                    Text("\(notification.type.capitalized): \(notification.status) for \(displayDate(notification.scheduledFor))")
                        .font(.subheadline)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func messageThread(canSendMessage: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Messages")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(.secondary)
            if appointmentMessages.isEmpty {
                Text("No messages yet.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(appointmentMessages) { message in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(message.authorType.capitalized)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                        Text(message.body)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(Color(.systemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            if canSendMessage {
                TextField("Message your stylist", text: $messageDraft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3, reservesSpace: true)
                Button("Send message") {
                    Task { await sendAppointmentMessage() }
                }
                .buttonStyle(.bordered)
                .disabled(isLoading || messageDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func feedbackForm(_ appointment: Appointment) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Feedback")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(.secondary)
            if let rating = appointment.customerFeedbackRating {
                Text("Rating: \(rating)/5")
                Text(appointment.customerFeedbackComment.isEmpty ? "No comment." : appointment.customerFeedbackComment)
                    .foregroundStyle(.secondary)
            } else {
                Stepper("Rating: \(feedbackRating)/5", value: $feedbackRating, in: 1...5)
                TextField("Optional comment", text: $feedbackComment, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3, reservesSpace: true)
                Button("Submit feedback") {
                    Task { await submitFeedback() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isLoading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func questionPage<Content: View>(
        eyebrow: String,
        title: String,
        subtitle: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(eyebrow)
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(.teal)
                    Text(title)
                        .font(.title)
                        .fontWeight(.bold)
                    Text(subtitle)
                        .foregroundStyle(.secondary)
                    content()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
            }
            navigationButtons
                .padding(20)
                .background(.regularMaterial)
        }
    }

    private var review: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Step 6 of 6")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(.teal)
                    Text("Review your fitting journey")
                        .font(.title)
                        .fontWeight(.bold)
                    SummaryRow(label: "Customer", value: currentUser?.displayName ?? "Logged-in customer")
                    SummaryRow(label: "Occasion", value: occasion)
                    SummaryRow(label: "Focus colors", value: colorSummary(focusColors))
                    SummaryRow(label: "Avoid colors", value: colorSummary(avoidColors))
                    SummaryRow(label: "Muse", value: derivedMuse)
                    SummaryRow(label: "Store", value: selectedStore?.name ?? "No store selected")
                    SummaryRow(label: "Appointment", value: selectedSlot.map(slotLabel) ?? "No time selected")
                    TextField("Optional note for your stylist", text: $guidance, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(4, reservesSpace: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
            }
            HStack {
                Button("Back") { step = step.previous }
                    .buttonStyle(.bordered)
                Spacer()
                Button {
                    Task { await bookAppointment() }
                } label: {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("Confirm appointment")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isLoading || selectedSlot == nil)
            }
            .padding(20)
            .background(.regularMaterial)
            Text(status)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 20)
                .padding(.bottom, 12)
        }
    }

    private var confirmation: some View {
        VStack(alignment: .leading, spacing: 18) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.teal)
            Text("You are booked")
                .font(.largeTitle)
                .fontWeight(.bold)
            if let appointment {
                Text("Your stylist, \(appointment.assignedStylist.displayName), will prepare around your \(appointment.museTag) direction.")
                    .foregroundStyle(.secondary)
                SummaryRow(label: "Appointment", value: displayDate(appointment.slotStart))
                SummaryRow(label: "Store", value: "\(appointment.store.name), \(appointment.store.city)")
                SummaryRow(label: "Occasion", value: appointment.occasion)
                SummaryRow(label: "Colors", value: "Focus: \(appointment.focusColors.isEmpty ? "None" : appointment.focusColors). Avoid: \(appointment.avoidColors.isEmpty ? "None" : appointment.avoidColors).")
                SummaryRow(label: "Notifications", value: "\(appointment.notificationSummary.count) mock records created")
            }
            Button("Manage appointment") {
                if let appointment = appointment {
                    Task { await openAppointmentDetail(appointment) }
                }
            }
            .buttonStyle(.bordered)
            Spacer()
        }
        .padding(24)
    }

    private var navigationButtons: some View {
        HStack {
            if step.previous != step {
                Button("Back") { step = step.previous }
                    .buttonStyle(.bordered)
            }
            Spacer()
            Button("Next") { step = step.next }
                .buttonStyle(.borderedProminent)
                .disabled(!canAdvance)
        }
    }

    private var canAdvance: Bool {
        switch step {
        case .landing:
            return currentUser != nil && appointment == nil
        case .occasion:
            return !occasion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .colors:
            return true
        case .style:
            return !selectedKeywords.isEmpty
        case .store:
            return selectedStore != nil
        case .schedule:
            return selectedSlot != nil
        case .review:
            return selectedSlot != nil
        case .confirmation:
            return true
        }
    }

    private var navigationTitle: String {
        switch screen {
        case .home:
            return "Appointments"
        case .booking:
            return step.navigationTitle
        case .appointmentDetail:
            return "Appointment"
        case .admin:
            return "Admin"
        }
    }

    private var derivedMuse: String {
        let clean = ["minimal", "effortless", "timeless essentials"]
        let romantic = ["feminine", "soft", "subtly dressed-up"]
        let boyish = ["preppy", "relaxed", "sporty", "menswear-inspired"]
        let statement = ["trend-forward", "bold", "boundary-pushing"]
        let groups = [
            ("Clean Muse", clean),
            ("Romantic Muse", romantic),
            ("Boyish Muse", boyish),
            ("Statement Maker", statement)
        ]
        return groups
            .map { ($0.0, $0.1.filter { selectedKeywords.contains($0) }.count) }
            .sorted { $0.1 > $1.1 }
            .first?.0 ?? "Clean Muse"
    }

    @MainActor
    private func loadInitialData() async {
        guard currentUser == nil else {
            await refreshCustomerData()
            return
        }
        isLoading = true
        defer { isLoading = false }

        do {
            currentUser = try await apiClient.getCurrentUser()
            users = try await apiClient.getUsers()
            stores = try await apiClient.getStores()
            selectedStore = stores.first
            if let selectedStore {
                slots = try await apiClient.getAppointmentSlots(storeId: selectedStore.storeId)
            }
            appointment = try await apiClient.getUpcomingAppointment()
            pastAppointments = try await apiClient.getPastAppointments()
            guidance = appointment?.guidance ?? ""
            status = "Ready"
        } catch {
            status = "Could not load your fitting journey"
        }
    }

    @MainActor
    private func refreshCustomerData() async {
        isLoading = true
        status = "Refreshing"
        defer { isLoading = false }

        do {
            currentUser = try await apiClient.getCurrentUser()
            users = try await apiClient.getUsers()
            stores = try await apiClient.getStores()
            selectedStore = selectedStore ?? stores.first
            if let selectedStore {
                slots = try await apiClient.getAppointmentSlots(storeId: selectedStore.storeId)
            } else {
                slots = []
            }
            appointment = try await apiClient.getUpcomingAppointment()
            pastAppointments = try await apiClient.getPastAppointments()
            detailAppointment = nil
            appointmentMessages = []
            appointmentNotifications = []
            guidance = appointment?.guidance ?? ""
            screen = .home
            step = .landing
            status = "Ready"
        } catch {
            status = "Could not refresh your fitting journey"
        }
    }

    @MainActor
    private func bookAppointment() async {
        guard let selectedSlot, let selectedStore else { return }
        isLoading = true
        status = "Confirming stylist"
        defer { isLoading = false }

        do {
            let request = CreateAppointmentRequest(
                storeId: selectedStore.storeId,
                slotStart: selectedSlot.slotStart,
                occasion: occasion,
                focusColors: colorPayload(focusColors),
                avoidColors: colorPayload(avoidColors),
                styleKeywords: selectedKeywords.sorted(),
                guidance: guidance,
                orderHistoryScenario: "standard"
            )
            appointment = try await apiClient.createAppointment(input: request).appointment
            pastAppointments = try await apiClient.getPastAppointments()
            status = "Confirmed"
            step = .confirmation
        } catch {
            status = "Could not confirm that appointment time"
        }
    }

    @MainActor
    private func selectStore(_ store: Store) async {
        selectedStore = store
        selectedSlot = nil
        isLoading = true
        status = "Loading \(store.city) appointments"
        defer { isLoading = false }

        do {
            slots = try await apiClient.getAppointmentSlots(storeId: store.storeId)
            status = "Choose an appointment time"
        } catch {
            slots = []
            status = "Could not load appointments for \(store.city)"
        }
    }

    private func toggleKeyword(_ keyword: String) {
        if selectedKeywords.contains(keyword) {
            selectedKeywords.remove(keyword)
        } else {
            selectedKeywords.insert(keyword)
        }
    }

    private func resetJourney() {
        clearJourney()
        appointment = nil
        status = "Ready"
        step = .landing
    }

    private func startBooking() {
        guard appointment == nil else { return }
        clearJourney()
        selectedStore = selectedStore ?? stores.first
        step = .occasion
        screen = .booking
    }

    private func exitBooking() {
        clearJourney()
        step = .landing
        screen = .home
        status = "Ready"
    }

    private func clearJourney() {
        occasion = ""
        focusColors = []
        avoidColors = []
        selectedKeywords = []
        selectedSlot = nil
        guidance = ""
        messageDraft = ""
        cancelReason = ""
        feedbackRating = 5
        feedbackComment = ""
    }

    private func slotLabel(_ slot: AppointmentSlot) -> String {
        "\(displayDate(slot.slotStart))"
    }

    private func colorSummary(_ values: Set<String>) -> String {
        let value = colorPayload(values)
        return value.isEmpty ? "None specified" : value
    }

    private func colorPayload(_ values: Set<String>) -> String {
        values.sorted().joined(separator: ", ")
    }

    @MainActor
    private func updateAppointmentGuidance() async {
        guard let detailAppointment else { return }
        isLoading = true
        status = "Saving note"
        defer { isLoading = false }

        do {
            let updated = try await apiClient.updateAppointment(id: detailAppointment.id, guidance: guidance).appointment
            self.appointment = updated
            self.detailAppointment = nil
            status = "Note saved"
            screen = .home
        } catch {
            status = "Could not save appointment note"
        }
    }

    @MainActor
    private func cancelAppointment() async {
        guard let detailAppointment else { return }
        isLoading = true
        status = "Canceling appointment"
        defer { isLoading = false }

        do {
            let updated = try await apiClient.cancelAppointment(id: detailAppointment.id, reason: cancelReason).appointment
            clearJourney()
            self.appointment = nil
            self.detailAppointment = updated
            self.pastAppointments = try await apiClient.getPastAppointments()
            step = .landing
            status = "Appointment canceled"
        } catch {
            status = "Could not cancel appointment"
        }
    }

    @MainActor
    private func openAppointmentDetail(_ appointment: Appointment) async {
        isLoading = true
        defer { isLoading = false }

        guidance = appointment.guidance
        detailAppointment = appointment
        feedbackRating = appointment.customerFeedbackRating ?? 5
        feedbackComment = appointment.customerFeedbackComment
        messageDraft = ""
        cancelReason = appointment.cancelReason ?? ""

        do {
            appointmentMessages = try await apiClient.getAppointmentMessages(id: appointment.id)
            appointmentNotifications = try await apiClient.getAppointmentNotifications(id: appointment.id)
            screen = .appointmentDetail
            status = "Ready"
        } catch {
            appointmentMessages = []
            appointmentNotifications = []
            screen = .appointmentDetail
            status = "Could not load appointment messages"
        }
    }

    @MainActor
    private func sendAppointmentMessage() async {
        guard let detailAppointment else { return }
        let body = messageDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            let message = try await apiClient.postAppointmentMessage(id: detailAppointment.id, body: body)
            appointmentMessages.append(message)
            messageDraft = ""
            status = "Message sent"
        } catch {
            status = "Could not send message"
        }
    }

    @MainActor
    private func submitFeedback() async {
        guard let detailAppointment else { return }
        isLoading = true
        status = "Submitting feedback"
        defer { isLoading = false }

        do {
            let updated = try await apiClient.submitFeedback(id: detailAppointment.id, rating: feedbackRating, comment: feedbackComment).appointment
            self.detailAppointment = updated
            self.pastAppointments = try await apiClient.getPastAppointments()
            status = "Feedback submitted"
        } catch {
            status = "Could not submit feedback"
        }
    }

    @MainActor
    private func setActiveUser(_ user: CurrentUser) async {
        isLoading = true
        status = "Switching user"
        defer { isLoading = false }

        do {
            let active = try await apiClient.setActiveUser(customerId: user.customerId)
            currentUser = active.user
            stores = try await apiClient.getStores()
            selectedStore = stores.first
            if let selectedStore {
                slots = try await apiClient.getAppointmentSlots(storeId: selectedStore.storeId)
            } else {
                slots = []
            }
            appointment = try await apiClient.getUpcomingAppointment()
            pastAppointments = try await apiClient.getPastAppointments()
            detailAppointment = nil
            appointmentMessages = []
            appointmentNotifications = []
            guidance = appointment?.guidance ?? ""
            clearJourney()
            step = .landing
            screen = .home
            status = "Active user: \(active.user.displayName)"
        } catch {
            status = "Could not switch active user"
        }
    }

    private var selectableColorOptions: [String] {
        colorOptions.filter { $0 != noColorPreference }
    }

    private func displayDate(_ value: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: value) else { return value }
        return date.formatted(date: .abbreviated, time: .shortened)
    }

    private func isFuture(_ value: String) -> Bool {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: value) else { return false }
        return date > Date()
    }

    private func formattedMeasurement(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)))
    }
}

private enum JourneyStep {
    case landing
    case occasion
    case colors
    case style
    case store
    case schedule
    case review
    case confirmation

    var navigationTitle: String {
        switch self {
        case .landing:
            return "Fitting"
        case .confirmation:
            return "Confirmed"
        default:
            return "Fitting Journey"
        }
    }

    var progress: Double {
        switch self {
        case .occasion: return 0.2
        case .colors: return 0.35
        case .style: return 0.5
        case .store: return 0.65
        case .schedule: return 0.82
        case .review: return 1.0
        case .landing, .confirmation: return 0
        }
    }

    var next: JourneyStep {
        switch self {
        case .landing: return .occasion
        case .occasion: return .colors
        case .colors: return .style
        case .style: return .store
        case .store: return .schedule
        case .schedule: return .review
        case .review: return .confirmation
        case .confirmation: return .confirmation
        }
    }

    var previous: JourneyStep {
        switch self {
        case .landing: return .landing
        case .occasion: return .landing
        case .colors: return .occasion
        case .style: return .colors
        case .store: return .style
        case .schedule: return .store
        case .review: return .schedule
        case .confirmation: return .confirmation
        }
    }
}

private enum AppScreen {
    case home
    case booking
    case appointmentDetail
    case admin
}

private struct StyleOption: Identifiable {
    let id = UUID()
    let value: String
    let label: String
    let muse: String

    static let all = [
        StyleOption(value: "minimal", label: "Minimal", muse: "Clean Muse"),
        StyleOption(value: "effortless", label: "Effortless", muse: "Clean Muse"),
        StyleOption(value: "timeless essentials", label: "Timeless essentials", muse: "Clean Muse"),
        StyleOption(value: "feminine", label: "Feminine", muse: "Romantic Muse"),
        StyleOption(value: "soft", label: "Soft", muse: "Romantic Muse"),
        StyleOption(value: "subtly dressed-up", label: "Subtly dressed-up", muse: "Romantic Muse"),
        StyleOption(value: "preppy", label: "Preppy", muse: "Boyish Muse"),
        StyleOption(value: "relaxed", label: "Relaxed", muse: "Boyish Muse"),
        StyleOption(value: "sporty", label: "Sporty", muse: "Boyish Muse"),
        StyleOption(value: "menswear-inspired", label: "Menswear-inspired", muse: "Boyish Muse"),
        StyleOption(value: "trend-forward", label: "Trend-forward", muse: "Statement Maker"),
        StyleOption(value: "bold", label: "Bold", muse: "Statement Maker"),
        StyleOption(value: "boundary-pushing", label: "Boundary-pushing", muse: "Statement Maker")
    ]
}

private struct ColorMultiSelect: View {
    let label: String
    @Binding var selections: Set<String>
    let options: [String]

    private var displayValue: String {
        selections.isEmpty ? "No preference" : selections.sorted().joined(separator: ", ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(.secondary)
            Menu {
                ForEach(options, id: \.self) { option in
                    Button {
                        if selections.contains(option) {
                            selections.remove(option)
                        } else {
                            selections.insert(option)
                        }
                    } label: {
                        Label(option, systemImage: selections.contains(option) ? "checkmark.circle.fill" : "circle")
                    }
                }
                if !selections.isEmpty {
                    Divider()
                    Button("Clear selection", role: .destructive) {
                        selections.removeAll()
                    }
                }
            } label: {
                HStack {
                    Text(displayValue)
                        .foregroundStyle(displayValue == "No preference" ? .secondary : .primary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding()
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(.separator), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
        }
    }
}

private struct SummaryRow: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(.secondary)
            Text(value)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

#Preview {
    FittingView()
}
