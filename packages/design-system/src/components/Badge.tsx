import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

export type BadgeVariant = "sale" | "new" | "neutral" | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	/** Tone of the badge. `sale` is the clearance red, `new` is slate-navy, `neutral`/`outline` are quiet. */
	variant?: BadgeVariant;
	children?: ReactNode;
}

const variants: Record<BadgeVariant, string> = {
	sale: "bg-sale text-white",
	new: "bg-ink text-white",
	neutral: "bg-surface-muted text-ink",
	outline: "bg-transparent text-ink border border-ink",
};

/**
 * A small uppercase label for merchandising flags — "Sale", "New", "Online Exclusive".
 * Overlays product imagery or sits inline with copy.
 */
export function Badge({
	variant = "neutral",
	className,
	children,
	...rest
}: BadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-none px-2 py-1 font-body font-bold text-2xs uppercase leading-none tracking-label",
				variants[variant],
				className,
			)}
			{...rest}
		>
			{children}
		</span>
	);
}
