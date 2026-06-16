import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface PriceProps extends HTMLAttributes<HTMLSpanElement> {
	/** The current selling price, already formatted or a number. */
	price: number | string;
	/** Original price shown struck-through when the item is on sale. */
	originalPrice?: number | string;
	/** Currency symbol prefixed to numeric values. Defaults to `$`. */
	currency?: string;
}

function format(value: number | string, currency: string): string {
	return typeof value === "number" ? `${currency}${value.toFixed(2)}` : value;
}

/**
 * Displays a product price, optionally with a struck-through original price when
 * on sale (the current price then renders in the sale red).
 */
export function Price({
	price,
	originalPrice,
	currency = "$",
	className,
	...rest
}: PriceProps) {
	const onSale = originalPrice != null;
	return (
		<span
			className={cn(
				"inline-flex items-baseline gap-2 font-body text-sm",
				className,
			)}
			{...rest}
		>
			<span className={cn("font-semibold", onSale ? "text-sale" : "text-ink")}>
				{format(price, currency)}
			</span>
			{onSale && (
				<span className="text-muted line-through">
					{format(originalPrice, currency)}
				</span>
			)}
		</span>
	);
}
