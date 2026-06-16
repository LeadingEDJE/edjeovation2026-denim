import type { AppointmentNotification } from "../../api";
import { SectionTitle } from "./shared";

export function NotificationPanel({
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
