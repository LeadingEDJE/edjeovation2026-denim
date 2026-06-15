import { CalendarClock, CheckCircle2, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	type Appointment,
	completeAppointment,
	listAppointments,
	updateSessionNotes,
} from "./api";
import "./styles.css";

const panelClass = "rounded-lg border border-line bg-surface p-[18px]";
const tagClass =
	"rounded-full bg-tag px-2 py-1 font-extrabold text-[0.8rem] text-accent";
const buttonBase =
	"inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-[9px] disabled:cursor-wait disabled:opacity-60";

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
				error instanceof Error
					? error.message
					: "Unable to complete appointment",
			);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return (
		<main className="min-h-screen p-[18px] min-[820px]:p-7">
			<header className="mx-auto mb-6 flex max-w-[1180px] items-center justify-between">
				<div>
					<p className="mb-1 font-bold text-[0.78rem] text-clay uppercase">
						AnF denim fitting
					</p>
					<h1 className="font-bold text-[clamp(2rem,4vw,3.25rem)] leading-none">
						Appointment prep dashboard
					</h1>
				</div>
				<button
					type="button"
					className="inline-flex size-[42px] cursor-pointer items-center justify-center rounded-full bg-ink text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
					onClick={refresh}
					disabled={isLoading}
					aria-label="Refresh appointments"
				>
					<RefreshCw size={18} />
				</button>
			</header>

			<section className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 min-[820px]:grid-cols-[minmax(240px,320px)_minmax(320px,1fr)]">
				<section
					className={`${panelClass} self-start`}
					data-testid="summary-panel"
				>
					<div className="mb-3 flex items-center justify-between gap-2">
						<div>
							<p className="mb-1 font-bold text-[0.78rem] text-clay uppercase">
								Booked journeys
							</p>
							<h2 className="font-semibold text-base">{appointments.length}</h2>
						</div>
						<CalendarClock size={24} />
					</div>
					<p className="text-[0.9rem] text-muted">{status}</p>
				</section>

				<section
					className={`${panelClass} min-h-[360px]`}
					data-testid="appointments-panel"
				>
					<div className="mb-3 flex items-center justify-between gap-2">
						<h2 className="font-semibold text-base">Stylist prep queue</h2>
						<span className="text-[0.9rem] text-muted">
							{appointments.length}
						</span>
					</div>
					<div className="grid gap-3" data-testid="appointment-list">
						{appointments.map((appointment) => (
							<article
								className="grid gap-3 rounded-lg border border-rowline p-3"
								key={appointment.id}
								data-testid="appointment-row"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="grid gap-0.5">
										<strong>{appointment.customerName}</strong>
										<span className="text-muted">
											{new Date(appointment.slotStart).toLocaleString()} with{" "}
											{appointment.assignedStylist.displayName}
										</span>
									</div>
									<span className="text-right text-muted">
										{appointment.status === "completed"
											? "Completed"
											: appointment.assignedStylist.title}
									</span>
								</div>
								<div className="flex flex-wrap gap-2">
									<span className={tagClass}>{appointment.museTag}</span>
									<span className={tagClass}>{appointment.occasion}</span>
									<span className={tagClass}>{appointment.status}</span>
								</div>
								<p className="text-muted">
									Focus: {appointment.focusColors || "None specified"} / Avoid:{" "}
									{appointment.avoidColors || "None specified"}
								</p>
								<p className="text-muted">
									Style signals: {appointment.styleKeywords.join(", ")}
								</p>
								<p className="text-muted">
									Order signal: {appointment.orderHistorySummary.denimItems}{" "}
									denim items, {appointment.orderHistorySummary.returnedItems}{" "}
									returns, preferred sizes{" "}
									{appointment.orderHistorySummary.preferredSizes.join(", ") ||
										"unknown"}
								</p>
								{appointment.guidance ? (
									<p className="text-muted">
										Customer note: {appointment.guidance}
									</p>
								) : null}
								<section className="grid gap-2 rounded-lg border border-suggestline border-dashed bg-suggest p-3">
									<div className="flex items-center justify-between">
										<strong>Suggested products</strong>
										<span className="min-w-[24px] rounded-full bg-ink px-2 py-0.5 text-center font-extrabold text-[0.78rem] text-white">
											{appointment.suggestedProducts.length}
										</span>
									</div>
									{appointment.suggestedProducts.length === 0 ? (
										<p className="text-[0.9rem] text-muted">
											No suggested products yet. This area is reserved for the
											product recommendation pipeline.
										</p>
									) : null}
								</section>
								<label className="grid gap-1.5">
									<span className="font-extrabold text-[0.85rem] text-ink">
										Associate session notes
									</span>
									<textarea
										className="min-h-24 w-full resize-y rounded-lg border border-line bg-surface p-2.5 text-ink focus:border-accent focus:outline-none"
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
								<div className="flex flex-wrap justify-end gap-2">
									<button
										type="button"
										className={`${buttonBase} border border-control bg-surface text-ink transition-colors hover:bg-canvas`}
										onClick={() => void saveNotes(appointment)}
										disabled={appointment.status === "completed" || isLoading}
									>
										<Save size={16} />
										Save notes
									</button>
									<button
										type="button"
										className={`${buttonBase} border border-ink bg-ink text-white transition-opacity hover:opacity-90`}
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
							<p
								className="text-[0.9rem] text-muted"
								data-testid="appointments-empty"
							>
								No guided appointments yet.
							</p>
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
