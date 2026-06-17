import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../errors.js";
import {
	analyzeOutfit,
	type BodyMeasurements,
	normalizeOutfitAnalysis,
	type SupportedMediaType,
} from "../outfit-analysis.js";
import {
	fetchThirdPartyOrderHistory,
	fetchThirdPartyStoreSchedulePatterns,
	fetchThirdPartyStores,
	fetchThirdPartyStylists,
} from "../recommendations.js";
import * as repository from "../repository.js";
import type {
	CreateAppointmentInput,
	OutfitAnalysis,
	SuggestedProductPrepStatus,
} from "../types.js";
import {
	assignStylist,
	buildSuggestedProducts,
	createMockNotifications,
	createStoreAppointmentSlots,
	findPatternForStore,
	getActiveUser,
	isActiveStatus,
	isTerminalStatus,
	mapAppointment,
	mapAppointmentMessage,
	mapAppointmentNotification,
	mapMuseTag,
	normalizeCatalogAudiences,
	normalizeSlotKey,
	outfitEngineValues,
	resolveAppointmentCustomer,
	scheduledStylistIdsForSlot,
	selectAppointmentById,
	summarizeOrderHistory,
} from "./helpers.js";
import {
	analyzeOutfitJsonSchema,
	appointmentIdParamsJsonSchema,
	appointmentMessageJsonSchema,
	appointmentNotificationJsonSchema,
	appointmentSlotJsonSchema,
	appointmentSummaryJsonSchema,
	cancelAppointmentJsonSchema,
	completeAppointmentJsonSchema,
	createAppointmentJsonSchema,
	createMessageJsonSchema,
	errorJsonSchema,
	feedbackJsonSchema,
	outfitAnalysisJsonSchema,
	reassignStylistJsonSchema,
	suggestedProductParamsJsonSchema,
	updateAppointmentJsonSchema,
	updateProductPrepJsonSchema,
	updateSessionNotesJsonSchema,
} from "./schemas.js";

export async function appointmentRoutes(app: FastifyInstance) {
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
				throw new HttpError(
					502,
					"Unable to load third-party appointment slots",
					{ cause: error },
				);
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
			const result = await repository.selectAllAppointmentsWithNotifications();

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
		async (_request, _reply) => {
			try {
				const currentUser = await getActiveUser();
				const result = await repository.selectUpcomingAppointmentForCustomer(
					currentUser.customerId,
				);

				return {
					appointment: result.rows[0] ? mapAppointment(result.rows[0]) : null,
				};
			} catch (error) {
				throw new HttpError(502, "Unable to load upcoming appointment", {
					cause: error,
				});
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
		async (_request, _reply) => {
			try {
				const currentUser = await getActiveUser();
				const result = await repository.selectPastAppointmentsForCustomer(
					currentUser.customerId,
				);

				return { appointments: result.rows.map(mapAppointment) };
			} catch (error) {
				throw new HttpError(502, "Unable to load past appointments", {
					cause: error,
				});
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

				const existingAppointment =
					await repository.selectActiveUpcomingAppointmentId(
						currentUser.customerId,
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
				const catalogAudiences = normalizeCatalogAudiences(
					input.catalogAudiences ?? currentUser.preferences.catalogAudiences,
				);
				const appointmentInput = { ...input, catalogAudiences };
				const suggestedProducts = await buildSuggestedProducts(
					currentUser,
					appointmentInput,
					museTag,
					orderHistorySummary,
				);

				const insertResult = await repository.insertAppointment([
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
					JSON.stringify(catalogAudiences),
					input.guidance ?? "",
					museTag,
					JSON.stringify(assignedStylist),
					JSON.stringify(orderHistorySummary),
					JSON.stringify(suggestedProducts),
					JSON.stringify({
						input: appointmentInput,
						currentUser,
						orderHistory,
						store: selectedStore,
					}),
					input.outfitAnalysis ? JSON.stringify(input.outfitAnalysis) : null,
				]);
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
				throw new HttpError(502, "Unable to book guided fitting appointment", {
					cause: error,
				});
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
				const result = await repository.updateAppointmentGuidance(
					input.guidance,
					appointmentId,
					currentUser.customerId,
				);

				if (!result.rows[0]) {
					const existing = await repository.selectAppointmentStatusForCustomer(
						appointmentId,
						currentUser.customerId,
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
				throw new HttpError(502, "Unable to update appointment", {
					cause: error,
				});
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
				const result = await repository.updateAppointmentSessionNotes(
					input.sessionNotes,
					appointmentId,
				);

				if (!result.rows[0]) {
					const existing =
						await repository.selectAppointmentStatusById(appointmentId);
					if (isTerminalStatus(String(existing.rows[0]?.status ?? ""))) {
						return reply
							.code(409)
							.send({ message: "Terminal appointments cannot be edited" });
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				throw new HttpError(502, "Unable to update session notes", {
					cause: error,
				});
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
				const existing =
					await repository.selectAppointmentRowById(appointmentId);
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

				const result = await repository.updateAppointmentStylist(
					JSON.stringify(stylist),
					appointmentId,
				);

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				throw new HttpError(502, "Unable to reassign appointment stylist", {
					cause: error,
				});
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
				const result = await repository.checkInAppointment(appointmentId);

				if (!result.rows[0]) {
					const existing =
						await repository.selectAppointmentStatusById(appointmentId);
					if (existing.rows[0]) {
						return reply
							.code(409)
							.send({ message: "Only scheduled appointments can check in" });
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				throw new HttpError(502, "Unable to check in appointment", {
					cause: error,
				});
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
				const result = await repository.markAppointmentNoShow(appointmentId);

				if (!result.rows[0]) {
					const existing =
						await repository.selectAppointmentStatusById(appointmentId);
					if (existing.rows[0]) {
						return reply.code(409).send({
							message: "Only scheduled appointments can be no-showed",
						});
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				throw new HttpError(502, "Unable to mark appointment no-show", {
					cause: error,
				});
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
				const result = await repository.cancelScheduledAppointment(
					input.cancelReason ?? "",
					appointmentId,
					currentUser.customerId,
				);

				if (!result.rows[0]) {
					const existing = await repository.selectAppointmentStatusForCustomer(
						appointmentId,
						currentUser.customerId,
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
				throw new HttpError(502, "Unable to cancel appointment", {
					cause: error,
				});
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
				const existing =
					await repository.selectAppointmentIdById(appointmentId);
				if (!existing.rows[0]) {
					return reply.code(404).send({ message: "Appointment not found" });
				}

				const result =
					await repository.selectAppointmentMessages(appointmentId);

				return { messages: result.rows.map(mapAppointmentMessage) };
			} catch (error) {
				throw new HttpError(502, "Unable to load appointment messages", {
					cause: error,
				});
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
				const existing =
					await repository.selectAppointmentStatusById(appointmentId);
				if (!existing.rows[0]) {
					return reply.code(404).send({ message: "Appointment not found" });
				}
				if (!isActiveStatus(String(existing.rows[0].status))) {
					return reply
						.code(409)
						.send({ message: "Messages are locked for terminal appointments" });
				}

				const result = await repository.insertAppointmentMessage(
					randomUUID(),
					appointmentId,
					input.authorType,
					body,
				);

				return reply
					.code(201)
					.send({ message: mapAppointmentMessage(result.rows[0]) });
			} catch (error) {
				throw new HttpError(502, "Unable to post appointment message", {
					cause: error,
				});
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
				const existing =
					await repository.selectAppointmentIdById(appointmentId);
				if (!existing.rows[0]) {
					return reply.code(404).send({ message: "Appointment not found" });
				}

				const result =
					await repository.selectAppointmentNotifications(appointmentId);

				return { notifications: result.rows.map(mapAppointmentNotification) };
			} catch (error) {
				throw new HttpError(502, "Unable to load appointment notifications", {
					cause: error,
				});
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
				const result = await repository.updateAppointmentFeedback(
					input.rating,
					input.comment ?? "",
					appointmentId,
					currentUser.customerId,
				);

				if (!result.rows[0]) {
					const existing = await repository.selectAppointmentStatusForCustomer(
						appointmentId,
						currentUser.customerId,
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
				throw new HttpError(502, "Unable to submit appointment feedback", {
					cause: error,
				});
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
				const existing =
					await repository.selectAppointmentRowById(appointmentId);
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

				const result = await repository.updateAppointmentSuggestedProducts(
					JSON.stringify(suggestedProducts),
					appointmentId,
				);

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				throw new HttpError(502, "Unable to update suggested product prep", {
					cause: error,
				});
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
				const result = await repository.markAppointmentCompleted(
					input.sessionNotes,
					input.customerRecap.trim(),
					input.associateFeedback ?? "",
					appointmentId,
				);

				if (!result.rows[0]) {
					const existing =
						await repository.selectAppointmentStatusById(appointmentId);
					if (isTerminalStatus(String(existing.rows[0]?.status ?? ""))) {
						return reply
							.code(409)
							.send({ message: "Appointment is already terminal" });
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				throw new HttpError(502, "Unable to complete appointment", {
					cause: error,
				});
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

			const existing = await repository.selectAppointmentRowById(appointmentId);
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
				const customer = await resolveAppointmentCustomer(
					appointment.customerId,
					existing.rows[0].source_payload,
				);
				if (!customer) {
					return reply
						.code(502)
						.send({ message: "Unable to resolve customer for suggestions" });
				}
				const suggestedProducts = await buildSuggestedProducts(
					customer,
					{
						storeId: appointment.store.storeId,
						slotStart: appointment.slotStart,
						occasion: appointment.occasion,
						focusColors: appointment.focusColors,
						avoidColors: appointment.avoidColors,
						styleKeywords: appointment.styleKeywords,
						catalogAudiences: appointment.catalogAudiences,
						guidance: appointment.guidance,
						outfitAnalysis: appointment.outfitAnalysis,
					},
					appointment.museTag,
					appointment.orderHistorySummary,
				);

				const result = await repository.updateAppointmentSuggestedProducts(
					JSON.stringify(suggestedProducts),
					appointmentId,
				);

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				throw new HttpError(502, "Unable to regenerate suggestions", {
					cause: error,
				});
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
		async (request) => {
			const { imageBase64, mediaType, analyzeBodyType, measurements } =
				request.body as {
					imageBase64: string;
					mediaType: SupportedMediaType;
					analyzeBodyType?: boolean;
					measurements?: BodyMeasurements;
				};
			try {
				const analysis = await analyzeOutfit(imageBase64, mediaType, {
					analyzeBodyType,
					measurements,
				});
				// imageBase64 falls out of scope here — never persisted or logged.
				return { analysis };
			} catch {
				// analyzeOutfit falls back internally; this guards unexpected throws.
				// Deliberately omit the error cause so nothing referencing the image
				// is logged — the error handler logs only the static message below.
				throw new HttpError(502, "Unable to analyze outfit photo");
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

			const existing = await repository.selectAppointmentRowById(appointmentId);
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
					const result = await repository.updateAppointmentOutfitAnalysis(
						normalized ? JSON.stringify(normalized) : null,
						appointmentId,
					);
					return { appointment: mapAppointment(result.rows[0]) };
				}

				const customer = await resolveAppointmentCustomer(
					appointment.customerId,
					existing.rows[0].source_payload,
				);
				if (!customer) {
					return reply
						.code(502)
						.send({ message: "Unable to resolve customer for suggestions" });
				}
				const suggestedProducts = await buildSuggestedProducts(
					customer,
					{
						storeId: appointment.store.storeId,
						slotStart: appointment.slotStart,
						occasion: appointment.occasion,
						focusColors: appointment.focusColors,
						avoidColors: appointment.avoidColors,
						styleKeywords: appointment.styleKeywords,
						catalogAudiences: appointment.catalogAudiences,
						guidance: appointment.guidance,
						outfitAnalysis: normalized,
					},
					appointment.museTag,
					appointment.orderHistorySummary,
				);

				const result =
					await repository.updateAppointmentOutfitAnalysisAndProducts(
						normalized ? JSON.stringify(normalized) : null,
						JSON.stringify(suggestedProducts),
						appointmentId,
					);
				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				throw new HttpError(502, "Unable to update outfit analysis", {
					cause: error,
				});
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
				const result = await repository.cancelUpcomingAppointment(
					appointmentId,
					currentUser.customerId,
				);

				if (!result.rowCount) {
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return reply.code(204).send();
			} catch (error) {
				throw new HttpError(502, "Unable to cancel appointment", {
					cause: error,
				});
			}
		},
	);
}
