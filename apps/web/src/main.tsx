import { RefreshCw, Ruler, Send, Sparkles } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	type CatalogRecommendations,
	createSession,
	type DenimRecommendation,
	type FittingInput,
	type FittingSession,
	getCatalogRecommendations,
	listSessions,
} from "./api";
import "./styles.css";

const initialInput: FittingInput = {
	customerName: "Avery",
	heightInches: 67,
	waistInches: 29,
	hipInches: 39,
	inseamInches: 30,
	fitPreference: "straight",
	stretchPreference: "comfort-stretch",
};

function App() {
	const [sessions, setSessions] = useState<FittingSession[]>([]);
	const [input, setInput] = useState<FittingInput>(initialInput);
	const [recommendation, setRecommendation] =
		useState<DenimRecommendation | null>(null);
	const [catalog, setCatalog] = useState<CatalogRecommendations | null>(null);
	const [status, setStatus] = useState("Ready");
	const [isLoading, setIsLoading] = useState(false);

	const latestSession = useMemo(() => sessions[0], [sessions]);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			setSessions(await listSessions());
			setStatus("Sessions loaded");
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Unable to load sessions",
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setIsLoading(true);
		try {
			// Existing WireMock-backed session + the catalog-backed engine in parallel.
			const [result, catalogResult] = await Promise.all([
				createSession(input),
				getCatalogRecommendations(input),
			]);
			setRecommendation(result.recommendation);
			setCatalog(catalogResult);
			setSessions((current) => [result.session, ...current]);
			setStatus(`Recommendation created · ${catalogResult.engine} engine`);
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "Unable to create recommendation",
			);
		} finally {
			setIsLoading(false);
		}
	}

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return (
		<main className="shell">
			<header className="topbar">
				<div>
					<p className="eyebrow">AnF denim fitting</p>
					<h1>Fit experience console</h1>
				</div>
				<button
					type="button"
					className="iconButton"
					onClick={refresh}
					disabled={isLoading}
					aria-label="Refresh sessions"
				>
					<RefreshCw size={18} />
				</button>
			</header>

			<section className="workspace">
				<form className="panel formPanel" onSubmit={submit}>
					<div className="panelHeader">
						<Ruler size={18} />
						<h2>New fitting</h2>
					</div>

					<label>
						Customer
						<input
							value={input.customerName}
							onChange={(event) =>
								setInput({ ...input, customerName: event.target.value })
							}
						/>
					</label>

					<div className="gridFields">
						<NumberField
							label="Height"
							value={input.heightInches}
							onChange={(heightInches) => setInput({ ...input, heightInches })}
						/>
						<NumberField
							label="Waist"
							value={input.waistInches}
							onChange={(waistInches) => setInput({ ...input, waistInches })}
						/>
						<NumberField
							label="Hip"
							value={input.hipInches}
							onChange={(hipInches) => setInput({ ...input, hipInches })}
						/>
						<NumberField
							label="Inseam"
							value={input.inseamInches}
							onChange={(inseamInches) => setInput({ ...input, inseamInches })}
						/>
					</div>

					<label>
						Fit
						<select
							value={input.fitPreference}
							onChange={(event) =>
								setInput({
									...input,
									fitPreference: event.target
										.value as FittingInput["fitPreference"],
								})
							}
						>
							<option value="skinny">Skinny</option>
							<option value="slim">Slim</option>
							<option value="straight">Straight</option>
							<option value="relaxed">Relaxed</option>
							<option value="wide">Wide</option>
						</select>
					</label>

					<label>
						Stretch
						<select
							value={input.stretchPreference}
							onChange={(event) =>
								setInput({
									...input,
									stretchPreference: event.target
										.value as FittingInput["stretchPreference"],
								})
							}
						>
							<option value="rigid">Rigid</option>
							<option value="comfort-stretch">Comfort stretch</option>
							<option value="high-stretch">High stretch</option>
						</select>
					</label>

					<button type="submit" className="primaryButton" disabled={isLoading}>
						<Send size={16} />
						Create recommendation
					</button>
					<p className="status">{status}</p>
				</form>

				<section className="panel resultPanel">
					<div className="panelHeader">
						<h2>Recommendation</h2>
					</div>
					{recommendation ? (
						<div className="recommendation">
							<strong>{recommendation.styleName}</strong>
							<span>{recommendation.sizeLabel}</span>
							<meter min="0" max="1" value={recommendation.confidence} />
							<p>{recommendation.rationale}</p>
						</div>
					) : (
						<p className="empty">
							Create a fitting session to see a WireMock-backed recommendation.
						</p>
					)}
				</section>

				<section className="panel catalogPanel">
					<div className="panelHeader">
						<Sparkles size={18} />
						<h2>Catalog matches</h2>
						{catalog ? (
							<span className={`engineBadge ${catalog.engine}`}>
								{catalog.engine === "claude"
									? "Claude re-ranked"
									: "Rule-based"}
							</span>
						) : null}
					</div>
					{catalog ? (
						<>
							<p className="catalogSummary">{catalog.summary}</p>
							<div className="catalogList">
								{catalog.recommendations.map((rec) => (
									<article className="catalogMatch" key={rec.rank}>
										<span className="rank">#{rec.rank}</span>
										<div className="matchBody">
											<a
												href={rec.product?.productUrl}
												target="_blank"
												rel="noreferrer"
											>
												{rec.product?.name ?? "Unknown product"}
											</a>
											<small className="matchMeta">
												{[
													rec.product?.fit,
													rec.product?.rise,
													rec.product?.stretch,
												]
													.filter(Boolean)
													.join(" · ")}
												{rec.product?.price != null
													? ` · $${rec.product.price}`
													: ""}
											</small>
											<p className="matchRationale">{rec.rationale}</p>
										</div>
										{rec.score != null ? (
											<span className="matchScore">{rec.score.toFixed(2)}</span>
										) : null}
									</article>
								))}
							</div>
							<small className="catalogFootnote">
								{catalog.candidatesConsidered} catalog items considered
							</small>
						</>
					) : (
						<p className="empty">
							Create a fitting session to see catalog-backed matches.
						</p>
					)}
				</section>

				<section className="panel sessionsPanel">
					<div className="panelHeader">
						<h2>Recent sessions</h2>
						{latestSession ? <span>{sessions.length}</span> : null}
					</div>
					<div className="sessionList">
						{sessions.map((session) => (
							<article className="sessionRow" key={session.id}>
								<strong>{session.customerName}</strong>
								<span>
									{session.fitPreference} / {session.stretchPreference}
								</span>
								<small>{new Date(session.createdAt).toLocaleString()}</small>
							</article>
						))}
						{sessions.length === 0 ? (
							<p className="empty">No sessions yet.</p>
						) : null}
					</div>
				</section>
			</section>
		</main>
	);
}

function NumberField(props: {
	label: string;
	value: number;
	onChange: (value: number) => void;
}) {
	return (
		<label>
			{props.label}
			<input
				type="number"
				step="0.5"
				value={props.value}
				onChange={(event) => props.onChange(Number(event.target.value))}
			/>
		</label>
	);
}

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element #root not found");
}
createRoot(rootElement).render(<App />);
