import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface AnnouncementBarProps extends HTMLAttributes<HTMLElement> {
	/** Promotional messages, shown centered and separated by dots. */
	messages: string[];
	/** Use the sale-red background instead of slate-navy. */
	sale?: boolean;
}

/**
 * The slim promotional strip that sits above the navigation — running offers
 * like free-shipping thresholds and clearance callouts. Pass `sale` for the red
 * treatment.
 */
export function AnnouncementBar({
	messages,
	sale = false,
	className,
	...rest
}: AnnouncementBarProps) {
	return (
		<section
			className={cn(
				"overflow-hidden font-body font-semibold text-2xs text-white uppercase tracking-label",
				sale ? "bg-sale" : "bg-ink",
				className,
			)}
			aria-label="Promotions"
			{...rest}
		>
			<div className="flex flex-wrap items-center justify-center gap-4 px-4 py-2">
				{messages.map((msg, i) => (
					<span key={msg} className="whitespace-nowrap">
						{i > 0 && (
							<span className="opacity-50" aria-hidden>
								{"•  "}
							</span>
						)}
						{msg}
					</span>
				))}
			</div>
		</section>
	);
}
