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
                    StepProgressBar(current: step.stepNumber, total: 6)
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
                eyebrow: "Step 1 of 6",
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
                                    .padding(.vertical, 9)
                                    .padding(.horizontal, 13)
                                    .frame(maxWidth: .infinity)
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
                eyebrow: "Step 2 of 6",
                title: "Any colors in mind?",
                subtitle: "Optional. Pick washes to lean into — and any to steer clear of."
            ) {
                ColorSwatchGrid(title: "Focus on", selections: $focusColors, options: selectableColorOptions, mode: .focus)
                ColorSwatchGrid(title: "Avoid", selections: $avoidColors, options: selectableColorOptions, mode: .avoid)
            }
        case .style:
            questionPage(
                eyebrow: "Step 3 of 6",
                title: "Pick your style signals",
                subtitle: "Choose the words that feel most like you."
            ) {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    ForEach(styleOptions) { option in
                        let selected = selectedKeywords.contains(option.value)
                        Button {
                            toggleKeyword(option.value)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(option.label)
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundStyle(selected ? Color.white : Color.ink)
                                Text(option.muse)
                                    .font(.system(size: 10))
                                    .foregroundStyle(selected ? Color(hex: 0x9FB6C6) : Color.muted)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 11)
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
                eyebrow: "Step 5 of 6",
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
            await refreshCustomerData()
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
            if canCancel {
                Text("Cancellation reason (optional)").eyebrow()
                    .padding(.top, 4)
                brandTextField("Let the store know why…", text: $cancelReason, lines: 3)
            }
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
                    Task { await cancelAppointment() }
                } label: {
                    Text("Cancel")
                        .font(.brandDisplay(13))
                        .tracking(Brand.trackingCTA)
                        .textCase(.uppercase)
                        .foregroundStyle(Color.sale)
                        .padding(.vertical, 14)
                        .padding(.horizontal, 18)
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
    }

    private func fitProfileContext(_ user: CurrentUser) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your fit profile").eyebrow(Color.ink)
            StatStrip(items: [
                (formattedHeight(user.measurements.heightInches), "Height"),
                (formattedMeasurement(user.measurements.waistInches), "Waist"),
                (formattedMeasurement(user.measurements.hipInches), "Hip"),
                (formattedMeasurement(user.measurements.inseamInches), "Inseam")
            ])
            (
                Text("Prefers ")
                    .font(.system(size: 13))
                    .foregroundColor(Color.bodyCopy)
                    + Text("\(user.preferences.fitPreference) fits")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color(hex: 0x2A2A2A))
                    + Text(" with \(user.preferences.stretchPreference) denim.")
                        .font(.system(size: 13))
                        .foregroundColor(Color.bodyCopy)
            )
        }
        .brandCard()
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

    private var review: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Step 6 of 6").eyebrow(.accent)
                    Text("Review & confirm")
                        .font(.brandDisplay(27))
                        .foregroundStyle(Color.ink)
                    KeyValueTable(rows: [
                        ("When", selectedSlot.map { "\(dayLabel($0.slotStart)) · \(timeLabel($0.slotStart))" } ?? "No time selected"),
                        ("Store", selectedStore?.name ?? "No store selected"),
                        ("Muse", derivedMuse),
                        ("Shopping for", occasion.isEmpty ? "—" : occasion),
                        ("Colors", colorSummary(focusColors))
                    ])
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

    /// 1-based position in the 6-step wizard; 0 for non-numbered screens.
    var stepNumber: Int {
        switch self {
        case .occasion: return 1
        case .colors: return 2
        case .style: return 3
        case .store: return 4
        case .schedule: return 5
        case .review: return 6
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

#Preview {
    FittingView()
}
