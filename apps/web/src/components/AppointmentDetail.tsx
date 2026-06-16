import {
	ArrowLeft,
	CheckCircle2,
	ImageOff,
	Save,
	Sparkles,
} from "lucide-react";
import type { Appointment } from "../api";
import { formatAppointmentDateTime, statusLabel } from "../formatters";

const buttonBase =
	"inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-[9px] disabled:cursor-wait disabled:opacity-60";

type AppointmentDetailProps = {
	appointment: Appointment;
	isLoading: boolean;
	sessionNote: string;
	onBack: () => void;
	onSessionNoteChange: (appointmentId: string, value: string) => void;
	onSaveNotes: (appointment: Appointment) => void;
	onCompleteSession: (appointment: Appointment) => void;
	onRegenerate: (appointment: Appointment) => void;
};

export function AppointmentDetail({
	appointment,
	isLoading,
	sessionNote,
	onBack,
	onSessionNoteChange,
	onSaveNotes,
	onCompleteSession,
	onRegenerate,
}: AppointmentDetailProps) {
	const canEdit = appointment.status === "scheduled" && !isLoading;

	return (
		<section className="rounded-lg border border-line bg-surface p-[18px]">
			<div className="mb-5 flex flex-col gap-3 min-[720px]:flex-row min-[720px]:items-start min-[720px]:justify-between">
				<div className="grid gap-2">
					<button
						type="button"
						className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-control bg-surface px-3 py-2 text-ink hover:bg-canvas"
						onClick={onBack}
					>
						<ArrowLeft size={16} />
						Back to appointments
					</button>
					<div>
						<p className="font-bold text-[0.78rem] text-clay uppercase">
							Appointment detail
						</p>
						<h2 className="font-bold text-2xl">{appointment.customerName}</h2>
					</div>
				</div>
				<span className="w-fit rounded-full bg-tag px-3 py-1 font-extrabold text-[0.85rem] text-accent">
					{statusLabel(appointment.status)}
				</span>
			</div>

			<div className="grid gap-4 min-[900px]:grid-cols-[1fr_1fr]">
				<DetailSection title="Appointment">
					<DetailItem
						label="Time"
						value={formatAppointmentDateTime(appointment)}
					/>
					<DetailItem
						label="Stylist"
						value={`${appointment.assignedStylist.displayName}, ${appointment.assignedStylist.title}`}
					/>
					<DetailItem label="Muse tag" value={appointment.museTag} />
					<DetailItem label="Occasion" value={appointment.occasion} />
				</DetailSection>

				<DetailSection title="Customer Preferences">
					<DetailItem
						label="Focus colors"
						value={appointment.focusColors || "None specified"}
					/>
					<DetailItem
						label="Avoid colors"
						value={appointment.avoidColors || "None specified"}
					/>
					<DetailItem
						label="Style signals"
						value={appointment.styleKeywords.join(", ") || "None specified"}
					/>
					<DetailItem
						label="Customer note"
						value={appointment.guidance || "None provided"}
					/>
				</DetailSection>

				<DetailSection title="Order Signal">
					<DetailItem
						label="Total orders"
						value={String(appointment.orderHistorySummary.totalOrders)}
					/>
					<DetailItem
						label="Denim items"
						value={String(appointment.orderHistorySummary.denimItems)}
					/>
					<DetailItem
						label="Returns"
						value={String(appointment.orderHistorySummary.returnedItems)}
					/>
					<DetailItem
						label="Preferred sizes"
						value={
							appointment.orderHistorySummary.preferredSizes.join(", ") ||
							"Unknown"
						}
					/>
				</DetailSection>

				<SuggestedProducts
					appointment={appointment}
					canEdit={canEdit}
					onRegenerate={onRegenerate}
				/>
			</div>

			<section className="mt-4 grid gap-2">
				<label className="grid gap-1.5">
					<span className="font-extrabold text-[0.85rem] text-ink">
						Associate session notes
					</span>
					<textarea
						className="min-h-32 w-full resize-y rounded-lg border border-line bg-surface p-2.5 text-ink focus:border-accent focus:outline-none disabled:bg-canvas disabled:text-muted"
						value={sessionNote}
						onChange={(event) =>
							onSessionNoteChange(appointment.id, event.target.value)
						}
						disabled={!canEdit}
						placeholder="Summarize fit feedback, products tried, and follow-up recommendations."
					/>
				</label>
				<div className="flex flex-wrap justify-end gap-2">
					<button
						type="button"
						className={`${buttonBase} border border-control bg-surface text-ink transition-colors hover:bg-canvas`}
						onClick={() => onSaveNotes(appointment)}
						disabled={!canEdit}
					>
						<Save size={16} />
						Save notes
					</button>
					<button
						type="button"
						className={`${buttonBase} border border-ink bg-ink text-white transition-opacity hover:opacity-90`}
						onClick={() => onCompleteSession(appointment)}
						disabled={!canEdit}
					>
						<CheckCircle2 size={16} />
						Mark complete
					</button>
				</div>
			</section>
		</section>
	);
}

function DetailSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="grid gap-3 rounded-lg border border-rowline p-3">
			<h3 className="font-semibold text-base">{title}</h3>
			<div className="grid gap-2">{children}</div>
		</section>
	);
}

function DetailItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid gap-0.5">
			<span className="font-bold text-[0.72rem] text-muted uppercase">
				{label}
			</span>
			<span className="text-ink">{value}</span>
		</div>
	);
}

function SuggestedProducts({
	appointment,
	canEdit,
	onRegenerate,
}: {
	appointment: Appointment;
	canEdit: boolean;
	onRegenerate: (appointment: Appointment) => void;
}) {
	return (
		<section className="grid gap-3 rounded-lg border border-suggestline border-dashed bg-suggest p-3">
			<div className="flex items-center justify-between gap-2">
				<h3 className="font-semibold text-base">Suggested products</h3>
				<div className="flex items-center gap-2">
					<button
						type="button"
						className={`${buttonBase} border border-control bg-surface text-[0.8rem] text-ink transition-colors hover:bg-canvas`}
						onClick={() => onRegenerate(appointment)}
						disabled={!canEdit}
					>
						<Sparkles size={14} />
						Regenerate
					</button>
					<span className="min-w-[24px] rounded-full bg-ink px-2 py-0.5 text-center font-extrabold text-[0.78rem] text-white">
						{appointment.suggestedProducts.length}
					</span>
				</div>
			</div>
			{appointment.suggestedProducts.length === 0 ? (
				<p className="text-[0.9rem] text-muted">
					No suggested products for this appointment.
				</p>
			) : (
				<ol className="grid gap-2.5">
					{appointment.suggestedProducts.map((suggestion) => (
						<li
							key={suggestion.rank}
							className="grid grid-cols-[64px_1fr] items-start gap-3 border-rowline border-b pb-2.5 last:border-b-0 last:pb-0"
						>
							<a
								className="block h-16 w-16 shrink-0 overflow-hidden rounded-md border border-rowline bg-surface"
								href={suggestion.product.productUrl}
								target="_blank"
								rel="noreferrer"
							>
								{suggestion.product.imageUrl ? (
									<img
										className="h-full w-full object-cover"
										src={suggestion.product.imageUrl}
										alt={suggestion.product.name}
										loading="lazy"
									/>
								) : (
									<span className="flex h-full w-full items-center justify-center text-muted">
										<ImageOff size={20} />
									</span>
								)}
							</a>
							<div className="grid gap-0.5">
								<a
									className="font-bold text-ink hover:underline"
									href={suggestion.product.productUrl}
									target="_blank"
									rel="noreferrer"
								>
									{suggestion.rank}. {suggestion.product.name}
								</a>
								<small className="text-[0.8rem] text-muted capitalize">
									{[
										suggestion.product.category,
										suggestion.product.fit,
										suggestion.product.rise,
										suggestion.product.stretch,
									]
										.filter(Boolean)
										.join(" · ")}
									{suggestion.product.price != null
										? ` · $${suggestion.product.price}`
										: ""}
								</small>
								<p className="text-[0.85rem] text-muted">
									{suggestion.rationale}
								</p>
							</div>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
