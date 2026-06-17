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

// Mirror routes.test.ts: mock the pg pool, the Claude re-ranker, and global fetch
// so the route plugins run fully offline against in-memory injected requests.
const { query, connect } = vi.hoisted(() => ({
	query: vi.fn(),
	connect: vi.fn(),
}));

const { rerankMock } = vi.hoisted(() => ({ rerankMock: vi.fn() }));

vi.mock("./db.js", () => ({
	pool: { query, connect },
	closeDb: vi.fn(),
}));

vi.mock("./claude-reranker.js", () => ({ rerank: rerankMock }));

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

const store = {
	storeId: "store-1",
	name: "Flagship",
	city: "Columbus",
	state: "OH",
	address: "160 Easton Town Center",
	phone: "+1 614-555-0100",
	timezone: "America/New_York",
};

function appointmentRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "11111111-1111-4111-8111-111111111111",
		customer_id: "cust_avery_001",
		loyalty_id: "anf-1",
		customer_name: "Avery Parker",
		slot_start: "2026-06-16T15:00:00.000Z",
		slot_end: "2026-06-16T16:00:00.000Z",
		store_snapshot: store,
		occasion: "Weekend trip",
		focus_colors: "Dark wash",
		avoid_colors: "White",
		style_keywords: ["minimal"],
		catalog_audiences: ["womens"],
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
		outfit_analysis: null,
		source_payload: null,
		notification_count: 0,
		confirmation_status: null,
		reminder_status: null,
		checked_in_at: null,
		completed_at: null,
		cancelled_at: null,
		no_show_at: null,
		cancel_reason: null,
		customer_recap: "",
		associate_feedback: "",
		customer_feedback_rating: null,
		customer_feedback_comment: "",
		customer_feedback_at: null,
		created_at: "2026-06-01T12:00:00.000Z",
		...overrides,
	};
}

function currentUserBody() {
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
				catalogAudiences: ["womens"],
			},
		},
	};
}

function storesResponse() {
	return { stores: [store] };
}

function schedulePatternsResponse() {
	return {
		patterns: [
			{
				storeId: store.storeId,
				timezone: "America/New_York",
				weekly: [
					{
						dayOfWeek: "Tuesday",
						openTime: "11:00",
						closeTime: "19:00",
						stylistIds: ["st-1", "st-2"],
					},
				],
			},
		],
	};
}

const catalogProductRow = {
	product_id: "sku-1",
	source: "anf",
	name: "Straight Jean",
	category: "jeans",
	catalog_audiences: ["womens"],
	product_url: "https://example.test/sku-1",
	image_url: null,
	description: "Classic",
	price: 89,
	currency: "USD",
	fit: "straight",
	rise: "high",
	stretch: "comfort-stretch",
	sizes: ["28"],
	colors: ["indigo"],
	scraped_at: "2026-06-01T00:00:00.000Z",
};

const validOutfitAnalysis = {
	garments: [
		{
			type: "midi skirt",
			colors: ["indigo"],
			material: "denim",
			pattern: null,
			descriptors: ["a-line"],
			intent: "complement",
		},
	],
	styleSummary: "Relaxed denim",
	suggestedFocusColors: ["cream"],
	suggestedStyleKeywords: ["chic"],
	pairingContext: "Build around the skirt",
	engine: "manual",
};

const APPT_ID = "11111111-1111-4111-8111-111111111111";

async function buildApp(): Promise<FastifyInstance> {
	const app = Fastify();
	await registerRoutes(app);
	await app.ready();
	return app;
}

let app: FastifyInstance;

beforeEach(async () => {
	vi.stubGlobal("fetch", fetchMock);
	rerankMock.mockImplementation(
		async (
			_context: unknown,
			_style: unknown,
			shortlist: Array<{ product: { productId: string } }>,
			limit: number,
		) => ({
			engine: "rule-based",
			summary: "Test rankings",
			rankings: shortlist.slice(0, limit).map((candidate, index) => ({
				productId: candidate.product.productId,
				rank: index + 1,
				rationale: "Test rationale",
			})),
		}),
	);
	app = await buildApp();
});

afterEach(async () => {
	await app.close();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	fetchMock.mockReset();
	query.mockReset();
	connect.mockReset();
	rerankMock.mockReset();
});

describe("admin routes", () => {
	it("lists mock users", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ users: [currentUserBody().user] }),
		);
		const res = await app.inject({ method: "GET", url: "/api/admin/users" });
		expect(res.statusCode).toBe(200);
		expect(res.json().users).toHaveLength(1);
	});

	it("returns 502 when the user list upstream fails", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({ method: "GET", url: "/api/admin/users" });
		expect(res.statusCode).toBe(502);
	});

	it("returns the active mock user", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		const res = await app.inject({
			method: "GET",
			url: "/api/admin/active-user",
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().activeUserId).toBe("cust_avery_001");
	});

	it("returns 502 when the active user upstream fails", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({
			method: "GET",
			url: "/api/admin/active-user",
		});
		expect(res.statusCode).toBe(502);
	});

	it("sets the active mock user", async () => {
		fetchMock
			.mockResolvedValueOnce(jsonResponse({ users: [currentUserBody().user] }))
			.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		const res = await app.inject({
			method: "PUT",
			url: "/api/admin/active-user",
			payload: { customerId: "cust_avery_001" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().activeUserId).toBe("cust_avery_001");
	});

	it("returns 404 when setting an unknown mock user", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ users: [currentUserBody().user] }),
		);
		const res = await app.inject({
			method: "PUT",
			url: "/api/admin/active-user",
			payload: { customerId: "ghost" },
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns 502 when the user lookup upstream fails on set", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({
			method: "PUT",
			url: "/api/admin/active-user",
			payload: { customerId: "cust_avery_001" },
		});
		expect(res.statusCode).toBe(502);
	});
});

describe("store routes", () => {
	it("returns 502 when stores upstream fails", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({ method: "GET", url: "/api/stores" });
		expect(res.statusCode).toBe(502);
	});

	it("returns schedule patterns", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(schedulePatternsResponse()));
		const res = await app.inject({
			method: "GET",
			url: "/api/stores/schedule-patterns",
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().patterns).toHaveLength(1);
	});

	it("returns 502 when schedule patterns upstream fails", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({
			method: "GET",
			url: "/api/stores/schedule-patterns",
		});
		expect(res.statusCode).toBe(502);
	});
});

describe("user route", () => {
	it("returns the active customer", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		const res = await app.inject({ method: "GET", url: "/api/me" });
		expect(res.statusCode).toBe(200);
		expect(res.json().customerId).toBe("cust_avery_001");
	});

	it("returns 502 when the upstream user fails", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({ method: "GET", url: "/api/me" });
		expect(res.statusCode).toBe(502);
	});
});

describe("stylist availability route", () => {
	it("returns the availability schedule", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				store: {
					storeId: "store-1",
					name: "Flagship",
					city: "Columbus",
					state: "OH",
				},
				timezone: "America/New_York",
				startDate: "2026-06-16",
				endDate: "2026-06-26",
				days: [],
			}),
		);
		const res = await app.inject({
			method: "GET",
			url: "/api/stylists/availability",
		});
		expect(res.statusCode).toBe(200);
	});

	it("returns 502 when availability upstream fails", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({
			method: "GET",
			url: "/api/stylists/availability",
		});
		expect(res.statusCode).toBe(502);
	});
});

describe("GET /api/catalog/:productId", () => {
	it("returns a single product", async () => {
		(query as Mock).mockResolvedValueOnce({
			rowCount: 1,
			rows: [catalogProductRow],
		});
		const res = await app.inject({ method: "GET", url: "/api/catalog/sku-1" });
		expect(res.statusCode).toBe(200);
		expect(res.json().product.productId).toBe("sku-1");
	});

	it("returns 404 for an unknown product", async () => {
		(query as Mock).mockResolvedValueOnce({ rowCount: 0, rows: [] });
		const res = await app.inject({ method: "GET", url: "/api/catalog/nope" });
		expect(res.statusCode).toBe(404);
	});
});

describe("GET /api/appointments", () => {
	it("lists all appointments", async () => {
		(query as Mock).mockResolvedValueOnce({ rows: [appointmentRow()] });
		const res = await app.inject({ method: "GET", url: "/api/appointments" });
		expect(res.statusCode).toBe(200);
		expect(res.json().appointments).toHaveLength(1);
	});
});

describe("GET /api/appointments/me/upcoming", () => {
	it("returns the upcoming appointment", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		(query as Mock).mockResolvedValueOnce({ rows: [appointmentRow()] });
		const res = await app.inject({
			method: "GET",
			url: "/api/appointments/me/upcoming",
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().appointment.id).toBe(APPT_ID);
	});

	it("returns null when there is none", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		(query as Mock).mockResolvedValueOnce({ rows: [] });
		const res = await app.inject({
			method: "GET",
			url: "/api/appointments/me/upcoming",
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().appointment).toBeNull();
	});

	it("returns 502 when the active user lookup fails", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({
			method: "GET",
			url: "/api/appointments/me/upcoming",
		});
		expect(res.statusCode).toBe(502);
	});
});

describe("GET /api/appointments/me/past", () => {
	it("lists the customer's past appointments", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		(query as Mock).mockResolvedValueOnce({
			rows: [appointmentRow({ status: "completed" })],
		});
		const res = await app.inject({
			method: "GET",
			url: "/api/appointments/me/past",
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().appointments).toHaveLength(1);
	});
});

describe("POST /api/appointments/:id/cancel", () => {
	it("cancels a scheduled appointment", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		(query as Mock).mockResolvedValueOnce({
			rows: [
				appointmentRow({ status: "cancelled", cancel_reason: "Plans changed" }),
			],
		});
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/cancel`,
			payload: { cancelReason: "Plans changed" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().appointment.status).toBe("cancelled");
	});

	it("returns 409 when the appointment is no longer scheduled", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ status: "completed" }] });
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/cancel`,
			payload: {},
		});
		expect(res.statusCode).toBe(409);
	});

	it("returns 404 when the appointment does not exist", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] });
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/cancel`,
			payload: {},
		});
		expect(res.statusCode).toBe(404);
	});
});

describe("PATCH /api/appointments/:id/stylist", () => {
	it("reassigns to a stylist scheduled at the same store and time", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [appointmentRow()] })
			.mockResolvedValueOnce({
				rows: [
					appointmentRow({ assigned_stylist: makeStylist({ id: "st-2" }) }),
				],
			});
		fetchMock
			.mockResolvedValueOnce(jsonResponse(schedulePatternsResponse()))
			.mockResolvedValueOnce(
				jsonResponse({
					stylists: [makeStylist(), makeStylist({ id: "st-2" })],
				}),
			);
		const res = await app.inject({
			method: "PATCH",
			url: `/api/appointments/${APPT_ID}/stylist`,
			payload: { stylistId: "st-2" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().appointment.assignedStylist.id).toBe("st-2");
	});

	it("returns 404 when the appointment is missing", async () => {
		(query as Mock).mockResolvedValueOnce({ rows: [] });
		const res = await app.inject({
			method: "PATCH",
			url: `/api/appointments/${APPT_ID}/stylist`,
			payload: { stylistId: "st-2" },
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns 409 when the appointment is not scheduled", async () => {
		(query as Mock).mockResolvedValueOnce({
			rows: [appointmentRow({ status: "checked_in" })],
		});
		const res = await app.inject({
			method: "PATCH",
			url: `/api/appointments/${APPT_ID}/stylist`,
			payload: { stylistId: "st-2" },
		});
		expect(res.statusCode).toBe(409);
	});

	it("returns 409 when the stylist is not scheduled for the slot", async () => {
		(query as Mock).mockResolvedValueOnce({ rows: [appointmentRow()] });
		fetchMock
			.mockResolvedValueOnce(jsonResponse(schedulePatternsResponse()))
			.mockResolvedValueOnce(jsonResponse({ stylists: [makeStylist()] }));
		const res = await app.inject({
			method: "PATCH",
			url: `/api/appointments/${APPT_ID}/stylist`,
			payload: { stylistId: "st-9" },
		});
		expect(res.statusCode).toBe(409);
	});

	it("returns 404 when the scheduled stylist profile is missing", async () => {
		(query as Mock).mockResolvedValueOnce({ rows: [appointmentRow()] });
		fetchMock
			.mockResolvedValueOnce(jsonResponse(schedulePatternsResponse()))
			.mockResolvedValueOnce(jsonResponse({ stylists: [makeStylist()] }));
		const res = await app.inject({
			method: "PATCH",
			url: `/api/appointments/${APPT_ID}/stylist`,
			payload: { stylistId: "st-2" },
		});
		expect(res.statusCode).toBe(404);
	});
});

describe("check-in / no-show 404s", () => {
	it("returns 404 when checking in a missing appointment", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] });
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/check-in`,
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns 409 when checking in an already checked-in appointment", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ status: "checked_in" }] });
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/check-in`,
		});
		expect(res.statusCode).toBe(409);
	});

	it("returns 404 when no-showing a missing appointment", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] });
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/no-show`,
		});
		expect(res.statusCode).toBe(404);
	});
});

describe("appointment messages & notifications GET", () => {
	it("lists messages for an existing appointment", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [{ id: APPT_ID }] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: "22222222-2222-4222-8222-222222222222",
						appointment_id: APPT_ID,
						author_type: "associate",
						body: "Ready for you",
						created_at: "2026-06-16T13:00:00.000Z",
					},
				],
			});
		const res = await app.inject({
			method: "GET",
			url: `/api/appointments/${APPT_ID}/messages`,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().messages).toHaveLength(1);
	});

	it("returns 404 listing messages for a missing appointment", async () => {
		(query as Mock).mockResolvedValueOnce({ rows: [] });
		const res = await app.inject({
			method: "GET",
			url: `/api/appointments/${APPT_ID}/messages`,
		});
		expect(res.statusCode).toBe(404);
	});

	it("rejects an empty message body", async () => {
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/messages`,
			payload: { authorType: "associate", body: "   " },
		});
		expect(res.statusCode).toBe(400);
	});

	it("returns 404 posting to a missing appointment", async () => {
		(query as Mock).mockResolvedValueOnce({ rows: [] });
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/messages`,
			payload: { authorType: "associate", body: "Hello" },
		});
		expect(res.statusCode).toBe(404);
	});

	it("lists notifications for an existing appointment", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [{ id: APPT_ID }] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: "33333333-3333-4333-8333-333333333333",
						appointment_id: APPT_ID,
						type: "confirmation",
						status: "sent",
						scheduled_for: "2026-06-15T12:00:00.000Z",
						sent_at: "2026-06-15T12:00:00.000Z",
						created_at: "2026-06-15T12:00:00.000Z",
					},
				],
			});
		const res = await app.inject({
			method: "GET",
			url: `/api/appointments/${APPT_ID}/notifications`,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().notifications).toHaveLength(1);
	});

	it("returns 404 listing notifications for a missing appointment", async () => {
		(query as Mock).mockResolvedValueOnce({ rows: [] });
		const res = await app.inject({
			method: "GET",
			url: `/api/appointments/${APPT_ID}/notifications`,
		});
		expect(res.statusCode).toBe(404);
	});
});

describe("complete / suggested-products edge cases", () => {
	it("returns 409 completing an already-terminal appointment", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ status: "completed" }] });
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/complete`,
			payload: { customerRecap: "Recap", sessionNotes: "notes" },
		});
		expect(res.statusCode).toBe(409);
	});

	it("returns 404 completing a missing appointment", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] });
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/complete`,
			payload: { customerRecap: "Recap" },
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns 404 when the suggested product id is unknown", async () => {
		(query as Mock).mockResolvedValueOnce({
			rows: [
				appointmentRow({
					suggested_products: [
						{
							rank: 1,
							rationale: "r",
							score: 0.9,
							prepStatus: "suggested",
							associateNote: "",
							product: { productId: "sku-1", catalogAudiences: ["womens"] },
						},
					],
				}),
			],
		});
		const res = await app.inject({
			method: "PATCH",
			url: `/api/appointments/${APPT_ID}/suggested-products/nope`,
			payload: { prepStatus: "pulled" },
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns 409 updating prep on a terminal appointment", async () => {
		(query as Mock).mockResolvedValueOnce({
			rows: [appointmentRow({ status: "completed" })],
		});
		const res = await app.inject({
			method: "PATCH",
			url: `/api/appointments/${APPT_ID}/suggested-products/sku-1`,
			payload: { prepStatus: "pulled" },
		});
		expect(res.statusCode).toBe(409);
	});
});

describe("POST /api/appointments/:id/regenerate-suggestions", () => {
	it("regenerates suggestions for an active appointment", async () => {
		// Generation is async now: the endpoint marks the row 'pending' and returns
		// immediately, then a background task fills in the products. The first query
		// is the lookup, the second marks pending (used for the response); later
		// queries belong to the background run, so a default mock covers them.
		(query as Mock)
			.mockResolvedValueOnce({ rows: [appointmentRow()] })
			.mockResolvedValue({
				rows: [appointmentRow({ suggestions_status: "pending" })],
			});
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/regenerate-suggestions`,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().appointment.suggestionsStatus).toBe("pending");
	});

	it("returns 404 for a missing appointment", async () => {
		(query as Mock).mockResolvedValueOnce({ rows: [] });
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/regenerate-suggestions`,
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns 409 for a terminal appointment", async () => {
		(query as Mock).mockResolvedValueOnce({
			rows: [appointmentRow({ status: "completed" })],
		});
		const res = await app.inject({
			method: "POST",
			url: `/api/appointments/${APPT_ID}/regenerate-suggestions`,
		});
		expect(res.statusCode).toBe(409);
	});
});

describe("PATCH /api/appointments/:id/outfit-analysis", () => {
	it("saves intents without regenerating", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [appointmentRow()] })
			.mockResolvedValueOnce({
				rows: [appointmentRow({ outfit_analysis: validOutfitAnalysis })],
			});
		const res = await app.inject({
			method: "PATCH",
			url: `/api/appointments/${APPT_ID}/outfit-analysis`,
			payload: { outfitAnalysis: validOutfitAnalysis, regenerate: false },
		});
		expect(res.statusCode).toBe(200);
	});

	it("attaches analysis and regenerates suggestions by default", async () => {
		// Async now: the analysis is saved + marked 'pending' synchronously, then the
		// re-rank runs in the background (covered by the default mock below).
		(query as Mock)
			.mockResolvedValueOnce({ rows: [appointmentRow()] })
			.mockResolvedValue({
				rows: [
					appointmentRow({
						outfit_analysis: validOutfitAnalysis,
						suggestions_status: "pending",
					}),
				],
			});
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		const res = await app.inject({
			method: "PATCH",
			url: `/api/appointments/${APPT_ID}/outfit-analysis`,
			payload: { outfitAnalysis: validOutfitAnalysis },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().appointment.suggestionsStatus).toBe("pending");
	});

	it("returns 404 for a missing appointment", async () => {
		(query as Mock).mockResolvedValueOnce({ rows: [] });
		const res = await app.inject({
			method: "PATCH",
			url: `/api/appointments/${APPT_ID}/outfit-analysis`,
			payload: { outfitAnalysis: null },
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns 409 for a terminal appointment", async () => {
		(query as Mock).mockResolvedValueOnce({
			rows: [appointmentRow({ status: "completed" })],
		});
		const res = await app.inject({
			method: "PATCH",
			url: `/api/appointments/${APPT_ID}/outfit-analysis`,
			payload: { outfitAnalysis: null },
		});
		expect(res.statusCode).toBe(409);
	});
});

describe("POST /api/outfit-analysis", () => {
	it("returns a sample analysis offline (no image persisted)", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/outfit-analysis",
			payload: { imageBase64: "abc123", mediaType: "image/jpeg" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().analysis.engine).toBe("sample");
	});
});

describe("DELETE /api/appointments/:id", () => {
	it("returns 404 when there is no upcoming appointment to cancel", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUserBody()));
		(query as Mock).mockResolvedValueOnce({ rowCount: 0, rows: [] });
		const res = await app.inject({
			method: "DELETE",
			url: `/api/appointments/${APPT_ID}`,
		});
		expect(res.statusCode).toBe(404);
	});
});

describe("POST /api/appointments — error paths", () => {
	const payload = {
		storeId: "store-1",
		slotStart: "2026-06-16T15:00:00.000Z",
		occasion: "Weekend trip",
		focusColors: "dark wash",
		avoidColors: "",
		styleKeywords: ["minimal"],
	};

	function freezeClock() {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-06-16T12:00:00.000Z"));
	}

	it("returns 404 when the store is not found", async () => {
		freezeClock();
		fetchMock
			.mockResolvedValueOnce(jsonResponse(currentUserBody()))
			.mockResolvedValueOnce(jsonResponse({ stores: [] }))
			.mockResolvedValueOnce(jsonResponse(schedulePatternsResponse()))
			.mockResolvedValueOnce(jsonResponse({ stylists: [makeStylist()] }));
		const res = await app.inject({
			method: "POST",
			url: "/api/appointments",
			payload,
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns 404 when the store schedule is not found", async () => {
		freezeClock();
		fetchMock
			.mockResolvedValueOnce(jsonResponse(currentUserBody()))
			.mockResolvedValueOnce(jsonResponse(storesResponse()))
			.mockResolvedValueOnce(jsonResponse({ patterns: [] }))
			.mockResolvedValueOnce(jsonResponse({ stylists: [makeStylist()] }));
		const res = await app.inject({
			method: "POST",
			url: "/api/appointments",
			payload,
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns 409 when the customer already has an upcoming appointment", async () => {
		freezeClock();
		fetchMock
			.mockResolvedValueOnce(jsonResponse(currentUserBody()))
			.mockResolvedValueOnce(jsonResponse(storesResponse()))
			.mockResolvedValueOnce(jsonResponse(schedulePatternsResponse()))
			.mockResolvedValueOnce(jsonResponse({ stylists: [makeStylist()] }));
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "x" }] });
		const res = await app.inject({
			method: "POST",
			url: "/api/appointments",
			payload,
		});
		expect(res.statusCode).toBe(409);
	});

	it("returns 409 when the requested slot is unavailable", async () => {
		freezeClock();
		fetchMock
			.mockResolvedValueOnce(jsonResponse(currentUserBody()))
			.mockResolvedValueOnce(jsonResponse(storesResponse()))
			.mockResolvedValueOnce(jsonResponse(schedulePatternsResponse()))
			.mockResolvedValueOnce(jsonResponse({ stylists: [makeStylist()] }));
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rowCount: 0, rows: [] });
		const res = await app.inject({
			method: "POST",
			url: "/api/appointments",
			payload: { ...payload, slotStart: "2026-07-05T15:00:00.000Z" },
		});
		expect(res.statusCode).toBe(409);
	});

	it("returns 409 when no stylist is available", async () => {
		freezeClock();
		fetchMock
			.mockResolvedValueOnce(jsonResponse(currentUserBody()))
			.mockResolvedValueOnce(jsonResponse(storesResponse()))
			.mockResolvedValueOnce(jsonResponse(schedulePatternsResponse()))
			.mockResolvedValueOnce(jsonResponse({ stylists: [] }));
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rowCount: 0, rows: [] });
		const res = await app.inject({
			method: "POST",
			url: "/api/appointments",
			payload,
		});
		expect(res.statusCode).toBe(409);
	});

	it("returns 502 when an upstream lookup fails", async () => {
		freezeClock();
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		const res = await app.inject({
			method: "POST",
			url: "/api/appointments",
			payload,
		});
		expect(res.statusCode).toBe(502);
	});
});
