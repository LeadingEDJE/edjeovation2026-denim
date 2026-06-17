import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type Appointment,
	type AppointmentMessage,
	type AppointmentNotification,
	type CurrentUser,
	checkInAppointment,
	completeAppointment,
	getAppointment,
	getCustomerProfile,
	listAppointmentMessages,
	listAppointmentNotifications,
	listAppointments,
	listEligibleStylists,
	listStores,
	listStylists,
	markNoShowAppointment,
	type OutfitAnalysis,
	postAppointmentMessage,
	reassignAppointmentStylist,
	regenerateSuggestions,
	type Store,
	type StylistProfile,
	type SuggestedProduct,
	updateCustomerFitProfile,
	updateOutfitAnalysis,
	updateSessionNotes,
	updateSuggestedProductPrep,
} from "../api";
import {
	compareAppointments,
	isOpenAppointment,
	matchesFilters,
	matchesView,
} from "../appointment-filters";
import type { AppointmentFilters, DashboardView } from "../types";

const emptyFilters: AppointmentFilters = {
	storeId: "",
	date: "",
	dateOrder: "open_priority",
	stylistId: "",
	status: "",
};

function initialUrlState(): {
	view: DashboardView;
	appointmentId: string | null;
} {
	const params = new URLSearchParams(window.location.search);
	const view = params.get("view");
	return {
		view: ["open", "in_progress", "completed", "cancelled", "no_show"].includes(
			view ?? "",
		)
			? (view as DashboardView)
			: "open",
		appointmentId: params.get("appointment"),
	};
}

export function useAppointmentDashboard() {
	const initialState = useMemo(initialUrlState, []);
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [stores, setStores] = useState<Store[]>([]);
	const [stylists, setStylists] = useState<StylistProfile[]>([]);
	const [eligibleStylists, setEligibleStylists] = useState<
		Record<string, StylistProfile[]>
	>({});
	const [customerProfiles, setCustomerProfiles] = useState<
		Record<string, CurrentUser>
	>({});
	const [sessionNotes, setSessionNotes] = useState<Record<string, string>>({});
	const [customerRecaps, setCustomerRecaps] = useState<Record<string, string>>(
		{},
	);
	const [associateFeedbacks, setAssociateFeedbacks] = useState<
		Record<string, string>
	>({});
	const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>(
		{},
	);
	const [messages, setMessages] = useState<
		Record<string, AppointmentMessage[]>
	>({});
	const [notifications, setNotifications] = useState<
		Record<string, AppointmentNotification[]>
	>({});
	const [filters, setFilters] = useState<AppointmentFilters>(emptyFilters);
	const [activeView, setActiveView] = useState<DashboardView>(
		initialState.view,
	);
	const [selectedAppointmentId, setSelectedAppointmentId] = useState<
		string | null
	>(initialState.appointmentId);
	const [status, setStatus] = useState("Loading appointments");
	const [isLoading, setIsLoading] = useState(false);
	const [regeneratingAppointmentId, setRegeneratingAppointmentId] = useState<
		string | null
	>(null);
	const dirtySessionFields = useRef({
		sessionNotes: new Set<string>(),
		customerRecaps: new Set<string>(),
		associateFeedbacks: new Set<string>(),
	});

	const seedDrafts = useCallback(
		(nextAppointments: Appointment[], force = false) => {
			setSessionNotes((current) => ({
				...Object.fromEntries(
					nextAppointments.map((appointment) => [
						appointment.id,
						force ||
						!dirtySessionFields.current.sessionNotes.has(appointment.id)
							? appointment.sessionNotes
							: (current[appointment.id] ?? appointment.sessionNotes),
					]),
				),
			}));
			setCustomerRecaps((current) => ({
				...Object.fromEntries(
					nextAppointments.map((appointment) => [
						appointment.id,
						force ||
						!dirtySessionFields.current.customerRecaps.has(appointment.id)
							? appointment.customerRecap
							: (current[appointment.id] ?? appointment.customerRecap),
					]),
				),
			}));
			setAssociateFeedbacks((current) => ({
				...Object.fromEntries(
					nextAppointments.map((appointment) => [
						appointment.id,
						force ||
						!dirtySessionFields.current.associateFeedbacks.has(appointment.id)
							? appointment.associateFeedback
							: (current[appointment.id] ?? appointment.associateFeedback),
					]),
				),
			}));
		},
		[],
	);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			const [nextAppointments, nextStores, nextStylists] = await Promise.all([
				listAppointments(),
				listStores(),
				listStylists(),
			]);
			setAppointments(nextAppointments);
			setStores(nextStores);
			setStylists(nextStylists);
			seedDrafts(nextAppointments);
			setStatus("Appointments loaded");
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Unable to load appointments",
			);
		} finally {
			setIsLoading(false);
		}
	}, [seedDrafts]);

	const mergeAppointment = useCallback(
		(updatedAppointment: Appointment, forceDrafts = false) => {
			setAppointments((current) => {
				const existing = current.some(
					(appointment) => appointment.id === updatedAppointment.id,
				);
				return existing
					? current.map((appointment) =>
							appointment.id === updatedAppointment.id
								? updatedAppointment
								: appointment,
						)
					: [updatedAppointment, ...current];
			});
			seedDrafts([updatedAppointment], forceDrafts);
		},
		[seedDrafts],
	);

	const loadAppointmentMeta = useCallback(
		async (appointmentId: string) => {
			try {
				const nextAppointment = await getAppointment(appointmentId);
				if (nextAppointment.id !== appointmentId) {
					setSelectedAppointmentId(null);
					return;
				}
				const [
					nextMessages,
					nextNotifications,
					nextEligibleStylists,
					nextProfile,
				] = await Promise.all([
					listAppointmentMessages(appointmentId),
					listAppointmentNotifications(appointmentId),
					listEligibleStylists(appointmentId),
					getCustomerProfile(nextAppointment.customerId),
				]);
				mergeAppointment(nextAppointment);
				setMessages((current) => ({
					...current,
					[appointmentId]: nextMessages,
				}));
				setNotifications((current) => ({
					...current,
					[appointmentId]: nextNotifications,
				}));
				setEligibleStylists((current) => ({
					...current,
					[appointmentId]: nextEligibleStylists,
				}));
				setCustomerProfiles((current) => ({
					...current,
					[nextProfile.customerId]: nextProfile,
				}));
			} catch (error) {
				setStatus(
					error instanceof Error
						? error.message
						: "Unable to load appointment detail",
				);
			}
		},
		[mergeAppointment],
	);

	const replaceAppointment = (updatedAppointment: Appointment) => {
		mergeAppointment(updatedAppointment, true);
	};

	// Replace just the appointment in the list, leaving the note/recap/feedback
	// drafts untouched — used by background polling so a refresh mid-edit doesn't
	// clobber what the stylist is typing.
	const replaceAppointmentInList = useCallback((updated: Appointment) => {
		setAppointments((current) =>
			current.map((appointment) =>
				appointment.id === updated.id ? updated : appointment,
			),
		);
	}, []);

	const runAppointmentAction = async (
		action: () => Promise<Appointment>,
		nextStatus: string,
		nextView?: DashboardView,
	) => {
		setIsLoading(true);
		try {
			const updatedAppointment = await action();
			replaceAppointment(updatedAppointment);
			if (nextView) {
				setActiveView(nextView);
			}
			setStatus(nextStatus);
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Unable to update appointment",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const saveNotes = async (appointment: Appointment) => {
		await runAppointmentAction(
			() =>
				updateSessionNotes(appointment.id, sessionNotes[appointment.id] ?? ""),
			"Session notes saved",
		);
		dirtySessionFields.current.sessionNotes.delete(appointment.id);
	};

	const completeSession = async (appointment: Appointment) => {
		await runAppointmentAction(
			() =>
				completeAppointment(appointment.id, {
					sessionNotes: sessionNotes[appointment.id] ?? "",
					customerRecap: customerRecaps[appointment.id] ?? "",
					associateFeedback: associateFeedbacks[appointment.id] ?? "",
				}),
			"Appointment marked complete",
			"completed",
		);
	};

	const checkIn = async (appointment: Appointment) => {
		await runAppointmentAction(
			() => checkInAppointment(appointment.id),
			"Appointment checked in",
			"in_progress",
		);
	};

	const noShow = async (appointment: Appointment) => {
		await runAppointmentAction(
			() => markNoShowAppointment(appointment.id),
			"Appointment marked no-show",
			"no_show",
		);
	};

	const reassign = async (appointment: Appointment, stylistId: string) => {
		if (stylistId === appointment.assignedStylist.id) return;
		await runAppointmentAction(
			() => reassignAppointmentStylist(appointment.id, stylistId),
			"Stylist reassigned",
		);
	};

	const regenerate = async (appointment: Appointment) => {
		setRegeneratingAppointmentId(appointment.id);
		setStatus("Regenerating suggestions...");
		await runAppointmentAction(
			() => regenerateSuggestions(appointment.id),
			"Suggestions regenerated",
		);
		setRegeneratingAppointmentId(null);
	};

	const saveCustomerFitProfile = async (
		customerId: string,
		profile: Pick<CurrentUser, "measurements" | "preferences">,
	) => {
		setIsLoading(true);
		try {
			const updatedProfile = await updateCustomerFitProfile(
				customerId,
				profile,
			);
			setCustomerProfiles((current) => ({
				...current,
				[customerId]: updatedProfile,
			}));
			setStatus("Fit profile saved");
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Unable to save fit profile",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const postMessage = async (appointment: Appointment) => {
		const draft = messageDrafts[appointment.id]?.trim() ?? "";
		if (!draft) return;

		setIsLoading(true);
		try {
			const message = await postAppointmentMessage(appointment.id, draft);
			setMessages((current) => ({
				...current,
				[appointment.id]: [...(current[appointment.id] ?? []), message],
			}));
			setMessageDrafts((current) => ({ ...current, [appointment.id]: "" }));
			setStatus("Message sent");
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Unable to send message",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const saveOutfitIntents = async (
		appointment: Appointment,
		analysis: OutfitAnalysis,
	) => {
		await runAppointmentAction(
			() => updateOutfitAnalysis(appointment.id, analysis, false),
			"Outfit intents saved — regenerate suggestions to apply",
		);
	};

	const updateProductPrep = async (
		appointment: Appointment,
		suggestion: SuggestedProduct,
		prepStatus: SuggestedProduct["prepStatus"],
		associateNote: string,
	) => {
		await runAppointmentAction(
			() =>
				updateSuggestedProductPrep(
					appointment.id,
					suggestion.product.productId,
					prepStatus,
					associateNote,
				),
			"Product prep updated",
		);
	};

	const changeView = useCallback((view: DashboardView) => {
		setActiveView(view);
		setSelectedAppointmentId(null);
	}, []);

	const onSessionNoteChange = useCallback(
		(appointmentId: string, value: string) => {
			dirtySessionFields.current.sessionNotes.add(appointmentId);
			setSessionNotes((current) => ({ ...current, [appointmentId]: value }));
		},
		[],
	);

	const onCustomerRecapChange = useCallback(
		(appointmentId: string, value: string) => {
			dirtySessionFields.current.customerRecaps.add(appointmentId);
			setCustomerRecaps((current) => ({ ...current, [appointmentId]: value }));
		},
		[],
	);

	const onAssociateFeedbackChange = useCallback(
		(appointmentId: string, value: string) => {
			dirtySessionFields.current.associateFeedbacks.add(appointmentId);
			setAssociateFeedbacks((current) => ({
				...current,
				[appointmentId]: value,
			}));
		},
		[],
	);

	const onMessageDraftChange = useCallback(
		(appointmentId: string, value: string) => {
			setMessageDrafts((current) => ({ ...current, [appointmentId]: value }));
		},
		[],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		params.set("view", activeView);
		if (selectedAppointmentId) {
			params.set("appointment", selectedAppointmentId);
		} else {
			params.delete("appointment");
		}
		const nextUrl = `${window.location.pathname}?${params.toString()}`;
		window.history.replaceState(null, "", nextUrl);
	}, [activeView, selectedAppointmentId]);

	const selectedAppointment =
		appointments.find(
			(appointment) => appointment.id === selectedAppointmentId,
		) ?? null;

	useEffect(() => {
		if (selectedAppointmentId) {
			void loadAppointmentMeta(selectedAppointmentId);
		}
	}, [loadAppointmentMeta, selectedAppointmentId]);

	useEffect(() => {
		if (!selectedAppointmentId) return;
		const interval = window.setInterval(() => {
			void loadAppointmentMeta(selectedAppointmentId);
		}, 5000);
		return () => window.clearInterval(interval);
	}, [loadAppointmentMeta, selectedAppointmentId]);

	// Suggestions are generated asynchronously after booking/regenerate. While the
	// selected appointment is 'pending', poll for the finished result. The effect
	// re-runs when the status flips (to 'ready'/'failed'), which clears the timer.
	useEffect(() => {
		if (selectedAppointment?.suggestionsStatus !== "pending") return;
		const appointmentId = selectedAppointment.id;
		let cancelled = false;
		const interval = setInterval(async () => {
			try {
				const updated = await getAppointment(appointmentId);
				if (!cancelled) replaceAppointmentInList(updated);
			} catch {
				// Transient error — keep polling; the next tick may succeed.
			}
		}, 2500);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [
		selectedAppointment?.id,
		selectedAppointment?.suggestionsStatus,
		replaceAppointmentInList,
	]);

	const counts = useMemo(
		() => ({
			open: appointments.filter(isOpenAppointment).length,
			in_progress: appointments.filter(
				(appointment) => appointment.status === "checked_in",
			).length,
			completed: appointments.filter(
				(appointment) => appointment.status === "completed",
			).length,
			cancelled: appointments.filter(
				(appointment) => appointment.status === "cancelled",
			).length,
			no_show: appointments.filter(
				(appointment) => appointment.status === "no_show",
			).length,
		}),
		[appointments],
	);

	const filteredAppointments = useMemo(
		() =>
			appointments
				.filter((appointment) => matchesView(appointment, activeView))
				.filter((appointment) => matchesFilters(appointment, filters))
				.sort((a, b) => compareAppointments(a, b, filters.dateOrder)),
		[appointments, activeView, filters],
	);

	return {
		status,
		isLoading,
		activeView,
		selectedAppointmentId,
		filters,
		stores,
		stylists,
		eligibleStylists,
		customerProfiles,
		filteredAppointments,
		counts,
		selectedAppointment,
		sessionNotes,
		customerRecaps,
		associateFeedbacks,
		messageDrafts,
		messages,
		notifications,
		setFilters,
		changeView,
		setSelectedAppointmentId,
		onSessionNoteChange,
		onCustomerRecapChange,
		onAssociateFeedbackChange,
		onMessageDraftChange,
		refresh,
		saveNotes,
		completeSession,
		checkIn,
		noShow,
		reassign,
		regenerate,
		postMessage,
		saveOutfitIntents,
		updateProductPrep,
		saveCustomerFitProfile,
		regeneratingAppointmentId,
	};
}
