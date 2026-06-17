import { useCallback, useEffect, useMemo, useState } from "react";
import {
	type Appointment,
	type AppointmentMessage,
	type AppointmentNotification,
	checkInAppointment,
	completeAppointment,
	getAppointment,
	listAppointmentMessages,
	listAppointmentNotifications,
	listAppointments,
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

export function useAppointmentDashboard() {
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [stores, setStores] = useState<Store[]>([]);
	const [stylists, setStylists] = useState<StylistProfile[]>([]);
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
	const [activeView, setActiveView] = useState<DashboardView>("open");
	const [selectedAppointmentId, setSelectedAppointmentId] = useState<
		string | null
	>(null);
	const [status, setStatus] = useState("Loading appointments");
	const [isLoading, setIsLoading] = useState(false);

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
			setSessionNotes(
				Object.fromEntries(
					nextAppointments.map((appointment) => [
						appointment.id,
						appointment.sessionNotes,
					]),
				),
			);
			setCustomerRecaps(
				Object.fromEntries(
					nextAppointments.map((appointment) => [
						appointment.id,
						appointment.customerRecap,
					]),
				),
			);
			setAssociateFeedbacks(
				Object.fromEntries(
					nextAppointments.map((appointment) => [
						appointment.id,
						appointment.associateFeedback,
					]),
				),
			);
			setStatus("Appointments loaded");
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Unable to load appointments",
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const loadAppointmentMeta = useCallback(async (appointmentId: string) => {
		try {
			const [nextMessages, nextNotifications] = await Promise.all([
				listAppointmentMessages(appointmentId),
				listAppointmentNotifications(appointmentId),
			]);
			setMessages((current) => ({
				...current,
				[appointmentId]: nextMessages,
			}));
			setNotifications((current) => ({
				...current,
				[appointmentId]: nextNotifications,
			}));
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "Unable to load appointment detail",
			);
		}
	}, []);

	const replaceAppointment = (updatedAppointment: Appointment) => {
		setAppointments((current) =>
			current.map((appointment) =>
				appointment.id === updatedAppointment.id
					? updatedAppointment
					: appointment,
			),
		);
		setSessionNotes((current) => ({
			...current,
			[updatedAppointment.id]: updatedAppointment.sessionNotes,
		}));
		setCustomerRecaps((current) => ({
			...current,
			[updatedAppointment.id]: updatedAppointment.customerRecap,
		}));
		setAssociateFeedbacks((current) => ({
			...current,
			[updatedAppointment.id]: updatedAppointment.associateFeedback,
		}));
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
		setStatus("Regenerating suggestions...");
		await runAppointmentAction(
			() => regenerateSuggestions(appointment.id),
			"Suggestions regenerated",
		);
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
			setSessionNotes((current) => ({ ...current, [appointmentId]: value }));
		},
		[],
	);

	const onCustomerRecapChange = useCallback(
		(appointmentId: string, value: string) => {
			setCustomerRecaps((current) => ({ ...current, [appointmentId]: value }));
		},
		[],
	);

	const onAssociateFeedbackChange = useCallback(
		(appointmentId: string, value: string) => {
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

	const selectedAppointment =
		appointments.find(
			(appointment) => appointment.id === selectedAppointmentId,
		) ?? null;

	useEffect(() => {
		if (selectedAppointmentId && !selectedAppointment) {
			setSelectedAppointmentId(null);
		}
	}, [selectedAppointment, selectedAppointmentId]);

	useEffect(() => {
		if (selectedAppointment?.id) {
			void loadAppointmentMeta(selectedAppointment.id);
		}
	}, [loadAppointmentMeta, selectedAppointment?.id]);

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
	};
}
