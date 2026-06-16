import { Card } from "@denim-fit/design-system";

const img = (label: string, bg: string) =>
	`data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='600'><rect width='480' height='600' fill='${bg}'/><text x='240' y='310' fill='%23ffffff' font-family='sans-serif' font-size='28' letter-spacing='3' text-anchor='middle'>${label}</text></svg>`;

export const Editorial = () => (
	<div style={{ width: 320 }}>
		<Card
			imageSrc={img("SUMMER", "%23253746")}
			eyebrow="New Arrivals"
			title="The Linen Edit"
			text="Lightweight, breathable staples built for warm-weather layering."
			ctaLabel="Shop the Edit"
		/>
	</div>
);

export const Bordered = () => (
	<div style={{ width: 320 }}>
		<Card
			variant="bordered"
			imageSrc={img("DENIM", "%2327455c")}
			eyebrow="Best Sellers"
			title="Denim Fit Guide"
			text="From high-rise skinny to relaxed straight — find your perfect leg."
			ctaLabel="Find Your Fit"
		/>
	</div>
);

export const Row = () => (
	<div
		style={{
			display: "grid",
			gridTemplateColumns: "repeat(2, 300px)",
			gap: 24,
		}}
	>
		<Card
			imageSrc={img("WOMEN", "%23253746")}
			eyebrow="Women"
			title="Shop Women"
			ctaLabel="Shop Now"
		/>
		<Card
			imageSrc={img("MEN", "%2327455c")}
			eyebrow="Men"
			title="Shop Men"
			ctaLabel="Shop Now"
		/>
	</div>
);
