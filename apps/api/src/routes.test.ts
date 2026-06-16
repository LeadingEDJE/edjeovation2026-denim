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

const { rerankMock } = vi.hoisted(() => ({
	rerankMock: vi.fn(),
}));

vi.mock("./db.js", () => ({
	pool: { query, connect },
	closeDb: vi.fn(),
}));

vi.mock("./claude-reranker.js", () => ({
	rerank: rerankMock,
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

describe("GET /api/stores", () => {
	it("returns configured appointment stores", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(storesResponse()));

		const res = await app.inject({ method: "GET", url: "/api/stores" });

		expect(res.statusCode).toBe(200);
		expect(res.json().stores[0]).toMatchObject({ storeId: "store-1" });
	});
});

describe("GET /api/appointments/slots", () => {
	it("generates store-scoped slots from weekly patterns", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-16T12:00:00.000Z"));
		fetchMock.mockResolvedValueOnce(jsonResponse(schedulePatternsResponse()));

		const res = await app.inject({
			method: "GET",
			url: "/api/appointments/slots?storeId=store-1",
		});

		vi.useRealTimers();

		expect(res.statusCode).toBe(200);
		expect(res.json().slots).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					storeId: "store-1",
					date: "2026-06-16",
					time: "11:00",
					availableStylistCount: 2,
				}),
			]),
		);
	});
});

describe("POST /api/appointments", () => {
	it("persists a per-booking catalog audience override", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-06-16T12:00:00.000Z"));
		fetchMock
			.mockResolvedValueOnce(jsonResponse(currentUser()))
			.mockResolvedValueOnce(jsonResponse(storesResponse()))
			.mockResolvedValueOnce(jsonResponse(schedulePatternsResponse()))
			.mockResolvedValueOnce(
				jsonResponse({
					stylists: [makeStylist(), makeStylist({ id: "st-2" })],
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					customerId: "cust_avery_001",
					scenario: "standard",
					orders: [],
				}),
			);
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					{
						product_id: "mens-1",
						source: "anf",
						name: "Mens Straight Jean",
						category: "mens jeans",
						catalog_audiences: ["mens"],
						product_url: "https://example.test/mens-1",
						image_url: null,
						description: null,
						price: 89,
						currency: "USD",
						fit: "straight",
						rise: null,
						stretch: "comfort-stretch",
						sizes: ["28", "30"],
						colors: ["dark wash"],
						scraped_at: "2026-06-01T12:00:00.000Z",
					},
					{
						product_id: "womens-1",
						source: "anf",
						name: "Womens Straight Jean",
						category: "womens jeans",
						catalog_audiences: ["womens"],
						product_url: "https://example.test/womens-1",
						image_url: null,
						description: null,
						price: 89,
						currency: "USD",
						fit: "straight",
						rise: null,
						stretch: "comfort-stretch",
						sizes: ["28", "Regular"],
						colors: ["dark wash"],
						scraped_at: "2026-06-01T12:00:00.000Z",
					},
				],
			})
			.mockResolvedValueOnce({
				rows: [appointmentRow({ catalog_audiences: ["mens"] })],
			})
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [appointmentRow({ catalog_audiences: ["mens"] })],
			});

		const res = await app.inject({
			method: "POST",
			url: "/api/appointments",
			payload: {
				storeId: "store-1",
				slotStart: "2026-06-16T15:00:00.000Z",
				occasion: "Weekend trip",
				focusColors: "dark wash",
				avoidColors: "",
				styleKeywords: ["minimal"],
				catalogAudiences: ["mens"],
			},
		});

		expect(res.statusCode).toBe(201);
		expect(res.json().appointment.catalogAudiences).toEqual(["mens"]);
		const insertCall = (query as Mock).mock.calls.find(([sql]) =>
			String(sql).includes("INSERT INTO appointments"),
		);
		expect(JSON.parse(insertCall?.[1][11] as string)).toEqual(["mens"]);
		expect(JSON.parse(insertCall?.[1][16] as string)[0].product.productId).toBe(
			"mens-1",
		);
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
						catalog_audiences: ["womens"],
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
			products: [
				{ productId: "sku-1", fit: "straight", catalogAudiences: ["womens"] },
			],
		});
	});

	it("filters catalog products by audience", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [{ count: "1" }] })
			.mockResolvedValueOnce({ rows: [] });

		const res = await app.inject({
			method: "GET",
			url: "/api/catalog?catalogAudience=mens",
		});

		expect(res.statusCode).toBe(200);
		expect(query).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("catalog_audiences ? $1"),
			["mens"],
		);
	});

	it("returns 400 for invalid catalog filters", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/catalog?fit=bootcut",
		});

		expect(res.statusCode).toBe(400);
	});
});

describe("appointment lifecycle routes", () => {
	it("checks in a scheduled appointment", async () => {
		(query as Mock).mockResolvedValueOnce({
			rows: [
				appointmentRow({
					status: "checked_in",
					checked_in_at: "2026-06-16T15:05:00.000Z",
				}),
			],
		});

		const res = await app.inject({
			method: "POST",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/check-in",
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().appointment.status).toBe("checked_in");
	});

	it("marks a scheduled appointment no-show", async () => {
		(query as Mock).mockResolvedValueOnce({
			rows: [
				appointmentRow({
					status: "no_show",
					no_show_at: "2026-06-16T16:15:00.000Z",
				}),
			],
		});

		const res = await app.inject({
			method: "POST",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/no-show",
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().appointment.status).toBe("no_show");
	});
});

describe("appointment messaging", () => {
	it("posts messages while an appointment is active", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rows: [{ status: "scheduled" }] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: "22222222-2222-4222-8222-222222222222",
						appointment_id: "11111111-1111-4111-8111-111111111111",
						author_type: "customer",
						body: "Can you pull black denim?",
						created_at: "2026-06-16T13:00:00.000Z",
					},
				],
			});

		const res = await app.inject({
			method: "POST",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/messages",
			payload: { authorType: "customer", body: "Can you pull black denim?" },
		});

		expect(res.statusCode).toBe(201);
		expect(res.json().message.body).toBe("Can you pull black denim?");
	});

	it("locks messages after completion", async () => {
		(query as Mock).mockResolvedValueOnce({ rows: [{ status: "completed" }] });

		const res = await app.inject({
			method: "POST",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/messages",
			payload: { authorType: "associate", body: "Late note" },
		});

		expect(res.statusCode).toBe(409);
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

describe("PUT /api/appointments/:appointmentId/feedback", () => {
	it("accepts customer feedback after completion", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
		(query as Mock).mockResolvedValueOnce({
			rows: [
				appointmentRow({
					status: "completed",
					completed_at: "2026-06-16T16:00:00.000Z",
					customer_recap: "Great fit.",
					customer_feedback_rating: 5,
					customer_feedback_comment: "Helpful appointment.",
					customer_feedback_at: "2026-06-16T17:00:00.000Z",
				}),
			],
		});

		const res = await app.inject({
			method: "PUT",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/feedback",
			payload: { rating: 5, comment: "Helpful appointment." },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().appointment.customerFeedbackRating).toBe(5);
	});

	it("rejects feedback before completion", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
		(query as Mock)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ status: "scheduled" }] });

		const res = await app.inject({
			method: "PUT",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/feedback",
			payload: { rating: 4 },
		});

		expect(res.statusCode).toBe(409);
	});
});

describe("PATCH /api/appointments/:appointmentId/suggested-products/:productId", () => {
	it("updates product prep state while the appointment is active", async () => {
		const suggestedProducts = [
			{
				rank: 1,
				rationale: "Good fit",
				score: 0.91,
				prepStatus: "suggested",
				associateNote: "",
				product: {
					productId: "sku-1",
					source: "anf",
					name: "Straight jean",
					category: "jeans",
					catalogAudiences: ["womens"],
					productUrl: "https://example.test/sku-1",
					imageUrl: null,
					description: null,
					price: 89,
					currency: "USD",
					fit: "straight",
					rise: "high",
					stretch: "comfort-stretch",
					sizes: ["28"],
					colors: ["black"],
					scrapedAt: "2026-06-01T12:00:00.000Z",
				},
			},
		];
		(query as Mock)
			.mockResolvedValueOnce({
				rows: [appointmentRow({ suggested_products: suggestedProducts })],
			})
			.mockResolvedValueOnce({
				rows: [
					appointmentRow({
						suggested_products: [
							{
								...suggestedProducts[0],
								prepStatus: "pulled",
								associateNote: "In fitting room 2",
							},
						],
					}),
				],
			});

		const res = await app.inject({
			method: "PATCH",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/suggested-products/sku-1",
			payload: { prepStatus: "pulled", associateNote: "In fitting room 2" },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().appointment.suggestedProducts[0]).toMatchObject({
			prepStatus: "pulled",
			associateNote: "In fitting room 2",
		});
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
		expect(res.json().appointment.guidance).toBe("Please pull darker washes.");
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
					customer_recap: "The straight-leg dark wash had the best fit.",
					associate_feedback: "Good prep accuracy.",
				}),
			],
		});

		const res = await app.inject({
			method: "POST",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/complete",
			payload: {
				sessionNotes: "Purchased dark straight jeans",
				customerRecap: "The straight-leg dark wash had the best fit.",
				associateFeedback: "Good prep accuracy.",
			},
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().appointment).toMatchObject({
			status: "completed",
			sessionNotes: "Purchased dark straight jeans",
			customerRecap: "The straight-leg dark wash had the best fit.",
			associateFeedback: "Good prep accuracy.",
			completedAt: "2026-06-16T16:00:00.000Z",
			suggestedProducts: [],
		});
	});

	it("rejects completion without a customer recap", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/appointments/11111111-1111-4111-8111-111111111111/complete",
			payload: { sessionNotes: "Missing recap" },
		});

		expect(res.statusCode).toBe(400);
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
