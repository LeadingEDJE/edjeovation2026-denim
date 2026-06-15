import Foundation

final class APIClient {
    private let baseURL = URL(string: "http://localhost:4000")!
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    func createSession(input: FittingInput) async throws -> CreateFittingResponse {
        var request = URLRequest(url: baseURL.appending(path: "/api/fitting-sessions"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(input)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        return try decoder.decode(CreateFittingResponse.self, from: data)
    }
}
