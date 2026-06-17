import PhotosUI
import SwiftUI
import UIKit

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
    @State private var selectedCatalogAudiences: Set<String> = ["womens"]
    @State private var guidance = ""
    @State private var messageDraft = ""
    @State private var cancelReason = ""
    @State private var showCancelConfirmation = false
    @State private var feedbackRating = 5
    @State private var feedbackComment = ""
    @State private var outfitAnalysis: OutfitAnalysis?
    @State private var showOutfitSheet = false
    @State private var fitHeight = ""
    @State private var fitChest = ""
    @State private var fitWaist = ""
    @State private var fitHip = ""
    @State private var fitInseam = ""
    @State private var fitPreference = "straight"
    @State private var stretchPreference = "comfort-stretch"
    @State private var status = "Loading your profile"
    @State private var isLoading = false

    private let apiClient = APIClient()
    private let styleGroups = MuseStyleGroup.all
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

    private let occasionStarters = [
        "Wardrobe refresh",
        "A specific event",
        "Travel / a trip",
        "New job",
        "Body change"
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if screen == .booking, step.stepNumber > 0 {
                    StepProgressBar(current: step.stepNumber, total: 8)
                        .padding(.horizontal, 22)
                        .padding(.top, 12)
                        .padding(.bottom, 4)
                        .background(Color.canvas)
                }

                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(Color.canvas)
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .tint(isNavyChrome ? .white : Color.ink)
            .toolbarColorScheme(isNavyChrome ? .dark : .light, for: .navigationBar)
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

    private var isNavyChrome: Bool {
        screen == .booking && (step == .landing || step == .confirmation)
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
                eyebrow: "Step 1 of 8",
                title: "What are you shopping for?",
                subtitle: "An event, a trip, or just refreshing your rotation. Tell us in your words."
            ) {
                brandTextField("Need one everyday jean that works for café work days and the occasional dinner out…", text: $occasion, lines: 5)

                VStack(alignment: .leading, spacing: 11) {
                    Text("Or start from a moment").eyebrow()
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 104), spacing: 8, alignment: .leading)],
                        alignment: .leading,
                        spacing: 8
                    ) {
                        ForEach(occasionStarters, id: \.self) { starter in
                            let selected = occasion == starter
                            Button {
                                occasion = starter
                            } label: {
                                Text(starter)
                                    .font(.system(size: 13))
                                    .foregroundStyle(selected ? Color.white : Color(hex: 0x3A3A3A))
                                    .lineLimit(2)
                                    .multilineTextAlignment(.center)
                                    .padding(.vertical, 9)
                                    .padding(.horizontal, 13)
                                    .frame(maxWidth: .infinity, minHeight: 58, maxHeight: 58)
                                    .background(selected ? Color.ink : Color.surface)
                                    .overlay(Rectangle().stroke(selected ? Color.ink : Color.line, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        case .colors:
            questionPage(
                eyebrow: "Step 2 of 8",
                title: "Any colors in mind?",
                subtitle: "Optional. Pick washes to lean into — and any to steer clear of."
            ) {
                ColorSwatchGrid(title: "Focus on", selections: focusColorBinding, options: selectableColorOptions, mode: .focus)
                ColorSwatchGrid(title: "Avoid", selections: avoidColorBinding, options: selectableColorOptions, mode: .avoid)
            }
        case .style:
            questionPage(
                eyebrow: "Step 3 of 8",
                title: "Pick your style signals",
                subtitle: "Choose the words that feel most like you."
            ) {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    ForEach(styleGroups) { group in
                        let selected = selectedKeywords == Set(group.values)
                        Button {
                            selectedKeywords = Set(group.values)
                        } label: {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(group.title)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(selected ? Color.white : Color.ink)
                                Text(group.description)
                                    .font(.system(size: 12))
                                    .foregroundStyle(selected ? Color(hex: 0xC9D4DC) : Color.muted)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .frame(minHeight: 78, alignment: .topLeading)
                            .padding(.vertical, 12)
                            .padding(.horizontal, 12)
                            .background(selected ? Color.ink : Color.surface)
                            .overlay(Rectangle().stroke(selected ? Color.ink : Color.line, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }

                if !selectedKeywords.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Your muse").eyebrow(Color(hex: 0x9FB6C6))
                            Text(derivedMuse)
                                .font(.brandDisplay(30))
                                .foregroundStyle(.white)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                        .background(Color.ink)
                        Text(museDescription(derivedMuse))
                            .font(.system(size: 13))
                            .foregroundStyle(Color(hex: 0x4A4A4A))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(13)
                            .background(Color.surface)
                    }
                    .overlay(Rectangle().stroke(Color.ink, lineWidth: 1))
                }
            }
        case .catalog:
            questionPage(
                eyebrow: "Step 4 of 8",
                title: "Which catalog should your stylist pull from?",
                subtitle: "Choose the source that fits this appointment."
            ) {
                CatalogAudiencePicker(selection: $selectedCatalogAudiences)
            }
        case .outfit:
            OutfitMatchView(
                apiClient: apiClient,
                eyebrow: "Step 5 of 8",
                measurements: currentUser?.measurements,
                showBack: true,
                onBack: { step = .catalog },
                onSkip: {
                    outfitAnalysis = nil
                    step = .store
                },
                onDone: { analysis in
                    outfitAnalysis = analysis
                    step = .store
                }
            )
        case .store:
            questionPage(
                eyebrow: "Step 6 of 8",
                title: "Choose a store",
                subtitle: "Pick the fitting room location before choosing a time."
            ) {
                if stores.isEmpty {
                    ContentUnavailableView("No stores available", systemImage: "mappin.slash")
                } else {
                    ForEach(stores) { store in
                        let selected = selectedStore?.storeId == store.storeId
                        Button {
                            Task { await selectStore(store) }
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(store.name)
                                        .font(.system(size: 15, weight: .bold))
                                        .foregroundStyle(Color.ink)
                                    Text("\(store.address) · \(store.phone)")
                                        .font(.system(size: 12))
                                        .foregroundStyle(Color.muted)
                                }
                                Spacer()
                                if selected { checkSquare }
                            }
                            .padding(15)
                            .background(Color.surface)
                            .overlay(Rectangle().stroke(selected ? Color.ink : Color.line, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        case .schedule:
            questionPage(
                eyebrow: "Step 7 of 8",
                title: "Pick a time",
                subtitle: "We only show times when at least one stylist is scheduled."
            ) {
                if slots.isEmpty {
                    ContentUnavailableView("No slots available", systemImage: "calendar.badge.exclamationmark")
                } else {
                    VStack(spacing: 9) {
                        ForEach(slots) { slot in
                            let selected = selectedSlot == slot
                            Button {
                                selectedSlot = slot
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(dayLabel(slot.slotStart)).eyebrow()
                                        Text(timeLabel(slot.slotStart))
                                            .font(.brandDisplay(16))
                                            .foregroundStyle(Color.ink)
                                    }
                                    Spacer()
                                    Text("\(slot.availableStylistCount) stylist\(slot.availableStylistCount == 1 ? "" : "s")")
                                        .font(.system(size: 11))
                                        .foregroundStyle(selected ? Color.accent : Color.muted)
                                    if selected { checkSquare.padding(.leading, 8) }
                                }
                                .padding(14)
                                .background(selected ? Color(hex: 0xF3F6F8) : Color.surface)
                                .overlay(Rectangle().stroke(selected ? Color.ink : Color.line, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
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
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 3) {
                    if let currentUser {
                        Text("Hi, \(currentUser.displayName)").eyebrow()
                    }
                    Text("Appointments")
                        .font(.brandDisplay(33))
                        .foregroundStyle(Color.ink)
                }

                if let currentUser {
                    fitProfileContext(currentUser)
                }

                if let appointment {
                    VStack(alignment: .leading, spacing: 12) {
                        sectionDivider("Upcoming")
                        Button {
                            Task { await openAppointmentDetail(appointment) }
                        } label: {
                            upcomingCard(appointment)
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    ContentUnavailableView("No upcoming appointments", systemImage: "calendar")
                    Button("Start a Fitting") {
                        startBooking()
                    }
                    .buttonStyle(BrandBlockButtonStyle())
                    .disabled(currentUser == nil || stores.isEmpty)
                }

                VStack(alignment: .leading, spacing: 12) {
                    sectionDivider("Past")
                    if pastAppointments.isEmpty {
                        Text("No past fitting appointments yet.")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.muted)
                    } else {
                        ForEach(pastAppointments) { pastAppointment in
                            Button {
                                Task { await openAppointmentDetail(pastAppointment) }
                            } label: {
                                pastRow(pastAppointment)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Text(status)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
        .background(Color.canvas)
        .refreshable {
            await refreshCustomerData()
        }
    }

    private func upcomingCard(_ appointment: Appointment) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(dayLabel(appointment.slotStart)).eyebrow(.accent)
                        Text(timeLabel(appointment.slotStart))
                            .font(.brandDisplay(27))
                            .foregroundStyle(Color.ink)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Color.ink)
                }
                Text("with ")
                    .font(.system(size: 14))
                    .foregroundColor(Color(hex: 0x2A2A2A))
                    + Text(appointment.assignedStylist.displayName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Color(hex: 0x2A2A2A))
                    + Text(" · \(appointment.assignedStylist.title)")
                        .font(.system(size: 14))
                        .foregroundColor(Color(hex: 0x2A2A2A))
                Text(appointment.store.name)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.muted)
                    .padding(.top, 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)

            HStack(spacing: 10) {
                Text(appointment.museTag)
                    .font(.system(size: 10, weight: .bold))
                    .textCase(.uppercase)
                    .tracking(Brand.trackingCTA)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .overlay(Rectangle().stroke(Color(hex: 0x4A6076), lineWidth: 1))
                Text(appointment.occasion)
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: 0xC9D4DC))
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 11)
            .background(Color.ink)
        }
        .background(Color.surface)
        .overlay(Rectangle().stroke(Color.ink, lineWidth: 1))
    }

    private func pastRow(_ appointment: Appointment) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("\(dayLabel(appointment.slotStart)) · \(timeLabel(appointment.slotStart))")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color(hex: 0x1F2A33))
                Spacer()
                StatusPill(status: appointment.status)
            }
            Text("with \(appointment.assignedStylist.displayName)")
                .font(.system(size: 12))
                .foregroundStyle(Color.muted)
            if !appointment.sessionNotes.isEmpty {
                Text(appointment.sessionNotes)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.muted)
                    .lineLimit(2)
            }
        }
        .brandCard(padding: 14)
    }

    private func sectionDivider(_ title: String) -> some View {
        HStack(spacing: 10) {
            Text(title)
                .font(.brandDisplay(12))
                .textCase(.uppercase)
                .tracking(Brand.trackingLabel)
                .foregroundStyle(Color.ink)
            Rectangle().fill(Color.lineSubtle).frame(height: 1)
        }
    }

    private var newJourneyLanding: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer()
            VStack(alignment: .leading, spacing: 16) {
                Rectangle().fill(Color(hex: 0x7E98AB)).frame(width: 38, height: 2)
                Text("Personalized fitting").eyebrow(Color(hex: 0x9FB6C6))
                Text("A better fitting room starts before you arrive.")
                    .font(.brandDisplay(36))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Answer a few questions about what you're after. We'll match you with a stylist and have the right denim waiting in your size.")
                    .font(.system(size: 15))
                    .foregroundStyle(Color(hex: 0xC9D4DC))
                    .lineSpacing(4)
            }
            Spacer()
            VStack(alignment: .leading, spacing: 12) {
                if let currentUser {
                    Text("Booking for ")
                        .font(.system(size: 13))
                        .foregroundColor(Color(hex: 0x9FB6C6))
                        + Text(currentUser.displayName)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                }
                Button("Start Your Fitting") {
                    startBooking()
                }
                .buttonStyle(BrandBlockButtonStyle(filled: false))
                .disabled(currentUser == nil || stores.isEmpty)
                Text(status)
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: 0x7E98AB))
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
        .padding(26)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(Color.ink.ignoresSafeArea())
    }

    private var admin: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Admin")
                    .font(.brandDisplay(33))
                    .foregroundStyle(Color.ink)
                Text("Swap the active mock customer for local testing. Reloads all data.")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.bodyCopy)

                HStack(alignment: .top, spacing: 9) {
                    devBadge
                    Text("Internal builds only — this screen is stripped from production.")
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: 0x7A3A3D))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(11)
                .background(Color(hex: 0xFBF3F3))
                .overlay(Rectangle().stroke(Color(hex: 0xE6C9CC), lineWidth: 1))

                Text("Mock customers").eyebrow()

                ForEach(users, id: \.customerId) { user in
                    let selected = user.customerId == currentUser?.customerId
                    Button {
                        Task { await setActiveUser(user) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.displayName)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(Color(hex: 0x1F2A33))
                                Text(user.loyaltyId)
                                    .font(.system(size: 11))
                                    .foregroundStyle(Color.muted)
                            }
                            Spacer()
                            if selected { checkSquare }
                        }
                        .padding(14)
                        .background(Color.surface)
                        .overlay(Rectangle().stroke(selected ? Color.ink : Color.lineSubtle, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoading)
                }

                Text(status)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
        .background(Color.canvas)
    }

    private var devBadge: some View {
        Text("Dev")
            .font(.system(size: 9, weight: .bold))
            .textCase(.uppercase)
            .tracking(Brand.trackingCTA)
            .foregroundStyle(.white)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Color.sale)
    }

    private var checkSquare: some View {
        ZStack {
            Rectangle().fill(Color.ink).frame(width: 22, height: 22)
            Image(systemName: "checkmark")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.white)
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
                VStack(spacing: 0) {
                    detailHero(appointment, isActive: isActive)

                    VStack(alignment: .leading, spacing: 14) {
                        whereWhoCard(appointment)
                        outfitCard(appointment, canEdit: canEdit)
                        remindersCard()
                        messagesCard(canSend: canSendMessage)
                        if canEdit {
                            noteEditorCard(appointment, canCancel: canCancel)
                        } else {
                            recapCard(appointment)
                        }
                        if canFeedback {
                            feedbackCard(appointment)
                        }
                        Text(status)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                }
            }

            detailFooter(canEdit: canEdit, canCancel: canCancel)
        }
        .background(Color.canvas)
        .refreshable {
            await refreshAppointmentDetail()
        }
        .task(id: detailAppointment?.id) {
            guard detailAppointment != nil else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                await refreshAppointmentDetail(silent: true)
            }
        }
        .sheet(isPresented: $showOutfitSheet) {
            NavigationStack {
                OutfitMatchView(
                    apiClient: apiClient,
                    eyebrow: "Outfit to match",
                    measurements: currentUser?.measurements,
                    initial: appointment.outfitAnalysis,
                    showBack: false,
                    onBack: {},
                    onSkip: { showOutfitSheet = false },
                    onDone: { analysis in
                        showOutfitSheet = false
                        Task { await attachOutfit(to: appointment.id, analysis: analysis) }
                    }
                )
                .navigationTitle("Outfit to match")
                .navigationBarTitleDisplayMode(.inline)
            }
        }
    }

    @MainActor
    private func refreshAppointmentDetail(silent: Bool = false) async {
        guard let detailAppointment else { return }
        if !silent {
            isLoading = true
            status = "Refreshing appointment"
        }
        defer {
            if !silent { isLoading = false }
        }

        do {
            let updated = try await apiClient.getAppointment(id: detailAppointment.id)
            self.detailAppointment = updated
            if appointment?.id == updated.id {
                appointment = updated.status == "cancelled" ? nil : updated
            }
            appointmentMessages = try await apiClient.getAppointmentMessages(id: updated.id)
            appointmentNotifications = try await apiClient.getAppointmentNotifications(id: updated.id)
            if !silent {
                status = "Ready"
            }
        } catch {
            if !silent {
                status = "Could not refresh appointment"
            }
        }
    }

    @MainActor
    private func attachOutfit(to appointmentId: String, analysis: OutfitAnalysis) async {
        isLoading = true
        status = "Updating your outfit details"
        defer { isLoading = false }
        do {
            let updated = try await apiClient.attachOutfitAnalysis(appointmentId: appointmentId, analysis: analysis)
            detailAppointment = updated.appointment
            if updated.appointment.id == appointment?.id {
                appointment = updated.appointment
            }
            status = "Outfit added — your stylist will see it"
        } catch {
            status = "Could not update the outfit details"
        }
    }

    @ViewBuilder
    private func detailHero(_ appointment: Appointment, isActive: Bool) -> some View {
        if isActive {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Your fitting").eyebrow(Color(hex: 0x9FB6C6))
                    Spacer()
                    Text(appointment.status == "checked_in" ? "Checked in" : "Scheduled")
                        .font(.system(size: 10, weight: .bold))
                        .textCase(.uppercase)
                        .tracking(Brand.trackingCTA)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .overlay(Rectangle().stroke(Color(hex: 0x4A6076), lineWidth: 1))
                }
                .padding(.bottom, 16)
                Text(dayLongLabel(appointment.slotStart))
                    .font(.brandDisplay(30))
                    .foregroundStyle(.white)
                Text(timeLabel(appointment.slotStart))
                    .font(.brandDisplay(30))
                    .foregroundStyle(.white)
                HStack(spacing: 8) {
                    Text(appointment.museTag)
                        .font(.system(size: 10, weight: .bold))
                        .textCase(.uppercase)
                        .tracking(Brand.trackingCTA)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .overlay(Rectangle().stroke(Color(hex: 0x4A6076), lineWidth: 1))
                    Text(appointment.occasion)
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: 0xC9D4DC))
                        .lineLimit(1)
                }
                .padding(.top, 14)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(22)
            .background(Color.ink)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Your recap").eyebrow()
                    Spacer()
                    StatusPill(status: appointment.status)
                }
                Text("\(dayLabel(appointment.slotStart)) · \(timeLabel(appointment.slotStart))")
                    .font(.brandDisplay(28))
                    .foregroundStyle(Color.ink)
                Text("\(appointment.assignedStylist.displayName) · \(appointment.store.name)")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(22)
            .background(Color.surface)
            .overlay(Rectangle().fill(Color.line).frame(height: 1), alignment: .bottom)
        }
    }

    private func whereWhoCard(_ appointment: Appointment) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Where").eyebrow()
            Text(appointment.store.name)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color(hex: 0x1F2A33))
                .padding(.top, 5)
            Text("\(appointment.store.address) · \(appointment.store.phone)")
                .font(.system(size: 12))
                .foregroundStyle(Color.muted)
                .padding(.top, 3)

            Rectangle().fill(Color.lineSubtle).frame(height: 1).padding(.vertical, 14)

            Text("Your stylist").eyebrow()
            HStack(spacing: 11) {
                Text(initials(appointment.assignedStylist.displayName))
                    .font(.brandDisplay(14))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(Color.navy)
                VStack(alignment: .leading, spacing: 1) {
                    Text(appointment.assignedStylist.displayName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color(hex: 0x1F2A33))
                    Text(appointment.assignedStylist.title)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.muted)
                }
            }
            .padding(.top, 9)
            if let bio = appointment.assignedStylist.bio {
                Text(bio)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.bodyCopy)
                    .padding(.top, 12)
            }
            if let specialties = appointment.assignedStylist.specialties, !specialties.isEmpty {
                Text("Specialties: \(specialties.joined(separator: ", "))")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.muted)
                    .padding(.top, 8)
            }
        }
        .brandCard()
    }

    @ViewBuilder
    private func outfitCard(_ appointment: Appointment, canEdit: Bool) -> some View {
        // Only render when there's something to show or an action to offer.
        if appointment.outfitAnalysis != nil || canEdit {
            VStack(alignment: .leading, spacing: 11) {
                Text("Outfit to match").eyebrow()
                if let outfit = appointment.outfitAnalysis {
                    let summary = outfit.pairingContext.isEmpty
                        ? outfit.styleSummary
                        : outfit.pairingContext
                    if !summary.isEmpty {
                        Text(summary)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.bodyCopy)
                    }
                    if !outfit.garments.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(outfit.garments, id: \.self) { garment in
                                Text("• \(garment.type)\(garment.colors.isEmpty ? "" : " — \(garment.colors.joined(separator: ", "))") · \(intentLabel(garment.intent))")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.muted)
                            }
                        }
                    }
                } else {
                    Text("Show your stylist a piece you want to build around.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.muted)
                }
                if canEdit {
                    Button {
                        showOutfitSheet = true
                    } label: {
                        Text(appointment.outfitAnalysis == nil ? "Add an outfit" : "Update outfit")
                            .font(.system(size: 10, weight: .bold))
                            .textCase(.uppercase)
                            .tracking(Brand.trackingCTA)
                            .foregroundStyle(Color.ink)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 11)
                            .overlay(Rectangle().stroke(Color.ink, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoading)
                }
            }
            .brandCard()
        }
    }

    private func intentLabel(_ intent: String) -> String {
        switch intent {
        case "similar": return "find similar"
        case "ignore": return "ignore"
        default: return "complement"
        }
    }

    private func remindersCard() -> some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("Reminders & updates").eyebrow()
            if appointmentNotifications.isEmpty {
                Text("No notification records.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.muted)
            } else {
                ForEach(appointmentNotifications) { notification in
                    HStack(alignment: .top, spacing: 10) {
                        Rectangle()
                            .fill(notification.sentAt != nil ? Color.success : Color.accent)
                            .frame(width: 6, height: 6)
                            .padding(.top, 6)
                        Text("\(notification.type.capitalized) · \(notification.status) for \(displayDate(notification.scheduledFor))")
                            .font(.system(size: 13))
                            .foregroundStyle(Color(hex: 0x3A3A3A))
                    }
                }
            }
        }
        .brandCard()
    }

    private func messagesCard(canSend: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Messages").eyebrow()
            if appointmentMessages.isEmpty {
                Text("No messages yet.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.muted)
            } else {
                ForEach(appointmentMessages) { message in
                    let mine = message.authorType == "customer"
                    HStack {
                        if mine { Spacer(minLength: 40) }
                        Text(message.body)
                            .font(.system(size: 13))
                            .foregroundStyle(mine ? Color.white : Color(hex: 0x2A2A2A))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 9)
                            .background(mine ? Color.navy : Color(hex: 0xF0F0EE))
                        if !mine { Spacer(minLength: 40) }
                    }
                }
            }
            if canSend {
                HStack(spacing: 8) {
                    brandTextField("Message your stylist…", text: $messageDraft, lines: 2)
                    Button {
                        Task { await sendAppointmentMessage() }
                    } label: {
                        Text("Send")
                            .font(.system(size: 10, weight: .bold))
                            .textCase(.uppercase)
                            .tracking(Brand.trackingCTA)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(Color.ink)
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoading || messageDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .brandCard()
    }

    private func noteEditorCard(_ appointment: Appointment, canCancel: Bool) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Note for your stylist").eyebrow()
            brandTextField("Anything you'd like your stylist to know…", text: $guidance, lines: 4)
        }
        .brandCard()
    }

    private func recapCard(_ appointment: Appointment) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 9) {
                Text("Note from \(firstName(appointment.assignedStylist.displayName))").eyebrow()
                Text(appointment.customerRecap.isEmpty ? "No recap added yet." : appointment.customerRecap)
                    .font(.system(size: 14))
                    .foregroundStyle(Color(hex: 0x3A3A3A))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(Color.surface)
                    .overlay(Rectangle().fill(Color.ink).frame(width: 3), alignment: .leading)
                    .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Your note").eyebrow()
                Text(appointment.guidance.isEmpty ? "None" : appointment.guidance)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.bodyCopy)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func feedbackCard(_ appointment: Appointment) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("How was your fitting?").eyebrow(Color(hex: 0x9FB6C6))
            if let rating = appointment.customerFeedbackRating {
                starsRow(rating: rating)
                Text(appointment.customerFeedbackComment.isEmpty ? "No comment." : appointment.customerFeedbackComment)
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: 0xC9D4DC))
            } else {
                HStack(spacing: 9) {
                    ForEach(1...5, id: \.self) { value in
                        Button {
                            feedbackRating = value
                        } label: {
                            Image(systemName: value <= feedbackRating ? "star.fill" : "star")
                                .font(.system(size: 24))
                                .foregroundStyle(value <= feedbackRating ? Color.white : Color(hex: 0x4A6076))
                        }
                        .buttonStyle(.plain)
                    }
                }
                TextField("Tell your stylist what worked… (optional)", text: $feedbackComment, axis: .vertical)
                    .lineLimit(3, reservesSpace: true)
                    .font(.system(size: 13))
                    .foregroundStyle(.white)
                    .tint(.white)
                    .padding(11)
                    .background(Color(hex: 0x1D2C38))
                    .overlay(Rectangle().stroke(Color(hex: 0x3A5066), lineWidth: 1))
                Button {
                    Task { await submitFeedback() }
                } label: {
                    if isLoading {
                        ProgressView().tint(Color.ink)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(Color.white)
                    } else {
                        Text("Submit Feedback")
                            .font(.brandDisplay(13))
                            .tracking(Brand.trackingCTA)
                            .textCase(.uppercase)
                            .foregroundStyle(Color.ink)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(Color.white)
                    }
                }
                .buttonStyle(.plain)
                .disabled(isLoading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Color.ink)
    }

    private func starsRow(rating: Int) -> some View {
        HStack(spacing: 9) {
            ForEach(1...5, id: \.self) { value in
                Image(systemName: value <= rating ? "star.fill" : "star")
                    .font(.system(size: 22))
                    .foregroundStyle(value <= rating ? Color.white : Color(hex: 0x4A6076))
            }
        }
    }

    private func detailFooter(canEdit: Bool, canCancel: Bool) -> some View {
        HStack(spacing: 10) {
            if canCancel {
                Button {
                    showCancelConfirmation = true
                } label: {
                    Text("Cancel Appointment")
                        .font(.brandDisplay(13))
                        .tracking(Brand.trackingCTA)
                        .textCase(.uppercase)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .foregroundStyle(Color.sale)
                        .padding(.vertical, 14)
                        .padding(.horizontal, 14)
                        .overlay(Rectangle().stroke(Color.sale.opacity(0.55), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(isLoading)
            }
            if canEdit {
                Button {
                    Task { await updateAppointmentGuidance() }
                } label: {
                    Group {
                        if isLoading {
                            ProgressView().tint(.white)
                        } else {
                            Text("Save Note")
                                .font(.brandDisplay(13))
                                .tracking(Brand.trackingCTA)
                                .textCase(.uppercase)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(.white)
                    .background(Color.ink)
                }
                .buttonStyle(.plain)
                .disabled(isLoading)
            } else {
                Button {
                    detailAppointment = nil
                    screen = .home
                } label: {
                    Text("Done")
                        .font(.brandDisplay(13))
                        .tracking(Brand.trackingCTA)
                        .textCase(.uppercase)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundStyle(.white)
                        .background(Color.ink)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, 12)
        .padding(.bottom, 24)
        .background(Color.surface)
        .overlay(Rectangle().fill(Color.line).frame(height: 1), alignment: .top)
        .alert("Cancel this appointment?", isPresented: $showCancelConfirmation) {
            TextField("Reason optional", text: $cancelReason)
            Button("Cancel Appointment", role: .destructive) {
                Task { await cancelAppointment() }
            }
            Button("Keep Appointment", role: .cancel) {}
        } message: {
            Text("This gives up your time slot and notifies the store.")
        }
    }

    private func fitProfileContext(_ user: CurrentUser) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Your fit profile").eyebrow(Color.ink)
                Spacer()
                Button {
                    Task { await saveFitProfile() }
                } label: {
                    Text("Save")
                        .font(.brandDisplay(12))
                        .tracking(Brand.trackingCTA)
                        .textCase(.uppercase)
                        .foregroundStyle(Color.ink)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 12)
                        .overlay(Rectangle().stroke(Color.ink, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(isLoading)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                fitNumberField("Height", text: $fitHeight)
                fitNumberField("Chest", text: $fitChest)
                fitNumberField("Waist", text: $fitWaist)
                fitNumberField("Hip", text: $fitHip)
                fitNumberField("Inseam", text: $fitInseam)
            }
            Picker("Fit", selection: $fitPreference) {
                ForEach(["skinny", "slim", "straight", "relaxed", "wide"], id: \.self) { value in
                    Text(value.capitalized).tag(value)
                }
            }
            .pickerStyle(.segmented)
            Picker("Stretch", selection: $stretchPreference) {
                Text("Rigid").tag("rigid")
                Text("Comfort").tag("comfort-stretch")
                Text("High").tag("high-stretch")
            }
            .pickerStyle(.segmented)
        }
        .brandCard()
    }

    private func fitNumberField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).eyebrow(Color.muted)
            TextField(label, text: text)
                .keyboardType(.decimalPad)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.ink)
                .padding(10)
                .background(Color.surface)
                .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
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
                    Text(eyebrow).eyebrow(.accent)
                    Text(title)
                        .font(.brandDisplay(27))
                        .foregroundStyle(Color.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(subtitle)
                        .font(.system(size: 14))
                        .foregroundStyle(Color.bodyCopy)
                    content()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(22)
            }
            navFooter
        }
        .background(Color.canvas)
    }

    private var navFooter: some View {
        HStack(spacing: 10) {
            if step.previous != step {
                Button("Back") { step = step.previous }
                    .buttonStyle(.plain)
                    .modifier(SecondaryFooterLabel())
            }
            Button {
                step = step.next
            } label: {
                Text("Next")
                    .font(.brandDisplay(13))
                    .tracking(Brand.trackingCTA)
                    .textCase(.uppercase)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(.white)
                    .background(canAdvance ? Color.ink : Color.disabled)
            }
            .buttonStyle(.plain)
            .disabled(!canAdvance)
        }
        .padding(.horizontal, 22)
        .padding(.top, 12)
        .padding(.bottom, 24)
        .background(Color.surface)
        .overlay(Rectangle().fill(Color.line).frame(height: 1), alignment: .top)
    }

    // Review rows for the confirm screen, including the outfit-to-match when set.
    private var reviewRows: [(String, String)] {
        var rows: [(String, String)] = [
            ("When", selectedSlot.map { "\(dayLabel($0.slotStart)) · \(timeLabel($0.slotStart))" } ?? "No time selected"),
            ("Store", selectedStore?.name ?? "No store selected"),
            ("Muse", derivedMuse),
            ("Catalog", catalogAudienceLabel(sortedSelectedCatalogAudiences)),
            ("Shopping for", occasion.isEmpty ? "—" : occasion),
            ("Colors", colorSummary(focusColors)),
        ]
        if let outfitAnalysis {
            let value = outfitAnalysis.pairingContext.isEmpty
                ? outfitAnalysis.styleSummary
                : outfitAnalysis.pairingContext
            if !value.isEmpty { rows.append(("Outfit", value)) }
        }
        return rows
    }

    private var sortedSelectedCatalogAudiences: [String] {
        let order = ["womens", "mens"]
        return order.filter { selectedCatalogAudiences.contains($0) }
    }

    private func defaultCatalogAudiences() -> Set<String> {
        let audiences = currentUser?.preferences.catalogAudiences ?? ["womens"]
        let valid = audiences.filter { $0 == "womens" || $0 == "mens" }
        return Set(valid.isEmpty ? ["womens"] : valid)
    }

    private func catalogAudienceLabel(_ audiences: [String]) -> String {
        let values = audiences.isEmpty ? ["womens"] : audiences
        if values.contains("womens") && values.contains("mens") {
            return "Womens + Mens"
        }
        if values.contains("mens") {
            return "Mens"
        }
        return "Womens"
    }

    private var review: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Step 8 of 8").eyebrow(.accent)
                    Text("Review & confirm")
                        .font(.brandDisplay(27))
                        .foregroundStyle(Color.ink)
                    KeyValueTable(rows: reviewRows)
                    VStack(alignment: .leading, spacing: 9) {
                        Text("Note for your stylist (optional)").eyebrow()
                        brandTextField("Anything you'd like your stylist to know…", text: $guidance, lines: 4)
                    }
                    Text(status)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(22)
            }
            HStack(spacing: 10) {
                Button("Back") { step = step.previous }
                    .buttonStyle(.plain)
                    .modifier(SecondaryFooterLabel())
                Button {
                    Task { await bookAppointment() }
                } label: {
                    Group {
                        if isLoading {
                            ProgressView().tint(.white)
                        } else {
                            Text("Confirm Appointment")
                                .font(.brandDisplay(13))
                                .tracking(Brand.trackingCTA)
                                .textCase(.uppercase)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(.white)
                    .background(selectedSlot == nil ? Color.disabled : Color.ink)
                }
                .buttonStyle(.plain)
                .disabled(isLoading || selectedSlot == nil)
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
            .padding(.bottom, 24)
            .background(Color.surface)
            .overlay(Rectangle().fill(Color.line).frame(height: 1), alignment: .top)
        }
        .background(Color.canvas)
    }

    private var confirmation: some View {
        VStack(spacing: 0) {
            Spacer()
            VStack(spacing: 0) {
                ZStack {
                    Rectangle().stroke(Color.white, lineWidth: 2).frame(width: 74, height: 74)
                    Image(systemName: "checkmark")
                        .font(.system(size: 32, weight: .regular))
                        .foregroundStyle(.white)
                }
                .padding(.bottom, 26)
                Text("Confirmed").eyebrow(Color(hex: 0x9FB6C6))
                    .padding(.bottom, 12)
                Text("You're booked.")
                    .font(.brandDisplay(40))
                    .foregroundStyle(.white)
                    .padding(.bottom, 14)
                if let appointment {
                    Text("\(appointment.assignedStylist.displayName) will have your \(appointment.museTag) denim edit ready. We'll send a reminder the day before.")
                        .font(.system(size: 15))
                        .foregroundStyle(Color(hex: 0xC9D4DC))
                        .multilineTextAlignment(.center)
                        .lineSpacing(3)
                        .padding(.bottom, 30)

                    VStack(spacing: 0) {
                        confirmationRow("When", "\(dayLabel(appointment.slotStart)) · \(timeLabel(appointment.slotStart))")
                        Rectangle().fill(Color(hex: 0x33485C)).frame(height: 1)
                        confirmationRow("Store", "\(appointment.store.name), \(appointment.store.city)")
                        Rectangle().fill(Color(hex: 0x33485C)).frame(height: 1)
                        confirmationRow("Stylist", appointment.assignedStylist.displayName)
                        Rectangle().fill(Color(hex: 0x33485C)).frame(height: 1)
                        confirmationRow("Catalog", catalogAudienceLabel(appointment.catalogAudiences))
                    }
                    .background(Color(hex: 0x1D2C38))
                    .overlay(Rectangle().stroke(Color(hex: 0x3A5066), lineWidth: 1))
                }
            }
            Spacer()
            VStack(spacing: 10) {
                if appointment != nil {
                    Button("Manage Appointment") {
                        if let appointment {
                            Task { await openAppointmentDetail(appointment) }
                        }
                    }
                    .buttonStyle(BrandBlockButtonStyle(filled: false))
                }
                Button {
                    Task { await refreshCustomerData() }
                } label: {
                    Text("Done")
                        .font(.system(size: 13, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(Brand.trackingCTA)
                        .foregroundStyle(Color(hex: 0x9FB6C6))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(26)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.ink.ignoresSafeArea())
    }

    private func confirmationRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).eyebrow(Color(hex: 0x7E98AB))
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
    }

    private func brandTextField(_ placeholder: String, text: Binding<String>, lines: Int) -> some View {
        TextField(placeholder, text: text, axis: .vertical)
            .lineLimit(lines, reservesSpace: true)
            .font(.system(size: 15))
            .foregroundStyle(Color(hex: 0x2A2A2A))
            .tint(Color.ink)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.surface)
            .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
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
        case .catalog:
            return !selectedCatalogAudiences.isEmpty
        case .outfit:
            // The outfit step is optional and supplies its own controls.
            return true
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

    private func museDescription(_ muse: String) -> String {
        switch muse {
        case "Romantic Muse":
            return "Soft, feminine, and subtly dressed-up. Your stylist will pull fluid drapes and gentle detailing."
        case "Boyish Muse":
            return "Relaxed, preppy, and menswear-inspired — easygoing shapes with a polished edge."
        case "Statement Maker":
            return "Trend-forward and bold. Pieces designed to be noticed."
        default:
            return "Pared-back, modern, built on essentials. Your stylist will pull denim that holds a clean line."
        }
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
            syncFitProfileDraft(currentUser)
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
            syncFitProfileDraft(currentUser)
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
                catalogAudiences: sortedSelectedCatalogAudiences,
                guidance: guidance,
                orderHistoryScenario: "standard",
                outfitAnalysis: outfitAnalysis
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
        selectedCatalogAudiences = defaultCatalogAudiences()
        selectedSlot = nil
        guidance = ""
        outfitAnalysis = nil
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
    private func saveFitProfile() async {
        guard let currentUser else { return }
        let chestValue = fitChest.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? nil
            : Double(fitChest)
        guard
            let height = Int(fitHeight),
            let waist = Double(fitWaist),
            let hip = Double(fitHip),
            let inseam = Double(fitInseam),
            fitChest.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || chestValue != nil
        else {
            status = "Check the fit profile numbers"
            return
        }

        isLoading = true
        status = "Saving fit profile"
        defer { isLoading = false }

        do {
            let updated = try await apiClient.updateFitProfile(
                customerId: currentUser.customerId,
                measurements: Measurements(
                    heightInches: height,
                    chestInches: chestValue,
                    waistInches: waist,
                    hipInches: hip,
                    inseamInches: inseam
                ),
                preferences: UserPreferences(
                    fitPreference: fitPreference,
                    stretchPreference: stretchPreference,
                    catalogAudiences: currentUser.preferences.catalogAudiences
                )
            )
            self.currentUser = updated
            syncFitProfileDraft(updated)
            status = "Fit profile saved"
        } catch {
            status = "Could not save fit profile"
        }
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

        let baseAppointment = (try? await apiClient.getAppointment(id: appointment.id)) ?? appointment
        guidance = baseAppointment.guidance
        detailAppointment = baseAppointment
        feedbackRating = baseAppointment.customerFeedbackRating ?? 5
        feedbackComment = baseAppointment.customerFeedbackComment
        messageDraft = ""
        cancelReason = baseAppointment.cancelReason ?? ""

        do {
            appointmentMessages = try await apiClient.getAppointmentMessages(id: baseAppointment.id)
            appointmentNotifications = try await apiClient.getAppointmentNotifications(id: baseAppointment.id)
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
            syncFitProfileDraft(currentUser)
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

    private var focusColorBinding: Binding<Set<String>> {
        Binding(
            get: { focusColors },
            set: { next in
                focusColors = next
                avoidColors.subtract(next)
            }
        )
    }

    private var avoidColorBinding: Binding<Set<String>> {
        Binding(
            get: { avoidColors },
            set: { next in
                avoidColors = next
                focusColors.subtract(next)
            }
        )
    }

    private func syncFitProfileDraft(_ user: CurrentUser?) {
        guard let user else { return }
        fitHeight = String(user.measurements.heightInches)
        fitChest = user.measurements.chestInches.map(formattedMeasurement) ?? ""
        fitWaist = formattedMeasurement(user.measurements.waistInches)
        fitHip = formattedMeasurement(user.measurements.hipInches)
        fitInseam = formattedMeasurement(user.measurements.inseamInches)
        fitPreference = user.preferences.fitPreference
        stretchPreference = user.preferences.stretchPreference
    }

    private func displayDate(_ value: String) -> String {
        guard let date = parseDate(value) else { return value }
        return date.formatted(date: .abbreviated, time: .shortened)
    }

    private func parseDate(_ value: String) -> Date? {
        // The API returns timestamps with fractional seconds (e.g.
        // "2026-06-16T19:00:00.000Z"), which the default ISO8601 parser rejects;
        // try the fractional-seconds variant first, then plain.
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }

    private func dayLabel(_ value: String) -> String {
        guard let date = parseDate(value) else { return value }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE · MMM d"
        return formatter.string(from: date)
    }

    private func dayLongLabel(_ value: String) -> String {
        guard let date = parseDate(value) else { return value }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: date)
    }

    private func timeLabel(_ value: String) -> String {
        guard let date = parseDate(value) else { return value }
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }

    private func isFuture(_ value: String) -> Bool {
        guard let date = parseDate(value) else { return false }
        return date > Date()
    }

    private func formattedMeasurement(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)))
    }

    private func formattedHeight(_ inches: Int) -> String {
        let feet = inches / 12
        let remainder = inches % 12
        return "\(feet)'\(remainder)\""
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        let letters = parts.prefix(2).compactMap { $0.first }
        return String(letters).uppercased()
    }

    private func firstName(_ name: String) -> String {
        String(name.split(separator: " ").first ?? Substring(name))
    }
}

private struct SecondaryFooterLabel: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.brandDisplay(13))
            .tracking(Brand.trackingCTA)
            .textCase(.uppercase)
            .foregroundStyle(Color.bodyCopy)
            .padding(.vertical, 14)
            .padding(.horizontal, 22)
            .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
    }
}

private enum JourneyStep {
    case landing
    case occasion
    case colors
    case style
    case catalog
    case outfit
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
            return "New Fitting"
        }
    }

    /// 1-based position in the 8-step wizard; 0 for non-numbered screens.
    var stepNumber: Int {
        switch self {
        case .occasion: return 1
        case .colors: return 2
        case .style: return 3
        case .catalog: return 4
        case .outfit: return 5
        case .store: return 6
        case .schedule: return 7
        case .review: return 8
        case .landing, .confirmation: return 0
        }
    }

    var next: JourneyStep {
        switch self {
        case .landing: return .occasion
        case .occasion: return .colors
        case .colors: return .style
        case .style: return .catalog
        case .catalog: return .outfit
        case .outfit: return .store
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
        case .catalog: return .style
        case .outfit: return .catalog
        case .store: return .outfit
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

private struct MuseStyleGroup: Identifiable {
    let id: String
    let title: String
    let description: String
    let values: [String]

    static let all = [
        MuseStyleGroup(
            id: "clean",
            title: "Clean Muse",
            description: "Minimal, effortless, timeless essentials",
            values: ["minimal", "effortless", "timeless essentials"]
        ),
        MuseStyleGroup(
            id: "romantic",
            title: "Romantic Muse",
            description: "Feminine, soft, subtly dressed-up",
            values: ["feminine", "soft", "subtly dressed-up"]
        ),
        MuseStyleGroup(
            id: "boyish",
            title: "Boyish Muse",
            description: "Preppy, relaxed, sporty, menswear-inspired",
            values: ["preppy", "relaxed", "sporty", "menswear-inspired"]
        ),
        MuseStyleGroup(
            id: "statement",
            title: "Statement Maker",
            description: "Trend-forward, bold, boundary-pushing",
            values: ["trend-forward", "bold", "boundary-pushing"]
        )
    ]
}

private struct CatalogAudiencePicker: View {
    @Binding var selection: Set<String>

    private let options: [(label: String, values: Set<String>)] = [
        ("Womens", ["womens"]),
        ("Mens", ["mens"]),
        ("Both", ["womens", "mens"])
    ]

    var body: some View {
        VStack(spacing: 10) {
            ForEach(options, id: \.label) { option in
                let selected = selection == option.values
                Button {
                    selection = option.values
                } label: {
                    HStack {
                        Text(option.label)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(selected ? Color.white : Color.ink)
                        Spacer()
                        if selected {
                            Image(systemName: "checkmark")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(Color.white)
                        }
                    }
                    .padding(15)
                    .frame(maxWidth: .infinity)
                    .background(selected ? Color.ink : Color.surface)
                    .overlay(Rectangle().stroke(selected ? Color.ink : Color.line, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Tappable color swatch grid for the booking color step. Focus selections show
/// a navy outline; avoid selections are struck through in sale-red.
private struct ColorSwatchGrid: View {
    enum Mode { case focus, avoid }

    let title: String
    @Binding var selections: Set<String>
    let options: [String]
    let mode: Mode

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 5)

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).eyebrow()
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(options, id: \.self) { name in
                    let selected = selections.contains(name)
                    Button {
                        toggle(name)
                    } label: {
                        VStack(spacing: 7) {
                            swatch(name: name, selected: selected)
                            Text(name)
                                .font(.system(size: 9))
                                .foregroundStyle(selected ? Color(hex: 0x3A3A3A) : Color.muted)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private func swatch(name: String, selected: Bool) -> some View {
        let isFocus = mode == .focus
        ZStack {
            Rectangle()
                .fill(Self.swatchColor(name))
                .aspectRatio(1, contentMode: .fit)
                .overlay(
                    Rectangle().stroke(Color(hex: 0xD6D6D4), lineWidth: name == "White" ? 1 : 0)
                )
            if selected && !isFocus {
                GeometryReader { geo in
                    Path { path in
                        path.move(to: CGPoint(x: geo.size.width * 0.18, y: geo.size.height * 0.82))
                        path.addLine(to: CGPoint(x: geo.size.width * 0.82, y: geo.size.height * 0.18))
                    }
                    .stroke(Color.sale, lineWidth: 2)
                }
            }
        }
        .padding(isFocus && selected ? 2 : 0)
        .overlay(
            Rectangle().stroke(isFocus && selected ? Color.ink : Color.clear, lineWidth: 2)
        )
    }

    private func toggle(_ name: String) {
        if selections.contains(name) {
            selections.remove(name)
        } else {
            selections.insert(name)
        }
    }

    /// Representative swatch colors, mirrored from the redesign mock's palette.
    static func swatchColor(_ name: String) -> Color {
        switch name {
        case "Black": return Color(hex: 0x1C1C1C)
        case "White": return Color.white
        case "Cream": return Color(hex: 0xDCD3BD)
        case "Light wash": return Color(hex: 0xB9C2D4)
        case "Medium wash": return Color(hex: 0x7D92B8)
        case "Dark wash": return Color(hex: 0x2F3B66)
        case "Grey": return Color(hex: 0x9A9A9A)
        case "Navy": return Color(hex: 0x27455C)
        case "Green": return Color(hex: 0x5B7050)
        case "Pink": return Color(hex: 0xE8A0B8)
        case "Red": return Color(hex: 0xA32D2D)
        default: return Color(hex: 0xC6C6C6)
        }
    }
}

// Two-path "outfit to match" capture + sign-off. The customer can analyze a photo
// (taken or uploaded) or describe the piece manually; both produce an editable
// OutfitAnalysis they confirm. Photos are downscaled on-device, sent for analysis,
// and never persisted — only the resulting text leaves this view.
private struct OutfitMatchView: View {
    let apiClient: APIClient
    var eyebrow: String = "Outfit to match"
    // The customer's measurements, forwarded with a "this is me" photo to sharpen
    // the (hidden) body-shape read. Nil when unavailable.
    var measurements: Measurements? = nil
    var initial: OutfitAnalysis? = nil
    var showBack: Bool = false
    var onBack: () -> Void = {}
    var onSkip: () -> Void = {}
    var onDone: (OutfitAnalysis) -> Void

    private enum Stage { case chooser, editing }

    @State private var stage: Stage = .chooser
    @State private var photoItem: PhotosPickerItem?
    @State private var previewImage: UIImage?
    @State private var isAnalyzing = false
    @State private var showCamera = false
    @State private var errorText: String?
    // When the customer marks the photo as being of themselves, we ask the server
    // for a discreet body-shape read alongside the outfit. The read is hidden — it
    // never appears in this view — and is carried through to the recommender.
    @State private var isSelfPhoto = false
    @State private var bodyType: String?

    // Editable, customer-facing fields — the sign-off surface.
    @State private var summary = ""
    @State private var focusColorsText = ""
    @State private var keywordsText = ""
    @State private var editableGarments: [EditableGarment] = []
    @State private var engine = "manual"

    private var cameraAvailable: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    private var canConfirm: Bool {
        editableGarments.contains {
            !$0.type.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
            || !summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(eyebrow).eyebrow(.accent)
                    Text("Want us to style around something?")
                        .font(.brandDisplay(27))
                        .foregroundStyle(Color.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("Add a piece you already own — like a skirt you want a top for. Snap or upload a photo and we'll read the details, or just describe it. Photos are analyzed instantly and never saved.")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.bodyCopy)

                    if let errorText {
                        Text(errorText)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.sale)
                    }

                    switch stage {
                    case .chooser:
                        chooser
                    case .editing:
                        editor
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(22)
            }
            footer
        }
        .background(Color.canvas)
        .onAppear {
            if let initial, stage == .chooser {
                // Reflect whether this outfit was previously read as the customer,
                // so replacing the photo keeps requesting the body-shape read.
                isSelfPhoto = initial.bodyType != nil
                apply(initial)
            }
        }
        .task(id: photoItem) {
            guard let photoItem else { return }
            await analyze(item: photoItem)
        }
        .sheet(isPresented: $showCamera) {
            CameraPicker { image in
                Task { await analyze(image: image) }
            }
            .ignoresSafeArea()
        }
    }

    private var chooser: some View {
        VStack(spacing: 12) {
            PhotosPicker(selection: $photoItem, matching: .images, photoLibrary: .shared()) {
                OutfitChooserCard(icon: "photo.on.rectangle", title: "Upload a photo", subtitle: "Choose an outfit photo from your library")
            }
            .buttonStyle(.plain)
            .disabled(isAnalyzing)

            if cameraAvailable {
                Button {
                    errorText = nil
                    showCamera = true
                } label: {
                    OutfitChooserCard(icon: "camera", title: "Take a photo", subtitle: "Capture the piece with your camera")
                }
                .buttonStyle(.plain)
                .disabled(isAnalyzing)
            }

            Button {
                beginManual()
            } label: {
                OutfitChooserCard(icon: "pencil", title: "Describe it myself", subtitle: "Skip the photo and type the details")
            }
            .buttonStyle(.plain)
            .disabled(isAnalyzing)

            Button {
                onSkip()
            } label: {
                OutfitChooserCard(icon: "arrow.right", title: "Skip", subtitle: "Continue without an outfit to match")
            }
            .buttonStyle(.plain)
            .disabled(isAnalyzing)

            if isAnalyzing {
                HStack(spacing: 8) {
                    ProgressView().tint(Color.ink)
                    Text("Analyzing your photo…")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.muted)
                }
                .padding(.top, 4)
            }
        }
    }

    private var editor: some View {
        // Hoisted out of the PhotosPicker label closure, which is non-isolated and
        // can't read main-actor @State directly.
        let hasPhoto = previewImage != nil
        let uploadTitle = hasPhoto ? "Replace photo" : "Add a photo"
        let cameraTitle = hasPhoto ? "Retake" : "Take a photo"

        return VStack(alignment: .leading, spacing: 14) {
            if let previewImage {
                Image(uiImage: previewImage)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 180)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
            }

            // Let the customer (re)attach a photo at any time — re-analyzing
            // replaces the pieces below with what we read from the new photo.
            // Labels are built inline (no method call) so they're usable inside
            // PhotosPicker's non-isolated label closure.
            HStack(spacing: 10) {
                PhotosPicker(selection: $photoItem, matching: .images, photoLibrary: .shared()) {
                    Label(uploadTitle, systemImage: "photo.on.rectangle")
                        .font(.system(size: 11, weight: .bold))
                        .textCase(.uppercase)
                        .tracking(Brand.trackingCTA)
                        .foregroundStyle(Color.ink)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 9)
                        .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
                }
                if cameraAvailable {
                    Button {
                        errorText = nil
                        showCamera = true
                    } label: {
                        Label(cameraTitle, systemImage: "camera")
                            .font(.system(size: 11, weight: .bold))
                            .textCase(.uppercase)
                            .tracking(Brand.trackingCTA)
                            .foregroundStyle(Color.ink)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 9)
                            .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .disabled(isAnalyzing)

            if previewImage != nil {
                SelfPhotoToggle(isOn: $isSelfPhoto)
                    .disabled(isAnalyzing)
            }

            if isAnalyzing {
                HStack(spacing: 8) {
                    ProgressView().tint(Color.ink)
                    Text("Analyzing your photo…")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.muted)
                }
            }

            Text("For each piece, choose how it should shape your recommendations.")
                .font(.system(size: 12))
                .foregroundStyle(Color.muted)

            ForEach($editableGarments) { $garment in
                GarmentEditorRow(garment: $garment) {
                    editableGarments.removeAll { $0.id == garment.id }
                }
            }

            Button {
                editableGarments.append(EditableGarment())
            } label: {
                Label("Add a piece", systemImage: "plus")
                    .font(.system(size: 11, weight: .bold))
                    .textCase(.uppercase)
                    .tracking(Brand.trackingCTA)
                    .foregroundStyle(Color.ink)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
            }
            .buttonStyle(.plain)

            labeledField("Style summary", text: $summary, prompt: "How would you describe the look?")
            labeledField("Focus colors", text: $focusColorsText, prompt: "comma separated, e.g. cream, white")
            labeledField("Style keywords", text: $keywordsText, prompt: "comma separated, e.g. casual-chic")
            Button("Start over") { resetToChooser() }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.accent)
        }
    }

    private var footer: some View {
        HStack(spacing: 10) {
            if showBack {
                footerSecondaryButton("Back", action: onBack)
            }
            if stage == .editing {
                footerSecondaryButton("Skip", action: onSkip)
                    .disabled(isAnalyzing)
                Button { confirm() } label: {
                    Text("Use this outfit")
                        .font(.brandDisplay(13))
                        .tracking(Brand.trackingCTA)
                        .textCase(.uppercase)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundStyle(.white)
                        .background(canConfirm ? Color.ink : Color.disabled)
                }
                .buttonStyle(.plain)
                .disabled(!canConfirm)
            } else {
                Spacer()
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, 12)
        .padding(.bottom, 24)
        .background(Color.surface)
        .overlay(Rectangle().fill(Color.line).frame(height: 1), alignment: .top)
    }

    private func footerSecondaryButton(
        _ title: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.brandDisplay(13))
                .tracking(Brand.trackingCTA)
                .textCase(.uppercase)
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
                .foregroundStyle(Color.ink)
                .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func labeledField(_ label: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).eyebrow()
            TextField(prompt, text: text, axis: .vertical)
                .lineLimit(2, reservesSpace: true)
                .brandFieldChrome()
        }
    }

    private func beginManual() {
        errorText = nil
        engine = "manual"
        editableGarments = [EditableGarment()]
        previewImage = nil
        summary = ""
        focusColorsText = ""
        keywordsText = ""
        // No photo, so there is no body-shape read to carry and nothing to flag.
        bodyType = nil
        isSelfPhoto = false
        stage = .editing
    }

    private func resetToChooser() {
        photoItem = nil
        previewImage = nil
        stage = .chooser
    }

    private func apply(_ analysis: OutfitAnalysis) {
        summary = analysis.styleSummary
        focusColorsText = analysis.suggestedFocusColors.joined(separator: ", ")
        keywordsText = analysis.suggestedStyleKeywords.joined(separator: ", ")
        editableGarments = analysis.garments.map { garment in
            EditableGarment(
                type: garment.type,
                colorsText: garment.colors.joined(separator: ", "),
                intent: garment.intent
            )
        }
        if editableGarments.isEmpty { editableGarments = [EditableGarment()] }
        engine = analysis.engine
        // Preserve the hidden body-shape read across edits (it has no editable field).
        bodyType = analysis.bodyType
        stage = .editing
    }

    @MainActor
    private func analyze(item: PhotosPickerItem) async {
        errorText = nil
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                errorText = "Couldn't read that photo."
                return
            }
            await analyzeData(data)
        } catch {
            errorText = "Couldn't read that photo."
        }
    }

    @MainActor
    private func analyze(image: UIImage) async {
        guard let data = image.jpegData(compressionQuality: 0.9) else {
            errorText = "Couldn't read that photo."
            return
        }
        await analyzeData(data)
    }

    @MainActor
    private func analyzeData(_ data: Data) async {
        guard let payload = outfitImagePayload(from: data) else {
            errorText = "Couldn't process that photo."
            return
        }
        previewImage = UIImage(data: data)?.outfitResized(maxDimension: 600)
        isAnalyzing = true
        defer { isAnalyzing = false }
        do {
            let analysis = try await apiClient.analyzeOutfit(
                imageBase64: payload.base64,
                mediaType: payload.mediaType,
                analyzeBodyType: isSelfPhoto,
                // Only share measurements when the body-shape read was requested.
                measurements: isSelfPhoto ? measurements : nil
            )
            apply(analysis)
        } catch {
            // Fall back to manual entry so the customer is never stuck.
            errorText = "We couldn't analyze that photo. You can describe the outfit instead."
            engine = "manual"
            editableGarments = [EditableGarment()]
            stage = .editing
        }
        // payload.base64 and data go out of scope here — the image is not retained.
    }

    private func confirm() {
        let trimmedSummary = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        let garments: [OutfitGarment] = editableGarments.compactMap { garment in
            let type = garment.type.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !type.isEmpty else { return nil }
            return OutfitGarment(
                type: type,
                colors: splitList(garment.colorsText),
                material: nil,
                pattern: nil,
                descriptors: [],
                intent: garment.intent
            )
        }
        let analysis = OutfitAnalysis(
            garments: garments,
            styleSummary: trimmedSummary,
            suggestedFocusColors: splitList(focusColorsText),
            suggestedStyleKeywords: splitList(keywordsText),
            pairingContext: trimmedSummary,
            engine: engine,
            // Pass the hidden body-shape read through untouched; it stays out of the UI.
            bodyType: bodyType
        )
        onDone(analysis)
    }
}

// Mutable per-garment row backing the editor (the customer/stylist intent choice).
private struct EditableGarment: Identifiable {
    let id = UUID()
    var type: String = ""
    var colorsText: String = ""
    var intent: String = "complement"
}

// One editable garment row: name, colors, and the intent selector that decides how
// the piece steers recommendations.
private struct GarmentEditorRow: View {
    @Binding var garment: EditableGarment
    var onDelete: () -> Void

    private let intents: [(value: String, label: String)] = [
        ("complement", "Complement"),
        ("similar", "Similar"),
        ("ignore", "Ignore"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 10) {
                TextField("Piece, e.g. denim midi skirt", text: $garment.type)
                    .brandFieldChrome()
                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.muted)
                        .padding(11)
                        .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            TextField("Colors (comma separated)", text: $garment.colorsText)
                .brandFieldChrome()

            HStack(spacing: 0) {
                ForEach(intents, id: \.value) { option in
                    let selected = garment.intent == option.value
                    Button {
                        garment.intent = option.value
                    } label: {
                        Text(option.label)
                            .font(.system(size: 11, weight: .bold))
                            .textCase(.uppercase)
                            .tracking(Brand.trackingCTA)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .foregroundStyle(selected ? Color.white : Color.ink)
                            .background(selected ? Color.ink : Color.surface)
                    }
                    .buttonStyle(.plain)
                }
            }
            .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
        }
        .brandCard(padding: 14)
    }
}

// "This is me" opt-in shown above the photo capture options. When checked, the
// photo is analyzed for the customer's own fit (in addition to the outfit) so the
// stylist's recommendations can be tailored to them. Square brand checkbox.
private struct SelfPhotoToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Button {
            isOn.toggle()
        } label: {
            HStack(spacing: 13) {
                ZStack {
                    Rectangle()
                        .fill(isOn ? Color.ink : Color.surface)
                        .frame(width: 24, height: 24)
                        .overlay(Rectangle().stroke(isOn ? Color.ink : Color.line, lineWidth: 1))
                    if isOn {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("This is me")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.ink)
                    Text("Check this if the photo you add is of you — helps your stylist tailor the fit.")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(15)
            .background(Color.surface)
            .overlay(Rectangle().stroke(isOn ? Color.ink : Color.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// A tappable card used as the label for each capture option. A standalone View
// (rather than a method on OutfitMatchView) so it can be constructed inside
// PhotosPicker's non-isolated label closure under Swift strict concurrency.
private struct OutfitChooserCard: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(Color.accent)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.muted)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .background(Color.surface)
        .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
    }
}

// Brand chrome for the outfit views' free-text fields — square white field with a
// 1px border, matching the rest of the app.
private extension View {
    func brandFieldChrome() -> some View {
        self
            .font(.system(size: 14))
            .foregroundStyle(Color(hex: 0x2A2A2A))
            .tint(Color.ink)
            .padding(11)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.surface)
            .overlay(Rectangle().stroke(Color.line, lineWidth: 1))
    }
}

// Camera capture wrapper — SwiftUI has no native camera view, so bridge to
// UIImagePickerController. Returns the captured UIImage via the callback.
private struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                parent.onImage(image)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

private extension UIImage {
    /// Downscale so the longest side is at most `maxDimension`, preserving aspect
    /// ratio. Used to shrink uploads (and strip metadata via re-encoding).
    func outfitResized(maxDimension: CGFloat) -> UIImage {
        let longestSide = max(size.width, size.height)
        guard longestSide > maxDimension, longestSide > 0 else { return self }
        let scale = maxDimension / longestSide
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
        return renderer.image { _ in draw(in: CGRect(origin: .zero, size: newSize)) }
    }
}

/// Downscale + JPEG-encode + base64 an image for upload. Returns nil if the data
/// can't be decoded as an image.
private func outfitImagePayload(
    from data: Data,
    maxDimension: CGFloat = 1024,
    quality: CGFloat = 0.7
) -> (base64: String, mediaType: String)? {
    guard let image = UIImage(data: data) else { return nil }
    let resized = image.outfitResized(maxDimension: maxDimension)
    guard let jpeg = resized.jpegData(compressionQuality: quality) else { return nil }
    return (jpeg.base64EncodedString(), "image/jpeg")
}

private func splitList(_ text: String) -> [String] {
    text.split(separator: ",")
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
}

#Preview {
    FittingView()
}
