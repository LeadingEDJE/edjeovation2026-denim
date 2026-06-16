import type { AppointmentMessage } from "../../api";
import { SectionTitle } from "./shared";

export function MessagingPanel({
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
