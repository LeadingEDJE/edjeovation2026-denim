import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { rerank, type StyleContext } from "./claude-reranker.js";
import { pool } from "./db.js";
import {
	analyzeOutfit,
	normalizeOutfitAnalysis,
	type SupportedMediaType,
	supportedMediaTypes,
} from "./outfit-analysis.js";
import {
	parseColors,
	type RecommendationContext,
	shortlistDiverse,
} from "./recommendation-scoring.js";
import {
	fetchThirdPartyOrderHistory,
	fetchThirdPartyStoreSchedulePatterns,
	fetchThirdPartyStores,
	fetchThirdPartyStylist,
	fetchThirdPartyStylistAvailability,
	fetchThirdPartyStylists,
	fetchThirdPartyUser,
	fetchThirdPartyUsers,
	ThirdPartyHttpError,
} from "./recommendations.js";
import {
	type Appointment,
	type AppointmentSlot,
	type CatalogProduct,
	type CreateAppointmentInput,
	type CurrentUser,
	catalogQuerySchema,
	type MuseTag,
	type OrderHistory,
	type OrderHistoryScenario,
	type OutfitAnalysis,
	type OutfitGarment,
	type Store,
	type StoreSchedulePattern,
	type StoreSchedulePatternList,
	type StylistAvailabilityStatus,
	type StylistProfile,
	type SuggestedProduct,
	type SuggestedProductPrepStatus,
	type UserList,
} from "./types.js";

let activeUserId = "cust_avery_001";

const fitPreferenceEnum = [
	"skinny",
	"slim",
	"straight",
	"relaxed",
	"wide",
] as const;
const stretchPreferenceEnum = [
	"rigid",
	"comfort-stretch",
	"high-stretch",
] as const;
const orderHistoryScenarioEnum = [
	"standard",
	"denim-heavy",
	"returns",
	"empty",
	"error",
] as const;
const stylistAvailabilityEnum = ["available", "busy", "offline"] as const;
const museTagEnum = [
	"Clean Muse",
	"Romantic Muse",
	"Boyish Muse",
	"Statement Maker",
] as const;
const appointmentStatusEnum = [
	"scheduled",
	"checked_in",
	"completed",
	"cancelled",
	"no_show",
] as const;
const terminalAppointmentStatuses = ["completed", "cancelled", "no_show"];
const productPrepStatusEnum = ["suggested", "pulled", "skipped"] as const;
const styleKeywordEnum = [
	"minimal",
	"effortless",
	"timeless essentials",
	"feminine",
	"soft",
	"subtly dressed-up",
	"preppy",
	"relaxed",
	"sporty",
	"menswear-inspired",
	"trend-forward",
	"bold",
	"boundary-pushing",
] as const;

const currentUserJsonSchema = {
	type: "object",
	required: [
		"customerId",
		"loyaltyId",
		"displayName",
		"measurements",
		"preferences",
	],
	properties: {
		customerId: { type: "string" },
		loyaltyId: { type: "string" },
		displayName: { type: "string" },
		measurements: {
			type: "object",
			required: ["heightInches", "waistInches", "hipInches", "inseamInches"],
			properties: {
				heightInches: { type: "integer" },
				waistInches: { type: "number" },
				hipInches: { type: "number" },
				inseamInches: { type: "number" },
			},
		},
		preferences: {
			type: "object",
			required: ["fitPreference", "stretchPreference"],
			properties: {
				fitPreference: { type: "string", enum: fitPreferenceEnum },
				stretchPreference: { type: "string", enum: stretchPreferenceEnum },
			},
		},
	},
} as const;

const userListJsonSchema = {
	type: "object",
	required: ["users"],
	properties: {
		users: {
			type: "array",
			items: currentUserJsonSchema,
		},
	},
} as const;

const activeUserJsonSchema = {
	type: "object",
	required: ["activeUserId", "user"],
	properties: {
		activeUserId: { type: "string" },
		user: currentUserJsonSchema,
	},
} as const;

const setActiveUserJsonSchema = {
	type: "object",
	required: ["customerId"],
	properties: {
		customerId: { type: "string", minLength: 1 },
	},
} as const;

const errorJsonSchema = {
	type: "object",
	properties: {
		message: { type: "string" },
	},
} as const;

const orderHistoryItemJsonSchema = {
	type: "object",
	required: [
		"sku",
		"productName",
		"category",
		"sizeLabel",
		"fit",
		"wash",
		"quantity",
		"unitPrice",
		"kept",
		"returnReason",
	],
	properties: {
		sku: { type: "string" },
		productName: { type: "string" },
		category: { type: "string" },
		sizeLabel: { type: "string" },
		fit: { type: "string" },
		wash: { type: "string" },
		quantity: { type: "integer", minimum: 1 },
		unitPrice: { type: "number", minimum: 0 },
		kept: { type: "boolean" },
		returnReason: { anyOf: [{ type: "string" }, { type: "null" }] },
	},
} as const;

const orderHistoryJsonSchema = {
	type: "object",
	required: ["customerId", "scenario", "orders"],
	properties: {
		customerId: { type: "string" },
		scenario: { type: "string", enum: orderHistoryScenarioEnum },
		orders: {
			type: "array",
			items: {
				type: "object",
				required: ["orderId", "orderedAt", "channel", "status", "items"],
				properties: {
					orderId: { type: "string" },
					orderedAt: { type: "string", format: "date-time" },
					channel: { type: "string", enum: ["web", "store", "mobile"] },
					status: {
						type: "string",
						enum: ["processing", "delivered", "returned", "exchanged"],
					},
					items: {
						type: "array",
						items: orderHistoryItemJsonSchema,
					},
				},
			},
		},
	},
} as const;

const stylistJsonSchema = {
	type: "object",
	required: [
		"id",
		"displayName",
		"pronouns",
		"title",
		"store",
		"bio",
		"specialties",
		"stylePointOfView",
		"supportedFits",
		"customerSignals",
		"availability",
		"avatarUrl",
	],
	properties: {
		id: { type: "string" },
		displayName: { type: "string" },
		pronouns: { type: "string" },
		title: { type: "string" },
		store: {
			type: "object",
			required: ["storeId", "name", "city", "state"],
			properties: {
				storeId: { type: "string" },
				name: { type: "string" },
				city: { type: "string" },
				state: { type: "string" },
			},
		},
		bio: { type: "string" },
		specialties: { type: "array", items: { type: "string" } },
		stylePointOfView: { type: "array", items: { type: "string" } },
		supportedFits: { type: "array", items: { type: "string" } },
		customerSignals: { type: "array", items: { type: "string" } },
		availability: {
			type: "object",
			required: ["status", "nextAvailableAt"],
			properties: {
				status: { type: "string", enum: stylistAvailabilityEnum },
				nextAvailableAt: {
					anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
				},
			},
		},
		avatarUrl: { anyOf: [{ type: "string", format: "uri" }, { type: "null" }] },
	},
} as const;

const stylistListJsonSchema = {
	type: "object",
	required: ["stylists"],
	properties: {
		stylists: {
			type: "array",
			items: stylistJsonSchema,
		},
	},
} as const;

const storeJsonSchema = {
	type: "object",
	required: [
		"storeId",
		"name",
		"city",
		"state",
		"address",
		"phone",
		"timezone",
	],
	properties: {
		storeId: { type: "string" },
		name: { type: "string" },
		city: { type: "string" },
		state: { type: "string" },
		address: { type: "string" },
		phone: { type: "string" },
		timezone: { type: "string" },
	},
} as const;

const storeListJsonSchema = {
	type: "object",
	required: ["stores"],
	properties: {
		stores: {
			type: "array",
			items: storeJsonSchema,
		},
	},
} as const;

const storeSchedulePatternJsonSchema = {
	type: "object",
	required: ["patterns"],
	properties: {
		patterns: {
			type: "array",
			items: {
				type: "object",
				required: ["storeId", "timezone", "weekly"],
				properties: {
					storeId: { type: "string" },
					timezone: { type: "string" },
					weekly: {
						type: "array",
						items: {
							type: "object",
							required: ["dayOfWeek", "openTime", "closeTime", "stylistIds"],
							properties: {
								dayOfWeek: {
									type: "string",
									enum: ["Monday", "Tuesday", "Wednesday", "Thursday"],
								},
								openTime: { type: "string" },
								closeTime: { type: "string" },
								stylistIds: { type: "array", items: { type: "string" } },
							},
						},
					},
				},
			},
		},
	},
} as const;

const stylistAvailabilityJsonSchema = {
	type: "object",
	required: ["store", "timezone", "startDate", "endDate", "days"],
	properties: {
		store: stylistJsonSchema.properties.store,
		timezone: { type: "string" },
		startDate: { type: "string", format: "date" },
		endDate: { type: "string", format: "date" },
		days: {
			type: "array",
			items: {
				type: "object",
				required: [
					"date",
					"dayOfWeek",
					"storeOpen",
					"openTime",
					"closeTime",
					"scheduledStylists",
				],
				properties: {
					date: { type: "string", format: "date" },
					dayOfWeek: { type: "string" },
					storeOpen: { type: "boolean" },
					openTime: { anyOf: [{ type: "string" }, { type: "null" }] },
					closeTime: { anyOf: [{ type: "string" }, { type: "null" }] },
					scheduledStylists: {
						type: "array",
						items: {
							type: "object",
							required: [
								"stylistId",
								"displayName",
								"role",
								"shiftStart",
								"shiftEnd",
							],
							properties: {
								stylistId: { type: "string" },
								displayName: { type: "string" },
								role: { type: "string" },
								shiftStart: { type: "string", format: "date-time" },
								shiftEnd: { type: "string", format: "date-time" },
							},
						},
					},
				},
			},
		},
	},
} as const;

const appointmentSlotJsonSchema = {
	type: "object",
	required: [
		"storeId",
		"slotStart",
		"slotEnd",
		"date",
		"time",
		"availableStylistCount",
	],
	properties: {
		storeId: { type: "string" },
		slotStart: { type: "string", format: "date-time" },
		slotEnd: { type: "string", format: "date-time" },
		date: { type: "string", format: "date" },
		time: { type: "string" },
		availableStylistCount: { type: "integer", minimum: 1 },
	},
} as const;

// Structured, text-only description of the outfit a customer wants to build
// around. Produced from a photo (engine "claude"/"sample") or typed manually
// (engine "manual"); the shape is identical either way. No image is ever stored.
const outfitAnalysisJsonSchema = {
	type: "object",
	required: [
		"garments",
		"styleSummary",
		"suggestedFocusColors",
		"suggestedStyleKeywords",
		"pairingContext",
		"engine",
	],
	properties: {
		garments: {
			type: "array",
			items: {
				type: "object",
				required: ["type", "colors", "descriptors"],
				properties: {
					type: { type: "string" },
					colors: { type: "array", items: { type: "string" } },
					material: { anyOf: [{ type: "string" }, { type: "null" }] },
					pattern: { anyOf: [{ type: "string" }, { type: "null" }] },
					descriptors: { type: "array", items: { type: "string" } },
					intent: {
						type: "string",
						enum: ["complement", "similar", "ignore"],
					},
				},
			},
		},
		styleSummary: { type: "string" },
		suggestedFocusColors: { type: "array", items: { type: "string" } },
		suggestedStyleKeywords: { type: "array", items: { type: "string" } },
		pairingContext: { type: "string" },
		engine: { type: "string", enum: ["claude", "sample", "manual"] },
	},
} as const;

// Request body for the stateless photo-analysis endpoint. The base64 image is
// held in memory only and discarded after Claude returns — never persisted.
const analyzeOutfitJsonSchema = {
	type: "object",
	required: ["imageBase64", "mediaType"],
	properties: {
		imageBase64: { type: "string", minLength: 1 },
		mediaType: { type: "string", enum: supportedMediaTypes },
	},
} as const;

const createAppointmentJsonSchema = {
	type: "object",
	required: [
		"storeId",
		"slotStart",
		"occasion",
		"focusColors",
		"avoidColors",
		"styleKeywords",
	],
	properties: {
		storeId: { type: "string", minLength: 1 },
		slotStart: { type: "string", format: "date-time" },
		occasion: { type: "string", minLength: 1 },
		focusColors: { type: "string" },
		avoidColors: { type: "string" },
		styleKeywords: {
			type: "array",
			minItems: 1,
			items: { type: "string", enum: styleKeywordEnum },
		},
		guidance: { type: "string" },
		orderHistoryScenario: {
			type: "string",
			enum: orderHistoryScenarioEnum,
			default: "standard",
		},
		outfitAnalysis: {
			anyOf: [outfitAnalysisJsonSchema, { type: "null" }],
		},
	},
} as const;

const updateAppointmentJsonSchema = {
	type: "object",
	required: ["guidance"],
	properties: {
		guidance: { type: "string", maxLength: 1000 },
	},
} as const;

const updateSessionNotesJsonSchema = {
	type: "object",
	required: ["sessionNotes"],
	properties: {
		sessionNotes: { type: "string", maxLength: 3000 },
	},
} as const;

const completeAppointmentJsonSchema = {
	type: "object",
	required: ["customerRecap"],
	properties: {
		customerRecap: { type: "string", minLength: 1, maxLength: 3000 },
		sessionNotes: { type: "string", maxLength: 3000 },
		associateFeedback: { type: "string", maxLength: 3000 },
	},
} as const;

const cancelAppointmentJsonSchema = {
	type: "object",
	properties: {
		cancelReason: { type: "string", maxLength: 1000 },
	},
} as const;

const reassignStylistJsonSchema = {
	type: "object",
	required: ["stylistId"],
	properties: {
		stylistId: { type: "string", minLength: 1 },
	},
} as const;

const createMessageJsonSchema = {
	type: "object",
	required: ["authorType", "body"],
	properties: {
		authorType: { type: "string", enum: ["customer", "associate"] },
		body: { type: "string", minLength: 1, maxLength: 2000 },
	},
} as const;

const feedbackJsonSchema = {
	type: "object",
	required: ["rating"],
	properties: {
		rating: { type: "integer", minimum: 1, maximum: 5 },
		comment: { type: "string", maxLength: 2000 },
	},
} as const;

const updateProductPrepJsonSchema = {
	type: "object",
	required: ["prepStatus"],
	properties: {
		prepStatus: { type: "string", enum: productPrepStatusEnum },
		associateNote: { type: "string", maxLength: 1000 },
	},
} as const;

const appointmentIdParamsJsonSchema = {
	type: "object",
	required: ["appointmentId"],
	properties: {
		appointmentId: { type: "string", format: "uuid" },
	},
} as const;

const suggestedProductParamsJsonSchema = {
	type: "object",
	required: ["appointmentId", "productId"],
	properties: {
		appointmentId: { type: "string", format: "uuid" },
		productId: { type: "string", minLength: 1 },
	},
} as const;

const appointmentMessageJsonSchema = {
	type: "object",
	required: ["id", "appointmentId", "authorType", "body", "createdAt"],
	properties: {
		id: { type: "string", format: "uuid" },
		appointmentId: { type: "string", format: "uuid" },
		authorType: { type: "string", enum: ["customer", "associate"] },
		body: { type: "string" },
		createdAt: { type: "string", format: "date-time" },
	},
} as const;

const appointmentNotificationJsonSchema = {
	type: "object",
	required: [
		"id",
		"appointmentId",
		"type",
		"status",
		"scheduledFor",
		"sentAt",
		"createdAt",
	],
	properties: {
		id: { type: "string", format: "uuid" },
		appointmentId: { type: "string", format: "uuid" },
		type: { type: "string", enum: ["confirmation", "reminder"] },
		status: { type: "string", enum: ["queued", "sent"] },
		scheduledFor: { type: "string", format: "date-time" },
		sentAt: {
			anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
		},
		createdAt: { type: "string", format: "date-time" },
	},
} as const;

const appointmentSummaryJsonSchema = {
	type: "object",
	required: [
		"id",
		"customerId",
		"loyaltyId",
		"customerName",
		"slotStart",
		"slotEnd",
		"store",
		"occasion",
		"focusColors",
		"avoidColors",
		"styleKeywords",
		"guidance",
		"sessionNotes",
		"status",
		"museTag",
		"assignedStylist",
		"orderHistorySummary",
		"suggestedProducts",
		"outfitAnalysis",
		"notificationSummary",
		"checkedInAt",
		"completedAt",
		"cancelledAt",
		"noShowAt",
		"cancelReason",
		"customerRecap",
		"associateFeedback",
		"customerFeedbackRating",
		"customerFeedbackComment",
		"customerFeedbackAt",
		"createdAt",
	],
	properties: {
		id: { type: "string", format: "uuid" },
		customerId: { type: "string" },
		loyaltyId: { type: "string" },
		customerName: { type: "string" },
		slotStart: { type: "string", format: "date-time" },
		slotEnd: { type: "string", format: "date-time" },
		store: storeJsonSchema,
		occasion: { type: "string" },
		focusColors: { type: "string" },
		avoidColors: { type: "string" },
		styleKeywords: { type: "array", items: { type: "string" } },
		guidance: { type: "string" },
		sessionNotes: { type: "string" },
		status: { type: "string", enum: appointmentStatusEnum },
		museTag: { type: "string", enum: museTagEnum },
		assignedStylist: stylistJsonSchema,
		orderHistorySummary: {
			type: "object",
			required: [
				"totalOrders",
				"denimItems",
				"returnedItems",
				"preferredSizes",
			],
			properties: {
				totalOrders: { type: "integer" },
				denimItems: { type: "integer" },
				returnedItems: { type: "integer" },
				preferredSizes: { type: "array", items: { type: "string" } },
			},
		},
		suggestedProducts: {
			type: "array",
			items: {
				type: "object",
				required: [
					"rank",
					"rationale",
					"score",
					"product",
					"prepStatus",
					"associateNote",
				],
				properties: {
					rank: { type: "integer" },
					rationale: { type: "string" },
					score: { anyOf: [{ type: "number" }, { type: "null" }] },
					product: {
						type: "object",
						additionalProperties: true,
					},
					prepStatus: { type: "string", enum: productPrepStatusEnum },
					associateNote: { type: "string" },
				},
			},
		},
		outfitAnalysis: {
			anyOf: [outfitAnalysisJsonSchema, { type: "null" }],
		},
		notificationSummary: {
			type: "object",
			required: ["count", "confirmationStatus", "reminderStatus"],
			properties: {
				count: { type: "integer", minimum: 0 },
				confirmationStatus: {
					anyOf: [
						{ type: "string", enum: ["queued", "sent"] },
						{ type: "null" },
					],
				},
				reminderStatus: {
					anyOf: [
						{ type: "string", enum: ["queued", "sent"] },
						{ type: "null" },
					],
				},
			},
		},
		checkedInAt: {
			anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
		},
		completedAt: {
			anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
		},
		cancelledAt: {
			anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
		},
		noShowAt: {
			anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
		},
		cancelReason: { anyOf: [{ type: "string" }, { type: "null" }] },
		customerRecap: { type: "string" },
		associateFeedback: { type: "string" },
		customerFeedbackRating: {
			anyOf: [{ type: "integer", minimum: 1, maximum: 5 }, { type: "null" }],
		},
		customerFeedbackComment: { type: "string" },
		customerFeedbackAt: {
			anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
		},
		createdAt: { type: "string", format: "date-time" },
	},
} as const;

function filterStylists(
	stylists: StylistProfile[],
	filters: {
		specialty?: string;
		fit?: string;
		availability?: StylistAvailabilityStatus;
	},
) {
	return stylists.filter((stylist) => {
		const specialtyMatch = filters.specialty
			? stylist.specialties.includes(filters.specialty)
			: true;
		const fitMatch = filters.fit
			? stylist.supportedFits.includes(filters.fit)
			: true;
		const availabilityMatch = filters.availability
			? stylist.availability.status === filters.availability
			: true;

		return specialtyMatch && fitMatch && availabilityMatch;
	});
}

const defaultStore: Store = {
	storeId: "anf_soho_001",
	name: "Abercrombie & Fitch SoHo",
	city: "New York",
	state: "NY",
	address: "547 Broadway, New York, NY 10012",
	phone: "+1 212-625-0868",
	timezone: "America/New_York",
};

function isTerminalStatus(status: string) {
	return terminalAppointmentStatuses.includes(status);
}

function isActiveStatus(status: string) {
	return status === "scheduled" || status === "checked_in";
}

function addOneHour(isoDateTime: string) {
	const date = new Date(isoDateTime);
	date.setHours(date.getHours() + 1);
	return date.toISOString();
}

function normalizeSlotKey(value: string) {
	return new Date(value).toISOString();
}

function getDatePartsForTimezone(
	date: Date,
	timezone: string,
): { date: string; dayOfWeek: string } {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		weekday: "long",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const value = (type: string) =>
		parts.find((part) => part.type === type)?.value ?? "";

	return {
		date: `${value("year")}-${value("month")}-${value("day")}`,
		dayOfWeek: value("weekday"),
	};
}

function timezoneOffsetForSchedule(timezone: string) {
	return timezone === "America/Los_Angeles" ? "-07:00" : "-04:00";
}

function hourRange(openTime: string, closeTime: string) {
	const openHour = Number(openTime.split(":")[0]);
	const closeHour = Number(closeTime.split(":")[0]);
	return Array.from(
		{ length: Math.max(closeHour - openHour, 0) },
		(_, index) => openHour + index,
	);
}

function createStoreAppointmentSlots(
	pattern: StoreSchedulePattern,
	now = new Date(),
): AppointmentSlot[] {
	const offset = timezoneOffsetForSchedule(pattern.timezone);

	return Array.from({ length: 10 }, (_, dayOffset) => {
		const date = new Date(now);
		date.setUTCDate(date.getUTCDate() + dayOffset);
		return getDatePartsForTimezone(date, pattern.timezone);
	}).flatMap((day) => {
		const dayPattern = pattern.weekly.find(
			(candidate) => candidate.dayOfWeek === day.dayOfWeek,
		);

		if (!dayPattern || dayPattern.stylistIds.length === 0) {
			return [];
		}

		return hourRange(dayPattern.openTime, dayPattern.closeTime).flatMap(
			(hour) => {
				const hourLabel = String(hour).padStart(2, "0");
				const slotStart = `${day.date}T${hourLabel}:00:00${offset}`;

				if (new Date(slotStart) <= now) {
					return [];
				}

				return [
					{
						storeId: pattern.storeId,
						slotStart,
						slotEnd: addOneHour(slotStart),
						date: day.date,
						time: `${hourLabel}:00`,
						availableStylistCount: dayPattern.stylistIds.length,
					},
				];
			},
		);
	});
}

function findPatternForStore(
	patterns: StoreSchedulePatternList,
	storeId: string,
) {
	return patterns.patterns.find((pattern) => pattern.storeId === storeId);
}

function scheduledStylistIdsForSlot(
	pattern: StoreSchedulePattern,
	slotStart: string,
) {
	const requested = new Date(slotStart);
	const localDate = getDatePartsForTimezone(requested, pattern.timezone);
	const dayPattern = pattern.weekly.find(
		(candidate) => candidate.dayOfWeek === localDate.dayOfWeek,
	);

	if (!dayPattern) {
		return [];
	}

	const localHour = Number(
		new Intl.DateTimeFormat("en-US", {
			timeZone: pattern.timezone,
			hour: "2-digit",
			hour12: false,
		}).format(requested),
	);

	if (
		!hourRange(dayPattern.openTime, dayPattern.closeTime).includes(localHour)
	) {
		return [];
	}

	return dayPattern.stylistIds;
}

function mapMuseTag(styleKeywords: string[]): MuseTag {
	const keywordSet = new Set(styleKeywords);
	const mapping: Array<{ tag: MuseTag; keywords: string[] }> = [
		{
			tag: "Clean Muse",
			keywords: ["minimal", "effortless", "timeless essentials"],
		},
		{
			tag: "Romantic Muse",
			keywords: ["feminine", "soft", "subtly dressed-up"],
		},
		{
			tag: "Boyish Muse",
			keywords: ["preppy", "relaxed", "sporty", "menswear-inspired"],
		},
		{
			tag: "Statement Maker",
			keywords: ["trend-forward", "bold", "boundary-pushing"],
		},
	];

	const scores = mapping.map(({ tag, keywords }) => ({
		tag,
		score: keywords.filter((keyword) => keywordSet.has(keyword)).length,
	}));

	return scores.sort((a, b) => b.score - a.score)[0]?.tag ?? "Clean Muse";
}

function summarizeOrderHistory(orderHistory: OrderHistory) {
	const items = orderHistory.orders.flatMap((order) => order.items);
	const denimItems = items.filter((item) => item.category === "denim");
	const returnedItems = items.filter((item) => !item.kept || item.returnReason);
	const preferredSizes = Array.from(
		new Set(
			denimItems.filter((item) => item.kept).map((item) => item.sizeLabel),
		),
	);

	return {
		totalOrders: orderHistory.orders.length,
		denimItems: denimItems.length,
		returnedItems: returnedItems.length,
		preferredSizes,
	};
}

function assignStylist(
	scheduledStylistIds: string[],
	stylists: StylistProfile[],
	museTag: MuseTag,
) {
	const museSpecialtyHints: Record<MuseTag, string[]> = {
		"Clean Muse": ["straight-leg-denim", "fit-troubleshooting"],
		"Romantic Muse": ["petite-proportions", "inseam-selection"],
		"Boyish Muse": ["athletic-builds", "relaxed-denim", "mobility-comfort"],
		"Statement Maker": ["trend-styling", "wide-leg-denim", "outfit-building"],
	};

	const scheduledStylists = scheduledStylistIds
		.map((id) => stylists.find((stylist) => stylist.id === id))
		.filter((stylist): stylist is StylistProfile => Boolean(stylist));

	return scheduledStylists
		.map((stylist, index) => ({
			stylist,
			index,
			score: museSpecialtyHints[museTag].filter((hint) =>
				stylist.specialties.includes(hint),
			).length,
		}))
		.sort((a, b) => b.score - a.score || a.index - b.index)[0]?.stylist;
}

function parseJsonField<T>(value: unknown): T {
	return typeof value === "string" ? JSON.parse(value) : (value as T);
}

function isoOrNull(value: unknown) {
	return value ? new Date(String(value)).toISOString() : null;
}

function normalizeSuggestedProducts(
	suggestedProducts: SuggestedProduct[],
): SuggestedProduct[] {
	return suggestedProducts.map((suggestion) => ({
		...suggestion,
		prepStatus: productPrepStatusEnum.includes(
			suggestion.prepStatus as SuggestedProductPrepStatus,
		)
			? suggestion.prepStatus
			: "suggested",
		associateNote: suggestion.associateNote ?? "",
	}));
}

function mapStoreSnapshot(row: Record<string, unknown>): Store {
	if (row.store_snapshot) {
		return {
			...defaultStore,
			...parseJsonField<Partial<Store>>(row.store_snapshot),
		};
	}

	const stylist = row.assigned_stylist
		? parseJsonField<StylistProfile>(row.assigned_stylist)
		: null;
	return {
		...defaultStore,
		...stylist?.store,
	};
}

const outfitEngineValues = ["claude", "sample", "manual"] as const;

/** Parse a stored outfit_analysis JSONB cell, preserving its original engine. */
function mapOutfitAnalysis(value: unknown): OutfitAnalysis | null {
	if (!value) return null;
	const parsed = parseJsonField<Partial<OutfitAnalysis>>(value);
	const engine = outfitEngineValues.includes(
		parsed?.engine as OutfitAnalysis["engine"],
	)
		? (parsed.engine as OutfitAnalysis["engine"])
		: "manual";
	return normalizeOutfitAnalysis(parsed, engine);
}

function mapAppointment(row: Record<string, unknown>): Appointment {
	const suggestedProducts = row.suggested_products
		? normalizeSuggestedProducts(
				parseJsonField<SuggestedProduct[]>(row.suggested_products),
			)
		: [];

	return {
		id: String(row.id),
		customerId: String(row.customer_id),
		loyaltyId: String(row.loyalty_id),
		customerName: String(row.customer_name),
		slotStart: new Date(String(row.slot_start)).toISOString(),
		slotEnd: new Date(String(row.slot_end)).toISOString(),
		store: mapStoreSnapshot(row),
		occasion: String(row.occasion),
		focusColors: String(row.focus_colors),
		avoidColors: String(row.avoid_colors),
		styleKeywords: parseJsonField<string[]>(row.style_keywords),
		guidance: String(row.guidance),
		sessionNotes: String(row.session_notes ?? ""),
		status: String(row.status ?? "scheduled") as Appointment["status"],
		museTag: String(row.muse_tag) as MuseTag,
		assignedStylist: parseJsonField<StylistProfile>(row.assigned_stylist),
		orderHistorySummary: parseJsonField<Appointment["orderHistorySummary"]>(
			row.order_history_summary,
		),
		suggestedProducts,
		outfitAnalysis: mapOutfitAnalysis(row.outfit_analysis),
		notificationSummary: {
			count: Number(row.notification_count ?? 0),
			confirmationStatus: row.confirmation_status
				? (String(row.confirmation_status) as "queued" | "sent")
				: null,
			reminderStatus: row.reminder_status
				? (String(row.reminder_status) as "queued" | "sent")
				: null,
		},
		checkedInAt: isoOrNull(row.checked_in_at),
		completedAt: isoOrNull(row.completed_at),
		cancelledAt: isoOrNull(row.cancelled_at),
		noShowAt: isoOrNull(row.no_show_at),
		cancelReason: row.cancel_reason == null ? null : String(row.cancel_reason),
		customerRecap: String(row.customer_recap ?? ""),
		associateFeedback: String(row.associate_feedback ?? ""),
		customerFeedbackRating:
			row.customer_feedback_rating == null
				? null
				: Number(row.customer_feedback_rating),
		customerFeedbackComment: String(row.customer_feedback_comment ?? ""),
		customerFeedbackAt: isoOrNull(row.customer_feedback_at),
		createdAt: new Date(String(row.created_at)).toISOString(),
	};
}

function mapAppointmentMessage(row: Record<string, unknown>) {
	return {
		id: String(row.id),
		appointmentId: String(row.appointment_id),
		authorType: String(row.author_type) as "customer" | "associate",
		body: String(row.body),
		createdAt: new Date(String(row.created_at)).toISOString(),
	};
}

function mapAppointmentNotification(row: Record<string, unknown>) {
	return {
		id: String(row.id),
		appointmentId: String(row.appointment_id),
		type: String(row.type) as "confirmation" | "reminder",
		status: String(row.status) as "queued" | "sent",
		scheduledFor: new Date(String(row.scheduled_for)).toISOString(),
		sentAt: isoOrNull(row.sent_at),
		createdAt: new Date(String(row.created_at)).toISOString(),
	};
}

async function getActiveUser() {
	return fetchThirdPartyUser(activeUserId);
}

function userExists(users: UserList, customerId: string) {
	return users.users.some((user) => user.customerId === customerId);
}

function mapCatalogProduct(row: Record<string, unknown>): CatalogProduct {
	return {
		productId: String(row.product_id),
		source: String(row.source),
		name: String(row.name),
		category: row.category == null ? null : String(row.category),
		productUrl: String(row.product_url),
		imageUrl: row.image_url == null ? null : String(row.image_url),
		description: row.description == null ? null : String(row.description),
		price: row.price == null ? null : Number(row.price),
		currency: row.currency == null ? null : String(row.currency),
		fit: row.fit == null ? null : String(row.fit),
		rise: row.rise == null ? null : String(row.rise),
		stretch: row.stretch == null ? null : String(row.stretch),
		// sizes/colors are JSONB and arrive already parsed as arrays.
		sizes: Array.isArray(row.sizes) ? (row.sizes as string[]) : [],
		colors: Array.isArray(row.colors) ? (row.colors as string[]) : [],
		scrapedAt: new Date(String(row.scraped_at)).toISOString(),
	};
}

/**
 * Hybrid product recommendations for an appointment: rule-based scoring
 * (focus/avoid colors for all products + fit/stretch/size for bottoms) builds a
 * category-diverse shortlist across the whole catalog, then Claude re-ranks it
 * with the appointment's occasion/style/muse context (falling back to the
 * rule-based order when no API key is set). Returned as enriched, ranked items
 * to store on the appointment.
 */
/**
 * Turn the per-garment intents into a single instruction for the re-ranker:
 * "complement" pieces should be completed (a top for a skirt), "similar" pieces
 * should be matched in style, and "ignore" pieces are left out entirely.
 */
function buildPairingInstruction(
	analysis: OutfitAnalysis | null,
): string | undefined {
	if (!analysis) return undefined;
	const describe = (g: OutfitGarment) =>
		`${g.type}${g.colors.length ? ` (${g.colors.join(", ")})` : ""}`;
	const complement = analysis.garments
		.filter((g) => g.intent === "complement")
		.map(describe);
	const similar = analysis.garments
		.filter((g) => g.intent === "similar")
		.map(describe);

	const parts: string[] = [];
	if (analysis.pairingContext) parts.push(analysis.pairingContext);
	if (complement.length) {
		parts.push(
			`Recommend pieces that complement (complete the look with): ${complement.join("; ")}.`,
		);
	}
	if (similar.length) {
		parts.push(`Recommend pieces similar in style to: ${similar.join("; ")}.`);
	}
	const text = parts.join(" ").trim();
	return text || undefined;
}

async function buildSuggestedProducts(
	customer: CurrentUser,
	input: CreateAppointmentInput,
	museTag: MuseTag,
	orderHistorySummary: Appointment["orderHistorySummary"],
): Promise<SuggestedProduct[]> {
	// When the customer signed off on an outfit to build around, let it fill the
	// gaps: use its suggested focus colors if they left that field blank, and merge
	// in its style keywords. The pairing context is passed to the re-ranker so it
	// recommends complementary pieces (e.g. a top for a skirt).
	const analysis = input.outfitAnalysis ?? null;
	const focusColorsText = input.focusColors?.trim()
		? input.focusColors
		: (analysis?.suggestedFocusColors ?? []).join(", ");
	const styleKeywords = analysis?.suggestedStyleKeywords?.length
		? Array.from(
				new Set([...input.styleKeywords, ...analysis.suggestedStyleKeywords]),
			)
		: input.styleKeywords;

	const context: RecommendationContext = {
		waistInches: customer.measurements.waistInches,
		inseamInches: customer.measurements.inseamInches,
		fitPreference: customer.preferences.fitPreference,
		stretchPreference: customer.preferences.stretchPreference,
		focusColors: parseColors(focusColorsText),
		avoidColors: parseColors(input.avoidColors),
	};

	const catalogResult = await pool.query("SELECT * FROM catalog_products");
	const candidates = catalogResult.rows.map(mapCatalogProduct);
	const shortlist = shortlistDiverse(context, candidates, 4, 12);

	const style: StyleContext = {
		occasion: input.occasion,
		focusColors: focusColorsText,
		avoidColors: input.avoidColors,
		styleKeywords,
		museTag,
		preferredSizes: orderHistorySummary.preferredSizes,
		pairingContext: buildPairingInstruction(analysis),
	};
	const reranked = await rerank(context, style, shortlist, 5);

	const byId = new Map(shortlist.map((c) => [c.product.productId, c]));
	return reranked.rankings.flatMap((r) => {
		const scored = byId.get(r.productId);
		if (!scored) return [];
		return [
			{
				rank: r.rank,
				rationale: r.rationale,
				score: Number(scored.score.toFixed(3)),
				product: scored.product,
				prepStatus: "suggested",
				associateNote: "",
			},
		];
	});
}

async function selectAppointmentById(appointmentId: string) {
	const result = await pool.query(
		`
			SELECT a.*,
				(
					SELECT count(*)::int
					FROM appointment_notifications n
					WHERE n.appointment_id = a.id
				) AS notification_count,
				(
					SELECT n.status
					FROM appointment_notifications n
					WHERE n.appointment_id = a.id
						AND n.type = 'confirmation'
					ORDER BY n.created_at DESC
					LIMIT 1
				) AS confirmation_status,
				(
					SELECT n.status
					FROM appointment_notifications n
					WHERE n.appointment_id = a.id
						AND n.type = 'reminder'
					ORDER BY n.created_at DESC
					LIMIT 1
				) AS reminder_status
			FROM appointments a
			WHERE a.id = $1
		`,
		[appointmentId],
	);

	return result.rows[0] ? mapAppointment(result.rows[0]) : null;
}

function reminderScheduledFor(slotStart: string, now = new Date()) {
	const appointmentStart = new Date(slotStart);
	const oneDayBefore = new Date(appointmentStart);
	oneDayBefore.setHours(oneDayBefore.getHours() - 24);

	if (oneDayBefore > now) {
		return oneDayBefore.toISOString();
	}

	const twoHoursBefore = new Date(appointmentStart);
	twoHoursBefore.setHours(twoHoursBefore.getHours() - 2);
	return twoHoursBefore.toISOString();
}

async function createMockNotifications(
	appointmentId: string,
	slotStart: string,
) {
	await pool.query(
		`
			INSERT INTO appointment_notifications (
				id, appointment_id, type, status, scheduled_for, sent_at
			)
			VALUES
				($1, $3, 'confirmation', 'sent', now(), now()),
				($2, $3, 'reminder', 'queued', $4, NULL)
		`,
		[
			randomUUID(),
			randomUUID(),
			appointmentId,
			reminderScheduledFor(slotStart),
		],
	);
}

export async function registerRoutes(app: FastifyInstance) {
	app.get(
		"/health",
		{
			schema: {
				tags: ["health"],
				summary: "Check API health",
				response: {
					200: {
						type: "object",
						required: ["ok"],
						properties: {
							ok: { type: "boolean" },
						},
					},
				},
			},
		},
		async () => ({ ok: true }),
	);

	// Browse the scraped catalog with optional fit/rise/stretch/category/text filters.
	app.get("/api/catalog", async (request, reply) => {
		const parsed = catalogQuerySchema.safeParse(request.query);

		if (!parsed.success) {
			return reply.code(400).send({
				message: "Invalid catalog query",
				issues: parsed.error.issues,
			});
		}

		const { fit, rise, stretch, category, q, limit, offset } = parsed.data;
		const conditions: string[] = [];
		const params: unknown[] = [];

		const eq = (column: string, value: unknown) => {
			params.push(value);
			conditions.push(`${column} = $${params.length}`);
		};
		const like = (column: string, value: string) => {
			params.push(`%${value}%`);
			conditions.push(`${column} ILIKE $${params.length}`);
		};

		if (fit) eq("fit", fit);
		if (rise) eq("rise", rise);
		if (stretch) eq("stretch", stretch);
		if (category) like("category", category);
		if (q) {
			params.push(`%${q}%`);
			const i = params.length;
			conditions.push(`(name ILIKE $${i} OR description ILIKE $${i})`);
		}

		const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

		const totalResult = await pool.query<{ count: string }>(
			`SELECT count(*)::text AS count FROM catalog_products ${where}`,
			params,
		);

		const rowsResult = await pool.query(
			`SELECT * FROM catalog_products ${where} ORDER BY scraped_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
			[...params, limit, offset],
		);

		return {
			total: Number(totalResult.rows[0]?.count ?? 0),
			limit,
			offset,
			products: rowsResult.rows.map(mapCatalogProduct),
		};
	});

	app.get("/api/catalog/:productId", async (request, reply) => {
		const { productId } = request.params as { productId: string };
		const result = await pool.query(
			"SELECT * FROM catalog_products WHERE product_id = $1",
			[productId],
		);

		if (result.rowCount === 0) {
			return reply.code(404).send({ message: "Catalog product not found" });
		}

		return { product: mapCatalogProduct(result.rows[0]) };
	});

	app.get(
		"/api/admin/users",
		{
			schema: {
				tags: ["admin"],
				summary: "List mock customers available for local testing",
				response: {
					200: userListJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				return await fetchThirdPartyUsers();
			} catch (error) {
				request.log.error(error);
				return reply.code(502).send({ message: "Unable to load mock users" });
			}
		},
	);

	app.get(
		"/api/admin/active-user",
		{
			schema: {
				tags: ["admin"],
				summary: "Get the active mock customer",
				response: {
					200: activeUserJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				const user = await getActiveUser();
				return { activeUserId, user };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load active mock user" });
			}
		},
	);

	app.put(
		"/api/admin/active-user",
		{
			schema: {
				tags: ["admin"],
				summary: "Set the active mock customer",
				body: setActiveUserJsonSchema,
				response: {
					200: activeUserJsonSchema,
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const input = request.body as { customerId: string };

			try {
				const users = await fetchThirdPartyUsers();
				if (!userExists(users, input.customerId)) {
					return reply.code(404).send({ message: "Mock user not found" });
				}

				activeUserId = input.customerId;
				const user = await getActiveUser();
				return { activeUserId, user };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to set active mock user" });
			}
		},
	);

	app.get(
		"/api/me",
		{
			schema: {
				tags: ["user"],
				summary: "Get the mocked logged-in loyalty customer",
				response: {
					200: currentUserJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				return await getActiveUser();
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load third-party current user" });
			}
		},
	);

	app.get(
		"/api/stores",
		{
			schema: {
				tags: ["appointments"],
				summary: "List stores available for guided denim fitting appointments",
				response: {
					200: storeListJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				return await fetchThirdPartyStores();
			} catch (error) {
				request.log.error(error);
				return reply.code(502).send({ message: "Unable to load stores" });
			}
		},
	);

	app.get(
		"/api/stores/schedule-patterns",
		{
			schema: {
				tags: ["appointments"],
				summary:
					"List weekly store and stylist schedule patterns used to generate bookable slots",
				response: {
					200: storeSchedulePatternJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				return await fetchThirdPartyStoreSchedulePatterns();
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load store schedule patterns" });
			}
		},
	);

	app.get(
		"/api/appointments/slots",
		{
			schema: {
				tags: ["appointments"],
				summary: "List bookable guided fitting appointment slots",
				querystring: {
					type: "object",
					properties: {
						storeId: { type: "string" },
					},
				},
				response: {
					200: {
						type: "object",
						required: ["slots"],
						properties: {
							slots: { type: "array", items: appointmentSlotJsonSchema },
						},
					},
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { storeId } = request.query as { storeId?: string };

			try {
				const patterns = await fetchThirdPartyStoreSchedulePatterns();
				const selectedStoreId = storeId ?? patterns.patterns[0]?.storeId;
				const pattern = selectedStoreId
					? findPatternForStore(patterns, selectedStoreId)
					: undefined;

				if (!pattern) {
					return reply.code(404).send({ message: "Store not found" });
				}

				return { slots: createStoreAppointmentSlots(pattern) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load third-party appointment slots" });
			}
		},
	);

	app.get(
		"/api/appointments",
		{
			schema: {
				tags: ["appointments"],
				summary: "List booked guided fitting appointments",
				response: {
					200: {
						type: "object",
						required: ["appointments"],
						properties: {
							appointments: {
								type: "array",
								items: appointmentSummaryJsonSchema,
							},
						},
					},
				},
			},
		},
		async () => {
			const result = await pool.query(`
				SELECT a.*,
					(
						SELECT count(*)::int
						FROM appointment_notifications n
						WHERE n.appointment_id = a.id
					) AS notification_count,
					(
						SELECT n.status
						FROM appointment_notifications n
						WHERE n.appointment_id = a.id
							AND n.type = 'confirmation'
						ORDER BY n.created_at DESC
						LIMIT 1
					) AS confirmation_status,
					(
						SELECT n.status
						FROM appointment_notifications n
						WHERE n.appointment_id = a.id
							AND n.type = 'reminder'
						ORDER BY n.created_at DESC
						LIMIT 1
					) AS reminder_status
				FROM appointments a
				ORDER BY a.slot_start ASC, a.created_at DESC
				LIMIT 100
			`);

			return { appointments: result.rows.map(mapAppointment) };
		},
	);

	app.get(
		"/api/appointments/me/upcoming",
		{
			schema: {
				tags: ["appointments"],
				summary:
					"Get the mocked customer's upcoming guided fitting appointment",
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: {
								anyOf: [appointmentSummaryJsonSchema, { type: "null" }],
							},
						},
					},
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				const currentUser = await getActiveUser();
				const result = await pool.query(
					`
						SELECT *
						FROM appointments
						WHERE customer_id = $1
							AND slot_start >= now()
							AND status IN ('scheduled', 'checked_in')
						ORDER BY slot_start ASC
						LIMIT 1
					`,
					[currentUser.customerId],
				);

				return {
					appointment: result.rows[0] ? mapAppointment(result.rows[0]) : null,
				};
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load upcoming appointment" });
			}
		},
	);

	app.get(
		"/api/appointments/me/past",
		{
			schema: {
				tags: ["appointments"],
				summary: "List the mocked customer's past guided fitting appointments",
				response: {
					200: {
						type: "object",
						required: ["appointments"],
						properties: {
							appointments: {
								type: "array",
								items: appointmentSummaryJsonSchema,
							},
						},
					},
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				const currentUser = await getActiveUser();
				const result = await pool.query(
					`
						SELECT *
						FROM appointments
						WHERE customer_id = $1
							AND (
								slot_start < now()
								OR status IN ('completed', 'cancelled', 'no_show')
							)
						ORDER BY slot_start DESC
						LIMIT 25
					`,
					[currentUser.customerId],
				);

				return { appointments: result.rows.map(mapAppointment) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load past appointments" });
			}
		},
	);

	app.post(
		"/api/appointments",
		{
			schema: {
				tags: ["appointments"],
				summary: "Book a guided fitting appointment",
				body: createAppointmentJsonSchema,
				response: {
					201: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					400: errorJsonSchema,
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const input = request.body as CreateAppointmentInput;
			const appointmentId = randomUUID();

			try {
				const [currentUser, stores, patterns, stylistList] = await Promise.all([
					getActiveUser(),
					fetchThirdPartyStores(),
					fetchThirdPartyStoreSchedulePatterns(),
					fetchThirdPartyStylists(),
				]);
				const selectedStore = stores.stores.find(
					(store) => store.storeId === input.storeId,
				);
				if (!selectedStore) {
					return reply.code(404).send({ message: "Store not found" });
				}

				const storePattern = findPatternForStore(patterns, input.storeId);
				if (!storePattern) {
					return reply.code(404).send({ message: "Store schedule not found" });
				}

				const existingAppointment = await pool.query(
					`
						SELECT id
						FROM appointments
						WHERE customer_id = $1
							AND slot_start >= now()
							AND status IN ('scheduled', 'checked_in')
						ORDER BY slot_start ASC
						LIMIT 1
					`,
					[currentUser.customerId],
				);

				if (existingAppointment.rowCount && existingAppointment.rowCount > 0) {
					return reply
						.code(409)
						.send({ message: "Customer already has an upcoming appointment" });
				}

				const slots = createStoreAppointmentSlots(storePattern);
				const selectedSlot = slots.find(
					(slot) =>
						normalizeSlotKey(slot.slotStart) ===
						normalizeSlotKey(input.slotStart),
				);

				if (!selectedSlot) {
					return reply
						.code(409)
						.send({ message: "Appointment slot is no longer available" });
				}

				const scheduledStylistIds = scheduledStylistIdsForSlot(
					storePattern,
					selectedSlot.slotStart,
				);
				if (scheduledStylistIds.length === 0) {
					return reply
						.code(409)
						.send({ message: "Appointment slot is no longer available" });
				}

				const museTag = mapMuseTag(input.styleKeywords);
				const assignedStylist = assignStylist(
					scheduledStylistIds,
					stylistList.stylists,
					museTag,
				);

				if (!assignedStylist) {
					return reply
						.code(409)
						.send({ message: "No stylist is available for the selected slot" });
				}

				const orderHistory = await fetchThirdPartyOrderHistory(
					currentUser.customerId,
					input.orderHistoryScenario ?? "standard",
				);
				const orderHistorySummary = summarizeOrderHistory(orderHistory);
				const suggestedProducts = await buildSuggestedProducts(
					currentUser,
					input,
					museTag,
					orderHistorySummary,
				);

				const insertResult = await pool.query(
					`
						INSERT INTO appointments (
							id, customer_id, loyalty_id, customer_name, slot_start, slot_end, store_snapshot,
							occasion, focus_colors, avoid_colors, style_keywords, guidance,
							session_notes, status, muse_tag, assigned_stylist,
							order_history_summary, suggested_products, source_payload, outfit_analysis
						)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '', 'scheduled', $13, $14, $15, $16, $17, $18)
						RETURNING *
					`,
					[
						appointmentId,
						currentUser.customerId,
						currentUser.loyaltyId,
						currentUser.displayName,
						new Date(selectedSlot.slotStart).toISOString(),
						new Date(selectedSlot.slotEnd).toISOString(),
						JSON.stringify(selectedStore),
						input.occasion,
						input.focusColors,
						input.avoidColors,
						JSON.stringify(input.styleKeywords),
						input.guidance ?? "",
						museTag,
						JSON.stringify(assignedStylist),
						JSON.stringify(orderHistorySummary),
						JSON.stringify(suggestedProducts),
						JSON.stringify({
							input,
							currentUser,
							orderHistory,
							store: selectedStore,
						}),
						input.outfitAnalysis ? JSON.stringify(input.outfitAnalysis) : null,
					],
				);
				await createMockNotifications(
					appointmentId,
					new Date(selectedSlot.slotStart).toISOString(),
				);
				const appointment =
					(await selectAppointmentById(appointmentId)) ??
					mapAppointment(insertResult.rows[0]);

				return reply.code(201).send({
					appointment,
				});
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to book guided fitting appointment" });
			}
		},
	);

	app.patch(
		"/api/appointments/:appointmentId",
		{
			schema: {
				tags: ["appointments"],
				summary: "Update the mocked customer's appointment guidance",
				params: appointmentIdParamsJsonSchema,
				body: updateAppointmentJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					400: errorJsonSchema,
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };
			const input = request.body as { guidance: string };

			try {
				const currentUser = await getActiveUser();
				const result = await pool.query(
					`
						UPDATE appointments
						SET guidance = $1
						WHERE id = $2
							AND customer_id = $3
							AND status NOT IN ('completed', 'cancelled', 'no_show')
						RETURNING *
					`,
					[input.guidance, appointmentId, currentUser.customerId],
				);

				if (!result.rows[0]) {
					const existing = await pool.query(
						`
							SELECT status
							FROM appointments
							WHERE id = $1
								AND customer_id = $2
						`,
						[appointmentId, currentUser.customerId],
					);
					if (isTerminalStatus(String(existing.rows[0]?.status ?? ""))) {
						return reply
							.code(409)
							.send({ message: "Terminal appointments cannot be edited" });
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to update appointment" });
			}
		},
	);

	app.patch(
		"/api/appointments/:appointmentId/session-notes",
		{
			schema: {
				tags: ["appointments"],
				summary:
					"Update associate session notes while an appointment is not completed",
				params: appointmentIdParamsJsonSchema,
				body: updateSessionNotesJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };
			const input = request.body as { sessionNotes: string };

			try {
				const result = await pool.query(
					`
						UPDATE appointments
						SET session_notes = $1
						WHERE id = $2
							AND status NOT IN ('completed', 'cancelled', 'no_show')
						RETURNING *
					`,
					[input.sessionNotes, appointmentId],
				);

				if (!result.rows[0]) {
					const existing = await pool.query(
						"SELECT status FROM appointments WHERE id = $1",
						[appointmentId],
					);
					if (isTerminalStatus(String(existing.rows[0]?.status ?? ""))) {
						return reply
							.code(409)
							.send({ message: "Terminal appointments cannot be edited" });
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to update session notes" });
			}
		},
	);

	app.patch(
		"/api/appointments/:appointmentId/stylist",
		{
			schema: {
				tags: ["appointments"],
				summary:
					"Reassign a scheduled appointment to a stylist scheduled at the same store and time",
				params: appointmentIdParamsJsonSchema,
				body: reassignStylistJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };
			const input = request.body as { stylistId: string };

			try {
				const existing = await pool.query(
					"SELECT * FROM appointments WHERE id = $1",
					[appointmentId],
				);
				if (!existing.rows[0]) {
					return reply.code(404).send({ message: "Appointment not found" });
				}

				const appointment = mapAppointment(existing.rows[0]);
				if (appointment.status !== "scheduled") {
					return reply
						.code(409)
						.send({ message: "Only scheduled appointments can be reassigned" });
				}

				const [patterns, stylistList] = await Promise.all([
					fetchThirdPartyStoreSchedulePatterns(),
					fetchThirdPartyStylists(),
				]);
				const pattern = findPatternForStore(
					patterns,
					appointment.store.storeId,
				);
				if (!pattern) {
					return reply.code(409).send({ message: "Store schedule not found" });
				}

				const scheduledStylistIds = scheduledStylistIdsForSlot(
					pattern,
					appointment.slotStart,
				);
				if (!scheduledStylistIds.includes(input.stylistId)) {
					return reply.code(409).send({
						message: "Stylist is not scheduled for this store and time",
					});
				}

				const stylist = stylistList.stylists.find(
					(candidate) =>
						candidate.id === input.stylistId &&
						candidate.store.storeId === appointment.store.storeId,
				);
				if (!stylist) {
					return reply.code(404).send({ message: "Stylist not found" });
				}

				const result = await pool.query(
					`
						UPDATE appointments
						SET assigned_stylist = $1
						WHERE id = $2
							AND status = 'scheduled'
						RETURNING *
					`,
					[JSON.stringify(stylist), appointmentId],
				);

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to reassign appointment stylist" });
			}
		},
	);

	app.post(
		"/api/appointments/:appointmentId/check-in",
		{
			schema: {
				tags: ["appointments"],
				summary: "Mark a scheduled appointment checked in",
				params: appointmentIdParamsJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };

			try {
				const result = await pool.query(
					`
						UPDATE appointments
						SET status = 'checked_in',
							checked_in_at = now()
						WHERE id = $1
							AND status = 'scheduled'
						RETURNING *
					`,
					[appointmentId],
				);

				if (!result.rows[0]) {
					const existing = await pool.query(
						"SELECT status FROM appointments WHERE id = $1",
						[appointmentId],
					);
					if (existing.rows[0]) {
						return reply
							.code(409)
							.send({ message: "Only scheduled appointments can check in" });
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to check in appointment" });
			}
		},
	);

	app.post(
		"/api/appointments/:appointmentId/no-show",
		{
			schema: {
				tags: ["appointments"],
				summary: "Mark a scheduled appointment as no-show",
				params: appointmentIdParamsJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };

			try {
				const result = await pool.query(
					`
						UPDATE appointments
						SET status = 'no_show',
							no_show_at = now()
						WHERE id = $1
							AND status = 'scheduled'
						RETURNING *
					`,
					[appointmentId],
				);

				if (!result.rows[0]) {
					const existing = await pool.query(
						"SELECT status FROM appointments WHERE id = $1",
						[appointmentId],
					);
					if (existing.rows[0]) {
						return reply.code(409).send({
							message: "Only scheduled appointments can be no-showed",
						});
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to mark appointment no-show" });
			}
		},
	);

	app.post(
		"/api/appointments/:appointmentId/cancel",
		{
			schema: {
				tags: ["appointments"],
				summary:
					"Cancel the mocked customer's scheduled appointment with an optional reason",
				params: appointmentIdParamsJsonSchema,
				body: cancelAppointmentJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };
			const input = request.body as { cancelReason?: string };

			try {
				const currentUser = await getActiveUser();
				const result = await pool.query(
					`
						UPDATE appointments
						SET status = 'cancelled',
							cancelled_at = now(),
							cancel_reason = COALESCE($1, '')
						WHERE id = $2
							AND customer_id = $3
							AND status = 'scheduled'
						RETURNING *
					`,
					[input.cancelReason ?? "", appointmentId, currentUser.customerId],
				);

				if (!result.rows[0]) {
					const existing = await pool.query(
						`
							SELECT status
							FROM appointments
							WHERE id = $1
								AND customer_id = $2
						`,
						[appointmentId, currentUser.customerId],
					);
					if (existing.rows[0]) {
						return reply.code(409).send({
							message: "Only scheduled appointments can be cancelled",
						});
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to cancel appointment" });
			}
		},
	);

	app.get(
		"/api/appointments/:appointmentId/messages",
		{
			schema: {
				tags: ["appointments"],
				summary: "List appointment messages",
				params: appointmentIdParamsJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["messages"],
						properties: {
							messages: {
								type: "array",
								items: appointmentMessageJsonSchema,
							},
						},
					},
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };

			try {
				const existing = await pool.query(
					"SELECT id FROM appointments WHERE id = $1",
					[appointmentId],
				);
				if (!existing.rows[0]) {
					return reply.code(404).send({ message: "Appointment not found" });
				}

				const result = await pool.query(
					`
						SELECT *
						FROM appointment_messages
						WHERE appointment_id = $1
						ORDER BY created_at ASC
					`,
					[appointmentId],
				);

				return { messages: result.rows.map(mapAppointmentMessage) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load appointment messages" });
			}
		},
	);

	app.post(
		"/api/appointments/:appointmentId/messages",
		{
			schema: {
				tags: ["appointments"],
				summary: "Post an appointment message while the appointment is active",
				params: appointmentIdParamsJsonSchema,
				body: createMessageJsonSchema,
				response: {
					201: {
						type: "object",
						required: ["message"],
						properties: {
							message: appointmentMessageJsonSchema,
						},
					},
					400: errorJsonSchema,
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };
			const input = request.body as {
				authorType: "customer" | "associate";
				body: string;
			};
			const body = input.body.trim();
			if (!body) {
				return reply.code(400).send({ message: "Message body is required" });
			}

			try {
				const existing = await pool.query(
					"SELECT status FROM appointments WHERE id = $1",
					[appointmentId],
				);
				if (!existing.rows[0]) {
					return reply.code(404).send({ message: "Appointment not found" });
				}
				if (!isActiveStatus(String(existing.rows[0].status))) {
					return reply
						.code(409)
						.send({ message: "Messages are locked for terminal appointments" });
				}

				const result = await pool.query(
					`
						INSERT INTO appointment_messages (
							id, appointment_id, author_type, body
						)
						VALUES ($1, $2, $3, $4)
						RETURNING *
					`,
					[randomUUID(), appointmentId, input.authorType, body],
				);

				return reply
					.code(201)
					.send({ message: mapAppointmentMessage(result.rows[0]) });
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to post appointment message" });
			}
		},
	);

	app.get(
		"/api/appointments/:appointmentId/notifications",
		{
			schema: {
				tags: ["appointments"],
				summary: "List mock confirmation and reminder notification records",
				params: appointmentIdParamsJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["notifications"],
						properties: {
							notifications: {
								type: "array",
								items: appointmentNotificationJsonSchema,
							},
						},
					},
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };

			try {
				const existing = await pool.query(
					"SELECT id FROM appointments WHERE id = $1",
					[appointmentId],
				);
				if (!existing.rows[0]) {
					return reply.code(404).send({ message: "Appointment not found" });
				}

				const result = await pool.query(
					`
						SELECT *
						FROM appointment_notifications
						WHERE appointment_id = $1
						ORDER BY created_at ASC
					`,
					[appointmentId],
				);

				return { notifications: result.rows.map(mapAppointmentNotification) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load appointment notifications" });
			}
		},
	);

	app.put(
		"/api/appointments/:appointmentId/feedback",
		{
			schema: {
				tags: ["appointments"],
				summary: "Submit customer feedback after an appointment is completed",
				params: appointmentIdParamsJsonSchema,
				body: feedbackJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };
			const input = request.body as { rating: number; comment?: string };

			try {
				const currentUser = await getActiveUser();
				const result = await pool.query(
					`
						UPDATE appointments
						SET customer_feedback_rating = $1,
							customer_feedback_comment = COALESCE($2, ''),
							customer_feedback_at = now()
						WHERE id = $3
							AND customer_id = $4
							AND status = 'completed'
						RETURNING *
					`,
					[
						input.rating,
						input.comment ?? "",
						appointmentId,
						currentUser.customerId,
					],
				);

				if (!result.rows[0]) {
					const existing = await pool.query(
						`
							SELECT status
							FROM appointments
							WHERE id = $1
								AND customer_id = $2
						`,
						[appointmentId, currentUser.customerId],
					);
					if (existing.rows[0]) {
						return reply
							.code(409)
							.send({ message: "Feedback opens after completion" });
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to submit appointment feedback" });
			}
		},
	);

	app.patch(
		"/api/appointments/:appointmentId/suggested-products/:productId",
		{
			schema: {
				tags: ["appointments"],
				summary:
					"Update associate-only prep state for a suggested appointment product",
				params: suggestedProductParamsJsonSchema,
				body: updateProductPrepJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId, productId } = request.params as {
				appointmentId: string;
				productId: string;
			};
			const input = request.body as {
				prepStatus: SuggestedProductPrepStatus;
				associateNote?: string;
			};

			try {
				const existing = await pool.query(
					"SELECT * FROM appointments WHERE id = $1",
					[appointmentId],
				);
				if (!existing.rows[0]) {
					return reply.code(404).send({ message: "Appointment not found" });
				}

				const appointment = mapAppointment(existing.rows[0]);
				if (!isActiveStatus(appointment.status)) {
					return reply.code(409).send({
						message: "Product prep is locked for terminal appointments",
					});
				}

				let updated = false;
				const suggestedProducts = appointment.suggestedProducts.map(
					(suggestion) => {
						if (suggestion.product.productId !== productId) {
							return suggestion;
						}
						updated = true;
						return {
							...suggestion,
							prepStatus: input.prepStatus,
							associateNote: input.associateNote ?? suggestion.associateNote,
						};
					},
				);

				if (!updated) {
					return reply
						.code(404)
						.send({ message: "Suggested product not found" });
				}

				const result = await pool.query(
					`
						UPDATE appointments
						SET suggested_products = $1
						WHERE id = $2
						RETURNING *
					`,
					[JSON.stringify(suggestedProducts), appointmentId],
				);

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to update suggested product prep" });
			}
		},
	);

	app.post(
		"/api/appointments/:appointmentId/complete",
		{
			schema: {
				tags: ["appointments"],
				summary: "Mark an appointment session as completed",
				params: appointmentIdParamsJsonSchema,
				body: completeAppointmentJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					400: errorJsonSchema,
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };
			const input = request.body as {
				customerRecap: string;
				sessionNotes?: string;
				associateFeedback?: string;
			};
			if (!input.customerRecap.trim()) {
				return reply.code(400).send({ message: "Customer recap is required" });
			}

			try {
				const result = await pool.query(
					`
						UPDATE appointments
						SET session_notes = COALESCE($1, session_notes),
							customer_recap = $2,
							associate_feedback = COALESCE($3, ''),
							status = 'completed',
							completed_at = now()
						WHERE id = $4
							AND status IN ('scheduled', 'checked_in')
						RETURNING *
					`,
					[
						input.sessionNotes,
						input.customerRecap.trim(),
						input.associateFeedback ?? "",
						appointmentId,
					],
				);

				if (!result.rows[0]) {
					const existing = await pool.query(
						"SELECT status FROM appointments WHERE id = $1",
						[appointmentId],
					);
					if (isTerminalStatus(String(existing.rows[0]?.status ?? ""))) {
						return reply
							.code(409)
							.send({ message: "Appointment is already terminal" });
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to complete appointment" });
			}
		},
	);

	app.post(
		"/api/appointments/:appointmentId/regenerate-suggestions",
		{
			schema: {
				tags: ["appointments"],
				summary: "Re-run the recommendation engine for an appointment",
				params: appointmentIdParamsJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };

			const existing = await pool.query(
				"SELECT * FROM appointments WHERE id = $1",
				[appointmentId],
			);
			if (!existing.rows[0]) {
				return reply.code(404).send({ message: "Appointment not found" });
			}
			const appointment = mapAppointment(existing.rows[0]);
			if (!isActiveStatus(appointment.status)) {
				return reply
					.code(409)
					.send({ message: "Terminal appointments cannot be edited" });
			}

			try {
				const customer = await fetchThirdPartyUser(appointment.customerId);
				const suggestedProducts = await buildSuggestedProducts(
					customer,
					{
						storeId: appointment.store.storeId,
						slotStart: appointment.slotStart,
						occasion: appointment.occasion,
						focusColors: appointment.focusColors,
						avoidColors: appointment.avoidColors,
						styleKeywords: appointment.styleKeywords,
						guidance: appointment.guidance,
						outfitAnalysis: appointment.outfitAnalysis,
					},
					appointment.museTag,
					appointment.orderHistorySummary,
				);

				const result = await pool.query(
					"UPDATE appointments SET suggested_products = $1 WHERE id = $2 RETURNING *",
					[JSON.stringify(suggestedProducts), appointmentId],
				);

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to regenerate suggestions" });
			}
		},
	);

	// Stateless: analyze an outfit photo into structured styling context. The
	// image is held in memory only for the duration of this request and is never
	// written to disk, the database, or logs — only the text analysis is returned.
	app.post(
		"/api/outfit-analysis",
		{
			// Base64-encoded images exceed Fastify's 1MB default body limit. iOS
			// downscales before upload, but allow generous headroom here.
			bodyLimit: 12 * 1024 * 1024,
			schema: {
				tags: ["appointments"],
				summary:
					"Analyze an outfit photo into structured styling context (image is not stored)",
				body: analyzeOutfitJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["analysis"],
						properties: { analysis: outfitAnalysisJsonSchema },
					},
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { imageBase64, mediaType } = request.body as {
				imageBase64: string;
				mediaType: SupportedMediaType;
			};
			try {
				const analysis = await analyzeOutfit(imageBase64, mediaType);
				// imageBase64 falls out of scope here — never persisted or logged.
				return { analysis };
			} catch {
				// analyzeOutfit falls back internally; this guards unexpected throws.
				// Deliberately do not log the error/body (may reference the image).
				request.log.error("Outfit analysis request failed");
				return reply
					.code(502)
					.send({ message: "Unable to analyze outfit photo" });
			}
		},
	);

	// Attach (or clear with null) a customer-signed-off outfit analysis on an
	// existing appointment. With `regenerate` true (default) it also re-runs the
	// recommendation engine; the stylist portal passes false to save intent edits
	// without an LLM re-run, then triggers the regenerate endpoint explicitly.
	app.patch(
		"/api/appointments/:appointmentId/outfit-analysis",
		{
			schema: {
				tags: ["appointments"],
				summary:
					"Attach or clear a signed-off outfit analysis (optionally re-running suggestions)",
				params: appointmentIdParamsJsonSchema,
				body: {
					type: "object",
					required: ["outfitAnalysis"],
					properties: {
						outfitAnalysis: {
							anyOf: [outfitAnalysisJsonSchema, { type: "null" }],
						},
						regenerate: { type: "boolean", default: true },
					},
				},
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: { appointment: appointmentSummaryJsonSchema },
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };
			const { outfitAnalysis, regenerate = true } = request.body as {
				outfitAnalysis: OutfitAnalysis | null;
				regenerate?: boolean;
			};

			const existing = await pool.query(
				"SELECT * FROM appointments WHERE id = $1",
				[appointmentId],
			);
			if (!existing.rows[0]) {
				return reply.code(404).send({ message: "Appointment not found" });
			}
			const appointment = mapAppointment(existing.rows[0]);
			if (!isActiveStatus(appointment.status)) {
				return reply
					.code(409)
					.send({ message: "Terminal appointments cannot be edited" });
			}

			try {
				const normalized = outfitAnalysis
					? normalizeOutfitAnalysis(
							outfitAnalysis,
							outfitEngineValues.includes(outfitAnalysis.engine)
								? outfitAnalysis.engine
								: "manual",
						)
					: null;

				// Persist intents only — the stylist re-runs explicitly via the
				// regenerate-suggestions endpoint.
				if (!regenerate) {
					const result = await pool.query(
						"UPDATE appointments SET outfit_analysis = $1 WHERE id = $2 RETURNING *",
						[normalized ? JSON.stringify(normalized) : null, appointmentId],
					);
					return { appointment: mapAppointment(result.rows[0]) };
				}

				const customer = await fetchThirdPartyUser(appointment.customerId);
				const suggestedProducts = await buildSuggestedProducts(
					customer,
					{
						storeId: appointment.store.storeId,
						slotStart: appointment.slotStart,
						occasion: appointment.occasion,
						focusColors: appointment.focusColors,
						avoidColors: appointment.avoidColors,
						styleKeywords: appointment.styleKeywords,
						guidance: appointment.guidance,
						outfitAnalysis: normalized,
					},
					appointment.museTag,
					appointment.orderHistorySummary,
				);

				const result = await pool.query(
					"UPDATE appointments SET outfit_analysis = $1, suggested_products = $2 WHERE id = $3 RETURNING *",
					[
						normalized ? JSON.stringify(normalized) : null,
						JSON.stringify(suggestedProducts),
						appointmentId,
					],
				);
				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to update outfit analysis" });
			}
		},
	);

	app.delete(
		"/api/appointments/:appointmentId",
		{
			schema: {
				tags: ["appointments"],
				summary: "Cancel the mocked customer's upcoming appointment",
				params: appointmentIdParamsJsonSchema,
				response: {
					204: {
						type: "null",
					},
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };

			try {
				const currentUser = await getActiveUser();
				const result = await pool.query(
					`
						UPDATE appointments
						SET status = 'cancelled',
							cancelled_at = now()
						WHERE id = $1
							AND customer_id = $2
							AND slot_start >= now()
							AND status IN ('scheduled', 'checked_in')
						RETURNING id
					`,
					[appointmentId, currentUser.customerId],
				);

				if (!result.rowCount) {
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return reply.code(204).send();
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to cancel appointment" });
			}
		},
	);

	app.get(
		"/api/customers/:customerId/order-history",
		{
			schema: {
				tags: ["order-history"],
				summary:
					"Get customer order history from the simulated third-party service",
				params: {
					type: "object",
					required: ["customerId"],
					properties: {
						customerId: { type: "string", minLength: 1 },
					},
				},
				querystring: {
					type: "object",
					properties: {
						scenario: {
							type: "string",
							enum: orderHistoryScenarioEnum,
							default: "standard",
						},
					},
				},
				response: {
					200: orderHistoryJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { customerId } = request.params as { customerId: string };
			const { scenario = "standard" } = request.query as {
				scenario?: OrderHistoryScenario;
			};

			try {
				return await fetchThirdPartyOrderHistory(customerId, scenario);
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load third-party order history" });
			}
		},
	);

	app.get(
		"/api/stylists",
		{
			schema: {
				tags: ["stylists"],
				summary: "List simulated store-associate stylist profiles",
				querystring: {
					type: "object",
					properties: {
						specialty: { type: "string" },
						fit: { type: "string" },
						availability: { type: "string", enum: stylistAvailabilityEnum },
					},
				},
				response: {
					200: stylistListJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const filters = request.query as {
				specialty?: string;
				fit?: string;
				availability?: StylistAvailabilityStatus;
			};

			try {
				const data = await fetchThirdPartyStylists();
				return { stylists: filterStylists(data.stylists, filters) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load third-party stylist profiles" });
			}
		},
	);

	app.get(
		"/api/stylists/availability",
		{
			schema: {
				tags: ["stylists"],
				summary:
					"Get the next 10 days of simulated store-associate stylist availability",
				response: {
					200: stylistAvailabilityJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				return await fetchThirdPartyStylistAvailability();
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load third-party stylist availability" });
			}
		},
	);

	app.get(
		"/api/stylists/:stylistId",
		{
			schema: {
				tags: ["stylists"],
				summary: "Get a simulated store-associate stylist profile",
				params: {
					type: "object",
					required: ["stylistId"],
					properties: {
						stylistId: { type: "string", minLength: 1 },
					},
				},
				response: {
					200: {
						type: "object",
						required: ["stylist"],
						properties: {
							stylist: stylistJsonSchema,
						},
					},
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { stylistId } = request.params as { stylistId: string };

			try {
				const stylist = await fetchThirdPartyStylist(stylistId);
				return { stylist };
			} catch (error) {
				request.log.error(error);

				if (error instanceof ThirdPartyHttpError && error.status === 404) {
					return reply.code(404).send({ message: "Stylist not found" });
				}

				return reply
					.code(502)
					.send({ message: "Unable to load third-party stylist profile" });
			}
		},
	);
}
