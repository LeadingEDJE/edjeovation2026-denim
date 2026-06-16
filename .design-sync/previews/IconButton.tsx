import { IconButton } from "@denim-fit/design-system";
import { Heart, Search, ShoppingBag, User } from "lucide-react";

export const Utilities = () => (
	<div style={{ display: "flex", gap: 4, alignItems: "center" }}>
		<IconButton label="Search" icon={<Search size={20} strokeWidth={1.5} />} />
		<IconButton label="Account" icon={<User size={20} strokeWidth={1.5} />} />
		<IconButton label="Wishlist" icon={<Heart size={20} strokeWidth={1.5} />} />
		<IconButton
			label="Bag"
			icon={<ShoppingBag size={20} strokeWidth={1.5} />}
		/>
	</div>
);
