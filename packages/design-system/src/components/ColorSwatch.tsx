import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface SwatchOption {
	/** Human-readable color name, used as the accessible label. */
	name: string;
	/** Any valid CSS color (hex, rgb, or a url() for printed/patterned swatches). */
	value: string;
}

export interface ColorSwatchProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
	/** The available color options. */
	options: SwatchOption[];
	/** Index of the currently selected option. */
	selectedIndex?: number;
	/** Cap how many swatches render before collapsing into a "+N" label. */
	maxVisible?: number;
	/** Fires with the index of the clicked swatch. */
	onSelect?: (index: number) => void;
}

/**
 * A row of selectable color chips for product color/finish choice. Beyond
 * `maxVisible`, the remainder collapse into a quiet "+N" count.
 */
export function ColorSwatch({
	options,
	selectedIndex = 0,
	maxVisible = 6,
	onSelect,
	className,
	...rest
}: ColorSwatchProps) {
	const visible = options.slice(0, maxVisible);
	const hidden = options.length - visible.length;
	return (
		<div className={cn("inline-flex items-center gap-2", className)} {...rest}>
			{visible.map((opt, i) => (
				<button
					key={opt.name}
					type="button"
					aria-label={opt.name}
					aria-pressed={i === selectedIndex}
					title={opt.name}
					className={cn(
						"h-[18px] w-[18px] cursor-pointer rounded-full border border-line bg-clip-padding p-0 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy",
						i === selectedIndex &&
							"ring-2 ring-ink ring-offset-1 ring-offset-white",
					)}
					style={{ background: opt.value }}
					onClick={() => onSelect?.(i)}
				/>
			))}
			{hidden > 0 && <span className="text-2xs text-muted">+{hidden}</span>}
		</div>
	);
}
