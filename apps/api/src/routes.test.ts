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
