import { Price } from "@denim-fit/design-system";

const row: React.CSSProperties = {
	display: "flex",
	gap: 24,
	flexWrap: "wrap",
	alignItems: "center",
};

export const Regular = () => <Price price={89} />;

export const OnSale = () => <Price price={49.99} originalPrice={89} />;

export const Both = () => (
	<div style={row}>
		<Price price={89} />
		<Price price={49.99} originalPrice={89} />
		<Price price="From $19.50" />
	</div>
);
