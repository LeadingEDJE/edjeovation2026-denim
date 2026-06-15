import Foundation

final class APIClient: Sendable {
    private let baseURL = URL(string: "http://localhost:4000")!
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    func getCurrentUser() async throws -> CurrentUser {
        try await get(path: "/api/me")
    }

    func getUsers() async throws -> [CurrentUser] {
        let response: UserListResponse = try await get(path: "/api/admin/users")
        return response.users
    }

    func setActiveUser(customerId: String) async throws -> ActiveUserResponse {
        try await send(path: "/api/admin/active-user", method: "PUT", input: SetActiveUserRequest(customerId: customerId))
    }

    func getAppointmentSlots() async throws -> [AppointmentSlot] {
        let response: AppointmentSlotsResponse = try await get(path: "/api/appointments/slots")
        return response.slots
    }

    func getUpcomingAppointment() async throws -> Appointment? {
        let response: UpcomingAppointmentResponse = try await get(path: "/api/appointments/me/upcoming")
        return response.appointment
    }

    func createAppointment(input: CreateAppointmentRequest) async throws -> AppointmentResponse {
        try await post(path: "/api/appointments", input: input)
    }

    func updateAppointment(id: String, guidance: String) async throws -> AppointmentResponse {
        try await send(path: "/api/appointments/\(id)", method: "PATCH", input: UpdateAppointmentRequest(guidance: guidance))
    }

    func cancelAppointment(id: String) async throws {
        let request = URLRequest(url: baseURL.appending(path: "/api/appointments/\(id)"))
        var mutableRequest = request
        mutableRequest.httpMethod = "DELETE"
        let (_, response) = try await URLSession.shared.data(for: mutableRequest)
        try validate(response: response)
    }

    private func get<T: Decodable>(path: String) async throws -> T {
        let (data, response) = try await URLSession.shared.data(from: baseURL.appending(path: path))
        try validate(response: response)
        return try decoder.decode(T.self, from: data)
    }

    private func post<T: Decodable, Body: Encodable>(path: String, input: Body) async throws -> T {
        try await send(path: path, method: "POST", input: input)
    }

    private func send<T: Decodable, Body: Encodable>(path: String, method: String, input: Body) async throws -> T {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(input)

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response)
        return try decoder.decode(T.self, from: data)
    }

    private func validate(response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}
