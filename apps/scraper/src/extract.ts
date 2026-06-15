/**
 * Pure extraction/normalization helpers. No browser or DB here so they stay
 * easy to reason about and test. The scraper feeds these the text it reads
 * from the page (product name, description, ld+json) and gets back normalized
 * fit attributes that line up with the API's fitPreference/stretchPreference.
 */

export type FitPreference = "skinny" | "slim" | "straight" | "relaxed" | "wide";
export type Rise = "ultra-high" | "high" | "mid" | "low";
export type StretchPreference = "rigid" | "comfort-stretch" | "high-stretch";

export type DerivedAttributes = {
	fit: FitPreference | null;
	rise: Rise | null;
	stretch: StretchPreference | null;
};

/**
 * Map the marketing fit words A&F uses onto the app's five fitPreference
 * values. Order matters: more specific phrases are checked first.
 */
export function deriveFit(text: string): FitPreference | null {
	const t = text.toLowerCase();
	if (/\bskinny\b|\bjegging/.test(t)) return "skinny";
	if (/\bslim\b/.test(t)) return "slim";
	if (/\bstraight\b/.test(t)) return "straight";
	if (
		/\bbaggy\b|\bwide\b|\bwide[- ]leg\b|\bflare\b|\bbootcut\b|\bboot[- ]cut\b|\bloose\b/.test(
			t,
		)
	)
		return "wide";
	if (/\brelaxed\b|\bmom\b|\bdad\b|\b90s\b|\bbarrel\b|\bcurve love\b/.test(t))
		return "relaxed";
	return null;
}

export function deriveRise(text: string): Rise | null {
	const t = text.toLowerCase();
	if (/\bultra high[- ]?rise\b|\bsuper high[- ]?rise\b/.test(t))
		return "ultra-high";
	if (/\bhigh[- ]?rise\b|\bhigh rise\b/.test(t)) return "high";
	if (/\bmid[- ]?rise\b|\bmid rise\b/.test(t)) return "mid";
	if (/\blow[- ]?rise\b|\blow rise\b/.test(t)) return "low";
	return null;
}

export function deriveStretch(text: string): StretchPreference | null {
	const t = text.toLowerCase();
	if (/\bhigh[- ]?stretch\b|\bsuper stretch\b|\bextra stretch\b/.test(t))
		return "high-stretch";
	if (/\bcomfort stretch\b|\bslight stretch\b|\bstretch\b/.test(t)) {
		// "non-stretch"/"rigid" handled below; only land here for genuine stretch.
		if (/\bnon[- ]?stretch\b|\brigid\b|\b100% cotton\b/.test(t)) return "rigid";
		return "comfort-stretch";
	}
	if (/\bnon[- ]?stretch\b|\brigid\b/.test(t)) return "rigid";
	return null;
}

export function deriveAttributes(
	name: string,
	description: string,
): DerivedAttributes {
	const text = `${name} ${description}`;
	return {
		fit: deriveFit(text),
		rise: deriveRise(text),
		stretch: deriveStretch(text),
	};
}

/**
 * Pull the trailing numeric product id from an A&F product URL/slug, e.g.
 * ".../p/high-rise-90s-relaxed-jean-61808905?..." -> "61808905".
 */
export function productIdFromUrl(url: string): string | null {
	const path = url.split("?")[0];
	const match = path.match(/-(\d{4,})\/?$/);
	return match ? match[1] : null;
}

export type LdProduct = {
	name: string | null;
	sku: string | null;
	image: string | null;
	description: string | null;
	url: string | null;
	price: number | null;
	currency: string | null;
	availability: string | null;
};

/** Parse the schema.org Product object out of a PDP's ld+json blocks. */
export function parseLdProduct(blocks: string[]): LdProduct | null {
	for (const block of blocks) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(block);
		} catch {
			continue;
		}
		const candidates = Array.isArray(parsed) ? parsed : [parsed];
		for (const c of candidates) {
			if (
				c &&
				typeof c === "object" &&
				(c as Record<string, unknown>)["@type"] === "Product"
			) {
				return normalizeLdProduct(c as Record<string, unknown>);
			}
		}
	}
	return null;
}

function normalizeLdProduct(p: Record<string, unknown>): LdProduct {
	const offers = (Array.isArray(p.offers) ? p.offers[0] : p.offers) as
		| Record<string, unknown>
		| undefined;
	const { price, currency } = extractPrice(offers);
	return {
		name: asString(p.name),
		sku: asString(p.SKU ?? p.sku),
		image: asString(Array.isArray(p.image) ? p.image[0] : p.image),
		description: asString(p.description),
		url: asString(p.url),
		price,
		currency,
		availability: asString(offers?.availability),
	};
}

function extractPrice(offers?: Record<string, unknown>): {
	price: number | null;
	currency: string | null;
} {
	if (!offers) return { price: null, currency: null };
	if (offers.price != null) {
		return {
			price: toNumber(offers.price),
			currency: asString(offers.priceCurrency),
		};
	}
	const specs = offers.priceSpecification;
	const spec = (Array.isArray(specs) ? specs[0] : specs) as
		| Record<string, unknown>
		| undefined;
	if (spec)
		return {
			price: toNumber(spec.price),
			currency: asString(spec.priceCurrency),
		};
	return { price: null, currency: null };
}

function asString(v: unknown): string | null {
	return typeof v === "string" && v.trim() ? v.trim() : null;
}

function toNumber(v: unknown): number | null {
	if (typeof v === "number") return v;
	if (typeof v === "string") {
		const n = Number(v.replace(/[^0-9.]/g, ""));
		return Number.isFinite(n) ? n : null;
	}
	return null;
}
