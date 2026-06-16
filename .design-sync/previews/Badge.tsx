import { Badge } from "@denim-fit/design-system";

const row: React.CSSProperties = {
	display: "flex",
	gap: 10,
	flexWrap: "wrap",
	alignItems: "center",
};

export const Variants = () => (
	<div style={row}>
		<Badge variant="sale">Sale</Badge>
		<Badge variant="new">New</Badge>
		<Badge variant="neutral">Online Exclusive</Badge>
		<Badge variant="outline">Limited</Badge>
	</div>
);

export const Sale = () => <Badge variant="sale">40% Off</Badge>;
