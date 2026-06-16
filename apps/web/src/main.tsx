import { createRoot } from "react-dom/client";
import {
	AppointmentViewNav,
	DashboardHeader,
	dashboardViews,
} from "./components/AppointmentChrome";
import { AppointmentDetail } from "./components/AppointmentDetail";
import { AppointmentList } from "./components/AppointmentList";
import { useAppointmentDashboard } from "./hooks/useAppointmentDashboard";
import "./styles.css";

function App() {
	const {
		status,
		isLoading,
		activeView,
		filters,
		stores,
		stylists,
		filteredAppointments,
		counts,
		selectedAppointment,
		sessionNotes,
		customerRecaps,
		associateFeedbacks,
		messageDrafts,
		messages,
		notifications,
		setFilters,
		changeView,
		setSelectedAppointmentId,
		onSessionNoteChange,
		onCustomerRecapChange,
		onAssociateFeedbackChange,
		onMessageDraftChange,
		refresh,
		saveNotes,
		completeSession,
		checkIn,
		noShow,
		reassign,
		regenerate,
		postMessage,
		saveOutfitIntents,
		updateProductPrep,
	} = useAppointmentDashboard();

	const activeTitle =
		dashboardViews.find((view) => view.id === activeView)?.label ?? "Open";

	return (
		<main className="min-h-screen p-[18px] min-[820px]:p-7">
			<DashboardHeader
				status={status}
				isLoading={isLoading}
				onRefresh={() => void refresh()}
			/>

			<AppointmentViewNav
				activeView={activeView}
				counts={counts}
				onChange={changeView}
			/>

			<section className="mx-auto max-w-[1180px]">
				{selectedAppointment ? (
					<AppointmentDetail
						appointment={selectedAppointment}
						stylists={stylists}
						messages={messages[selectedAppointment.id] ?? []}
						notifications={notifications[selectedAppointment.id] ?? []}
						isLoading={isLoading}
						sessionNote={sessionNotes[selectedAppointment.id] ?? ""}
						customerRecap={customerRecaps[selectedAppointment.id] ?? ""}
						associateFeedback={associateFeedbacks[selectedAppointment.id] ?? ""}
						messageDraft={messageDrafts[selectedAppointment.id] ?? ""}
						onBack={() => setSelectedAppointmentId(null)}
						onSessionNoteChange={onSessionNoteChange}
						onCustomerRecapChange={onCustomerRecapChange}
						onAssociateFeedbackChange={onAssociateFeedbackChange}
						onMessageDraftChange={onMessageDraftChange}
						onSaveNotes={(appointment) => void saveNotes(appointment)}
						onCompleteSession={(appointment) =>
							void completeSession(appointment)
						}
						onRegenerate={(appointment) => void regenerate(appointment)}
						onSaveOutfitIntents={(appointment, analysis) =>
							void saveOutfitIntents(appointment, analysis)
						}
						onCheckIn={(appointment) => void checkIn(appointment)}
						onNoShow={(appointment) => void noShow(appointment)}
						onReassign={(appointment, stylistId) =>
							void reassign(appointment, stylistId)
						}
						onPostMessage={(appointment) => void postMessage(appointment)}
						onUpdateProductPrep={(
							appointment,
							suggestion,
							prepStatus,
							associateNote,
						) =>
							void updateProductPrep(
								appointment,
								suggestion,
								prepStatus,
								associateNote,
							)
						}
					/>
				) : (
					<AppointmentList
						activeTitle={activeTitle}
						appointments={filteredAppointments}
						filters={filters}
						stores={stores}
						stylists={stylists}
						onFilterChange={setFilters}
						onSelect={setSelectedAppointmentId}
					/>
				)}
			</section>
		</main>
	);
}

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element #root not found");
}
createRoot(rootElement).render(<App />);
