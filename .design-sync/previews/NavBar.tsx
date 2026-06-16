import { NavBar } from "@denim-fit/design-system";

const links = [
	{ label: "Women", href: "/women", active: true },
	{ label: "Men", href: "/men" },
	{ label: "Kids", href: "/kids" },
	{ label: "Clearance", href: "/sale", sale: true },
];

export const Default = () => (
	<div style={{ width: 960 }}>
		<NavBar brand="DENIM & CO." links={links} bagCount={2} />
	</div>
);
