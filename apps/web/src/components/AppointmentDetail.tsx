import {
	ArrowLeft,
	CheckCircle2,
	ImageOff,
	MessageSquarePlus,
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
	StylistProfile,
	SuggestedProduct,
} from "../api";
import { formatAppointmentDateTime, statusLabel } from "../formatters";

const buttonBase =
	"inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-[9px] disabled:cursor-wait disabled:opacity-60";

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
	onUpdateProductPrep: (
		appointment: Appointment,
		suggestion: SuggestedProduct,
		prepStatus: SuggestedProduct["prepStatus"],
		associateNote: string,
	) => void;
};

export function AppointmentDetail({
	appointment,
	stylists,
	messages,
	notifications,
	isLoading,
	sessionNote,
	customerRecap,
	associateFeedback,
	messageDraft,
	onBack,
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
	onUpdateProductPrep,
}: AppointmentDetailProps) {
	const canEdit = isActiveAppointment(appointment) && !isLoading;
	const sameStoreStylists = stylists.filter(
		(stylist) => stylist.store.storeId === appointment.store.storeId,
	);

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
						label="Store"
						value={`${appointment.store.name}, ${appointment.store.city}`}
					/>
					<DetailItem label="Muse tag" value={appointment.museTag} />
					<DetailItem label="Occasion" value={appointment.occasion} />
					{canEdit ? (
						<label className="grid gap-1">
							<span className="font-bold text-[0.72rem] text-muted uppercase">
								Reassign stylist
							</span>
							<select
								className="h-10 rounded-lg border border-line bg-surface px-3"
								value={appointment.assignedStylist.id}
								onChange={(event) =>
									onReassign(appointment, event.target.value)
								}
							>
								{sameStoreStylists.map((stylist) => (
									<option key={stylist.id} value={stylist.id}>
										{stylist.displayName}
									</option>
								))}
							</select>
						</label>
					) : null}
				</DetailSection>

				<DetailSection title="Stylist Profile">
					<DetailItem
						label="Stylist"
						value={`${appointment.assignedStylist.displayName}, ${appointment.assignedStylist.title}`}
					/>
					<DetailItem label="Bio" value={appointment.assignedStylist.bio} />
					<DetailItem
						label="Specialties"
						value={appointment.assignedStylist.specialties.join(", ")}
					/>
					<DetailItem
						label="Point of view"
						value={appointment.assignedStylist.stylePointOfView.join(", ")}
					/>
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

				<MessagingPanel
					canEdit={canEdit}
					messageDraft={messageDraft}
					messages={messages}
					onMessageDraftChange={(value) =>
						onMessageDraftChange(appointment.id, value)
					}
					onPostMessage={() => onPostMessage(appointment)}
				/>

				<NotificationPanel notifications={notifications} />

				<SuggestedProducts
					appointment={appointment}
					canEdit={canEdit}
					onRegenerate={onRegenerate}
					onUpdateProductPrep={onUpdateProductPrep}
				/>

				<FeedbackPanel appointment={appointment} />
			</div>

			<section className="mt-4 grid gap-3">
				<label className="grid gap-1.5">
					<span className="font-extrabold text-[0.85rem] text-ink">
						Associate session notes
					</span>
					<textarea
						className="min-h-28 w-full resize-y rounded-lg border border-line bg-surface p-2.5 text-ink focus:border-accent focus:outline-none disabled:bg-canvas disabled:text-muted"
						value={sessionNote}
						onChange={(event) =>
							onSessionNoteChange(appointment.id, event.target.value)
						}
						disabled={!canEdit}
						placeholder="Summarize fit feedback, products tried, and follow-up recommendations."
					/>
				</label>
				<label className="grid gap-1.5">
					<span className="font-extrabold text-[0.85rem] text-ink">
						Customer recap
					</span>
					<textarea
						className="min-h-24 w-full resize-y rounded-lg border border-line bg-surface p-2.5 text-ink focus:border-accent focus:outline-none disabled:bg-canvas disabled:text-muted"
						value={customerRecap}
						onChange={(event) =>
							onCustomerRecapChange(appointment.id, event.target.value)
						}
						disabled={!canEdit}
						placeholder="Customer-visible fit recap and next best denim guidance."
					/>
				</label>
				<label className="grid gap-1.5">
					<span className="font-extrabold text-[0.85rem] text-ink">
						Associate feedback
					</span>
					<textarea
						className="min-h-20 w-full resize-y rounded-lg border border-line bg-surface p-2.5 text-ink focus:border-accent focus:outline-none disabled:bg-canvas disabled:text-muted"
						value={associateFeedback}
						onChange={(event) =>
							onAssociateFeedbackChange(appointment.id, event.target.value)
						}
						disabled={!canEdit}
						placeholder="Internal notes on prep quality, fit confidence, and recommendation gaps."
					/>
				</label>
				<div className="flex flex-wrap justify-end gap-2">
					<button
						type="button"
						className={`${buttonBase} border border-control bg-surface text-ink transition-colors hover:bg-canvas`}
						onClick={() => onCheckIn(appointment)}
						disabled={appointment.status !== "scheduled" || isLoading}
					>
						<UserCheck size={16} />
						Check in
					</button>
					<button
						type="button"
						className={`${buttonBase} border border-control bg-surface text-ink transition-colors hover:bg-canvas`}
						onClick={() => onNoShow(appointment)}
						disabled={appointment.status !== "scheduled" || isLoading}
					>
						<UserX size={16} />
						No-show
					</button>
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
						disabled={!canEdit || !customerRecap.trim()}
					>
						<CheckCircle2 size={16} />
						Complete
					</button>
				</div>
			</section>
		</section>
	);
}

function isActiveAppointment(appointment: Appointment) {
	return (
		appointment.status === "scheduled" || appointment.status === "checked_in"
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
		<DetailSection title="Messages">
			<div className="grid max-h-[240px] gap-2 overflow-y-auto pr-1">
				{messages.length === 0 ? (
					<p className="text-[0.9rem] text-muted">No messages yet.</p>
				) : (
					messages.map((message) => (
						<div key={message.id} className="rounded-lg bg-canvas p-2">
							<div className="mb-1 flex justify-between gap-2 text-[0.75rem] text-muted">
								<strong className="capitalize">{message.authorType}</strong>
								<span>{new Date(message.createdAt).toLocaleString()}</span>
							</div>
							<p className="text-[0.9rem]">{message.body}</p>
						</div>
					))
				)}
			</div>
			<div className="grid gap-2">
				<textarea
					className="min-h-20 rounded-lg border border-line bg-surface p-2.5 text-sm disabled:bg-canvas disabled:text-muted"
					value={messageDraft}
					onChange={(event) => onMessageDraftChange(event.target.value)}
					disabled={!canEdit}
					placeholder="Message the customer about appointment prep."
				/>
				<button
					type="button"
					className={`${buttonBase} border border-control bg-surface text-ink transition-colors hover:bg-canvas`}
					onClick={onPostMessage}
					disabled={!canEdit || !messageDraft.trim()}
				>
					<MessageSquarePlus size={15} />
					Send message
				</button>
			</div>
		</DetailSection>
	);
}

function NotificationPanel({
	notifications,
}: {
	notifications: AppointmentNotification[];
}) {
	return (
		<DetailSection title="Mock Notifications">
			{notifications.length === 0 ? (
				<p className="text-[0.9rem] text-muted">No notification records.</p>
			) : (
				notifications.map((notification) => (
					<DetailItem
						key={notification.id}
						label={notification.type}
						value={`${notification.status} for ${new Date(
							notification.scheduledFor,
						).toLocaleString()}`}
					/>
				))
			)}
		</DetailSection>
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
				<ol className="grid gap-3">
					{appointment.suggestedProducts.map((suggestion) => {
						const productId = suggestion.product.productId;
						const note = notes[productId] ?? "";
						return (
							<li
								key={productId}
								className="grid grid-cols-[64px_1fr] items-start gap-3 border-rowline border-b pb-3 last:border-b-0 last:pb-0"
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
								<div className="grid gap-2">
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
									<div className="grid gap-2 min-[640px]:grid-cols-[150px_1fr_auto]">
										<select
											className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
											value={suggestion.prepStatus}
											disabled={!canEdit}
											onChange={(event) =>
												onUpdateProductPrep(
													appointment,
													suggestion,
													event.target.value as SuggestedProduct["prepStatus"],
													note,
												)
											}
										>
											<option value="suggested">Suggested</option>
											<option value="pulled">Pulled</option>
											<option value="skipped">Skipped</option>
										</select>
										<input
											className="h-10 rounded-lg border border-line bg-surface px-3 text-sm disabled:bg-canvas disabled:text-muted"
											value={note}
											disabled={!canEdit}
											placeholder="Associate product note"
											onChange={(event) =>
												setNotes((current) => ({
													...current,
													[productId]: event.target.value,
												}))
											}
										/>
										<button
											type="button"
											className={`${buttonBase} border border-control bg-surface text-ink text-sm transition-colors hover:bg-canvas`}
											disabled={!canEdit}
											onClick={() =>
												onUpdateProductPrep(
													appointment,
													suggestion,
													suggestion.prepStatus,
													note,
												)
											}
										>
											<Save size={14} />
											Save
										</button>
									</div>
								</div>
							</li>
						);
					})}
				</ol>
			)}
		</section>
	);
}

function FeedbackPanel({ appointment }: { appointment: Appointment }) {
	return (
		<DetailSection title="Customer Feedback">
			{appointment.customerFeedbackRating == null ? (
				<p className="text-[0.9rem] text-muted">No customer feedback yet.</p>
			) : (
				<>
					<DetailItem
						label="Rating"
						value={`${appointment.customerFeedbackRating}/5`}
					/>
					<DetailItem
						label="Comment"
						value={appointment.customerFeedbackComment || "No comment"}
					/>
				</>
			)}
			{appointment.customerRecap ? (
				<DetailItem label="Recap" value={appointment.customerRecap} />
			) : null}
			{appointment.associateFeedback ? (
				<DetailItem
					label="Associate feedback"
					value={appointment.associateFeedback}
				/>
			) : null}
		</DetailSection>
	);
}
