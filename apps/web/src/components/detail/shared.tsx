import type { Appointment, CatalogProduct, SuggestedProduct } from "../../api";
import { colorNameToHex, splitColorList } from "../../formatters";

export function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<div className="mb-4">
			<p className="font-display font-semibold text-[13px] text-ink uppercase tracking-label">
				{children}
			</p>
			<span className="mt-1 block h-0.5 w-[34px] bg-ink" />
		</div>
	);
}

export function MetaLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="mb-2 font-bold text-2xs text-muted uppercase tracking-label">
			{children}
		</p>
	);
}

export function Chips({ items }: { items: string[] }) {
	if (items.length === 0) return null;
	return (
		<div className="flex flex-wrap gap-1.5">
			{items.map((item) => (
				<span key={item} className="bg-chip px-2.5 py-1 text-[11px] text-navy">
					{item}
				</span>
			))}
		</div>
	);
}

export function SwatchRow({ value }: { value: string }) {
	const items = splitColorList(value);
	if (items.length === 0) {
		return <p className="text-[13px] text-muted">None specified</p>;
	}
	return (
		<div className="flex flex-wrap gap-x-4 gap-y-2">
			{items.map((name) => (
				<span key={name} className="flex items-center gap-2">
					<span
						className="block h-4 w-4 border border-line-subtle"
						style={{ backgroundColor: colorNameToHex(name) }}
					/>
					<span className="text-[13px] text-ink">{name}</span>
				</span>
			))}
		</div>
	);
}

export function Stat({ value, label }: { value: string; label: string }) {
	return (
		<div className="bg-surface px-4 py-3.5">
			<p className="font-display font-semibold text-[26px] text-ink leading-none">
				{value}
			</p>
			<p className="mt-1.5 font-bold text-2xs text-muted uppercase tracking-label">
				{label}
			</p>
		</div>
	);
}

export function ProductShot({ suggestion }: { suggestion: SuggestedProduct }) {
	const { imageUrl, name, productUrl } = suggestion.product;
	return (
		<a
			className="block h-[100px] w-[78px] shrink-0 overflow-hidden border border-line-subtle bg-surface"
			href={productUrl}
			target="_blank"
			rel="noreferrer"
		>
			{imageUrl ? (
				<img
					className="h-full w-full object-cover"
					src={imageUrl}
					alt={name}
					loading="lazy"
				/>
			) : (
				<span
					className="flex h-full w-full items-end justify-center pb-1.5"
					style={{
						backgroundImage:
							"repeating-linear-gradient(135deg,#2c4a63,#2c4a63 3px,#27455c 3px,#27455c 6px)",
					}}
				>
					<span className="font-mono text-[7px] text-steel tracking-[0.08em]">
						PRODUCT SHOT
					</span>
				</span>
			)}
		</a>
	);
}

export function shortRef(appointment: Appointment) {
	return `#${appointment.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export function formatPrice(price: number | null, currency: string | null) {
	if (price == null) return null;
	return `${currency ?? "$"}${price.toFixed(2)}`;
}

export function specLine(product: CatalogProduct) {
	return [product.category, product.fit, product.rise, product.stretch]
		.filter(Boolean)
		.join(" · ");
}
