import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	type Appointment,
	type AppointmentMessage,
	type AppointmentNotification,
	checkInAppointment,
	completeAppointment,
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
} from "./api";
import {
	AppointmentViewNav,
	DashboardHeader,
	dashboardViews,
} from "./components/AppointmentChrome";
import { AppointmentDetail } from "./components/AppointmentDetail";
import {
	type AppointmentFilters,
	AppointmentList,
} from "./components/AppointmentList";
import type { DashboardView } from "./types";
import "./styles.css";

const emptyFilters: AppointmentFilters = {
	storeId: "",
	date: "",
	dateOrder: "open_priority",
	stylistId: "",
	status: "",
};

function App() {
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
			setMessages((current) => ({ ...current, [appointmentId]: nextMessages }));
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

	const activeTitle =
		dashboardViews.find((view) => view.id === activeView)?.label ?? "Open";

	return (
		<main className="min-h-screen p-[18px] min-[820px]:p-7">
			<DashboardHeader
				status={status}
				isLoading={isLoading}
				onRefresh={() => void refresh()}
			/>

			<AppointmentViewNav
				activeView={activeView}
				counts={counts}
				onChange={(view) => {
					setActiveView(view);
					setSelectedAppointmentId(null);
				}}
			/>

			<section className="mx-auto max-w-[1180px]">
				{selectedAppointment ? (
					<AppointmentDetail
						appointment={selectedAppointment}
						stylists={stylists}
						messages={messages[selectedAppointment.id] ?? []}
						notifications={notifications[selectedAppointment.id] ?? []}
						isLoading={isLoading}
						sessionNote={sessionNotes[selectedAppointment.id] ?? ""}
						customerRecap={customerRecaps[selectedAppointment.id] ?? ""}
						associateFeedback={associateFeedbacks[selectedAppointment.id] ?? ""}
						messageDraft={messageDrafts[selectedAppointment.id] ?? ""}
						onBack={() => setSelectedAppointmentId(null)}
						onSessionNoteChange={(appointmentId, value) =>
							setSessionNotes((current) => ({
								...current,
								[appointmentId]: value,
							}))
						}
						onCustomerRecapChange={(appointmentId, value) =>
							setCustomerRecaps((current) => ({
								...current,
								[appointmentId]: value,
							}))
						}
						onAssociateFeedbackChange={(appointmentId, value) =>
							setAssociateFeedbacks((current) => ({
								...current,
								[appointmentId]: value,
							}))
						}
						onMessageDraftChange={(appointmentId, value) =>
							setMessageDrafts((current) => ({
								...current,
								[appointmentId]: value,
							}))
						}
						onSaveNotes={(appointment) => void saveNotes(appointment)}
						onCompleteSession={(appointment) =>
							void completeSession(appointment)
						}
						onRegenerate={(appointment) => void regenerate(appointment)}
						onSaveOutfitIntents={(appointment, analysis) =>
							void saveOutfitIntents(appointment, analysis)
						}
						onCheckIn={(appointment) => void checkIn(appointment)}
						onNoShow={(appointment) => void noShow(appointment)}
						onReassign={(appointment, stylistId) =>
							void reassign(appointment, stylistId)
						}
						onPostMessage={(appointment) => void postMessage(appointment)}
						onUpdateProductPrep={(
							appointment,
							suggestion,
							prepStatus,
							associateNote,
						) =>
							void updateProductPrep(
								appointment,
								suggestion,
								prepStatus,
								associateNote,
							)
						}
					/>
				) : (
					<AppointmentList
						activeTitle={activeTitle}
						appointments={filteredAppointments}
						filters={filters}
						stores={stores}
						stylists={stylists}
						onFilterChange={setFilters}
						onSelect={setSelectedAppointmentId}
					/>
				)}
			</section>
		</main>
	);
}

function isOpenAppointment(appointment: Appointment) {
	return (
		appointment.status === "scheduled" || appointment.status === "checked_in"
	);
}

function matchesView(appointment: Appointment, view: DashboardView) {
	switch (view) {
		case "open":
			return isOpenAppointment(appointment);
		case "in_progress":
			return appointment.status === "checked_in";
		case "completed":
			return appointment.status === "completed";
		case "cancelled":
			return appointment.status === "cancelled";
		case "no_show":
			return appointment.status === "no_show";
	}
}

function matchesFilters(appointment: Appointment, filters: AppointmentFilters) {
	if (filters.storeId && appointment.store.storeId !== filters.storeId) {
		return false;
	}
	if (
		filters.date &&
		new Date(appointment.slotStart).toISOString().slice(0, 10) !== filters.date
	) {
		return false;
	}
	if (
		filters.stylistId &&
		appointment.assignedStylist.id !== filters.stylistId
	) {
		return false;
	}
	if (filters.status && appointment.status !== filters.status) {
		return false;
	}
	return true;
}

function compareAppointments(
	a: Appointment,
	b: Appointment,
	dateOrder: AppointmentFilters["dateOrder"],
) {
	const aTime = new Date(a.slotStart).getTime();
	const bTime = new Date(b.slotStart).getTime();

	if (dateOrder === "oldest") {
		return aTime - bTime;
	}
	if (dateOrder === "newest") {
		return bTime - aTime;
	}

	const now = Date.now();
	const aFuture = aTime >= now;
	const bFuture = bTime >= now;

	if (aFuture !== bFuture) {
		return aFuture ? -1 : 1;
	}

	return aFuture ? aTime - bTime : bTime - aTime;
}

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element #root not found");
}
createRoot(rootElement).render(<App />);
