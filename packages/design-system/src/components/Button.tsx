import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "inverse" | "tertiary";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** Visual emphasis. `primary` is the filled slate-navy CTA; `secondary` is outlined; `inverse` is for dark backgrounds; `tertiary` is an underlined text link. */
	variant?: ButtonVariant;
	/** Control height and padding. Defaults to `md`. */
	size?: ButtonSize;
	/** Stretch to the full width of the container. */
	fullWidth?: boolean;
	/** Optional leading icon (e.g. a lucide-react icon element). */
	leadingIcon?: ReactNode;
	/** Optional trailing icon. */
	trailingIcon?: ReactNode;
	children?: ReactNode;
}

const base =
	"items-center justify-center gap-2 font-body font-bold uppercase tracking-cta rounded-none border transition-colors whitespace-nowrap select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:pointer-events-none";

const sizes: Record<ButtonSize, string> = {
	sm: "text-xs px-4 py-2 min-h-[34px]",
	md: "text-sm px-7 py-3 min-h-[44px]",
	lg: "text-sm px-10 py-4 min-h-[52px]",
};

const variants: Record<ButtonVariant, string> = {
	primary:
		"bg-ink text-white border-ink hover:bg-ink-deep hover:border-ink-deep disabled:bg-disabled disabled:border-disabled disabled:text-white",
	secondary:
		"bg-transparent text-ink border-ink hover:bg-ink hover:text-white disabled:text-disabled disabled:border-disabled",
	inverse:
		"bg-white text-ink border-white hover:bg-transparent hover:text-white disabled:opacity-60",
	tertiary:
		"bg-transparent text-ink border-transparent !px-0 !py-0 min-h-0 underline underline-offset-4 hover:text-ink-deep disabled:text-disabled disabled:no-underline",
};

/**
 * The primary call-to-action control. Square corners, uppercase tracked label.
 * Use `primary` for the single dominant action on a surface (e.g. "Add to Bag"),
 * `secondary` for alternatives, and `tertiary` for low-emphasis inline links.
 */
export function Button({
	variant = "primary",
	size = "md",
	fullWidth = false,
	leadingIcon,
	trailingIcon,
	className,
	children,
	type = "button",
	...rest
}: ButtonProps) {
	return (
		<button
			type={type}
			className={cn(
				fullWidth ? "flex w-full" : "inline-flex",
				base,
				sizes[size],
				variants[variant],
				className,
			)}
			{...rest}
		>
			{leadingIcon}
			{children}
			{trailingIcon}
		</button>
	);
}
