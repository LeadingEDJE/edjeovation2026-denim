import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	type Appointment,
	completeAppointment,
	listAppointments,
	regenerateSuggestions,
	updateSessionNotes,
} from "./api";
import {
	AppointmentViewNav,
	DashboardHeader,
	dashboardViews,
} from "./components/AppointmentChrome";
import { AppointmentDetail } from "./components/AppointmentDetail";
import { AppointmentList } from "./components/AppointmentList";
import type { DashboardView } from "./types";
import "./styles.css";

function App() {
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [sessionNotes, setSessionNotes] = useState<Record<string, string>>({});
	const [activeView, setActiveView] = useState<DashboardView>("upcoming");
	const [selectedAppointmentId, setSelectedAppointmentId] = useState<
		string | null
	>(null);
	const [status, setStatus] = useState("Loading appointments");
	const [isLoading, setIsLoading] = useState(false);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			const nextAppointments = await listAppointments();
			setAppointments(nextAppointments);
			setSessionNotes(
				Object.fromEntries(
					nextAppointments.map((appointment) => [
						appointment.id,
						appointment.sessionNotes,
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
	};

	const saveNotes = async (appointment: Appointment) => {
		setIsLoading(true);
		try {
			const updatedAppointment = await updateSessionNotes(
				appointment.id,
				sessionNotes[appointment.id] ?? "",
			);
			replaceAppointment(updatedAppointment);
			setStatus("Session notes saved");
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Unable to save session notes",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const completeSession = async (appointment: Appointment) => {
		setIsLoading(true);
		try {
			const updatedAppointment = await completeAppointment(
				appointment.id,
				sessionNotes[appointment.id] ?? "",
			);
			replaceAppointment(updatedAppointment);
			setActiveView("completed");
			setStatus("Appointment marked complete");
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "Unable to complete appointment",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const regenerate = async (appointment: Appointment) => {
		setIsLoading(true);
		setStatus("Regenerating suggestions…");
		try {
			const updatedAppointment = await regenerateSuggestions(appointment.id);
			replaceAppointment(updatedAppointment);
			setStatus("Suggestions regenerated");
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "Unable to regenerate suggestions",
			);
		} finally {
			setIsLoading(false);
		}
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

	const counts = useMemo(
		() => ({
			upcoming: appointments.filter(isUpcomingAppointment).length,
			completed: appointments.filter(
				(appointment) => appointment.status === "completed",
			).length,
			cancelled: appointments.filter(
				(appointment) => appointment.status === "cancelled",
			).length,
		}),
		[appointments],
	);

	const filteredAppointments = useMemo(
		() =>
			appointments.filter((appointment) =>
				matchesView(appointment, activeView),
			),
		[appointments, activeView],
	);

	const activeTitle =
		dashboardViews.find((view) => view.id === activeView)?.label ?? "Upcoming";

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
						isLoading={isLoading}
						sessionNote={sessionNotes[selectedAppointment.id] ?? ""}
						onBack={() => setSelectedAppointmentId(null)}
						onSessionNoteChange={(appointmentId, value) =>
							setSessionNotes((current) => ({
								...current,
								[appointmentId]: value,
							}))
						}
						onSaveNotes={(appointment) => void saveNotes(appointment)}
						onCompleteSession={(appointment) =>
							void completeSession(appointment)
						}
						onRegenerate={(appointment) => void regenerate(appointment)}
					/>
				) : (
					<AppointmentList
						activeTitle={activeTitle}
						appointments={filteredAppointments}
						onSelect={setSelectedAppointmentId}
					/>
				)}
			</section>
		</main>
	);
}

function isUpcomingAppointment(appointment: Appointment) {
	return (
		appointment.status === "scheduled" &&
		new Date(appointment.slotStart) >= new Date()
	);
}

function matchesView(appointment: Appointment, view: DashboardView) {
	switch (view) {
		case "upcoming":
			return isUpcomingAppointment(appointment);
		case "completed":
			return appointment.status === "completed";
		case "cancelled":
			return appointment.status === "cancelled";
	}
}

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element #root not found");
}
createRoot(rootElement).render(<App />);
