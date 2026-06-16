import { Heart, Search, ShoppingBag, User } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";
import { IconButton } from "./IconButton";

export interface NavLink {
	/** Link label. */
	label: string;
	/** Destination href. */
	href: string;
	/** Marks the currently active section. */
	active?: boolean;
	/** Renders the label in the sale red (for clearance entries). */
	sale?: boolean;
}

export interface NavBarProps extends HTMLAttributes<HTMLElement> {
	/** Brand wordmark text shown on the left. */
	brand?: string;
	/** Destination for the brand wordmark. Defaults to the site root. */
	brandHref?: string;
	/** Primary category navigation links. */
	links?: NavLink[];
	/** Item count shown on the bag icon. */
	bagCount?: number;
}

/**
 * The site header: brand wordmark, primary category links, and the standard
 * search / account / wishlist / bag utility icons. Square, flat, hairline-bottom.
 */
export function NavBar({
	brand = "DENIM & CO.",
	brandHref = "/",
	links = [],
	bagCount,
	className,
	...rest
}: NavBarProps) {
	return (
		<nav
			className={cn(
				"border-line-subtle border-b bg-white font-body",
				className,
			)}
			{...rest}
		>
			<div className="mx-auto flex min-h-[75px] max-w-[1440px] items-center justify-between gap-6 px-6">
				<a
					className="whitespace-nowrap font-display font-medium text-ink text-xl tracking-tight no-underline"
					href={brandHref}
				>
					{brand}
				</a>
				<ul className="m-0 flex list-none items-center gap-6 p-0">
					{links.map((link) => (
						<li key={link.label}>
							<a
								className={cn(
									"border-transparent border-b-2 py-2 font-semibold text-sm uppercase tracking-cta no-underline transition-colors hover:border-ink",
									link.active && "border-ink",
									link.sale ? "text-sale" : "text-ink",
								)}
								href={link.href}
							>
								{link.label}
							</a>
						</li>
					))}
				</ul>
				<div className="flex items-center gap-1">
					<IconButton
						label="Search"
						icon={<Search size={20} strokeWidth={1.5} />}
					/>
					<IconButton
						label="Account"
						icon={<User size={20} strokeWidth={1.5} />}
					/>
					<IconButton
						label="Wishlist"
						icon={<Heart size={20} strokeWidth={1.5} />}
					/>
					<IconButton
						label={bagCount != null ? `Bag, ${bagCount} items` : "Bag"}
						icon={<ShoppingBag size={20} strokeWidth={1.5} />}
					/>
				</div>
			</div>
		</nav>
	);
}
