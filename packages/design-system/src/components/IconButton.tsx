import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

export interface IconButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** The icon to render (e.g. a lucide-react icon element). */
	icon: ReactNode;
	/** Accessible label — required because the button has no visible text. */
	label: string;
}

/**
 * A borderless square control wrapping a single icon — used for header utilities
 * (search, account, bag) and other compact actions. Always pass `label` for a11y.
 */
export function IconButton({
	icon,
	label,
	className,
	type = "button",
	...rest
}: IconButtonProps) {
	return (
		<button
			type={type}
			aria-label={label}
			className={cn(
				"inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-none border-0 bg-transparent p-0 text-ink transition-colors hover:text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy",
				className,
			)}
			{...rest}
		>
			{icon}
		</button>
	);
}
