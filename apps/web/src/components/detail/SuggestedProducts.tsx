import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { Appointment, SuggestedProduct } from "../../api";
import { formatPrice, ProductShot, specLine } from "./shared";

const PREP_OPTIONS: Array<{
	value: SuggestedProduct["prepStatus"];
	label: string;
}> = [
	{ value: "suggested", label: "Suggested" },
	{ value: "pulled", label: "Pulled" },
	{ value: "skipped", label: "Skip" },
];

export function PrepSegment({
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

export function SuggestedProducts({
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

	const isPending = appointment.suggestionsStatus === "pending";
	const hasFailed = appointment.suggestionsStatus === "failed";

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

			{isPending ? (
				<div className="flex items-center gap-2.5 border-line-subtle border-b bg-surface-subtle px-5 py-3.5 text-[13px] text-muted">
					<Loader2 size={15} className="animate-spin" />
					Preparing your picks… this can take a moment.
				</div>
			) : hasFailed ? (
				<div className="border-line-subtle border-b bg-surface-subtle px-5 py-3.5 text-[13px] text-sale">
					We couldn't generate suggestions. Use Regenerate to try again.
				</div>
			) : null}

			{appointment.suggestedProducts.length === 0 ? (
				// While pending (first run) or failed, the banner above already
				// explains the empty list — only show the "none" copy once ready.
				appointment.suggestionsStatus === "ready" ? (
					<p className="p-5 text-[0.9rem] text-muted">
						No suggested products for this appointment.
					</p>
				) : null
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
