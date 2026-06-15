import { CalendarClock, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	type Appointment,
	type AppointmentRecommendations,
	getAppointmentRecommendations,
	listAppointments,
} from "./api";
import "./styles.css";

function App() {
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [status, setStatus] = useState("Loading appointments");
	const [isLoading, setIsLoading] = useState(false);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			const nextAppointments = await listAppointments();
			setAppointments(nextAppointments);
			setStatus("Appointments loaded");
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Unable to load appointments",
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

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
							<AppointmentCard key={appointment.id} appointment={appointment} />
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

function AppointmentCard({ appointment }: { appointment: Appointment }) {
	const [recs, setRecs] = useState<AppointmentRecommendations | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function loadSuggestions() {
		setLoading(true);
		setError(null);
		try {
			setRecs(await getAppointmentRecommendations(appointment.id));
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Unable to load suggestions",
			);
		} finally {
			setLoading(false);
		}
	}

	return (
		<article className="appointmentRow">
			<div className="appointmentHeading">
				<div>
					<strong>{appointment.customerName}</strong>
					<span>
						{new Date(appointment.slotStart).toLocaleString()} with{" "}
						{appointment.assignedStylist.displayName}
					</span>
				</div>
				<span className="stylistTitle">
					{appointment.assignedStylist.title}
				</span>
			</div>
			<div className="prepTags">
				<span>{appointment.museTag}</span>
				<span>{appointment.occasion}</span>
			</div>
			<p>
				Focus: {appointment.focusColors || "None specified"} / Avoid:{" "}
				{appointment.avoidColors || "None specified"}
			</p>
			<p>Style signals: {appointment.styleKeywords.join(", ")}</p>
			<p>
				Order signal: {appointment.orderHistorySummary.denimItems} denim items,{" "}
				{appointment.orderHistorySummary.returnedItems} returns, preferred sizes{" "}
				{appointment.orderHistorySummary.preferredSizes.join(", ") || "unknown"}
			</p>
			{appointment.guidance ? <p>{appointment.guidance}</p> : null}

			<div className="suggestions">
				<div className="suggestionsHeader">
					<Sparkles size={14} />
					<span>Suggested denim</span>
					{recs ? (
						<span className={`engineBadge ${recs.engine}`}>
							{recs.engine === "claude" ? "Claude re-ranked" : "Rule-based"}
						</span>
					) : null}
				</div>
				{recs ? (
					<>
						<p className="suggestionSummary">{recs.summary}</p>
						<ol className="suggestionList">
							{recs.recommendations.map((rec) => (
								<li key={rec.rank}>
									<a
										href={rec.product?.productUrl}
										target="_blank"
										rel="noreferrer"
									>
										{rec.product?.name ?? "Unknown product"}
									</a>
									<small>
										{[rec.product?.fit, rec.product?.rise, rec.product?.stretch]
											.filter(Boolean)
											.join(" · ")}
										{rec.product?.price != null
											? ` · $${rec.product.price}`
											: ""}
									</small>
									<p>{rec.rationale}</p>
								</li>
							))}
						</ol>
					</>
				) : (
					<button
						type="button"
						className="suggestButton"
						onClick={loadSuggestions}
						disabled={loading}
					>
						{loading ? "Finding denim…" : "Suggest denim"}
					</button>
				)}
				{error ? <p className="empty">{error}</p> : null}
			</div>
		</article>
	);
}

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element #root not found");
}
createRoot(rootElement).render(<App />);
