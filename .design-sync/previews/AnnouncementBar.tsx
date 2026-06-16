import { AnnouncementBar } from "@denim-fit/design-system";

const stack: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 12,
	width: 720,
};

export const Default = () => (
	<div style={{ width: 720 }}>
		<AnnouncementBar
			messages={[
				"Free Standard Shipping On Orders Over $99",
				"Up To 60% Off Clearance",
			]}
		/>
	</div>
);

export const Sale = () => (
	<div style={{ width: 720 }}>
		<AnnouncementBar
			sale
			messages={["Clearance — Up To 60% Off", "Final Sale, Limited Time"]}
		/>
	</div>
);

export const Both = () => (
	<div style={stack}>
		<AnnouncementBar messages={["Free Standard Shipping On Orders Over $99"]} />
		<AnnouncementBar sale messages={["Clearance — Up To 60% Off"]} />
	</div>
);
