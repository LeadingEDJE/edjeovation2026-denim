import { useEffect, useState } from "react";
import type {
	Appointment,
	OutfitAnalysis,
	OutfitGarment,
	OutfitIntent,
} from "../../api";
import { Chips, MetaLabel, SectionTitle, Stat, SwatchRow } from "./shared";

const INTENT_LABELS: Record<OutfitIntent, string> = {
	complement: "Complement",
	similar: "Find similar",
	ignore: "Ignore",
};

function OutfitMatchBlock({
	analysis,
	onSave,
}: {
	analysis: OutfitAnalysis;
	onSave?: (analysis: OutfitAnalysis) => void;
}) {
	const source =
		analysis.engine === "manual"
			? "Described by customer"
			: "From customer photo · AI analysis";

	const editable = Boolean(onSave);
	const [garments, setGarments] = useState<OutfitGarment[]>(analysis.garments);
	useEffect(() => setGarments(analysis.garments), [analysis]);

	const dirty = garments.some(
		(g, i) => g.intent !== analysis.garments[i]?.intent,
	);

	const setIntent = (index: number, intent: OutfitIntent) =>
		setGarments((current) =>
			current.map((g, i) => (i === index ? { ...g, intent } : g)),
		);

	return (
		<div className="mt-7">
			<SectionTitle>Outfit To Match</SectionTitle>

			<p className="mb-3 font-bold text-2xs text-muted uppercase tracking-label">
				{source}
			</p>

			{analysis.pairingContext && (
				<p className="mb-4 border-ink border-l-[3px] bg-surface-subtle px-3.5 py-3 text-[14px] text-body leading-relaxed">
					{analysis.pairingContext}
				</p>
			)}

			{garments.length > 0 && (
				<>
					<MetaLabel>Pieces</MetaLabel>
					<ul className="mb-3 space-y-2">
						{garments.map((garment, index) => (
							<li
								key={`${garment.type}-${garment.colors.join("-")}-${garment.material ?? ""}`}
								className="text-[14px] text-body leading-relaxed"
							>
								<span className="block">
									{garment.type}
									{garment.colors.length > 0
										? ` — ${garment.colors.join(", ")}`
										: ""}
									{garment.material ? ` · ${garment.material}` : ""}
								</span>
								{editable ? (
									<select
										className="mt-1 border border-line bg-surface px-2 py-1 text-[13px] text-ink"
										value={garment.intent}
										onChange={(e) =>
											setIntent(index, e.target.value as OutfitIntent)
										}
									>
										{(
											["complement", "similar", "ignore"] as OutfitIntent[]
										).map((intent) => (
											<option key={intent} value={intent}>
												{INTENT_LABELS[intent]}
											</option>
										))}
									</select>
								) : (
									<span className="text-[12px] text-muted uppercase tracking-label">
										{INTENT_LABELS[garment.intent]}
									</span>
								)}
							</li>
						))}
					</ul>
					{editable && (
						<div className="mb-4">
							<button
								type="button"
								className="border border-ink px-3 py-1.5 font-bold text-2xs text-ink uppercase tracking-label disabled:opacity-40"
								disabled={!dirty}
								onClick={() => onSave?.({ ...analysis, garments })}
							>
								Save intents
							</button>
							<p className="mt-1.5 text-[11px] text-muted">
								Save, then Regenerate suggestions to apply.
							</p>
						</div>
					)}
				</>
			)}

			{analysis.styleSummary && (
				<>
					<MetaLabel>Stylist read</MetaLabel>
					<p className="mb-4 text-[14px] text-body leading-relaxed">
						{analysis.styleSummary}
					</p>
				</>
			)}

			{analysis.suggestedFocusColors.length > 0 && (
				<>
					<MetaLabel>Suggested focus colors</MetaLabel>
					<div className="mb-4">
						<SwatchRow value={analysis.suggestedFocusColors.join(", ")} />
					</div>
				</>
			)}

			{analysis.suggestedStyleKeywords.length > 0 && (
				<>
					<MetaLabel>Suggested style signals</MetaLabel>
					<div className="mb-4">
						<Chips items={analysis.suggestedStyleKeywords} />
					</div>
				</>
			)}
		</div>
	);
}

export function catalogAudienceLabel(audiences: string[] | undefined | null) {
	// Defend against records that predate the catalog_audiences field (or any
	// response that omits it) — default to the womens catalog rather than crashing
	// the whole detail view.
	if (!audiences || audiences.length === 0) return "Womens";
	if (audiences.includes("womens") && audiences.includes("mens")) {
		return "Womens + Mens";
	}
	if (audiences.includes("mens")) return "Mens";
	return "Womens";
}

export function CustomerSnapshot({
	appointment,
	onSaveOutfitIntents,
}: {
	appointment: Appointment;
	onSaveOutfitIntents?: (analysis: OutfitAnalysis) => void;
}) {
	const order = appointment.orderHistorySummary;
	return (
		<>
			<SectionTitle>Customer Preferences</SectionTitle>

			<MetaLabel>Focus colors</MetaLabel>
			<div className="mb-4">
				<SwatchRow value={appointment.focusColors} />
			</div>

			<MetaLabel>Avoid</MetaLabel>
			<div className="mb-4">
				<SwatchRow value={appointment.avoidColors} />
			</div>

			<MetaLabel>Style signals</MetaLabel>
			<div className="mb-4">
				<Chips items={appointment.styleKeywords} />
			</div>

			<MetaLabel>Catalog</MetaLabel>
			<p className="mb-4 text-[14px] text-body">
				{catalogAudienceLabel(appointment.catalogAudiences)}
			</p>

			<MetaLabel>Customer note</MetaLabel>
			<p className="border-ink border-l-[3px] bg-surface-subtle px-3.5 py-3 text-[14px] text-body leading-relaxed">
				{appointment.guidance ? `"${appointment.guidance}"` : "None provided"}
			</p>

			{appointment.outfitAnalysis && (
				<OutfitMatchBlock
					analysis={appointment.outfitAnalysis}
					onSave={onSaveOutfitIntents}
				/>
			)}

			<div className="mt-7">
				<SectionTitle>Order Signal</SectionTitle>
			</div>
			<div className="grid grid-cols-2 gap-px border border-line-subtle bg-line-subtle">
				<Stat value={String(order.totalOrders)} label="Total orders" />
				<Stat value={String(order.denimItems)} label="Denim items" />
				<Stat value={String(order.returnedItems)} label="Returns" />
				<Stat value={order.preferredSizes[0] ?? "—"} label="Preferred size" />
			</div>
		</>
	);
}
