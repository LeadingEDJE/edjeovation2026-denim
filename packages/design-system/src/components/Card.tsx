import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";
import { Button } from "./Button";

export type CardVariant = "flat" | "bordered";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
	/** Optional image URL for the editorial media area. */
	imageSrc?: string;
	/** Small uppercase kicker above the title (e.g. "New Arrivals"). */
	eyebrow?: string;
	/** Card heading. */
	title?: string;
	/** Supporting body copy. */
	text?: string;
	/** Optional call-to-action label; renders a secondary button when set. */
	ctaLabel?: string;
	/** Fires when the CTA is clicked. */
	onCta?: () => void;
	/** `flat` (default) has no border; `bordered` adds a hairline frame. */
	variant?: CardVariant;
	/** Custom body content; overrides eyebrow/title/text/cta when provided. */
	children?: ReactNode;
}

/**
 * An editorial / category card pairing imagery with a kicker, title, copy, and an
 * optional CTA — the building block for homepage and landing-page grids. Pass
 * `children` for fully custom body content.
 */
export function Card({
	imageSrc,
	eyebrow,
	title,
	text,
	ctaLabel,
	onCta,
	variant = "flat",
	className,
	children,
	...rest
}: CardProps) {
	return (
		<div
			className={cn(
				"flex flex-col rounded-none bg-white font-body",
				variant === "bordered" && "border border-line-subtle",
				className,
			)}
			{...rest}
		>
			{imageSrc && (
				<div className="relative aspect-[4/5] overflow-hidden bg-surface-subtle">
					<img
						className="block h-full w-full object-cover"
						src={imageSrc}
						alt={title ?? ""}
						loading="lazy"
					/>
				</div>
			)}
			<div
				className={cn(
					"flex flex-col gap-3 py-5",
					variant === "bordered" ? "px-5" : "px-0",
				)}
			>
				{children ?? (
					<>
						{eyebrow && (
							<p className="m-0 font-bold text-2xs text-muted uppercase tracking-label">
								{eyebrow}
							</p>
						)}
						{title && (
							<h3 className="m-0 font-display font-medium text-3xl text-ink leading-tight tracking-tight">
								{title}
							</h3>
						)}
						{text && <p className="m-0 text-body text-sm">{text}</p>}
						{ctaLabel && (
							<div className="mt-2">
								<Button variant="secondary" size="sm" onClick={onCta}>
									{ctaLabel}
								</Button>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
