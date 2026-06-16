import Foundation

final class APIClient: Sendable {
    private static let defaultBaseURL = "http://localhost:4000"

    private let baseURL: URL
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(baseURL: URL = APIClient.configuredBaseURL()) {
        self.baseURL = baseURL
    }

    private static func configuredBaseURL() -> URL {
        let environmentValue = ProcessInfo.processInfo.environment["DENIM_FIT_API_BASE_URL"]
        let bundleValue = Bundle.main.object(forInfoDictionaryKey: "DENIM_FIT_API_BASE_URL") as? String
        let rawValue = environmentValue ?? bundleValue ?? defaultBaseURL
        let trimmedValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedValue.isEmpty, let url = URL(string: trimmedValue) else {
            assertionFailure("Invalid DENIM_FIT_API_BASE_URL: \(rawValue)")
            return URL(string: defaultBaseURL)!
        }

        return url
    }

    func getCurrentUser() async throws -> CurrentUser {
        try await get(path: "/api/me")
    }

    func getUsers() async throws -> [CurrentUser] {
        let response: UserListResponse = try await get(path: "/api/admin/users")
        return response.users
    }

    func getStores() async throws -> [Store] {
        let response: StoresResponse = try await get(path: "/api/stores")
        return response.stores
    }

    func setActiveUser(customerId: String) async throws -> ActiveUserResponse {
        try await send(path: "/api/admin/active-user", method: "PUT", input: SetActiveUserRequest(customerId: customerId))
    }

    func getAppointmentSlots(storeId: String) async throws -> [AppointmentSlot] {
        let response: AppointmentSlotsResponse = try await get(path: "/api/appointments/slots?storeId=\(storeId)")
        return response.slots
    }

    func getUpcomingAppointment() async throws -> Appointment? {
        let response: UpcomingAppointmentResponse = try await get(path: "/api/appointments/me/upcoming")
        return response.appointment
    }

    func getPastAppointments() async throws -> [Appointment] {
        let response: AppointmentsResponse = try await get(path: "/api/appointments/me/past")
        return response.appointments
    }

    func createAppointment(input: CreateAppointmentRequest) async throws -> AppointmentResponse {
        try await post(path: "/api/appointments", input: input)
    }

    func updateAppointment(id: String, guidance: String) async throws -> AppointmentResponse {
        try await send(path: "/api/appointments/\(id)", method: "PATCH", input: UpdateAppointmentRequest(guidance: guidance))
    }

    func cancelAppointment(id: String, reason: String) async throws -> AppointmentResponse {
        try await send(path: "/api/appointments/\(id)/cancel", method: "POST", input: CancelAppointmentRequest(cancelReason: reason))
    }

    func getAppointmentMessages(id: String) async throws -> [AppointmentMessage] {
        let response: AppointmentMessagesResponse = try await get(path: "/api/appointments/\(id)/messages")
        return response.messages
    }

    func postAppointmentMessage(id: String, body: String) async throws -> AppointmentMessage {
        let response: AppointmentMessageResponse = try await send(path: "/api/appointments/\(id)/messages", method: "POST", input: AppointmentMessageRequest(authorType: "customer", body: body))
        return response.message
    }

    func getAppointmentNotifications(id: String) async throws -> [AppointmentNotification] {
        let response: AppointmentNotificationsResponse = try await get(path: "/api/appointments/\(id)/notifications")
        return response.notifications
    }

    func submitFeedback(id: String, rating: Int, comment: String) async throws -> AppointmentResponse {
        try await send(path: "/api/appointments/\(id)/feedback", method: "PUT", input: AppointmentFeedbackRequest(rating: rating, comment: comment))
    }

    private func get<T: Decodable>(path: String) async throws -> T {
        let (data, response) = try await URLSession.shared.data(from: url(for: path))
        try validate(response: response)
        return try decoder.decode(T.self, from: data)
    }

    private func post<T: Decodable, Body: Encodable>(path: String, input: Body) async throws -> T {
        try await send(path: path, method: "POST", input: input)
    }

    private func send<T: Decodable, Body: Encodable>(path: String, method: String, input: Body) async throws -> T {
        var request = URLRequest(url: url(for: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(input)

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response)
        return try decoder.decode(T.self, from: data)
    }

    private func url(for path: String) -> URL {
        guard let queryStart = path.firstIndex(of: "?") else {
            return baseURL.appending(path: path)
        }

        let route = String(path[..<queryStart])
        let query = String(path[path.index(after: queryStart)...])
        var components = URLComponents(url: baseURL.appending(path: route), resolvingAgainstBaseURL: false)!
        components.percentEncodedQuery = query
        return components.url!
    }

    private func validate(response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}
