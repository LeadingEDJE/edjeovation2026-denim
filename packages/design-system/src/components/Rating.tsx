import { Star } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface RatingProps extends HTMLAttributes<HTMLSpanElement> {
	/** Rating from 0 to `max`. Rounded to the nearest whole star for display. */
	value: number;
	/** Maximum number of stars. Defaults to 5. */
	max?: number;
	/** Optional review count shown beside the stars. */
	count?: number;
}

/**
 * A compact star rating with an optional review count — typically shown on
 * product tiles and PDPs.
 */
export function Rating({
	value,
	max = 5,
	count,
	className,
	...rest
}: RatingProps) {
	const filled = Math.round(value);
	return (
		<span className={cn("inline-flex items-center gap-2", className)} {...rest}>
			<span
				className="inline-flex text-ink"
				role="img"
				aria-label={`${value} out of ${max} stars`}
			>
				{Array.from({ length: max }, (_, i) => `star-${i}`).map((id, i) => (
					<Star
						key={id}
						size={14}
						aria-hidden
						className={cn(i < filled ? "text-ink" : "text-line")}
						fill={i < filled ? "currentColor" : "none"}
						strokeWidth={1.5}
					/>
				))}
			</span>
			{count != null && <span className="text-2xs text-muted">({count})</span>}
		</span>
	);
}
