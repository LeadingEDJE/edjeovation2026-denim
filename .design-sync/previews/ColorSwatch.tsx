import { ColorSwatch } from "@denim-fit/design-system";

const denim = [
	{ name: "Dark Wash", value: "#253746" },
	{ name: "Mid Indigo", value: "#3c5a7a" },
	{ name: "Light Wash", value: "#aebfce" },
	{ name: "Ecru", value: "#efe9dd" },
	{ name: "Black", value: "#1b1b1b" },
];

export const Default = () => <ColorSwatch options={denim} selectedIndex={0} />;

export const Selected = () => <ColorSwatch options={denim} selectedIndex={2} />;

export const Overflow = () => (
	<ColorSwatch
		options={[...denim, { name: "Stone", value: "#c6c6c6" }, { name: "Olive", value: "#5b6248" }]}
		maxVisible={4}
	/>
);
