import Fastify, { type FastifyInstance } from "fastify";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import type { StylistProfile } from "./types.js";

// Mock the pg pool so no real database connection is attempted.
const { query, connect } = vi.hoisted(() => ({
	query: vi.fn(),
	connect: vi.fn(),
}));

vi.mock("./db.js", () => ({
	pool: { query, connect },
	closeDb: vi.fn(),
}));

const { registerRoutes } = await import("./routes.js");

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	} as Response;
}

function makeStylist(overrides: Partial<StylistProfile> = {}): StylistProfile {
	return {
		id: "st-1",
		displayName: "Jordan Lee",
		pronouns: "they/them",
		title: "Senior Denim Stylist",
		store: {
			storeId: "store-1",
			name: "Flagship",
			city: "Columbus",
			state: "OH",
		},
		bio: "Denim specialist.",
		specialties: ["curvy-fit"],
		stylePointOfView: ["timeless"],
		supportedFits: ["slim"],
		customerSignals: ["return-reducer"],
		availability: { status: "available", nextAvailableAt: null },
		avatarUrl: null,
		...overrides,
	};
}

function appointmentRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "11111111-1111-4111-8111-111111111111",
		customer_id: "cust_avery_001",
		loyalty_id: "anf-1",
		customer_name: "Avery Parker",
		slot_start: "2026-06-16T15:00:00.000Z",
		slot_end: "2026-06-16T16:00:00.000Z",
		occasion: "Weekend trip",
		focus_colors: "Dark wash",
		avoid_colors: "White",
		style_keywords: ["minimal"],
		guidance: "Customer note",
		session_notes: "",
		status: "scheduled",
		muse_tag: "Clean Muse",
		assigned_stylist: makeStylist(),
		order_history_summary: {
			totalOrders: 1,
			denimItems: 1,
			returnedItems: 0,
			preferredSizes: ["28"],
		},
		suggested_products: [],
		completed_at: null,
		created_at: "2026-06-01T12:00:00.000Z",
		...overrides,
	};
}

function currentUser() {
	return {
		user: {
			customerId: "cust_avery_001",
			loyaltyId: "anf-1",
			displayName: "Avery Parker",
			measurements: {
				heightInches: 66,
				waistInches: 28,
				hipInches: 38,
				inseamInches: 30,
			},
			preferences: {
				fitPreference: "straight",
				stretchPreference: "comfort-stretch",
			},
		},
	};
}

async function buildApp(): Promise<FastifyInstance> {
	const app = Fastify();
	await registerRoutes(app);
	await app.ready();
	return app;
}

let app: FastifyInstance;

beforeEach(async () => {
	vi.stubGlobal("fetch", fetchMock);
	app = await buildApp();
});

afterEach(async () => {
	await app.close();
	vi.unstubAllGlobals();
	fetchMock.mockReset();
	query.mockReset();
	connect.mockReset();
});

describe("GET /health", () => {
	it("returns ok", async () => {
		const res = await app.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});
});

describe("GET /api/stylists", () => {
	it("returns the full list with no filters", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ stylists: [makeStylist(), makeStylist({ id: "st-2" })] }),
		);

		const res = await app.inject({ method: "GET", url: "/api/stylists" });

		expect(res.statusCode).toBe(200);
		expect(res.json().stylists).toHaveLength(2);
	});

	it("filters by specialty, fit and availability", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				stylists: [
					makeStylist({ id: "match" }),
					makeStylist({ id: "wrong-fit", supportedFits: ["wide"] }),
					makeStylist({
						id: "busy",
						availability: { status: "busy", nextAvailableAt: null },
					}),
				],
			}),
		);

		const res = await app.inject({
			method: "GET",
			url: "/api/stylists?specialty=curvy-fit&fit=slim&availability=available",
		});

		expect(res.statusCode).toBe(200);
		const ids = res.json().stylists.map((s: StylistProfile) => s.id);
		expect(ids).toEqual(["match"]);
	});

	it("returns 502 when the upstream service fails", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({ method: "GET", url: "/api/stylists" });
		expect(res.statusCode).toBe(502);
		expect(res.json().message).toMatch(/stylist profiles/i);
	});
});

describe("GET /api/stylists/:stylistId", () => {
	it("returns a single stylist", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ stylist: makeStylist() }));
		const res = await app.inject({ method: "GET", url: "/api/stylists/st-1" });
		expect(res.statusCode).toBe(200);
		expect(res.json().stylist.id).toBe("st-1");
	});

	it("maps an upstream 404 to a 404", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 404));
		const res = await app.inject({ method: "GET", url: "/api/stylists/nope" });
		expect(res.statusCode).toBe(404);
	});

	it("maps other upstream errors to a 502", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({ method: "GET", url: "/api/stylists/st-1" });
		expect(res.statusCode).toBe(502);
	});
});

describe("GET /api/customers/:customerId/order-history", () => {
	it("returns the order history", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ customerId: "c1", scenario: "standard", orders: [] }),
		);
		const res = await app.inject({
			method: "GET",
			url: "/api/customers/c1/order-history",
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().customerId).toBe("c1");
	});

	it("returns 502 when the upstream service fails", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({
			method: "GET",
			url: "/api/customers/c1/order-history",
		});
		expect(res.statusCode).toBe(502);
	});
});

describe("GET /api/catalog", () => {
	it("returns catalog products with totals", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [{ count: "1" }] })
			.mockResolvedValueOnce({
				rows: [
					{
						product_id: "sku-1",
						source: "anf",
						name: "High Rise Straight Jean",
						category: "jeans",
						product_url: "https://example.test/p/sku-1",
						image_url: null,
						description: "Straight jean",
						price: 89,
						currency: "USD",
						fit: "straight",
						rise: "high",
						stretch: "comfort-stretch",
						sizes: ["27", "28"],
						colors: ["medium wash"],
						scraped_at: "2026-06-01T12:00:00.000Z",
					},
				],
			});

		const res = await app.inject({
			method: "GET",
			url: "/api/catalog?fit=straight&limit=10&offset=0",
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({
			total: 1,
			limit: 10,
			offset: 0,
			products: [{ productId: "sku-1", fit: "straight" }],
		});
	});

	it("returns 400 for invalid catalog filters", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/catalog?fit=bootcut",
		});

		expect(res.statusCode).toBe(400);
	});
});

describe("PATCH /api/appointments/:appointmentId/session-notes", () => {
	it("updates associate notes for a non-completed appointment", async () => {
		(query as Mock).mockResolvedValueOnce({
			rows: [appointmentRow({ session_notes: "Great fit in straight denim" })],
		});

		const res = await app.inject({
			method: "PATCH",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/session-notes",
			payload: { sessionNotes: "Great fit in straight denim" },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().appointment.sessionNotes).toBe(
			"Great fit in straight denim",
		);
	});

	it("rejects session note edits after completion", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ status: "completed" }] });

		const res = await app.inject({
			method: "PATCH",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/session-notes",
			payload: { sessionNotes: "Late edit" },
		});

		expect(res.statusCode).toBe(409);
	});
});

describe("PATCH /api/appointments/:appointmentId", () => {
	it("updates customer guidance on a non-completed appointment even after the slot time", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
		(query as Mock).mockResolvedValueOnce({
			rows: [
				appointmentRow({
					guidance: "Please pull darker washes.",
					slot_start: "2026-06-01T15:00:00.000Z",
					status: "scheduled",
				}),
			],
		});

		const res = await app.inject({
			method: "PATCH",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111",
			payload: { guidance: "Please pull darker washes." },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().appointment.guidance).toBe(
			"Please pull darker washes.",
		);
	});

	it("rejects customer guidance edits after completion", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ status: "completed" }] });

		const res = await app.inject({
			method: "PATCH",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111",
			payload: { guidance: "Late note" },
		});

		expect(res.statusCode).toBe(409);
	});
});

describe("POST /api/appointments/:appointmentId/complete", () => {
	it("marks an appointment completed with session notes", async () => {
		(query as Mock).mockResolvedValueOnce({
			rows: [
				appointmentRow({
					session_notes: "Purchased dark straight jeans",
					status: "completed",
					completed_at: "2026-06-16T16:00:00.000Z",
				}),
			],
		});

		const res = await app.inject({
			method: "POST",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/complete",
			payload: { sessionNotes: "Purchased dark straight jeans" },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().appointment).toMatchObject({
			status: "completed",
			sessionNotes: "Purchased dark straight jeans",
			completedAt: "2026-06-16T16:00:00.000Z",
			suggestedProducts: [],
		});
	});
});

describe("DELETE /api/appointments/:appointmentId", () => {
	it("marks an upcoming appointment cancelled instead of deleting it", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
		(query as Mock).mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "x" }] });

		const res = await app.inject({
			method: "DELETE",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111",
		});

		expect(res.statusCode).toBe(204);
		expect(query).toHaveBeenCalledWith(
			expect.stringContaining("SET status = 'cancelled'"),
			["11111111-1111-4111-8111-111111111111", "cust_avery_001"],
		);
	});
});
