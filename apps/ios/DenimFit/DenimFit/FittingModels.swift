import Foundation

struct CurrentUser: Codable {
    let customerId: String
    let loyaltyId: String
    let displayName: String
    let measurements: Measurements
    let preferences: UserPreferences
}

struct Measurements: Codable {
    let heightInches: Int
    let waistInches: Double
    let hipInches: Double
    let inseamInches: Double
}

struct UserPreferences: Codable {
    let fitPreference: String
    let stretchPreference: String
}

struct UserListResponse: Codable {
    let users: [CurrentUser]
}

struct ActiveUserResponse: Codable {
    let activeUserId: String
    let user: CurrentUser
}

struct SetActiveUserRequest: Codable {
    let customerId: String
}

struct AppointmentSlot: Codable, Identifiable, Hashable {
    let slotStart: String
    let slotEnd: String
    let date: String
    let time: String
    let availableStylistCount: Int

    var id: String { slotStart }
}

struct AppointmentSlotsResponse: Codable {
    let slots: [AppointmentSlot]
}

struct CreateAppointmentRequest: Codable {
    let slotStart: String
    let occasion: String
    let focusColors: String
    let avoidColors: String
    let styleKeywords: [String]
    let guidance: String
    let orderHistoryScenario: String
}

struct AppointmentResponse: Codable {
    let appointment: Appointment
}

struct UpcomingAppointmentResponse: Codable {
    let appointment: Appointment?
}

struct UpdateAppointmentRequest: Codable {
    let guidance: String
}

struct Appointment: Codable, Identifiable {
    let id: String
    let customerId: String
    let loyaltyId: String
    let customerName: String
    let slotStart: String
    let slotEnd: String
    let occasion: String
    let focusColors: String
    let avoidColors: String
    let styleKeywords: [String]
    let guidance: String
    let museTag: String
    let assignedStylist: AppointmentStylist
    let orderHistorySummary: OrderHistorySummary
    let createdAt: String
}

struct AppointmentStylist: Codable {
    let id: String
    let displayName: String
    let title: String
}

struct OrderHistorySummary: Codable {
    let totalOrders: Int
    let denimItems: Int
    let returnedItems: Int
    let preferredSizes: [String]
}
