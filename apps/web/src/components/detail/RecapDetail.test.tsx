import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
	Appointment,
	StylistProfile,
	SuggestedProduct,
} from "../../api.js";
import { RecapDetail } from "./RecapDetail.js";

function stylist(id: string, displayName: string): StylistProfile {
	return {
		id,
		displayName,
		pronouns: "they/them",
		title: "Denim Stylist",
		store: {
			storeId: "store-1",
			name: "Flagship",
			city: "Columbus",
			state: "OH",
		},
		bio: "",
		specialties: [],
		stylePointOfView: [],
		supportedFits: [],
		customerSignals: [],
		availability: { status: "available", nextAvailableAt: null },
		avatarUrl: null,
	};
}

function pulledProduct(): SuggestedProduct {
	return {
		rank: 1,
		rationale: "Great match",
		score: 0.9,
		prepStatus: "pulled",
		associateNote: "Customer loved the wash",
		product: {
			productId: "prod-1",
			name: "Slim Dark Wash",
			category: "Denim",
			catalogAudiences: ["womens"],
			productUrl: "https://example.com/prod-1",
			imageUrl: null,
			price: 98,
			currency: "$",
			fit: "Slim",
			rise: "High",
			stretch: "Comfort",
		},
	};
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
	return {
		id: "11111111-2222-4333-8444-555566667777",
		customerName: "Avery Parker",
		slotStart: "2026-06-16T15:00:00.000Z",
		slotEnd: "2026-06-16T16:00:00.000Z",
		store: {
			storeId: "store-1",
			name: "Flagship",
			city: "Columbus",
			state: "OH",
			address: "160 Easton",
			phone: "x",
			timezone: "America/New_York",
		},
		occasion: "Weekend trip",
		museTag: "Clean Muse",
		focusColors: "Indigo",
		avoidColors: "White",
		styleKeywords: [],
		catalogAudiences: ["womens"],
		guidance: "",
		status: "completed",
		assignedStylist: stylist("sty-1", "Jordan Lee"),
		orderHistorySummary: {
			totalOrders: 2,
			denimItems: 1,
			returnedItems: 0,
			preferredSizes: ["28"],
		},
		suggestedProducts: [],
		outfitAnalysis: null,
		customerRecap: "",
		sessionNotes: "",
		associateFeedback: "",
		customerFeedbackRating: null,
		customerFeedbackComment: "",
		...overrides,
	} as Appointment;
}

const stylists = [stylist("sty-1", "Jordan Lee")];

describe("RecapDetail", () => {
	it("renders the customer, reference, and stylist header", () => {
		render(<RecapDetail appointment={makeAppointment()} stylists={stylists} />);
		expect(screen.getByText("Avery Parker")).toBeInTheDocument();
		expect(screen.getByText(/Appointment · #/)).toBeInTheDocument();
		expect(screen.getByText("Jordan Lee")).toBeInTheDocument();
	});

	it("shows the empty state when nothing was pulled", () => {
		render(<RecapDetail appointment={makeAppointment()} stylists={stylists} />);
		expect(
			screen.getByText(/no products were pulled in this session/i),
		).toBeInTheDocument();
	});

	it("lists pulled products with their note", () => {
		render(
			<RecapDetail
				appointment={makeAppointment({ suggestedProducts: [pulledProduct()] })}
				stylists={stylists}
			/>,
		);
		expect(screen.getByText("Slim Dark Wash")).toBeInTheDocument();
		expect(screen.getByText("$98.00")).toBeInTheDocument();
		expect(screen.getByText("Customer loved the wash")).toBeInTheDocument();
	});

	it("shows the customer rating banner when feedback exists", () => {
		render(
			<RecapDetail
				appointment={makeAppointment({
					customerFeedbackRating: 5,
					customerFeedbackComment: "Loved the styling",
				})}
				stylists={stylists}
			/>,
		);
		expect(screen.getByText(/customer rating/i)).toBeInTheDocument();
		expect(screen.getByText(/loved the styling/i)).toBeInTheDocument();
	});

	it("renders recap fields and their fallbacks", () => {
		render(
			<RecapDetail
				appointment={makeAppointment({
					customerRecap: "Found the perfect fit",
				})}
				stylists={stylists}
			/>,
		);
		expect(screen.getByText("Found the perfect fit")).toBeInTheDocument();
		expect(
			screen.getByText(/no associate notes recorded/i),
		).toBeInTheDocument();
		expect(
			screen.getByText(/no internal feedback recorded/i),
		).toBeInTheDocument();
	});
});
