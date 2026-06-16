/**
 * Data-access layer for the Personalized Denim Fitting API.
 *
 * Every SQL statement in the service lives here as a named function wrapping a
 * single `pool.query` call. Route handlers orchestrate these functions and map
 * the returned rows to API types; they never embed SQL directly. Each function
 * issues exactly one query so callers (and tests that mock the pool) can rely on
 * a predictable call sequence.
 */
import { pool } from "./db.js";

// --- Catalog -------------------------------------------------------------

export function selectAllCatalogProducts() {
	return pool.query("SELECT * FROM catalog_products");
}

export function countCatalogProducts(whereClause: string, params: unknown[]) {
	return pool.query<{ count: string }>(
		`SELECT count(*)::text AS count FROM catalog_products ${whereClause}`,
		params,
	);
}

export function selectCatalogProductsPage(
	whereClause: string,
	params: unknown[],
	limit: number,
	offset: number,
) {
	return pool.query(
		`SELECT * FROM catalog_products ${whereClause} ORDER BY scraped_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
		[...params, limit, offset],
	);
}

export function selectCatalogProductById(productId: string) {
	return pool.query("SELECT * FROM catalog_products WHERE product_id = $1", [
		productId,
	]);
}

// --- Appointments: reads -------------------------------------------------

/**
 * Selects a single appointment joined with its latest confirmation/reminder
 * notification status and total notification count.
 */
export function selectAppointmentWithNotificationsById(appointmentId: string) {
	return pool.query(
		`
			SELECT a.*,
				(
					SELECT count(*)::int
					FROM appointment_notifications n
					WHERE n.appointment_id = a.id
				) AS notification_count,
				(
					SELECT n.status
					FROM appointment_notifications n
					WHERE n.appointment_id = a.id
						AND n.type = 'confirmation'
					ORDER BY n.created_at DESC
					LIMIT 1
				) AS confirmation_status,
				(
					SELECT n.status
					FROM appointment_notifications n
					WHERE n.appointment_id = a.id
						AND n.type = 'reminder'
					ORDER BY n.created_at DESC
					LIMIT 1
				) AS reminder_status
			FROM appointments a
			WHERE a.id = $1
		`,
		[appointmentId],
	);
}

/** Lists all appointments (most recent slots first) with notification status. */
export function selectAllAppointmentsWithNotifications() {
	return pool.query(`
		SELECT a.*,
			(
				SELECT count(*)::int
				FROM appointment_notifications n
				WHERE n.appointment_id = a.id
			) AS notification_count,
			(
				SELECT n.status
				FROM appointment_notifications n
				WHERE n.appointment_id = a.id
					AND n.type = 'confirmation'
				ORDER BY n.created_at DESC
				LIMIT 1
			) AS confirmation_status,
			(
				SELECT n.status
				FROM appointment_notifications n
				WHERE n.appointment_id = a.id
					AND n.type = 'reminder'
				ORDER BY n.created_at DESC
				LIMIT 1
			) AS reminder_status
		FROM appointments a
		ORDER BY a.slot_start ASC, a.created_at DESC
		LIMIT 100
	`);
}

/** The customer's next scheduled/checked-in appointment, if any. */
export function selectUpcomingAppointmentForCustomer(customerId: string) {
	return pool.query(
		`
			SELECT *
			FROM appointments
			WHERE customer_id = $1
				AND slot_start >= now()
				AND status IN ('scheduled', 'checked_in')
			ORDER BY slot_start ASC
			LIMIT 1
		`,
		[customerId],
	);
}

/** The customer's past or terminal appointments. */
export function selectPastAppointmentsForCustomer(customerId: string) {
	return pool.query(
		`
			SELECT *
			FROM appointments
			WHERE customer_id = $1
				AND (
					slot_start < now()
					OR status IN ('completed', 'cancelled', 'no_show')
				)
			ORDER BY slot_start DESC
			LIMIT 25
		`,
		[customerId],
	);
}

/** Existence check used before booking: an active upcoming appointment id. */
export function selectActiveUpcomingAppointmentId(customerId: string) {
	return pool.query(
		`
			SELECT id
			FROM appointments
			WHERE customer_id = $1
				AND slot_start >= now()
				AND status IN ('scheduled', 'checked_in')
			ORDER BY slot_start ASC
			LIMIT 1
		`,
		[customerId],
	);
}

export function selectAppointmentRowById(appointmentId: string) {
	return pool.query("SELECT * FROM appointments WHERE id = $1", [
		appointmentId,
	]);
}

export function selectAppointmentIdById(appointmentId: string) {
	return pool.query("SELECT id FROM appointments WHERE id = $1", [
		appointmentId,
	]);
}

export function selectAppointmentStatusById(appointmentId: string) {
	return pool.query("SELECT status FROM appointments WHERE id = $1", [
		appointmentId,
	]);
}

export function selectAppointmentStatusForCustomer(
	appointmentId: string,
	customerId: string,
) {
	return pool.query(
		`
			SELECT status
			FROM appointments
			WHERE id = $1
				AND customer_id = $2
		`,
		[appointmentId, customerId],
	);
}

// --- Appointments: writes ------------------------------------------------

/**
 * Inserts a booked appointment. `values` must be supplied in column order as
 * spelled out in the VALUES clause below (the caller already prepares the
 * JSON-encoded snapshot columns).
 */
export function insertAppointment(values: unknown[]) {
	return pool.query(
		`
			INSERT INTO appointments (
				id, customer_id, loyalty_id, customer_name, slot_start, slot_end, store_snapshot,
				occasion, focus_colors, avoid_colors, style_keywords, guidance,
				session_notes, status, muse_tag, assigned_stylist,
				order_history_summary, suggested_products, source_payload, outfit_analysis
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '', 'scheduled', $13, $14, $15, $16, $17, $18)
			RETURNING *
		`,
		values,
	);
}

export function updateAppointmentGuidance(
	guidance: string,
	appointmentId: string,
	customerId: string,
) {
	return pool.query(
		`
			UPDATE appointments
			SET guidance = $1
			WHERE id = $2
				AND customer_id = $3
				AND status NOT IN ('completed', 'cancelled', 'no_show')
			RETURNING *
		`,
		[guidance, appointmentId, customerId],
	);
}

export function updateAppointmentSessionNotes(
	sessionNotes: string,
	appointmentId: string,
) {
	return pool.query(
		`
			UPDATE appointments
			SET session_notes = $1
			WHERE id = $2
				AND status NOT IN ('completed', 'cancelled', 'no_show')
			RETURNING *
		`,
		[sessionNotes, appointmentId],
	);
}

export function updateAppointmentStylist(
	stylistJson: string,
	appointmentId: string,
) {
	return pool.query(
		`
			UPDATE appointments
			SET assigned_stylist = $1
			WHERE id = $2
				AND status = 'scheduled'
			RETURNING *
		`,
		[stylistJson, appointmentId],
	);
}

export function checkInAppointment(appointmentId: string) {
	return pool.query(
		`
			UPDATE appointments
			SET status = 'checked_in',
				checked_in_at = now()
			WHERE id = $1
				AND status = 'scheduled'
			RETURNING *
		`,
		[appointmentId],
	);
}

export function markAppointmentNoShow(appointmentId: string) {
	return pool.query(
		`
			UPDATE appointments
			SET status = 'no_show',
				no_show_at = now()
			WHERE id = $1
				AND status = 'scheduled'
			RETURNING *
		`,
		[appointmentId],
	);
}

export function cancelScheduledAppointment(
	cancelReason: string,
	appointmentId: string,
	customerId: string,
) {
	return pool.query(
		`
			UPDATE appointments
			SET status = 'cancelled',
				cancelled_at = now(),
				cancel_reason = COALESCE($1, '')
			WHERE id = $2
				AND customer_id = $3
				AND status = 'scheduled'
			RETURNING *
		`,
		[cancelReason, appointmentId, customerId],
	);
}

/** Cancels the customer's upcoming (scheduled/checked-in) appointment. */
export function cancelUpcomingAppointment(
	appointmentId: string,
	customerId: string,
) {
	return pool.query(
		`
			UPDATE appointments
			SET status = 'cancelled',
				cancelled_at = now()
			WHERE id = $1
				AND customer_id = $2
				AND slot_start >= now()
				AND status IN ('scheduled', 'checked_in')
			RETURNING id
		`,
		[appointmentId, customerId],
	);
}

export function updateAppointmentFeedback(
	rating: number,
	comment: string,
	appointmentId: string,
	customerId: string,
) {
	return pool.query(
		`
			UPDATE appointments
			SET customer_feedback_rating = $1,
				customer_feedback_comment = COALESCE($2, ''),
				customer_feedback_at = now()
			WHERE id = $3
				AND customer_id = $4
				AND status = 'completed'
			RETURNING *
		`,
		[rating, comment, appointmentId, customerId],
	);
}

export function updateAppointmentSuggestedProducts(
	suggestedProductsJson: string,
	appointmentId: string,
) {
	return pool.query(
		`
			UPDATE appointments
			SET suggested_products = $1
			WHERE id = $2
			RETURNING *
		`,
		[suggestedProductsJson, appointmentId],
	);
}

export function updateAppointmentOutfitAnalysis(
	outfitAnalysisJson: string | null,
	appointmentId: string,
) {
	return pool.query(
		"UPDATE appointments SET outfit_analysis = $1 WHERE id = $2 RETURNING *",
		[outfitAnalysisJson, appointmentId],
	);
}

export function updateAppointmentOutfitAnalysisAndProducts(
	outfitAnalysisJson: string | null,
	suggestedProductsJson: string,
	appointmentId: string,
) {
	return pool.query(
		"UPDATE appointments SET outfit_analysis = $1, suggested_products = $2 WHERE id = $3 RETURNING *",
		[outfitAnalysisJson, suggestedProductsJson, appointmentId],
	);
}

export function markAppointmentCompleted(
	sessionNotes: string | undefined,
	customerRecap: string,
	associateFeedback: string,
	appointmentId: string,
) {
	return pool.query(
		`
			UPDATE appointments
			SET session_notes = COALESCE($1, session_notes),
				customer_recap = $2,
				associate_feedback = COALESCE($3, ''),
				status = 'completed',
				completed_at = now()
			WHERE id = $4
				AND status IN ('scheduled', 'checked_in')
			RETURNING *
		`,
		[sessionNotes, customerRecap, associateFeedback, appointmentId],
	);
}

// --- Appointment messages ------------------------------------------------

export function selectAppointmentMessages(appointmentId: string) {
	return pool.query(
		`
			SELECT *
			FROM appointment_messages
			WHERE appointment_id = $1
			ORDER BY created_at ASC
		`,
		[appointmentId],
	);
}

export function insertAppointmentMessage(
	id: string,
	appointmentId: string,
	authorType: string,
	body: string,
) {
	return pool.query(
		`
			INSERT INTO appointment_messages (
				id, appointment_id, author_type, body
			)
			VALUES ($1, $2, $3, $4)
			RETURNING *
		`,
		[id, appointmentId, authorType, body],
	);
}

// --- Appointment notifications -------------------------------------------

export function selectAppointmentNotifications(appointmentId: string) {
	return pool.query(
		`
			SELECT *
			FROM appointment_notifications
			WHERE appointment_id = $1
			ORDER BY created_at ASC
		`,
		[appointmentId],
	);
}

/** Inserts the mock confirmation (sent) and reminder (queued) notifications. */
export function insertAppointmentNotifications(
	confirmationId: string,
	reminderId: string,
	appointmentId: string,
	reminderScheduledFor: string,
) {
	return pool.query(
		`
			INSERT INTO appointment_notifications (
				id, appointment_id, type, status, scheduled_for, sent_at
			)
			VALUES
				($1, $3, 'confirmation', 'sent', now(), now()),
				($2, $3, 'reminder', 'queued', $4, NULL)
		`,
		[confirmationId, reminderId, appointmentId, reminderScheduledFor],
	);
}
