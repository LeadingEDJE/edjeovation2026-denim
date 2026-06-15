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

describe("GET /api/fitting-sessions/:id", () => {
	const sessionId = "11111111-1111-4111-8111-111111111111";

	function sessionRow() {
		return {
			id: sessionId,
			customer_name: "Dana Rivera",
			height_inches: 68,
			waist_inches: 32,
			hip_inches: 40,
			inseam_inches: 30,
			fit_preference: "slim",
			stretch_preference: "comfort-stretch",
			created_at: "2026-06-01T12:00:00.000Z",
		};
	}

	it("returns 404 when the session does not exist", async () => {
		(query as Mock).mockResolvedValueOnce({ rowCount: 0, rows: [] });
		const res = await app.inject({
			method: "GET",
			url: `/api/fitting-sessions/${sessionId}`,
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns the session with its recommendations", async () => {
		(query as Mock)
			.mockResolvedValueOnce({ rowCount: 1, rows: [sessionRow()] })
			.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "22222222-2222-4222-8222-222222222222",
						session_id: sessionId,
						style_name: "Curve Love",
						size_label: "29",
						confidence: 0.8,
						rationale: "good",
						created_at: "2026-06-01T12:05:00.000Z",
					},
				],
			});

		const res = await app.inject({
			method: "GET",
			url: `/api/fitting-sessions/${sessionId}`,
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.session.customerName).toBe("Dana Rivera");
		expect(body.recommendations).toHaveLength(1);
		expect(body.recommendations[0].styleName).toBe("Curve Love");
	});
});

describe("POST /api/fitting-sessions", () => {
	const validBody = {
		customerName: "Dana Rivera",
		heightInches: 68,
		waistInches: 32,
		hipInches: 40,
		inseamInches: 30,
		fitPreference: "slim",
		stretchPreference: "comfort-stretch",
	};

	it("returns 400 for an invalid body", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/fitting-sessions",
			payload: { ...validBody, fitPreference: "bootcut" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("creates a session and recommendation within a transaction", async () => {
		const calls: string[] = [];
		const clientQuery = vi.fn(async (sql: string) => {
			calls.push(sql.trim().split(/\s+/)[0]);
			if (sql.includes("INSERT INTO fitting_sessions")) {
				return {
					rows: [
						{
							id: "33333333-3333-4333-8333-333333333333",
							customer_name: validBody.customerName,
							height_inches: validBody.heightInches,
							waist_inches: validBody.waistInches,
							hip_inches: validBody.hipInches,
							inseam_inches: validBody.inseamInches,
							fit_preference: validBody.fitPreference,
							stretch_preference: validBody.stretchPreference,
							created_at: "2026-06-01T12:00:00.000Z",
						},
					],
				};
			}
			if (sql.includes("INSERT INTO denim_recommendations")) {
				return {
					rows: [
						{
							id: "44444444-4444-4444-8444-444444444444",
							session_id: "33333333-3333-4333-8333-333333333333",
							style_name: "Curve Love",
							size_label: "29",
							confidence: 0.88,
							rationale: "great match",
							created_at: "2026-06-01T12:05:00.000Z",
						},
					],
				};
			}
			return { rows: [] };
		});
		const release = vi.fn();
		connect.mockResolvedValueOnce({ query: clientQuery, release });

		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				styleName: "Curve Love",
				sizeLabel: "29",
				confidence: 0.88,
				rationale: "great match",
			}),
		);

		const res = await app.inject({
			method: "POST",
			url: "/api/fitting-sessions",
			payload: validBody,
		});

		expect(res.statusCode).toBe(201);
		expect(res.json().recommendation.styleName).toBe("Curve Love");
		expect(calls).toContain("BEGIN");
		expect(calls).toContain("COMMIT");
		expect(release).toHaveBeenCalledOnce();
	});

	it("rolls back and surfaces an error when the third-party call fails", async () => {
		const clientQuery = vi.fn(async (sql: string) => {
			if (sql.includes("INSERT INTO fitting_sessions")) {
				return { rows: [{ id: "x" }] };
			}
			return { rows: [] };
		});
		const release = vi.fn();
		connect.mockResolvedValueOnce({ query: clientQuery, release });

		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

		const res = await app.inject({
			method: "POST",
			url: "/api/fitting-sessions",
			payload: validBody,
		});

		expect(res.statusCode).toBe(500);
		expect(clientQuery).toHaveBeenCalledWith("ROLLBACK");
		expect(release).toHaveBeenCalledOnce();
	});
});
