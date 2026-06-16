import { Button, Rating } from "@denim-fit/design-system";
import {
	CheckCircle2,
	ChevronLeft,
	Save,
	Sparkles,
	UserCheck,
	UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
	Appointment,
	AppointmentMessage,
	AppointmentNotification,
	CatalogProduct,
	OutfitAnalysis,
	OutfitGarment,
	OutfitIntent,
	StylistProfile,
	SuggestedProduct,
} from "../api";
import {
	colorNameToHex,
	formatAppointmentDateTime,
	initials,
	splitColorList,
	statusLabel,
} from "../formatters";

type AppointmentDetailProps = {
	appointment: Appointment;
	stylists: StylistProfile[];
	messages: AppointmentMessage[];
	notifications: AppointmentNotification[];
	isLoading: boolean;
	sessionNote: string;
	customerRecap: string;
	associateFeedback: string;
	messageDraft: string;
	onBack: () => void;
	onSessionNoteChange: (appointmentId: string, value: string) => void;
	onCustomerRecapChange: (appointmentId: string, value: string) => void;
	onAssociateFeedbackChange: (appointmentId: string, value: string) => void;
	onMessageDraftChange: (appointmentId: string, value: string) => void;
	onSaveNotes: (appointment: Appointment) => void;
	onCompleteSession: (appointment: Appointment) => void;
	onRegenerate: (appointment: Appointment) => void;
	onCheckIn: (appointment: Appointment) => void;
	onNoShow: (appointment: Appointment) => void;
	onReassign: (appointment: Appointment, stylistId: string) => void;
	onPostMessage: (appointment: Appointment) => void;
	onSaveOutfitIntents: (
		appointment: Appointment,
		analysis: OutfitAnalysis,
	) => void;
	onUpdateProductPrep: (
		appointment: Appointment,
		suggestion: SuggestedProduct,
		prepStatus: SuggestedProduct["prepStatus"],
		associateNote: string,
	) => void;
};

export function AppointmentDetail(props: AppointmentDetailProps) {
	const { appointment, isLoading, onBack } = props;
	const interactive = isActiveAppointment(appointment);

	return (
		<section className="rounded-none border border-line bg-surface">
			<DetailTopBar
				appointment={appointment}
				interactive={interactive}
				onBack={onBack}
			/>
			{interactive ? (
				<InteractiveDetail {...props} canEdit={interactive && !isLoading} />
			) : (
				<RecapDetail appointment={appointment} stylists={props.stylists} />
			)}
		</section>
	);
}

function isActiveAppointment(appointment: Appointment) {
	return (
		appointment.status === "scheduled" || appointment.status === "checked_in"
	);
}

function shortRef(appointment: Appointment) {
	return `#${appointment.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function formatPrice(price: number | null, currency: string | null) {
	if (price == null) {
		return null;
	}
	return `${currency ?? "$"}${price.toFixed(2)}`;
}

function specLine(product: CatalogProduct) {
	return [product.category, product.fit, product.rise, product.stretch]
		.filter(Boolean)
		.join(" · ");
}

/* ------------------------------------------------------------------ chrome */

function DetailTopBar({
	appointment,
	interactive,
	onBack,
}: {
	appointment: Appointment;
	interactive: boolean;
	onBack: () => void;
}) {
	const closedTone =
		appointment.status === "completed"
			? { border: "border-success", dot: "bg-success", text: "text-success" }
			: { border: "border-sale", dot: "bg-sale", text: "text-sale" };
	return (
		<div className="flex items-center justify-between gap-3 border-line-subtle border-b px-5 py-4 min-[760px]:px-8">
			<button
				type="button"
				className="flex items-center gap-1.5 text-ink transition-colors hover:text-ink-deep"
				onClick={onBack}
			>
				<ChevronLeft size={18} />
				<span className="font-bold text-2xs uppercase tracking-label">
					Back to queue
				</span>
			</button>
			{interactive ? (
				<div className="flex items-center gap-2">
					<span className="block h-[7px] w-[7px] bg-navy" />
					<span className="font-bold text-2xs text-body uppercase tracking-label">
						{statusLabel(appointment.status)}
					</span>
				</div>
			) : (
				<div className="flex items-center gap-3">
					<span className="hidden text-[11px] text-muted min-[760px]:inline">
						Read-only — session closed
					</span>
					<span
						className={`flex items-center gap-2 border px-3 py-1 ${closedTone.border}`}
					>
						<span className={`block h-[7px] w-[7px] ${closedTone.dot}`} />
						<span
							className={`font-bold text-2xs uppercase tracking-label ${closedTone.text}`}
						>
							{statusLabel(appointment.status)}
						</span>
					</span>
				</div>
			)}
		</div>
	);
}

/* ----------------------------------------------------------- shared pieces */

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<div className="mb-4">
			<p className="font-display font-semibold text-[13px] text-ink uppercase tracking-label">
				{children}
			</p>
			<span className="mt-1 block h-0.5 w-[34px] bg-ink" />
		</div>
	);
}

function MetaLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="mb-2 font-bold text-2xs text-muted uppercase tracking-label">
			{children}
		</p>
	);
}

function Chips({ items }: { items: string[] }) {
	if (items.length === 0) {
		return null;
	}
	return (
		<div className="flex flex-wrap gap-1.5">
			{items.map((item) => (
				<span key={item} className="bg-chip px-2.5 py-1 text-[11px] text-navy">
					{item}
				</span>
			))}
		</div>
	);
}

function SwatchRow({ value }: { value: string }) {
	const items = splitColorList(value);
	if (items.length === 0) {
		return <p className="text-[13px] text-muted">None specified</p>;
	}
	return (
		<div className="flex flex-wrap gap-x-4 gap-y-2">
			{items.map((name) => (
				<span key={name} className="flex items-center gap-2">
					<span
						className="block h-4 w-4 border border-line-subtle"
						style={{ backgroundColor: colorNameToHex(name) }}
					/>
					<span className="text-[13px] text-ink">{name}</span>
				</span>
			))}
		</div>
	);
}

function Stat({ value, label }: { value: string; label: string }) {
	return (
		<div className="bg-surface px-4 py-3.5">
			<p className="font-display font-semibold text-[26px] text-ink leading-none">
				{value}
			</p>
			<p className="mt-1.5 font-bold text-2xs text-muted uppercase tracking-label">
				{label}
			</p>
		</div>
	);
}

/** Left-column customer snapshot — preferences + order signal, used by both frames. */
function CustomerSnapshot({
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

			<MetaLabel>Customer note</MetaLabel>
			<p className="border-ink border-l-[3px] bg-surface-subtle px-3.5 py-3 text-[14px] text-body leading-relaxed">
				{appointment.guidance ? `“${appointment.guidance}”` : "None provided"}
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

const INTENT_LABELS: Record<OutfitIntent, string> = {
	complement: "Complement",
	similar: "Find similar",
	ignore: "Ignore",
};

/**
 * Summary of an outfit the customer wants to build around (from a photo or typed
 * manually). Text only — the photo is never stored or shown. When `onSave` is
 * provided (active appointments), the stylist can change each piece's intent and
 * save it; suggestions are re-applied via the separate Regenerate action.
 */
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
	// Re-seed when a new analysis arrives (e.g. after save/regenerate).
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

function ProductShot({ suggestion }: { suggestion: SuggestedProduct }) {
	const { imageUrl, name, productUrl } = suggestion.product;
	return (
		<a
			className="block h-[100px] w-[78px] shrink-0 overflow-hidden border border-line-subtle bg-surface"
			href={productUrl}
			target="_blank"
			rel="noreferrer"
		>
			{imageUrl ? (
				<img
					className="h-full w-full object-cover"
					src={imageUrl}
					alt={name}
					loading="lazy"
				/>
			) : (
				<span
					className="flex h-full w-full items-end justify-center pb-1.5"
					style={{
						backgroundImage:
							"repeating-linear-gradient(135deg,#2c4a63,#2c4a63 3px,#27455c 3px,#27455c 6px)",
					}}
				>
					<span className="font-mono text-[7px] text-steel tracking-[0.08em]">
						PRODUCT SHOT
					</span>
				</span>
			)}
		</a>
	);
}

/* ------------------------------------------------------- interactive frame */

type InteractiveProps = AppointmentDetailProps & { canEdit: boolean };

function InteractiveDetail({
	appointment,
	stylists,
	messages,
	notifications,
	isLoading,
	sessionNote,
	customerRecap,
	associateFeedback,
	messageDraft,
	canEdit,
	onSessionNoteChange,
	onCustomerRecapChange,
	onAssociateFeedbackChange,
	onMessageDraftChange,
	onSaveNotes,
	onCompleteSession,
	onRegenerate,
	onCheckIn,
	onNoShow,
	onReassign,
	onPostMessage,
	onSaveOutfitIntents,
	onUpdateProductPrep,
}: InteractiveProps) {
	const stylist = appointment.assignedStylist;
	const sameStoreStylists = stylists.filter(
		(candidate) => candidate.store.storeId === appointment.store.storeId,
	);
	const captureUnlocked = appointment.status === "checked_in" && !isLoading;
	const canSchedule = appointment.status === "scheduled" && !isLoading;
	const completeLabel =
		appointment.status === "scheduled"
			? "Complete · check in first"
			: "Complete";
	const heroAction =
		"inline-flex flex-1 items-center justify-center gap-2 px-5 py-3 font-bold text-2xs uppercase tracking-label transition-colors disabled:cursor-not-allowed disabled:opacity-50 min-[760px]:flex-none";

	return (
		<>
			{/* hero */}
			<div className="flex flex-col gap-5 bg-ink px-5 py-7 text-white min-[760px]:flex-row min-[760px]:items-start min-[760px]:justify-between min-[760px]:px-8">
				<div className="min-w-0 flex-1">
					<p className="font-bold text-2xs text-steel uppercase tracking-label">
						Appointment · {shortRef(appointment)}
					</p>
					<h2 className="mt-1.5 font-display font-semibold text-[clamp(1.9rem,3vw,2.4rem)] leading-tight">
						{appointment.customerName}
					</h2>
					<div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-white/80">
						<span className="border border-white/30 px-2 py-1 font-bold text-2xs text-white uppercase tracking-label">
							{appointment.museTag}
						</span>
						<span>{formatAppointmentDateTime(appointment)}</span>
						<span className="text-white/30">|</span>
						<span>
							{appointment.store.name}, {appointment.store.city}
						</span>
						<span className="text-white/30">|</span>
						<span>{appointment.occasion}</span>
					</div>
				</div>
				<div className="flex w-full shrink-0 gap-2.5 min-[760px]:w-auto">
					<button
						type="button"
						className={`${heroAction} bg-white text-ink hover:bg-white/90`}
						onClick={() => onCheckIn(appointment)}
						disabled={!canSchedule}
					>
						<UserCheck size={15} />
						Check In
					</button>
					<button
						type="button"
						className={`${heroAction} border border-white/40 text-white hover:bg-white/10`}
						onClick={() => onNoShow(appointment)}
						disabled={!canSchedule}
					>
						<UserX size={15} />
						No-Show
					</button>
				</div>
			</div>

			{/* body */}
			<div className="grid grid-cols-1 min-[1040px]:grid-cols-[360px_1fr]">
				{/* SUGGESTED PRODUCTS — centerpiece, first on mobile */}
				<div className="px-5 pt-7 min-[760px]:px-8 min-[1040px]:col-start-2 min-[1040px]:row-start-1">
					<SuggestedProducts
						appointment={appointment}
						canEdit={canEdit}
						onRegenerate={onRegenerate}
						onUpdateProductPrep={onUpdateProductPrep}
					/>
				</div>

				{/* LEFT INFO — customer snapshot + stylist */}
				<div className="border-line-subtle px-5 py-7 min-[760px]:px-7 min-[1040px]:col-start-1 min-[1040px]:row-start-1 min-[1040px]:row-span-2 min-[1040px]:border-r">
					<CustomerSnapshot
						appointment={appointment}
						onSaveOutfitIntents={
							canEdit
								? (analysis) => onSaveOutfitIntents(appointment, analysis)
								: undefined
						}
					/>

					<div className="mt-7">
						<SectionTitle>Stylist</SectionTitle>
					</div>
					<div className="flex items-center gap-3">
						<span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center bg-navy font-display font-semibold text-[14px] text-white">
							{initials(stylist.displayName)}
						</span>
						<div>
							<p className="font-bold text-[15px] text-ink">
								{stylist.displayName}
							</p>
							<p className="text-[12px] text-muted">{stylist.title}</p>
						</div>
					</div>
					<div className="mt-3">
						<Chips items={stylist.specialties} />
					</div>
					{canEdit ? (
						<div className="mt-4">
							<MetaLabel>Reassign</MetaLabel>
							<div className="relative">
								<select
									className="w-full appearance-none border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink focus:border-ink focus:outline-none"
									value={stylist.id}
									onChange={(event) =>
										onReassign(appointment, event.target.value)
									}
								>
									{sameStoreStylists.map((candidate) => (
										<option key={candidate.id} value={candidate.id}>
											{candidate.displayName}
										</option>
									))}
								</select>
								<span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[10px] text-muted">
									▾
								</span>
							</div>
						</div>
					) : null}
				</div>

				{/* RIGHT LOWER — messaging / notifications + session capture */}
				<div className="px-5 pb-7 min-[760px]:px-8 min-[1040px]:col-start-2 min-[1040px]:row-start-2">
					<div className="mt-7 grid grid-cols-1 gap-7 min-[640px]:grid-cols-2">
						<MessagingPanel
							canEdit={canEdit}
							messages={messages}
							messageDraft={messageDraft}
							onMessageDraftChange={(value) =>
								onMessageDraftChange(appointment.id, value)
							}
							onPostMessage={() => onPostMessage(appointment)}
						/>
						<NotificationPanel notifications={notifications} />
					</div>

					{/* session capture */}
					<div className="mt-8 border border-line-subtle bg-surface-subtle p-5">
						<div className="mb-4 flex items-center justify-between gap-3">
							<p className="font-display font-semibold text-[13px] text-ink uppercase tracking-label">
								Session Capture
							</p>
							{!captureUnlocked ? (
								<span className="border border-line bg-surface px-2.5 py-1 font-bold text-2xs text-muted uppercase tracking-label">
									Unlocks at check-in
								</span>
							) : null}
						</div>
						<div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
							<div>
								<MetaLabel>Associate session notes</MetaLabel>
								<textarea
									className="h-24 w-full resize-y border border-line bg-surface p-2.5 text-[13px] text-ink focus:border-ink focus:outline-none disabled:bg-surface-muted disabled:text-muted"
									value={sessionNote}
									disabled={!captureUnlocked}
									placeholder="Fit feedback, products tried, follow-ups…"
									onChange={(event) =>
										onSessionNoteChange(appointment.id, event.target.value)
									}
								/>
							</div>
							<div>
								<MetaLabel>Customer recap</MetaLabel>
								<textarea
									className="h-24 w-full resize-y border border-line bg-surface p-2.5 text-[13px] text-ink focus:border-ink focus:outline-none disabled:bg-surface-muted disabled:text-muted"
									value={customerRecap}
									disabled={!captureUnlocked}
									placeholder="Customer-visible fit recap…"
									onChange={(event) =>
										onCustomerRecapChange(appointment.id, event.target.value)
									}
								/>
							</div>
						</div>
						<div className="mt-4">
							<MetaLabel>Internal feedback</MetaLabel>
							<textarea
								className="h-20 w-full resize-y border border-line bg-surface p-2.5 text-[13px] text-ink focus:border-ink focus:outline-none disabled:bg-surface-muted disabled:text-muted"
								value={associateFeedback}
								disabled={!captureUnlocked}
								placeholder="Internal notes on prep quality, fit confidence, gaps…"
								onChange={(event) =>
									onAssociateFeedbackChange(appointment.id, event.target.value)
								}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* footer */}
			<div className="sticky bottom-0 z-10 flex flex-col gap-3 border-line-subtle border-t bg-surface px-5 py-4 min-[760px]:static min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between min-[760px]:px-8">
				<span className="text-[12px] text-muted">
					Save notes to persist this session
				</span>
				<div className="flex flex-wrap gap-2.5">
					<Button
						variant="secondary"
						size="sm"
						leadingIcon={<Save size={15} />}
						onClick={() => onSaveNotes(appointment)}
						disabled={!canEdit}
					>
						Save Notes
					</Button>
					<Button
						variant="primary"
						size="sm"
						leadingIcon={<CheckCircle2 size={15} />}
						onClick={() => onCompleteSession(appointment)}
						disabled={!canEdit || !customerRecap.trim()}
					>
						{completeLabel}
					</Button>
				</div>
			</div>
		</>
	);
}

const PREP_OPTIONS: Array<{
	value: SuggestedProduct["prepStatus"];
	label: string;
}> = [
	{ value: "suggested", label: "Suggested" },
	{ value: "pulled", label: "Pulled" },
	{ value: "skipped", label: "Skip" },
];

function PrepSegment({
	value,
	disabled,
	onChange,
}: {
	value: SuggestedProduct["prepStatus"];
	disabled: boolean;
	onChange: (next: SuggestedProduct["prepStatus"]) => void;
}) {
	return (
		<div className="flex w-full border border-line min-[640px]:inline-flex min-[640px]:w-auto">
			{PREP_OPTIONS.map((option, index) => {
				const active = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						disabled={disabled}
						aria-pressed={active}
						className={`flex-1 px-3 py-2 font-bold text-2xs uppercase tracking-[0.06em] transition-colors disabled:cursor-not-allowed min-[640px]:flex-none ${
							index > 0 ? "border-line border-l" : ""
						} ${active ? "bg-ink text-white" : "bg-surface text-body hover:text-ink disabled:text-muted"}`}
						onClick={() => onChange(option.value)}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

function SuggestedProducts({
	appointment,
	canEdit,
	onRegenerate,
	onUpdateProductPrep,
}: {
	appointment: Appointment;
	canEdit: boolean;
	onRegenerate: (appointment: Appointment) => void;
	onUpdateProductPrep: (
		appointment: Appointment,
		suggestion: SuggestedProduct,
		prepStatus: SuggestedProduct["prepStatus"],
		associateNote: string,
	) => void;
}) {
	const [notes, setNotes] = useState<Record<string, string>>({});

	useEffect(() => {
		setNotes(
			Object.fromEntries(
				appointment.suggestedProducts.map((suggestion) => [
					suggestion.product.productId,
					suggestion.associateNote,
				]),
			),
		);
	}, [appointment.suggestedProducts]);

	const toPull = appointment.suggestedProducts.filter(
		(suggestion) => suggestion.prepStatus !== "skipped",
	).length;

	return (
		<div className="border border-ink">
			<div className="flex items-center justify-between gap-3 bg-ink px-5 py-4 text-white">
				<div className="flex items-center gap-3">
					<span className="font-display font-semibold text-[15px] uppercase tracking-[0.06em]">
						Suggested Products
					</span>
					{toPull > 0 ? (
						<span className="bg-white px-2 py-0.5 font-bold text-2xs text-ink">
							{toPull} to pull
						</span>
					) : null}
				</div>
				<button
					type="button"
					className="inline-flex items-center gap-2 border border-white/40 px-3.5 py-2 font-bold text-2xs text-white uppercase tracking-label transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
					onClick={() => onRegenerate(appointment)}
					disabled={!canEdit}
				>
					<Sparkles size={13} />
					Regenerate
				</button>
			</div>

			{appointment.suggestedProducts.length === 0 ? (
				<p className="p-5 text-[0.9rem] text-muted">
					No suggested products for this appointment.
				</p>
			) : (
				appointment.suggestedProducts.map((suggestion) => {
					const productId = suggestion.product.productId;
					const note = notes[productId] ?? "";
					const price = formatPrice(
						suggestion.product.price,
						suggestion.product.currency,
					);
					return (
						<div
							key={productId}
							className="flex gap-4 border-line-subtle border-b p-5 last:border-b-0"
						>
							<ProductShot suggestion={suggestion} />
							<div className="min-w-0 flex-1">
								<div className="flex items-baseline justify-between gap-3">
									<a
										className="font-bold text-[15px] text-ink hover:underline"
										href={suggestion.product.productUrl}
										target="_blank"
										rel="noreferrer"
									>
										<span className="text-muted">{suggestion.rank}.</span>{" "}
										{suggestion.product.name}
									</a>
									{price ? (
										<span className="shrink-0 whitespace-nowrap font-display font-semibold text-[17px] text-ink">
											{price}
										</span>
									) : null}
								</div>
								<p className="mt-1.5 font-semibold text-2xs text-muted uppercase tracking-[0.06em]">
									{specLine(suggestion.product)}
								</p>
								<p className="mt-2 text-[13px] text-body leading-relaxed">
									{suggestion.rationale}
								</p>
								<div className="mt-3 flex flex-col gap-2.5 min-[640px]:flex-row min-[640px]:items-center">
									<PrepSegment
										value={suggestion.prepStatus}
										disabled={!canEdit}
										onChange={(next) =>
											onUpdateProductPrep(appointment, suggestion, next, note)
										}
									/>
									<input
										className="border border-line bg-surface px-3 py-2 text-[12px] text-ink placeholder:text-muted focus:border-ink focus:outline-none disabled:bg-surface-subtle disabled:text-muted min-[640px]:flex-1"
										value={note}
										disabled={!canEdit}
										placeholder="Add a prep note…"
										onChange={(event) =>
											setNotes((current) => ({
												...current,
												[productId]: event.target.value,
											}))
										}
										onBlur={() =>
											onUpdateProductPrep(
												appointment,
												suggestion,
												suggestion.prepStatus,
												note,
											)
										}
									/>
								</div>
							</div>
						</div>
					);
				})
			)}
		</div>
	);
}

function MessagingPanel({
	canEdit,
	messages,
	messageDraft,
	onMessageDraftChange,
	onPostMessage,
}: {
	canEdit: boolean;
	messages: AppointmentMessage[];
	messageDraft: string;
	onMessageDraftChange: (value: string) => void;
	onPostMessage: () => void;
}) {
	return (
		<div>
			<SectionTitle>Messages</SectionTitle>
			<div className="mb-3 grid max-h-[240px] gap-3 overflow-y-auto">
				{messages.length === 0 ? (
					<p className="text-[0.9rem] text-muted">No messages yet.</p>
				) : (
					messages.map((message) => {
						const mine = message.authorType === "associate";
						return (
							<div key={message.id}>
								<div className="mb-1 flex justify-between gap-2">
									<span
										className={`font-bold text-2xs uppercase tracking-label ${mine ? "text-navy" : "text-muted"}`}
									>
										{mine ? "You" : "Customer"}
									</span>
									<span className="text-2xs text-muted">
										{new Date(message.createdAt).toLocaleTimeString([], {
											hour: "numeric",
											minute: "2-digit",
										})}
									</span>
								</div>
								<p
									className={`px-3 py-2.5 text-[13px] leading-relaxed ${mine ? "bg-navy text-white" : "bg-surface-subtle text-body"}`}
								>
									{message.body}
								</p>
							</div>
						);
					})
				)}
			</div>
			<div className="flex gap-2">
				<input
					className="flex-1 border border-line bg-surface px-3 py-2.5 text-[12px] text-ink placeholder:text-muted focus:border-ink focus:outline-none disabled:bg-surface-subtle disabled:text-muted"
					value={messageDraft}
					disabled={!canEdit}
					placeholder="Message customer…"
					onChange={(event) => onMessageDraftChange(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && messageDraft.trim()) {
							event.preventDefault();
							onPostMessage();
						}
					}}
				/>
				<button
					type="button"
					className="bg-ink px-4 font-bold text-2xs text-white uppercase tracking-label transition-colors hover:bg-ink-deep disabled:cursor-not-allowed disabled:bg-disabled"
					onClick={onPostMessage}
					disabled={!canEdit || !messageDraft.trim()}
				>
					Send
				</button>
			</div>
		</div>
	);
}

function NotificationPanel({
	notifications,
}: {
	notifications: AppointmentNotification[];
}) {
	return (
		<div>
			<SectionTitle>Notifications</SectionTitle>
			{notifications.length === 0 ? (
				<p className="text-[0.9rem] text-muted">No notification records.</p>
			) : (
				notifications.map((notification, index) => (
					<div
						key={notification.id}
						className={`flex items-start gap-2.5 py-2.5 ${
							index < notifications.length - 1
								? "border-line-subtle border-b"
								: ""
						}`}
					>
						<span
							className={`mt-1.5 block h-[7px] w-[7px] shrink-0 ${notification.status === "sent" ? "bg-success" : "bg-muted"}`}
						/>
						<div>
							<p className="font-semibold text-[13px] text-ink">
								<span className="capitalize">{notification.type}</span>{" "}
								{notification.status}
							</p>
							<p className="text-[12px] text-muted">
								{new Date(notification.scheduledFor).toLocaleString([], {
									month: "short",
									day: "numeric",
									hour: "numeric",
									minute: "2-digit",
								})}
							</p>
						</div>
					</div>
				))
			)}
		</div>
	);
}

/* ------------------------------------------------------------ recap frame */

function RecapDetail({
	appointment,
	stylists,
}: {
	appointment: Appointment;
	stylists: StylistProfile[];
}) {
	const stylist =
		stylists.find(
			(candidate) => candidate.id === appointment.assignedStylist.id,
		) ?? appointment.assignedStylist;
	const rating = appointment.customerFeedbackRating;
	const pulled = appointment.suggestedProducts.filter(
		(suggestion) => suggestion.prepStatus === "pulled",
	);

	return (
		<>
			{/* hero (light) */}
			<div className="flex flex-col gap-5 border-line-subtle border-b px-5 py-7 min-[760px]:flex-row min-[760px]:items-start min-[760px]:justify-between min-[760px]:px-8">
				<div className="min-w-0 flex-1">
					<p className="font-bold text-2xs text-muted uppercase tracking-label">
						Appointment · {shortRef(appointment)}
					</p>
					<h2 className="mt-1.5 font-display font-semibold text-[clamp(1.9rem,3vw,2.4rem)] text-ink leading-tight">
						{appointment.customerName}
					</h2>
					<div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-body">
						<span className="border border-navy/30 px-2 py-1 font-bold text-2xs text-navy uppercase tracking-label">
							{appointment.museTag}
						</span>
						<span>{formatAppointmentDateTime(appointment)}</span>
						<span className="text-line">|</span>
						<span>
							{appointment.store.name}, {appointment.store.city}
						</span>
						<span className="text-line">|</span>
						<span>{appointment.occasion}</span>
					</div>
				</div>
				<div className="shrink-0 min-[760px]:text-right">
					<p className="font-bold text-2xs text-muted uppercase tracking-label">
						Stylist
					</p>
					<p className="mt-1 font-bold text-[15px] text-ink">
						{stylist.displayName}
					</p>
					<p className="text-[12px] text-muted">{stylist.title}</p>
				</div>
			</div>

			{/* outcome banner */}
			{rating != null ? (
				<div className="flex flex-col gap-3 border-line-subtle border-b bg-success-tint px-5 py-5 min-[760px]:flex-row min-[760px]:items-center min-[760px]:gap-6 min-[760px]:px-8">
					<div className="flex items-center gap-3">
						<span className="font-display font-semibold text-[13px] text-success uppercase tracking-label">
							Customer Rating
						</span>
						<Rating value={rating} />
					</div>
					{appointment.customerFeedbackComment ? (
						<>
							<span className="hidden h-7 w-px bg-line-subtle min-[760px]:block" />
							<p className="flex-1 text-[14px] text-body">
								“{appointment.customerFeedbackComment}”
							</p>
						</>
					) : null}
				</div>
			) : null}

			{/* body */}
			<div className="grid grid-cols-1 min-[1040px]:grid-cols-[360px_1fr]">
				<div className="order-2 border-line-subtle px-5 py-7 min-[760px]:px-7 min-[1040px]:order-none min-[1040px]:border-r">
					<CustomerSnapshot appointment={appointment} />
				</div>

				<div className="order-1 px-5 py-7 min-[760px]:px-8 min-[1040px]:order-none">
					<SectionTitle>What Was Pulled</SectionTitle>
					{pulled.length === 0 ? (
						<p className="mb-7 text-[0.9rem] text-muted">
							No products were pulled in this session.
						</p>
					) : (
						pulled.map((suggestion) => {
							const price = formatPrice(
								suggestion.product.price,
								suggestion.product.currency,
							);
							return (
								<div
									key={suggestion.product.productId}
									className="mb-7 flex gap-4 border border-line-subtle p-4"
								>
									<ProductShot suggestion={suggestion} />
									<div className="min-w-0 flex-1">
										<div className="flex items-baseline justify-between gap-3">
											<p className="font-bold text-[15px] text-ink">
												{suggestion.product.name}
											</p>
											{price ? (
												<span className="shrink-0 whitespace-nowrap font-display font-semibold text-[17px] text-ink">
													{price}
												</span>
											) : null}
										</div>
										<p className="mt-1.5 font-semibold text-2xs text-muted uppercase tracking-[0.06em]">
											{specLine(suggestion.product)}
										</p>
										<div className="mt-2.5 flex flex-wrap items-center gap-2.5">
											<span className="bg-success px-2.5 py-1 font-bold text-2xs text-white uppercase tracking-label">
												Pulled
											</span>
											{suggestion.associateNote ? (
												<span className="text-[13px] text-body">
													{suggestion.associateNote}
												</span>
											) : null}
										</div>
									</div>
								</div>
							);
						})
					)}

					<SectionTitle>Session Recap</SectionTitle>
					<MetaLabel>Customer recap</MetaLabel>
					<p className="mb-4 bg-surface-subtle px-4 py-3.5 text-[14px] text-body leading-relaxed">
						{appointment.customerRecap || "No customer recap recorded."}
					</p>
					<MetaLabel>Associate notes</MetaLabel>
					<p className="mb-4 bg-surface-subtle px-4 py-3.5 text-[14px] text-body leading-relaxed">
						{appointment.sessionNotes || "No associate notes recorded."}
					</p>
					<MetaLabel>Internal feedback</MetaLabel>
					<p className="border-sale border-l-[3px] bg-sale-tint px-4 py-3.5 text-[14px] text-body leading-relaxed">
						{appointment.associateFeedback || "No internal feedback recorded."}
					</p>
				</div>
			</div>
		</>
	);
}
