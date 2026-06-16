import SwiftUI

// Denim Fit brand primitives for the iOS app.
//
// SOURCE OF TRUTH: packages/design-system/src/theme.css (the `@theme` block).
// Swift can't import the design-system CSS, so the color values below are a
// documented mirror of those tokens — each one is annotated with the
// `--color-*` token it tracks. If a token changes in theme.css, update the
// matching value here. (We follow the tokens, not the redesign mock's
// hand-picked inline hexes, which differ slightly.)

extension Color {
	init(hex: UInt32) {
		let r = Double((hex >> 16) & 0xFF) / 255.0
		let g = Double((hex >> 8) & 0xFF) / 255.0
		let b = Double(hex & 0xFF) / 255.0
		self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
	}

	/// Signature slate-navy — primary brand. (`--color-ink`)
	static let ink = Color(hex: 0x253746)
	/// Hover / pressed on ink. (`--color-ink-deep`)
	static let inkDeep = Color(hex: 0x1B2935)
	/// Secondary navy / focus. (`--color-navy`; web aliases as `--color-accent`)
	static let navy = Color(hex: 0x27455C)
	static let accent = Color.navy
	/// Default body copy. (`--color-body`)
	static let bodyCopy = Color(hex: 0x5E5E5E)
	/// Meta, captions, placeholders. (`--color-muted`)
	static let muted = Color(hex: 0x8A8A8A)
	/// Default borders. (`--color-line`)
	static let line = Color(hex: 0xC6C6C6)
	/// Hairline dividers. (`--color-line-subtle`)
	static let lineSubtle = Color(hex: 0xE3E3E3)
	/// Quiet panels; also the app page background. (`--color-surface-subtle`,
	/// aliased by web as `--color-canvas`)
	static let surfaceSubtle = Color(hex: 0xF6F6F6)
	static let canvas = Color.surfaceSubtle
	/// Panels. (web `--color-surface`)
	static let surface = Color.white
	/// Clearance / sale red. (`--color-sale`)
	static let sale = Color(hex: 0x981420)
	/// (`--color-sale-soft`)
	static let saleSoft = Color(hex: 0x9E3533)
	/// (`--color-success`)
	static let success = Color(hex: 0x2F6B4F)
	/// (`--color-disabled`)
	static let disabled = Color(hex: 0x8F969C)
}

enum Brand {
	/// Square corners are the brand signature.
	static let cardRadius: CGFloat = 0
	/// Uppercase eyebrows / badges. (`--tracking-label`, 0.12em)
	static let trackingLabel: CGFloat = 1.3
	/// Buttons & nav labels. (`--tracking-cta`, 0.04em)
	static let trackingCTA: CGFloat = 0.6
}

extension Font {
	/// Display type (Oswald substitute). System font is used as a stand-in for
	/// the brand's Oswald; weight defaults to semibold to match the headings.
	static func brandDisplay(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
		.system(size: size, weight: weight, design: .default)
	}
}

// MARK: - Reusable brand views / modifiers

private struct EyebrowModifier: ViewModifier {
	var color: Color
	func body(content: Content) -> some View {
		content
			.font(.system(size: 11, weight: .bold))
			.textCase(.uppercase)
			.tracking(Brand.trackingLabel)
			.foregroundStyle(color)
	}
}

extension View {
	/// Uppercase, tracked, fine-print eyebrow label.
	func eyebrow(_ color: Color = .muted) -> some View {
		modifier(EyebrowModifier(color: color))
	}

	/// White panel with a square 1px border — the workhorse card surface.
	func brandCard(padding: CGFloat = 16) -> some View {
		self
			.padding(padding)
			.frame(maxWidth: .infinity, alignment: .leading)
			.background(Color.surface)
			.overlay(
				Rectangle().stroke(Color.line, lineWidth: 1)
			)
	}
}

enum StatusTone {
	case scheduled, completed, neutral, sale

	var color: Color {
		switch self {
		case .scheduled: return .accent
		case .completed: return .success
		case .neutral: return .muted
		case .sale: return .sale
		}
	}
}

/// Bordered status pill with a leading square dot.
struct StatusPill: View {
	let text: String
	var tone: StatusTone = .neutral

	var body: some View {
		HStack(spacing: 6) {
			Rectangle()
				.fill(tone.color)
				.frame(width: 6, height: 6)
			Text(text)
				.font(.system(size: 10, weight: .bold))
				.textCase(.uppercase)
				.tracking(Brand.trackingCTA)
				.foregroundStyle(tone.color)
		}
		.padding(.horizontal, 9)
		.padding(.vertical, 4)
		.overlay(Rectangle().stroke(tone.color.opacity(0.35), lineWidth: 1))
	}
}

/// Status pill helper that maps an appointment status string to a tone.
extension StatusPill {
	init(status: String) {
		switch status {
		case "completed":
			self.init(text: "Completed", tone: .completed)
		case "checked_in":
			self.init(text: "Checked in", tone: .scheduled)
		case "scheduled":
			self.init(text: "Scheduled", tone: .scheduled)
		case "cancelled":
			self.init(text: "Cancelled", tone: .neutral)
		case "no_show":
			self.init(text: "No-show", tone: .neutral)
		default:
			self.init(text: status.capitalized, tone: .neutral)
		}
	}
}

/// The glanceable 4-up fit-profile stat grid.
struct StatStrip: View {
	let items: [(value: String, label: String)]

	var body: some View {
		HStack(spacing: 1) {
			ForEach(Array(items.enumerated()), id: \.offset) { _, item in
				VStack(spacing: 2) {
					Text(item.value)
						.font(.brandDisplay(18))
						.foregroundStyle(Color.ink)
					Text(item.label)
						.font(.system(size: 9, weight: .bold))
						.textCase(.uppercase)
						.tracking(Brand.trackingLabel)
						.foregroundStyle(Color.muted)
				}
				.frame(maxWidth: .infinity)
				.padding(.vertical, 9)
				.padding(.horizontal, 6)
				.background(Color.surface)
			}
		}
		.background(Color.lineSubtle)
		.overlay(Rectangle().stroke(Color.lineSubtle, lineWidth: 1))
	}
}

/// Bordered key/value table used on the review screen.
struct KeyValueTable: View {
	let rows: [(label: String, value: String)]

	var body: some View {
		VStack(spacing: 0) {
			ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
				HStack(alignment: .top, spacing: 12) {
					Text(row.label)
						.eyebrow(.muted)
						.fixedSize(horizontal: false, vertical: true)
					Spacer(minLength: 12)
					Text(row.value)
						.font(.system(size: 13, weight: .semibold))
						.foregroundStyle(Color.ink)
						.multilineTextAlignment(.trailing)
				}
				.padding(.horizontal, 15)
				.padding(.vertical, 12)
				if index < rows.count - 1 {
					Rectangle().fill(Color.lineSubtle).frame(height: 1)
				}
			}
		}
		.overlay(Rectangle().stroke(Color.line, lineWidth: 1))
	}
}

/// Segmented progress bar for the booking wizard.
struct StepProgressBar: View {
	let current: Int
	let total: Int

	var body: some View {
		HStack(spacing: 5) {
			ForEach(0..<total, id: \.self) { index in
				Rectangle()
					.fill(index < current ? Color.accent : Color.lineSubtle)
					.frame(height: 4)
			}
		}
	}
}

/// Full-width navy primary action styled as a brand block button.
struct BrandBlockButtonStyle: ButtonStyle {
	var filled: Bool = true
	func makeBody(configuration: Configuration) -> some View {
		configuration.label
			.font(.brandDisplay(14))
			.tracking(Brand.trackingCTA)
			.textCase(.uppercase)
			.frame(maxWidth: .infinity)
			.padding(.vertical, 15)
			.foregroundStyle(filled ? Color.white : Color.ink)
			.background(filled ? Color.ink : Color.surface)
			.overlay(Rectangle().stroke(filled ? Color.clear : Color.ink, lineWidth: 1))
			.opacity(configuration.isPressed ? 0.85 : 1)
	}
}
