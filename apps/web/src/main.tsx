import { CalendarClock, CheckCircle2, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	completeAppointment,
	type Appointment,
	listAppointments,
	updateSessionNotes,
} from "./api";
import "./styles.css";

function App() {
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [sessionNotes, setSessionNotes] = useState<Record<string, string>>({});
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
			setStatus("Appointment marked complete");
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Unable to complete appointment",
			);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return (
		<main className="shell">
			<header className="topbar">
				<div>
					<p className="eyebrow">AnF denim fitting</p>
					<h1>Appointment prep dashboard</h1>
				</div>
				<button
					type="button"
					className="iconButton"
					onClick={refresh}
					disabled={isLoading}
					aria-label="Refresh appointments"
				>
					<RefreshCw size={18} />
				</button>
			</header>

			<section className="workspace">
				<section className="panel summaryPanel">
					<div className="panelHeader">
						<div>
							<p className="eyebrow">Booked journeys</p>
							<h2>{appointments.length}</h2>
						</div>
						<CalendarClock size={24} />
					</div>
					<p className="status">{status}</p>
				</section>

				<section className="panel appointmentsPanel">
					<div className="panelHeader">
						<h2>Stylist prep queue</h2>
						<span>{appointments.length}</span>
					</div>
					<div className="appointmentList">
						{appointments.map((appointment) => (
							<article className="appointmentRow" key={appointment.id}>
								<div className="appointmentHeading">
									<div>
										<strong>{appointment.customerName}</strong>
										<span>
											{new Date(appointment.slotStart).toLocaleString()} with{" "}
											{appointment.assignedStylist.displayName}
										</span>
									</div>
									<span className="stylistTitle">
										{appointment.status === "completed"
											? "Completed"
											: appointment.assignedStylist.title}
									</span>
								</div>
								<div className="prepTags">
									<span>{appointment.museTag}</span>
									<span>{appointment.occasion}</span>
									<span>{appointment.status}</span>
								</div>
								<p>
									Focus: {appointment.focusColors || "None specified"} / Avoid:{" "}
									{appointment.avoidColors || "None specified"}
								</p>
								<p>
									Style signals: {appointment.styleKeywords.join(", ")}
								</p>
								<p>
									Order signal: {appointment.orderHistorySummary.denimItems} denim
									items, {appointment.orderHistorySummary.returnedItems} returns,
									preferred sizes{" "}
									{appointment.orderHistorySummary.preferredSizes.join(", ") ||
										"unknown"}
								</p>
								{appointment.guidance ? (
									<p>Customer note: {appointment.guidance}</p>
								) : null}
								<section className="suggestedProducts">
									<div className="sectionHeader">
										<strong>Suggested products</strong>
										<span>{appointment.suggestedProducts.length}</span>
									</div>
									{appointment.suggestedProducts.length === 0 ? (
										<p className="empty">
											No suggested products yet. This area is reserved for the
											product recommendation pipeline.
										</p>
									) : null}
								</section>
								<label className="notesField">
									<span>Associate session notes</span>
									<textarea
										value={sessionNotes[appointment.id] ?? ""}
										onChange={(event) =>
											setSessionNotes((current) => ({
												...current,
												[appointment.id]: event.target.value,
											}))
										}
										disabled={appointment.status === "completed" || isLoading}
										placeholder="Summarize fit feedback, products tried, and follow-up recommendations."
									/>
								</label>
								<div className="rowActions">
									<button
										type="button"
										className="secondaryButton"
										onClick={() => void saveNotes(appointment)}
										disabled={appointment.status === "completed" || isLoading}
									>
										<Save size={16} />
										Save notes
									</button>
									<button
										type="button"
										className="primaryButton"
										onClick={() => void completeSession(appointment)}
										disabled={appointment.status === "completed" || isLoading}
									>
										<CheckCircle2 size={16} />
										Mark complete
									</button>
								</div>
							</article>
						))}
						{appointments.length === 0 ? (
							<p className="empty">No guided appointments yet.</p>
						) : null}
					</div>
				</section>
			</section>
		</main>
	);
}

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element #root not found");
}
createRoot(rootElement).render(<App />);
