/**
 * Rule-based scoring for the catalog-backed recommendation engine — the cheap,
 * deterministic first stage of the hybrid pipeline. It scores each candidate
 * product against the fitting profile and returns a ranked shortlist that the
 * Claude re-ranker then refines. Pure functions only (no DB, no network) so the
 * scoring is easy to unit-test and reason about.
 */
import type { CatalogProduct } from "./types.js";

// Self-contained fit profile the scorer needs. Decoupled from any request/UI
// shape so it can be fed from the logged-in user's measurements + preferences
// (the appointment-prep flow) rather than a one-off form.
export type FitProfile = {
	waistInches: number;
	inseamInches: number;
	fitPreference: "skinny" | "slim" | "straight" | "relaxed" | "wide";
	stretchPreference: "rigid" | "comfort-stretch" | "high-stretch";
};

export type ScoredCandidate = {
	product: CatalogProduct;
	score: number; // 0..1
	reasons: string[];
};

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
	fitExact: 0.4,
	fitAdjacent: 0.2,
	stretchExact: 0.25,
	stretchOther: 0.05,
	waistAvailable: 0.2,
	lengthAvailable: 0.1,
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

export function scoreProduct(
	input: FitProfile,
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
	if (product.sizes.includes(waist)) {
		score += WEIGHTS.waistAvailable;
		reasons.push(`Available in your waist size (${waist})`);
	}
	if (product.sizes.includes(length)) {
		score += WEIGHTS.lengthAvailable;
		reasons.push(`Offered in ${length} length for your inseam`);
	}

	return { product, score: Math.min(1, score), reasons };
}

/** Score every candidate and return the top `limit`, highest score first. */
export function rankCandidates(
	input: FitProfile,
	products: CatalogProduct[],
	limit = 10,
): ScoredCandidate[] {
	return products
		.map((product) => scoreProduct(input, product))
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}
