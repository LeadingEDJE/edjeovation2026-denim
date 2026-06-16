/**
 * JSON Schemas and enum constants for request/response validation and OpenAPI
 * generation. Pure data shared across the route plugins.
 */
import { supportedMediaTypes } from "../outfit-analysis.js";

export const fitPreferenceEnum = [
	"skinny",
	"slim",
	"straight",
	"relaxed",
	"wide",
] as const;
export const stretchPreferenceEnum = [
	"rigid",
	"comfort-stretch",
	"high-stretch",
] as const;
export const orderHistoryScenarioEnum = [
	"standard",
	"denim-heavy",
	"returns",
	"empty",
	"error",
] as const;
export const stylistAvailabilityEnum = [
	"available",
	"busy",
	"offline",
] as const;
export const museTagEnum = [
	"Clean Muse",
	"Romantic Muse",
	"Boyish Muse",
	"Statement Maker",
] as const;
export const appointmentStatusEnum = [
	"scheduled",
	"checked_in",
	"completed",
	"cancelled",
	"no_show",
] as const;
export const terminalAppointmentStatuses = [
	"completed",
	"cancelled",
	"no_show",
];
export const productPrepStatusEnum = [
	"suggested",
	"pulled",
	"skipped",
] as const;
export const catalogAudienceEnum = ["womens", "mens"] as const;
export const catalogAudiencesJsonSchema = {
	type: "array",
	minItems: 1,
	uniqueItems: true,
	items: { type: "string", enum: catalogAudienceEnum },
} as const;
export const styleKeywordEnum = [
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

export const currentUserJsonSchema = {
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
				catalogAudiences: catalogAudiencesJsonSchema,
			},
		},
	},
} as const;

export const userListJsonSchema = {
	type: "object",
	required: ["users"],
	properties: {
		users: {
			type: "array",
			items: currentUserJsonSchema,
		},
	},
} as const;

export const activeUserJsonSchema = {
	type: "object",
	required: ["activeUserId", "user"],
	properties: {
		activeUserId: { type: "string" },
		user: currentUserJsonSchema,
	},
} as const;

export const setActiveUserJsonSchema = {
	type: "object",
	required: ["customerId"],
	properties: {
		customerId: { type: "string", minLength: 1 },
	},
} as const;

export const errorJsonSchema = {
	type: "object",
	properties: {
		message: { type: "string" },
	},
} as const;

export const orderHistoryItemJsonSchema = {
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

export const orderHistoryJsonSchema = {
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

export const stylistJsonSchema = {
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

export const stylistListJsonSchema = {
	type: "object",
	required: ["stylists"],
	properties: {
		stylists: {
			type: "array",
			items: stylistJsonSchema,
		},
	},
} as const;

export const storeJsonSchema = {
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

export const storeListJsonSchema = {
	type: "object",
	required: ["stores"],
	properties: {
		stores: {
			type: "array",
			items: storeJsonSchema,
		},
	},
} as const;

export const storeSchedulePatternJsonSchema = {
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

export const stylistAvailabilityJsonSchema = {
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

export const appointmentSlotJsonSchema = {
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
export const outfitAnalysisJsonSchema = {
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
export const analyzeOutfitJsonSchema = {
	type: "object",
	required: ["imageBase64", "mediaType"],
	properties: {
		imageBase64: { type: "string", minLength: 1 },
		mediaType: { type: "string", enum: supportedMediaTypes },
	},
} as const;

export const createAppointmentJsonSchema = {
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
		catalogAudiences: catalogAudiencesJsonSchema,
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

export const updateAppointmentJsonSchema = {
	type: "object",
	required: ["guidance"],
	properties: {
		guidance: { type: "string", maxLength: 1000 },
	},
} as const;

export const updateSessionNotesJsonSchema = {
	type: "object",
	required: ["sessionNotes"],
	properties: {
		sessionNotes: { type: "string", maxLength: 3000 },
	},
} as const;

export const completeAppointmentJsonSchema = {
	type: "object",
	required: ["customerRecap"],
	properties: {
		customerRecap: { type: "string", minLength: 1, maxLength: 3000 },
		sessionNotes: { type: "string", maxLength: 3000 },
		associateFeedback: { type: "string", maxLength: 3000 },
	},
} as const;

export const cancelAppointmentJsonSchema = {
	type: "object",
	properties: {
		cancelReason: { type: "string", maxLength: 1000 },
	},
} as const;

export const reassignStylistJsonSchema = {
	type: "object",
	required: ["stylistId"],
	properties: {
		stylistId: { type: "string", minLength: 1 },
	},
} as const;

export const createMessageJsonSchema = {
	type: "object",
	required: ["authorType", "body"],
	properties: {
		authorType: { type: "string", enum: ["customer", "associate"] },
		body: { type: "string", minLength: 1, maxLength: 2000 },
	},
} as const;

export const feedbackJsonSchema = {
	type: "object",
	required: ["rating"],
	properties: {
		rating: { type: "integer", minimum: 1, maximum: 5 },
		comment: { type: "string", maxLength: 2000 },
	},
} as const;

export const updateProductPrepJsonSchema = {
	type: "object",
	required: ["prepStatus"],
	properties: {
		prepStatus: { type: "string", enum: productPrepStatusEnum },
		associateNote: { type: "string", maxLength: 1000 },
	},
} as const;

export const appointmentIdParamsJsonSchema = {
	type: "object",
	required: ["appointmentId"],
	properties: {
		appointmentId: { type: "string", format: "uuid" },
	},
} as const;

export const suggestedProductParamsJsonSchema = {
	type: "object",
	required: ["appointmentId", "productId"],
	properties: {
		appointmentId: { type: "string", format: "uuid" },
		productId: { type: "string", minLength: 1 },
	},
} as const;

export const appointmentMessageJsonSchema = {
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

export const appointmentNotificationJsonSchema = {
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

export const appointmentSummaryJsonSchema = {
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
		"catalogAudiences",
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
		catalogAudiences: catalogAudiencesJsonSchema,
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
