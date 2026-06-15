import SwiftUI

struct FittingView: View {
    @State private var input = FittingInput(
        customerName: "Avery",
        heightInches: 67,
        waistInches: 29,
        hipInches: 39,
        inseamInches: 30,
        fitPreference: "straight",
        stretchPreference: "comfort-stretch"
    )
    @State private var recommendation: DenimRecommendation?
    @State private var status = "Ready"
    @State private var isLoading = false

    private let apiClient = APIClient()
    private let fitOptions = ["skinny", "slim", "straight", "relaxed", "wide"]
    private let stretchOptions = ["rigid", "comfort-stretch", "high-stretch"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Customer") {
                    TextField("Name", text: $input.customerName)
                    Stepper("Height: \(input.heightInches) in", value: $input.heightInches, in: 48...90)
                }

                Section("Measurements") {
                    measurementRow("Waist", value: $input.waistInches)
                    measurementRow("Hip", value: $input.hipInches)
                    measurementRow("Inseam", value: $input.inseamInches)
                }

                Section("Preference") {
                    Picker("Fit", selection: $input.fitPreference) {
                        ForEach(fitOptions, id: \.self) { Text($0.capitalized).tag($0) }
                    }
                    Picker("Stretch", selection: $input.stretchPreference) {
                        ForEach(stretchOptions, id: \.self) { Text($0.replacingOccurrences(of: "-", with: " ").capitalized).tag($0) }
                    }
                }

                Section("Recommendation") {
                    if let recommendation {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(recommendation.styleName).font(.headline)
                            Text(recommendation.sizeLabel).font(.subheadline).foregroundStyle(.teal)
                            ProgressView(value: recommendation.confidence)
                            Text(recommendation.rationale).font(.footnote)
                        }
                    } else {
                        Text("No recommendation yet")
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    Button {
                        Task { await createRecommendation() }
                    } label: {
                        if isLoading {
                            ProgressView()
                        } else {
                            Text("Create Recommendation")
                        }
                    }
                    Text(status).font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Denim Fit")
        }
    }

    private func measurementRow(_ label: String, value: Binding<Double>) -> some View {
        HStack {
            Text(label)
            Spacer()
            Stepper(value: value, in: 20...80, step: 0.5) {
                Text(value.wrappedValue, format: .number.precision(.fractionLength(1)))
            }
        }
    }

    @MainActor
    private func createRecommendation() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await apiClient.createSession(input: input)
            recommendation = response.recommendation
            status = "Recommendation created"
        } catch {
            status = "API request failed"
        }
    }
}

#Preview {
    FittingView()
}
