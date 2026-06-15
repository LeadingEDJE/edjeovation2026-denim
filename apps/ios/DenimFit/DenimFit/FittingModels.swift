import Foundation

struct FittingInput: Codable {
    var customerName: String
    var heightInches: Int
    var waistInches: Double
    var hipInches: Double
    var inseamInches: Double
    var fitPreference: String
    var stretchPreference: String
}

struct FittingSession: Codable, Identifiable {
    let id: String
    let customerName: String
    let heightInches: Int
    let waistInches: Double
    let hipInches: Double
    let inseamInches: Double
    let fitPreference: String
    let stretchPreference: String
    let createdAt: String
}

struct DenimRecommendation: Codable, Identifiable {
    let id: String
    let sessionId: String
    let styleName: String
    let sizeLabel: String
    let confidence: Double
    let rationale: String
    let createdAt: String
}

struct CreateFittingResponse: Codable {
    let session: FittingSession
    let recommendation: DenimRecommendation
}
