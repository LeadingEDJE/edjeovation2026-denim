import SwiftUI

struct FittingView: View {
    @State private var currentUser: CurrentUser?
    @State private var users: [CurrentUser] = []
    @State private var slots: [AppointmentSlot] = []
    @State private var selectedSlot: AppointmentSlot?
    @State private var appointment: Appointment?
    @State private var screen: AppScreen = .home
    @State private var step: JourneyStep = .landing
    @State private var occasion = ""
    @State private var focusColors = Set<String>()
    @State private var avoidColors = Set<String>()
    @State private var selectedKeywords = Set<String>()
    @State private var guidance = ""
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
                        screen = .home
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
            if let appointment {
                existingAppointment(appointment)
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
                eyebrow: "Step 3 of 5",
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
        case .schedule:
            questionPage(
                eyebrow: "Step 4 of 5",
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
                }

                if let appointment {
                    Button {
                        guidance = appointment.guidance
                        screen = .appointmentDetail
                    } label: {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(displayDate(appointment.slotStart))
                                        .font(.headline)
                                    Text("with \(appointment.assignedStylist.displayName)")
                                        .font(.subheadline)
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
                    .disabled(currentUser == nil || slots.isEmpty)
                }

                Text(status)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
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
            .disabled(currentUser == nil || slots.isEmpty)
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

    private func existingAppointment(_ appointment: Appointment) -> some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Upcoming appointment")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(.teal)
                    Text("Your fitting journey is booked.")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    Text("You can update the note your stylist sees or cancel this appointment.")
                        .foregroundStyle(.secondary)
                    SummaryRow(label: "Appointment", value: displayDate(appointment.slotStart))
                    SummaryRow(label: "Stylist", value: "\(appointment.assignedStylist.displayName), \(appointment.assignedStylist.title)")
                    SummaryRow(label: "Muse", value: appointment.museTag)
                    SummaryRow(label: "Occasion", value: appointment.occasion)
                    SummaryRow(label: "Colors", value: "Focus: \(appointment.focusColors.isEmpty ? "None" : appointment.focusColors). Avoid: \(appointment.avoidColors.isEmpty ? "None" : appointment.avoidColors).")
                    TextField("Note for your stylist", text: $guidance, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(4, reservesSpace: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
            }
            HStack {
                Button("Cancel appointment", role: .destructive) {
                    Task { await cancelAppointment() }
                }
                .buttonStyle(.bordered)
                .disabled(isLoading)
                Spacer()
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
            }
            .padding(20)
            .background(.regularMaterial)
        }
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
                    Text("Step 5 of 5")
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
                SummaryRow(label: "Occasion", value: appointment.occasion)
                SummaryRow(label: "Colors", value: "Focus: \(appointment.focusColors.isEmpty ? "None" : appointment.focusColors). Avoid: \(appointment.avoidColors.isEmpty ? "None" : appointment.avoidColors).")
            }
            Button("Manage appointment") {
                screen = .appointmentDetail
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
        guard currentUser == nil else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            async let user = apiClient.getCurrentUser()
            async let availableUsers = apiClient.getUsers()
            async let availableSlots = apiClient.getAppointmentSlots()
            async let upcomingAppointment = apiClient.getUpcomingAppointment()
            currentUser = try await user
            users = try await availableUsers
            slots = try await availableSlots
            appointment = try await upcomingAppointment
            guidance = appointment?.guidance ?? ""
            status = "Ready"
        } catch {
            status = "Could not load your fitting journey"
        }
    }

    @MainActor
    private func bookAppointment() async {
        guard let selectedSlot else { return }
        isLoading = true
        status = "Confirming stylist"
        defer { isLoading = false }

        do {
            let request = CreateAppointmentRequest(
                slotStart: selectedSlot.slotStart,
                occasion: occasion,
                focusColors: colorPayload(focusColors),
                avoidColors: colorPayload(avoidColors),
                styleKeywords: selectedKeywords.sorted(),
                guidance: guidance,
                orderHistoryScenario: "standard"
            )
            appointment = try await apiClient.createAppointment(input: request).appointment
            status = "Confirmed"
            step = .confirmation
        } catch {
            status = "Could not confirm that appointment time"
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
        guard let appointment else { return }
        isLoading = true
        status = "Saving note"
        defer { isLoading = false }

        do {
            self.appointment = try await apiClient.updateAppointment(id: appointment.id, guidance: guidance).appointment
            status = "Note saved"
        } catch {
            status = "Could not save appointment note"
        }
    }

    @MainActor
    private func cancelAppointment() async {
        guard let appointment else { return }
        isLoading = true
        status = "Canceling appointment"
        defer { isLoading = false }

        do {
            try await apiClient.cancelAppointment(id: appointment.id)
            clearJourney()
            self.appointment = nil
            step = .landing
            status = "Appointment canceled"
        } catch {
            status = "Could not cancel appointment"
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
            appointment = try await apiClient.getUpcomingAppointment()
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
}

private enum JourneyStep {
    case landing
    case occasion
    case colors
    case style
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
        case .colors: return 0.4
        case .style: return 0.6
        case .schedule: return 0.8
        case .review: return 1.0
        case .landing, .confirmation: return 0
        }
    }

    var next: JourneyStep {
        switch self {
        case .landing: return .occasion
        case .occasion: return .colors
        case .colors: return .style
        case .style: return .schedule
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
        case .schedule: return .style
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
