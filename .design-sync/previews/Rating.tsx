import { Rating } from "@denim-fit/design-system";

const col: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 10,
};

export const Default = () => <Rating value={4} count={128} />;

export const Range = () => (
	<div style={col}>
		<Rating value={5} count={342} />
		<Rating value={4} count={128} />
		<Rating value={3} count={56} />
		<Rating value={2} count={9} />
	</div>
);

export const NoCount = () => <Rating value={4} />;
