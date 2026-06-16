import { TextField } from "@denim-fit/design-system";

const col: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 20, width: 320 };

export const Default = () => (
	<div style={{ width: 320 }}>
		<TextField label="Email" placeholder="you@example.com" />
	</div>
);

export const States = () => (
	<div style={col}>
		<TextField label="Email" placeholder="you@example.com" hint="We'll send order updates here." />
		<TextField label="Email" defaultValue="not-an-email" error="Enter a valid email address." />
		<TextField label="Full name" defaultValue="Wesley King" />
	</div>
);
