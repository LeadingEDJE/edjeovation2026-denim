import { ProductTile } from "@denim-fit/design-system";

// Self-contained placeholder art so the media area renders offline.
const img = (label: string, bg: string) =>
	`data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400'><rect width='300' height='400' fill='${bg}'/><text x='150' y='208' fill='%23ffffff' font-family='sans-serif' font-size='20' letter-spacing='2' text-anchor='middle'>${label}</text></svg>`;

const colors = [
	{ name: "Dark Wash", value: "#253746" },
	{ name: "Mid Indigo", value: "#3c5a7a" },
	{ name: "Light Wash", value: "#aebfce" },
];

export const Default = () => (
	<div style={{ width: 260 }}>
		<ProductTile
			name="Curve Love High Rise Ankle Jean"
			imageSrc={img("DENIM", "%23253746")}
			price={89}
			rating={4}
			reviewCount={128}
			colors={colors}
		/>
	</div>
);

export const OnSale = () => (
	<div style={{ width: 260 }}>
		<ProductTile
			name="Relaxed Straight Crop Jean"
			imageSrc={img("SALE", "%239e3533")}
			price={49.99}
			originalPrice={89}
			badge="Sale"
			badgeVariant="sale"
			rating={5}
			reviewCount={342}
			colors={colors}
		/>
	</div>
);

export const Grid = () => (
	<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 220px)", gap: 24 }}>
		<ProductTile name="High Rise Skinny Jean" imageSrc={img("DENIM", "%23253746")} price={79} badge="New" rating={4} reviewCount={64} colors={colors} />
		<ProductTile name="Loose Pleated Trouser" imageSrc={img("TROUSER", "%2327455c")} price={89} rating={5} reviewCount={203} colors={colors} />
		<ProductTile name="Baggy Carpenter Jean" imageSrc={img("SALE", "%239e3533")} price={59} originalPrice={99} badge="Sale" badgeVariant="sale" rating={4} reviewCount={41} colors={colors} />
	</div>
);
