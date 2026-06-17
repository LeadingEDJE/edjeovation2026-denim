import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// buildSuggestedProducts reaches the DB (catalog) and the Claude re-ranker; mock
// both so the helper logic is exercised deterministically and offline.
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../db.js", () => ({ pool: { query }, closeDb: vi.fn() }));

const { rerankMock } = vi.hoisted(() => ({ rerankMock: vi.fn() }));
vi.mock("../claude-reranker.js", () => ({ rerank: rerankMock }));

import type {
	Appointment,
	CurrentUser,
	OrderHistory,
	OutfitAnalysis,
	StylistProfile,
} from "../types.js";
import {
	addOneHour,
	assignStylist,
	buildPairingInstruction,
	buildSuggestedProducts,
	createStoreAppointmentSlots,
	filterStylists,
	hourRange,
	isActiveStatus,
	isoOrNull,
	isTerminalStatus,
	mapAppointment,
	mapCatalogProduct,
	mapMuseTag,
	mapOutfitAnalysis,
	mapStoreSnapshot,
	normalizeCatalogAudiences,
	normalizeSlotKey,
	normalizeSuggestedProducts,
	parseJsonField,
	reminderScheduledFor,
	scheduledStylistIdsForSlot,
	summarizeOrderHistory,
} from "./helpers.js";

afterEach(() => {
	query.mockReset();
	rerankMock.mockReset();
	vi.useRealTimers();
});

describe("mapMuseTag", () => {
	it("maps keyword sets to the best-matching muse tag", () => {
		expect(mapMuseTag(["minimal"])).toBe("Clean Muse");
		expect(mapMuseTag(["feminine", "soft"])).toBe("Romantic Muse");
		expect(mapMuseTag(["preppy", "sporty"])).toBe("Boyish Muse");
		expect(mapMuseTag(["bold"])).toBe("Statement Maker");
	});

	it("defaults to Clean Muse when nothing matches", () => {
		expect(mapMuseTag([])).toBe("Clean Muse");
		expect(mapMuseTag(["unknown-keyword"])).toBe("Clean Muse");
	});
});

describe("summarizeOrderHistory", () => {
	it("counts denim, returns, and preferred kept sizes", () => {
		const history = {
			orders: [
				{
					items: [
						{ category: "denim", kept: true, sizeLabel: "28" },
						{ category: "denim", kept: false, sizeLabel: "30" },
						{ category: "top", kept: true, sizeLabel: "M" },
					],
				},
			],
		} as unknown as OrderHistory;

		expect(summarizeOrderHistory(history)).toEqual({
			totalOrders: 1,
			denimItems: 2,
			returnedItems: 1,
			preferredSizes: ["28"],
		});
	});
});

describe("assignStylist", () => {
	const stylist = (id: string, specialties: string[]): StylistProfile =>
		({ id, specialties }) as StylistProfile;

	it("prefers the stylist whose specialties match the muse hints", () => {
		const result = assignStylist(
			["s1", "s2"],
			[stylist("s1", []), stylist("s2", ["straight-leg-denim"])],
			"Clean Muse",
		);
		expect(result?.id).toBe("s2");
	});

	it("breaks ties by schedule order", () => {
		const result = assignStylist(
			["s1", "s2"],
			[stylist("s1", []), stylist("s2", [])],
			"Clean Muse",
		);
		expect(result?.id).toBe("s1");
	});

	it("returns undefined when no scheduled stylist is found", () => {
		expect(
			assignStylist(["ghost"], [stylist("s1", [])], "Clean Muse"),
		).toBeUndefined();
	});
});

describe("normalizeCatalogAudiences", () => {
	it("keeps valid audiences and de-duplicates", () => {
		expect(normalizeCatalogAudiences(["mens", "womens", "mens"])).toEqual([
			"mens",
			"womens",
		]);
	});

	it("parses a JSON-encoded array string", () => {
		expect(normalizeCatalogAudiences('["mens"]')).toEqual(["mens"]);
	});

	it("treats a bare string as a single audience", () => {
		expect(normalizeCatalogAudiences("womens")).toEqual(["womens"]);
	});

	it("falls back to womens for empty or invalid input", () => {
		expect(normalizeCatalogAudiences([])).toEqual(["womens"]);
		expect(normalizeCatalogAudiences(["nope"])).toEqual(["womens"]);
		expect(normalizeCatalogAudiences(42)).toEqual(["womens"]);
	});
});

describe("buildPairingInstruction", () => {
	it("returns undefined without an analysis", () => {
		expect(buildPairingInstruction(null)).toBeUndefined();
	});

	it("describes complement pieces", () => {
		const analysis = {
			pairingContext: "Build around the skirt.",
			garments: [
				{ type: "midi skirt", colors: ["indigo"], intent: "complement" },
			],
		} as OutfitAnalysis;
		const text = buildPairingInstruction(analysis);
		expect(text).toContain("Build around the skirt.");
		expect(text).toMatch(/complement/i);
		expect(text).toContain("midi skirt (indigo)");
	});

	it("describes similar pieces", () => {
		const analysis = {
			pairingContext: "",
			garments: [{ type: "blazer", colors: [], intent: "similar" }],
		} as OutfitAnalysis;
		expect(buildPairingInstruction(analysis)).toMatch(/similar in style/i);
	});

	it("returns undefined when there is nothing to say", () => {
		const analysis = { pairingContext: "", garments: [] } as OutfitAnalysis;
		expect(buildPairingInstruction(analysis)).toBeUndefined();
	});
});

describe("reminderScheduledFor", () => {
	it("schedules 24h before when that is still in the future", () => {
		const now = new Date("2026-06-16T12:00:00.000Z");
		expect(reminderScheduledFor("2026-06-20T12:00:00.000Z", now)).toBe(
			"2026-06-19T12:00:00.000Z",
		);
	});

	it("falls back to 2h before when 24h before has passed", () => {
		const now = new Date("2026-06-16T12:00:00.000Z");
		expect(reminderScheduledFor("2026-06-16T20:00:00.000Z", now)).toBe(
			"2026-06-16T18:00:00.000Z",
		);
	});
});

describe("status helpers", () => {
	it("classifies terminal statuses", () => {
		expect(isTerminalStatus("completed")).toBe(true);
		expect(isTerminalStatus("cancelled")).toBe(true);
		expect(isTerminalStatus("no_show")).toBe(true);
		expect(isTerminalStatus("scheduled")).toBe(false);
	});

	it("classifies active statuses", () => {
		expect(isActiveStatus("scheduled")).toBe(true);
		expect(isActiveStatus("checked_in")).toBe(true);
		expect(isActiveStatus("completed")).toBe(false);
	});
});

describe("small pure helpers", () => {
	it("hourRange enumerates open hours and clamps", () => {
		expect(hourRange("11:00", "14:00")).toEqual([11, 12, 13]);
		expect(hourRange("14:00", "11:00")).toEqual([]);
	});

	it("addOneHour advances by an hour", () => {
		expect(addOneHour("2026-06-16T15:00:00.000Z")).toBe(
			"2026-06-16T16:00:00.000Z",
		);
	});

	it("normalizeSlotKey converts to UTC ISO", () => {
		expect(normalizeSlotKey("2026-06-16T15:00:00-04:00")).toBe(
			"2026-06-16T19:00:00.000Z",
		);
	});

	it("parseJsonField parses strings and passes objects through", () => {
		expect(parseJsonField<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
		expect(parseJsonField<{ a: number }>({ a: 2 })).toEqual({ a: 2 });
	});

	it("isoOrNull normalizes or returns null", () => {
		expect(isoOrNull(null)).toBeNull();
		expect(isoOrNull("2026-06-16T15:00:00-04:00")).toBe(
			"2026-06-16T19:00:00.000Z",
		);
	});
});

describe("filterStylists", () => {
	const stylists = [
		{
			id: "match",
			specialties: ["curvy-fit"],
			supportedFits: ["slim"],
			availability: { status: "available" },
		},
		{
			id: "wrong-fit",
			specialties: ["curvy-fit"],
			supportedFits: ["wide"],
			availability: { status: "available" },
		},
		{
			id: "busy",
			specialties: ["curvy-fit"],
			supportedFits: ["slim"],
			availability: { status: "busy" },
		},
	] as StylistProfile[];

	it("filters by specialty, fit, and availability", () => {
		const result = filterStylists(stylists, {
			specialty: "curvy-fit",
			fit: "slim",
			availability: "available",
		});
		expect(result.map((s) => s.id)).toEqual(["match"]);
	});

	it("returns everyone when no filters are provided", () => {
		expect(filterStylists(stylists, {})).toHaveLength(3);
	});
});

describe("mapCatalogProduct", () => {
	it("maps a raw row and normalizes nullable fields", () => {
		const product = mapCatalogProduct({
			product_id: "sku-1",
			source: "anf",
			name: "Straight Jean",
			category: null,
			catalog_audiences: ["womens"],
			product_url: "https://example.test/sku-1",
			image_url: null,
			description: null,
			price: null,
			currency: null,
			fit: null,
			rise: null,
			stretch: null,
			sizes: ["28"],
			colors: ["indigo"],
			scraped_at: "2026-06-01T00:00:00.000Z",
		});
		expect(product).toMatchObject({
			productId: "sku-1",
			category: null,
			price: null,
			sizes: ["28"],
			colors: ["indigo"],
		});
	});
});

describe("mapStoreSnapshot", () => {
	it("uses the stored snapshot when present", () => {
		const store = mapStoreSnapshot({
			store_snapshot: { storeId: "store-9", name: "Branch" },
		});
		expect(store.storeId).toBe("store-9");
		expect(store.name).toBe("Branch");
	});

	it("falls back to the assigned stylist's store", () => {
		const store = mapStoreSnapshot({
			assigned_stylist: { store: { storeId: "store-5" } },
		});
		expect(store.storeId).toBe("store-5");
	});

	it("falls back to the default store", () => {
		expect(mapStoreSnapshot({}).storeId).toBe("anf_soho_001");
	});
});

describe("mapOutfitAnalysis", () => {
	it("returns null for empty input", () => {
		expect(mapOutfitAnalysis(null)).toBeNull();
	});

	it("preserves a known engine", () => {
		const analysis = mapOutfitAnalysis({ engine: "claude", garments: [] });
		expect(analysis?.engine).toBe("claude");
	});

	it("coerces an unknown engine to manual", () => {
		const analysis = mapOutfitAnalysis({ engine: "robot", garments: [] });
		expect(analysis?.engine).toBe("manual");
	});
});

describe("normalizeSuggestedProducts", () => {
	it("repairs invalid prep status and missing notes", () => {
		const [normalized] = normalizeSuggestedProducts([
			{
				rank: 1,
				rationale: "r",
				score: 0.5,
				prepStatus: "bogus",
				product: {
					productId: "p1",
					catalogAudiences: ["womens"],
				},
			} as never,
		]);
		expect(normalized.prepStatus).toBe("suggested");
		expect(normalized.associateNote).toBe("");
	});
});

describe("mapAppointment", () => {
	it("maps a DB row into the API appointment shape", () => {
		const appointment = mapAppointment({
			id: "a1",
			customer_id: "c1",
			loyalty_id: "l1",
			customer_name: "Avery",
			slot_start: "2026-06-16T15:00:00.000Z",
			slot_end: "2026-06-16T16:00:00.000Z",
			store_snapshot: { storeId: "store-1", name: "Flagship" },
			occasion: "Trip",
			focus_colors: "Indigo",
			avoid_colors: "White",
			style_keywords: ["minimal"],
			catalog_audiences: ["womens"],
			guidance: "note",
			session_notes: "",
			status: "scheduled",
			muse_tag: "Clean Muse",
			assigned_stylist: { id: "s1", store: { storeId: "store-1" } },
			order_history_summary: {
				totalOrders: 1,
				denimItems: 1,
				returnedItems: 0,
				preferredSizes: ["28"],
			},
			suggested_products: [],
			outfit_analysis: { engine: "manual", garments: [] },
			notification_count: 2,
			confirmation_status: "sent",
			reminder_status: "queued",
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
		});

		expect(appointment).toMatchObject({
			id: "a1",
			status: "scheduled",
			store: { storeId: "store-1" },
			styleKeywords: ["minimal"],
			notificationSummary: {
				count: 2,
				confirmationStatus: "sent",
				reminderStatus: "queued",
			},
		});
		expect(appointment.outfitAnalysis?.engine).toBe("manual");
	});
});

describe("slot scheduling math", () => {
	const pattern = {
		storeId: "store-1",
		timezone: "America/New_York",
		weekly: [
			{
				dayOfWeek: "Tuesday",
				openTime: "11:00",
				closeTime: "19:00",
				stylistIds: ["st-1", "st-2"],
			},
		],
	};

	it("creates future slots from the weekly pattern", () => {
		const now = new Date("2026-06-16T12:00:00.000Z"); // Tuesday
		const slots = createStoreAppointmentSlots(pattern, now);
		expect(slots.length).toBeGreaterThan(0);
		expect(slots[0]).toMatchObject({
			storeId: "store-1",
			availableStylistCount: 2,
		});
	});

	it("returns no slots when the pattern has no matching days", () => {
		const emptyPattern = { ...pattern, weekly: [] };
		expect(createStoreAppointmentSlots(emptyPattern, new Date())).toEqual([]);
	});

	it("returns scheduled stylist ids for an in-hours slot", () => {
		// 15:00Z = 11:00 EDT on a Tuesday → within the 11–19 window.
		expect(
			scheduledStylistIdsForSlot(pattern, "2026-06-16T15:00:00.000Z"),
		).toEqual(["st-1", "st-2"]);
	});

	it("returns nothing for a day with no pattern", () => {
		// 2026-06-14 is a Sunday.
		expect(
			scheduledStylistIdsForSlot(pattern, "2026-06-14T15:00:00.000Z"),
		).toEqual([]);
	});
});

describe("buildSuggestedProducts", () => {
	const customer = {
		customerId: "c1",
		loyaltyId: "l1",
		displayName: "Avery",
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
	} as CurrentUser;

	const summary: Appointment["orderHistorySummary"] = {
		totalOrders: 1,
		denimItems: 1,
		returnedItems: 0,
		preferredSizes: ["28"],
	};

	const catalogRow = (overrides: Record<string, unknown> = {}) => ({
		product_id: "p1",
		source: "anf",
		name: "Straight Jean",
		category: "jeans",
		catalog_audiences: ["womens"],
		product_url: "https://example.test/p1",
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
		...overrides,
	});

	const input = {
		storeId: "store-1",
		slotStart: "2026-06-16T15:00:00.000Z",
		occasion: "Weekend trip",
		focusColors: "indigo",
		avoidColors: "",
		styleKeywords: ["minimal"],
		catalogAudiences: ["womens"] as const,
		guidance: "",
	};

	beforeEach(() => {
		// Echo the shortlist back as rankings, like the integration harness does.
		rerankMock.mockImplementation(
			async (
				_ctx: unknown,
				_style: unknown,
				shortlist: Array<{ product: { productId: string } }>,
				limit: number,
			) => ({
				engine: "rule-based",
				summary: "s",
				rankings: shortlist.slice(0, limit).map((c, i) => ({
					productId: c.product.productId,
					rank: i + 1,
					rationale: "r",
				})),
			}),
		);
	});

	it("scores the catalog and returns enriched, ranked suggestions", async () => {
		query.mockResolvedValueOnce({
			rows: [
				catalogRow({ product_id: "p1" }),
				catalogRow({ product_id: "p2" }),
			],
		});

		const result = await buildSuggestedProducts(
			customer,
			input,
			"Clean Muse",
			summary,
		);

		expect(result.map((s) => s.product.productId).sort()).toEqual(["p1", "p2"]);
		expect(result[0]).toMatchObject({
			prepStatus: "suggested",
			associateNote: "",
		});
		expect(typeof result[0].score).toBe("number");
	});

	it("filters out products outside the selected catalog audiences", async () => {
		query.mockResolvedValueOnce({
			rows: [
				catalogRow({ product_id: "womens-1", catalog_audiences: ["womens"] }),
				catalogRow({ product_id: "mens-1", catalog_audiences: ["mens"] }),
			],
		});

		const result = await buildSuggestedProducts(
			customer,
			input,
			"Clean Muse",
			summary,
		);

		expect(result.map((s) => s.product.productId)).toEqual(["womens-1"]);
	});

	it("restricts to like categories when every garment intent is 'similar'", async () => {
		query.mockResolvedValueOnce({
			rows: [
				catalogRow({
					product_id: "jean",
					name: "Straight Jean",
					category: "jeans",
				}),
				catalogRow({
					product_id: "tank",
					name: "Ribbed Tank",
					category: "tops",
				}),
			],
		});

		const result = await buildSuggestedProducts(
			customer,
			{
				...input,
				outfitAnalysis: {
					engine: "manual",
					garments: [
						{
							type: "tank top",
							colors: ["white"],
							material: null,
							pattern: null,
							descriptors: [],
							intent: "similar",
						},
					],
					styleSummary: "",
					suggestedFocusColors: [],
					suggestedStyleKeywords: [],
					pairingContext: "",
				},
			},
			"Clean Muse",
			summary,
		);

		expect(result.map((s) => s.product.productId)).toEqual(["tank"]);
	});

	it("returns nothing when the catalog is empty", async () => {
		query.mockResolvedValueOnce({ rows: [] });
		const result = await buildSuggestedProducts(
			customer,
			input,
			"Clean Muse",
			summary,
		);
		expect(result).toEqual([]);
	});
});
