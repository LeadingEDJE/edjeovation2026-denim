import { Rating } from "@denim-fit/design-system";
import type { Appointment, StylistProfile } from "../../api";
import { formatAppointmentDateTime } from "../../formatters";
import { CustomerSnapshot } from "./CustomerSnapshot";
import {
	formatPrice,
	MetaLabel,
	ProductShot,
	SectionTitle,
	shortRef,
	specLine,
} from "./shared";

export function RecapDetail({
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
								"{appointment.customerFeedbackComment}"
							</p>
						</>
					) : null}
				</div>
			) : null}

			{/* body */}
			<div className="grid grid-cols-1 min-[1040px]:grid-cols-[360px_1fr]">
				<div className="order-2 border-line-subtle px-5 py-7 min-[1040px]:order-none min-[1040px]:border-r min-[760px]:px-7">
					<CustomerSnapshot appointment={appointment} />
				</div>

				<div className="order-1 px-5 py-7 min-[1040px]:order-none min-[760px]:px-8">
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
