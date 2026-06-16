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

struct Store: Codable, Identifiable, Hashable {
    let storeId: String
    let name: String
    let city: String
    let state: String
    let address: String
    let phone: String
    let timezone: String

    var id: String { storeId }
}

struct StoresResponse: Codable {
    let stores: [Store]
}

struct SetActiveUserRequest: Codable {
    let customerId: String
}

struct AppointmentSlot: Codable, Identifiable, Hashable {
    let storeId: String
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

// One garment/accessory in an outfit the customer wants to build around, from a
// photo analysis or manual entry. Mirrors the API's OutfitGarment.
struct OutfitGarment: Codable, Hashable {
    let type: String
    let colors: [String]
    let material: String?
    let pattern: String?
    let descriptors: [String]
    // "complement" | "similar" | "ignore" — how this piece steers recommendations.
    let intent: String
}

// The "outfit to match" the customer signed off on. Same shape whether it came
// from a photo (engine "claude"/"sample") or was typed manually (engine "manual").
struct OutfitAnalysis: Codable {
    let garments: [OutfitGarment]
    let styleSummary: String
    let suggestedFocusColors: [String]
    let suggestedStyleKeywords: [String]
    let pairingContext: String
    let engine: String
}

struct OutfitAnalysisRequest: Codable {
    let imageBase64: String
    let mediaType: String
}

struct OutfitAnalysisResponse: Codable {
    let analysis: OutfitAnalysis
}

struct AttachOutfitAnalysisRequest: Codable {
    let outfitAnalysis: OutfitAnalysis
}

struct CreateAppointmentRequest: Codable {
    let storeId: String
    let slotStart: String
    let occasion: String
    let focusColors: String
    let avoidColors: String
    let styleKeywords: [String]
    let guidance: String
    let orderHistoryScenario: String
    // Omitted from the request when nil (the customer skipped the outfit step).
    let outfitAnalysis: OutfitAnalysis?
}

struct AppointmentResponse: Codable {
    let appointment: Appointment
}

struct UpcomingAppointmentResponse: Codable {
    let appointment: Appointment?
}

struct AppointmentsResponse: Codable {
    let appointments: [Appointment]
}

struct UpdateAppointmentRequest: Codable {
    let guidance: String
}

struct CancelAppointmentRequest: Codable {
    let cancelReason: String
}

struct AppointmentMessageRequest: Codable {
    let authorType: String
    let body: String
}

struct AppointmentMessageResponse: Codable {
    let message: AppointmentMessage
}

struct AppointmentMessagesResponse: Codable {
    let messages: [AppointmentMessage]
}

struct AppointmentNotificationsResponse: Codable {
    let notifications: [AppointmentNotification]
}

struct AppointmentFeedbackRequest: Codable {
    let rating: Int
    let comment: String
}

struct Appointment: Codable, Identifiable {
    let id: String
    let customerId: String
    let loyaltyId: String
    let customerName: String
    let slotStart: String
    let slotEnd: String
    let store: Store
    let occasion: String
    let focusColors: String
    let avoidColors: String
    let styleKeywords: [String]
    let guidance: String
    let sessionNotes: String
    let status: String
    let museTag: String
    let assignedStylist: AppointmentStylist
    let orderHistorySummary: OrderHistorySummary
    let suggestedProducts: [SuggestedProduct]
    let outfitAnalysis: OutfitAnalysis?
    let notificationSummary: NotificationSummary
    let checkedInAt: String?
    let completedAt: String?
    let cancelledAt: String?
    let noShowAt: String?
    let cancelReason: String?
    let customerRecap: String
    let associateFeedback: String
    let customerFeedbackRating: Int?
    let customerFeedbackComment: String
    let customerFeedbackAt: String?
    let createdAt: String
}

struct AppointmentStylist: Codable {
    let id: String
    let displayName: String
    let title: String
    let pronouns: String?
    let bio: String?
    let specialties: [String]?
    let stylePointOfView: [String]?
}

struct OrderHistorySummary: Codable {
    let totalOrders: Int
    let denimItems: Int
    let returnedItems: Int
    let preferredSizes: [String]
}

struct SuggestedProduct: Codable, Identifiable {
    let productId: String?
    let name: String?

    var id: String { productId ?? name ?? "suggested-product" }
}

struct NotificationSummary: Codable {
    let count: Int
    let confirmationStatus: String?
    let reminderStatus: String?
}

struct AppointmentMessage: Codable, Identifiable {
    let id: String
    let appointmentId: String
    let authorType: String
    let body: String
    let createdAt: String
}

struct AppointmentNotification: Codable, Identifiable {
    let id: String
    let appointmentId: String
    let type: String
    let status: String
    let scheduledFor: String
    let sentAt: String?
    let createdAt: String
}
