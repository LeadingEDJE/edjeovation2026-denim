import { Button } from "@denim-fit/design-system";
import { ArrowRight, ShoppingBag } from "lucide-react";

const row: React.CSSProperties = {
	display: "flex",
	gap: 12,
	flexWrap: "wrap",
	alignItems: "center",
};

export const Primary = () => <Button variant="primary">Add to Bag</Button>;

export const Variants = () => (
	<div style={row}>
		<Button variant="primary">Add to Bag</Button>
		<Button variant="secondary">Find in Store</Button>
		<Button variant="tertiary">View details</Button>
	</div>
);

export const Inverse = () => (
	<div style={{ ...row, background: "#253746", padding: 24 }}>
		<Button variant="inverse">Shop the Look</Button>
	</div>
);

export const Sizes = () => (
	<div style={row}>
		<Button size="sm">Small</Button>
		<Button size="md">Medium</Button>
		<Button size="lg">Large</Button>
	</div>
);

export const WithIcon = () => (
	<div style={row}>
		<Button leadingIcon={<ShoppingBag size={16} />}>Add to Bag</Button>
		<Button variant="secondary" trailingIcon={<ArrowRight size={16} />}>
			Continue
		</Button>
	</div>
);

export const FullWidth = () => (
	<div style={{ width: 320 }}>
		<Button fullWidth size="lg">
			Checkout
		</Button>
	</div>
);

export const Disabled = () => (
	<div style={row}>
		<Button disabled>Add to Bag</Button>
		<Button variant="secondary" disabled>
			Find in Store
		</Button>
	</div>
);
