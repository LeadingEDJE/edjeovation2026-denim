import { Button } from "@denim-fit/design-system";
import { CheckCircle2, Save, UserCheck, UserX } from "lucide-react";
import type {
	Appointment,
	AppointmentMessage,
	AppointmentNotification,
	OutfitAnalysis,
	StylistProfile,
	SuggestedProduct,
} from "../../api";
import { formatAppointmentDateTime, initials } from "../../formatters";
import { CustomerSnapshot } from "./CustomerSnapshot";
import { MessagingPanel } from "./MessagingPanel";
import { NotificationPanel } from "./NotificationPanel";
import { SuggestedProducts } from "./SuggestedProducts";
import { Chips, MetaLabel, SectionTitle, shortRef } from "./shared";

export type InteractiveDetailProps = {
	appointment: Appointment;
	stylists: StylistProfile[];
	messages: AppointmentMessage[];
	notifications: AppointmentNotification[];
	isLoading: boolean;
	sessionNote: string;
	customerRecap: string;
	associateFeedback: string;
	messageDraft: string;
	canEdit: boolean;
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

export function InteractiveDetail({
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
}: InteractiveDetailProps) {
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
				<div className="px-5 pt-7 min-[1040px]:col-start-2 min-[1040px]:row-start-1 min-[760px]:px-8">
					<SuggestedProducts
						appointment={appointment}
						canEdit={canEdit}
						onRegenerate={onRegenerate}
						onUpdateProductPrep={onUpdateProductPrep}
					/>
				</div>

				{/* LEFT INFO — customer snapshot + stylist */}
				<div className="border-line-subtle px-5 py-7 min-[1040px]:col-start-1 min-[1040px]:row-span-2 min-[1040px]:row-start-1 min-[1040px]:border-r min-[760px]:px-7">
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
				<div className="px-5 pb-7 min-[1040px]:col-start-2 min-[1040px]:row-start-2 min-[760px]:px-8">
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
