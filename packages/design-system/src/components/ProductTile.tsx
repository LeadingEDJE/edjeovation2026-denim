import { Heart } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";
import { Badge } from "./Badge";
import { ColorSwatch, type SwatchOption } from "./ColorSwatch";
import { Price } from "./Price";
import { Rating } from "./Rating";

export interface ProductTileProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
	/** Product display name. */
	name: string;
	/** Image URL for the product shot. */
	imageSrc: string;
	/** Current price (number is formatted with `currency`). */
	price: number | string;
	/** Original price — renders struck-through and flips the price to sale red. */
	originalPrice?: number | string;
	/** Optional merchandising flag text (e.g. "New", "Sale"). */
	badge?: string;
	/** Tone for the badge. Defaults to `new`. */
	badgeVariant?: "sale" | "new" | "neutral";
	/** Optional color options shown beneath the name. */
	colors?: SwatchOption[];
	/** Optional average star rating. */
	rating?: number;
	/** Optional review count shown beside the rating. */
	reviewCount?: number;
	/** Show the wishlist (heart) affordance. Defaults to true. */
	wishlist?: boolean;
	/** Fires when the wishlist heart is clicked. */
	onWishlist?: () => void;
}

/**
 * The merchandising workhorse: a product card with image, optional flag badge,
 * wishlist affordance, name, price (with sale handling), color swatches, and an
 * optional rating. Drop these into a responsive grid for category pages.
 */
export function ProductTile({
	name,
	imageSrc,
	price,
	originalPrice,
	badge,
	badgeVariant = "new",
	colors,
	rating,
	reviewCount,
	wishlist = true,
	onWishlist,
	className,
	...rest
}: ProductTileProps) {
	return (
		<div
			className={cn("flex flex-col bg-white text-left font-body", className)}
			{...rest}
		>
			<div className="relative aspect-[3/4] overflow-hidden bg-surface-subtle">
				{badge && (
					<span className="absolute top-3 left-3">
						<Badge variant={badgeVariant}>{badge}</Badge>
					</span>
				)}
				{wishlist && (
					<button
						type="button"
						className="absolute top-2 right-2 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-white/85 text-ink hover:bg-white"
						aria-label="Add to wishlist"
						onClick={onWishlist}
					>
						<Heart size={18} strokeWidth={1.5} aria-hidden />
					</button>
				)}
				<img
					className="block h-full w-full object-cover"
					src={imageSrc}
					alt={name}
					loading="lazy"
				/>
			</div>
			<div className="flex flex-col gap-2 pt-3">
				<h3 className="m-0 font-semibold text-ink text-sm leading-snug">
					{name}
				</h3>
				{rating != null && <Rating value={rating} count={reviewCount} />}
				<div className="flex items-center justify-between gap-2">
					<Price price={price} originalPrice={originalPrice} />
					{colors && colors.length > 0 && <ColorSwatch options={colors} />}
				</div>
			</div>
		</div>
	);
}
