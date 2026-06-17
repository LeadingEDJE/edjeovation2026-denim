/**
 * Rule-based scoring for the catalog-backed recommendation engine — the cheap,
 * deterministic first stage of the hybrid pipeline. It scores any catalog
 * product (not just denim) against the customer's fit profile and the
 * appointment's color context, then builds a category-diverse shortlist the
 * Claude re-ranker refines. Pure functions only (no DB, no network) so the
 * scoring is easy to unit-test and reason about.
 */
import type { CatalogProduct } from "./types.js";

export type CoarseCategory =
	| "bottoms"
	| "dresses"
	| "tops"
	| "outerwear"
	| "other";

/**
 * Bucket free-text garment wording into a coarse category. Order matters: more
 * specific buckets (outerwear, dresses, bottoms) are checked before tops so a
 * "denim jacket" or "denim dress" isn't miscategorized as bottoms by "denim".
 */
export function coarseCategoryFromText(text: string): CoarseCategory {
	const lower = text.toLowerCase();
	// Stems are anchored at a word start (\b) but NOT at the end, so plural and
	// suffixed forms still match ("pants", "jeans", "dresses", "jackets"). This is
	// for free-text garment wording (customer/Claude phrasing), which is commonly
	// plural — unlike catalog product names, which coarseCategory() handles.
	if (/\b(jacket|coat|blazer|outerwear|parka|trench|bomber)/.test(lower)) {
		return "outerwear";
	}
	if (/\b(dress|jumpsuit|romper|gown)/.test(lower)) return "dresses";
	if (
		/\b(jean|denim|pant|trouser|short|skort|skirt|legging|chino|cargo|bottom)/.test(
			lower,
		)
	) {
		return "bottoms";
	}
	if (
		/\b(top|tee|t-shirt|shirt|blouse|cami|tank|bodysuit|sweater|sweatshirt|hoodie|knit|cardigan|polo|corset|bustier|vest|henley|crewneck)/.test(
			lower,
		)
	) {
		return "tops";
	}
	return "other";
}

/**
 * Bucket a product into a coarse garment category from its name + category text.
 * Used to keep the shortlist diverse across product types. Uses tighter word
 * boundaries than coarseCategoryFromText since catalog names/categories follow
 * singular conventions and shouldn't over-match.
 */
export function coarseCategory(product: CatalogProduct): CoarseCategory {
	const text = `${product.name} ${product.category ?? ""}`.toLowerCase();
	if (/\b(jacket|coat|blazer|outerwear|parka|trench|bomber)\b/.test(text)) {
		return "outerwear";
	}
	if (/\b(dress|jumpsuit|romper|gown)\b/.test(text)) return "dresses";
	if (
		/\b(jean|denim|pant|trouser|short|skort|skirt|legging|chino|cargo)\b/.test(
			text,
		) ||
		/bottom/.test(text)
	) {
		return "bottoms";
	}
	if (
		/\b(top|tee|t-shirt|shirt|blouse|cami|tank|bodysuit|sweater|sweatshirt|hoodie|knit|cardigan|polo|corset|bustier|vest|henley|crewneck)\b/.test(
			text,
		)
	) {
		return "tops";
	}
	return "other";
}

// Self-contained fit profile the scorer needs. Decoupled from any request/UI
// shape so it can be fed from the logged-in user's measurements + preferences
// (the appointment-prep flow) rather than a one-off form.
export type FitProfile = {
	waistInches: number;
	inseamInches: number;
	fitPreference: "skinny" | "slim" | "straight" | "relaxed" | "wide";
	stretchPreference: "rigid" | "comfort-stretch" | "high-stretch";
};

// Fit profile plus the appointment's color context. Color fields are optional
// so a bare FitProfile still scores (fit/stretch/size only).
export type RecommendationContext = FitProfile & {
	focusColors?: string[];
	avoidColors?: string[];
};

export type ScoredCandidate = {
	product: CatalogProduct;
	score: number; // 0..1
	reasons: string[];
};

/** Split a free-text color string ("indigo, black") into normalized tokens. */
export function parseColors(text: string): string[] {
	return Array.from(
		new Set(
			text
				.toLowerCase()
				.split(/[\s,/&]+|\band\b/)
				.map((t) => t.trim())
				.filter((t) => t.length >= 3),
		),
	);
}

function colorMatches(productColors: string[], tokens: string[]): boolean {
	const lower = productColors.map((c) => c.toLowerCase());
	return tokens.some((t) => lower.some((c) => c.includes(t)));
}

// Fits one step away on the skinny→wide spectrum still partially satisfy a
// preference (e.g. someone who wants "straight" is often happy in "slim").
const FIT_ADJACENCY: Record<FitProfile["fitPreference"], string[]> = {
	skinny: ["slim"],
	slim: ["skinny", "straight"],
	straight: ["slim", "relaxed"],
	relaxed: ["straight", "wide"],
	wide: ["relaxed"],
};

const WEIGHTS = {
	// Bottoms-only fit signals (these attributes only exist on denim/bottoms).
	fitExact: 0.4,
	fitAdjacent: 0.2,
	stretchExact: 0.25,
	stretchOther: 0.05,
	waistAvailable: 0.2,
	// Length is a strong preference, not a hard filter: reward pants that stock the
	// customer's length and meaningfully penalize length-sized pants that don't, so
	// they sink in the ranking but can still surface when options are thin.
	lengthAvailable: 0.3,
	lengthUnavailable: -0.35, // penalty
	// Color signals apply to every product, so they carry more weight — they are
	// the main cross-category criterion in a styling appointment.
	colorFocus: 0.3,
	colorAvoid: 0.45, // penalty
};

/** A&F jean waist sizes are labeled in inches, so round the body measurement. */
export function targetWaistSize(waistInches: number): string {
	return String(Math.round(waistInches));
}

/** Map an inseam measurement onto A&F's Short/Regular/Long length labels. */
export function targetLength(
	inseamInches: number,
): "Short" | "Regular" | "Long" {
	if (inseamInches < 30) return "Short";
	if (inseamInches <= 32) return "Regular";
	return "Long";
}

const LENGTH_LABELS = new Set(["Short", "Regular", "Long"]);

/**
 * The length options a product offers, preferring the structured `lengthSizes`
 * dimension and falling back to any length labels embedded in the flat `sizes`
 * list (legacy rows without the split). Empty when the product isn't sized by
 * length at all (tops, single-length bottoms), in which case length is not scored.
 */
function lengthOptionsFor(product: CatalogProduct): string[] {
	if (product.lengthSizes.length > 0) return product.lengthSizes;
	return product.sizes.filter((s) => LENGTH_LABELS.has(s));
}

export function scoreProduct(
	input: RecommendationContext,
	product: CatalogProduct,
): ScoredCandidate {
	let score = 0;
	const reasons: string[] = [];

	if (product.fit === input.fitPreference) {
		score += WEIGHTS.fitExact;
		reasons.push(`Fit matches your ${input.fitPreference} preference`);
	} else if (
		product.fit &&
		FIT_ADJACENCY[input.fitPreference].includes(product.fit)
	) {
		score += WEIGHTS.fitAdjacent;
		reasons.push(
			`${product.fit} fit is close to your ${input.fitPreference} preference`,
		);
	}

	if (product.stretch === input.stretchPreference) {
		score += WEIGHTS.stretchExact;
		reasons.push(`Stretch matches your ${input.stretchPreference} preference`);
	} else if (product.stretch) {
		score += WEIGHTS.stretchOther;
	}

	const waist = targetWaistSize(input.waistInches);
	const length = targetLength(input.inseamInches);
	// Prefer the structured waist dimension; fall back to the flat list (excluding
	// length labels so a length token can't masquerade as a waist size).
	const waistOptions = product.waistSizes.length
		? product.waistSizes
		: product.sizes.filter((s) => !LENGTH_LABELS.has(s));
	if (waistOptions.includes(waist)) {
		score += WEIGHTS.waistAvailable;
		reasons.push(`Available in your waist size (${waist})`);
	}

	// Length: strong preference, but only for BOTTOMS sized on the inseam axis
	// (Short/Regular/Long). Dresses/jumpsuits carry a Petite/Regular/Tall *height*
	// axis that shares the "Regular" label — scoring those against inseam would
	// wrongly penalize them for a customer whose inseam maps to Short or Long.
	const lengthOptions = lengthOptionsFor(product);
	if (coarseCategory(product) === "bottoms" && lengthOptions.length > 0) {
		if (lengthOptions.includes(length)) {
			score += WEIGHTS.lengthAvailable;
			reasons.push(`Offered in ${length} length for your inseam`);
		} else {
			score += WEIGHTS.lengthUnavailable;
			reasons.push(
				`Not offered in your ${length} length — may run short or long`,
			);
		}
	}

	if (
		input.focusColors?.length &&
		colorMatches(product.colors, input.focusColors)
	) {
		score += WEIGHTS.colorFocus;
		reasons.push("Comes in one of the requested focus colors");
	}
	if (
		input.avoidColors?.length &&
		colorMatches(product.colors, input.avoidColors)
	) {
		score -= WEIGHTS.colorAvoid;
		reasons.push("Note: also offered in a color to avoid");
	}

	return { product, score: Math.max(0, Math.min(1, score)), reasons };
}

/** Score every candidate and return the top `limit`, highest score first. */
export function rankCandidates(
	input: RecommendationContext,
	products: CatalogProduct[],
	limit = 10,
): ScoredCandidate[] {
	return products
		.map((product) => scoreProduct(input, product))
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}

/**
 * Build a category-diverse shortlist across the whole catalog. Bottoms tend to
 * out-score everything else (they have fit/size signals), so a plain top-N would
 * be all denim. Instead we take the best `perCategory` from each garment bucket,
 * then keep the top `total` by score — giving the Claude re-ranker a varied set
 * (jeans, tops, dresses, …) to assemble a recommendation from.
 */
export function shortlistDiverse(
	input: RecommendationContext,
	products: CatalogProduct[],
	perCategory = 4,
	total = 12,
): ScoredCandidate[] {
	const scored = products
		.map((product) => scoreProduct(input, product))
		.sort((a, b) => b.score - a.score);

	const perBucket = new Map<CoarseCategory, number>();
	const picked: ScoredCandidate[] = [];
	for (const candidate of scored) {
		const bucket = coarseCategory(candidate.product);
		const count = perBucket.get(bucket) ?? 0;
		if (count < perCategory) {
			perBucket.set(bucket, count + 1);
			picked.push(candidate);
		}
	}

	return picked.sort((a, b) => b.score - a.score).slice(0, total);
}
