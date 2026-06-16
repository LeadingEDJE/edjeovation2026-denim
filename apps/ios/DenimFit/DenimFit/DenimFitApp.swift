import SwiftUI

@main
struct DenimFitApp: App {
    var body: some Scene {
        WindowGroup {
            SplashHostView {
                FittingView()
            }
        }
    }
}

private struct SplashHostView<Content: View>: View {
    @State private var isSplashVisible = true

    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack {
            content
                .opacity(isSplashVisible ? 0 : 1)

            if isSplashVisible {
                StylistSplashView {
                    withAnimation(.easeInOut(duration: 0.35)) {
                        isSplashVisible = false
                    }
                }
                .transition(.opacity)
            }
        }
    }
}

private struct StylistSplashView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var markScale = 0.9
    @State private var markOpacity = 0.0
    @State private var visibleCharacters = 0

    let onComplete: () -> Void

    private let word = "stylist"

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.035, green: 0.075, blue: 0.13),
                    Color(red: 0.055, green: 0.13, blue: 0.20),
                    Color(red: 0.02, green: 0.045, blue: 0.08)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 18) {
                Text("A&F")
                    .font(.system(size: 78, weight: .bold, design: .serif))
                    .foregroundStyle(.white)
                    .tracking(-2)
                    .shadow(color: .black.opacity(0.28), radius: 18, y: 10)
                    .scaleEffect(markScale)
                    .opacity(markOpacity)

                HStack(spacing: 4) {
                    ForEach(Array(word.enumerated()), id: \.offset) { index, character in
                        Text(String(character))
                            .font(.system(size: 42, weight: .semibold, design: .rounded))
                            .italic()
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.white, Color(red: 0.72, green: 0.86, blue: 0.84)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .opacity(index < visibleCharacters ? 1 : 0)
                            .offset(y: index < visibleCharacters ? 0 : 18)
                            .rotation3DEffect(
                                .degrees(index < visibleCharacters ? 0 : -28),
                                axis: (x: 1, y: 0, z: 0),
                                perspective: 0.6
                            )
                            .animation(
                                reduceMotion ? nil : .spring(response: 0.36, dampingFraction: 0.74),
                                value: visibleCharacters
                            )
                    }
                }
                .accessibilityLabel("stylist")
            }
            .padding(.bottom, 36)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("A and F stylist")
        }
        .task {
            await playIntro()
        }
    }

    private func playIntro() async {
        if reduceMotion {
            markOpacity = 1
            markScale = 1
            visibleCharacters = word.count
            try? await Task.sleep(for: .milliseconds(700))
            onComplete()
            return
        }

        withAnimation(.spring(response: 0.7, dampingFraction: 0.76)) {
            markOpacity = 1
            markScale = 1
        }

        try? await Task.sleep(for: .milliseconds(320))

        for count in 1...word.count {
            visibleCharacters = count
            try? await Task.sleep(for: .milliseconds(78))
        }

        try? await Task.sleep(for: .milliseconds(700))
        onComplete()
    }
}
