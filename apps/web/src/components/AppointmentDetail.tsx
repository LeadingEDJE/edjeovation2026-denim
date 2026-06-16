import { ChevronLeft } from "lucide-react";
import type {
	Appointment,
	AppointmentMessage,
	AppointmentNotification,
	OutfitAnalysis,
	StylistProfile,
	SuggestedProduct,
} from "../api";
import { statusLabel } from "../formatters";
import { InteractiveDetail } from "./detail/InteractiveDetail";
import { RecapDetail } from "./detail/RecapDetail";

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

function isActiveAppointment(appointment: Appointment) {
	return (
		appointment.status === "scheduled" || appointment.status === "checked_in"
	);
}

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
				<InteractiveDetail
					appointment={appointment}
					stylists={props.stylists}
					messages={props.messages}
					notifications={props.notifications}
					isLoading={isLoading}
					sessionNote={props.sessionNote}
					customerRecap={props.customerRecap}
					associateFeedback={props.associateFeedback}
					messageDraft={props.messageDraft}
					canEdit={interactive && !isLoading}
					onSessionNoteChange={props.onSessionNoteChange}
					onCustomerRecapChange={props.onCustomerRecapChange}
					onAssociateFeedbackChange={props.onAssociateFeedbackChange}
					onMessageDraftChange={props.onMessageDraftChange}
					onSaveNotes={props.onSaveNotes}
					onCompleteSession={props.onCompleteSession}
					onRegenerate={props.onRegenerate}
					onCheckIn={props.onCheckIn}
					onNoShow={props.onNoShow}
					onReassign={props.onReassign}
					onPostMessage={props.onPostMessage}
					onSaveOutfitIntents={props.onSaveOutfitIntents}
					onUpdateProductPrep={props.onUpdateProductPrep}
				/>
			) : (
				<RecapDetail appointment={appointment} stylists={props.stylists} />
			)}
		</section>
	);
}
