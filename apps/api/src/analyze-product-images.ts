/**
 * One-time (resumable) backfill: read each catalog product's photo with a vision
 * model and store structured style cues on catalog_products.image_analysis. The
 * recommender then weighs how a garment actually looks (silhouette, pattern,
 * wash, vibe) on top of the scraped fit/color/size attributes.
 *
 * Run from the repo root or apps/api:
 *   npm run analyze:images -w @denim-fit/api
 *   npm run analyze:images -w @denim-fit/api -- --limit 10        # small test batch
 *   npm run analyze:images -w @denim-fit/api -- --force           # re-analyze all
 *   npm run analyze:images -w @denim-fit/api -- --concurrency 8 --throttle 200
 *
 * Requires the DB reachable (DATABASE_URL or local default) and ANTHROPIC_API_KEY
 * (loaded from the repo-root .env). Idempotent: by default only products missing
 * an analysis are processed, so it is safe to stop (Ctrl-C) and re-run.
 */
import "./load-env.js";
import { config } from "./config.js";
import { closeDb } from "./db.js";
import {
	analyzeProductImage,
	type SupportedMediaType,
	supportedMediaTypes,
} from "./product-image-analysis.js";
import {
	selectCatalogProductsForImageAnalysis,
	updateCatalogProductImageAnalysis,
} from "./repository.js";

type Args = {
	limit: number;
	concurrency: number;
	throttleMs: number;
	force: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = { limit: 0, concurrency: 5, throttleMs: 0, force: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const num = () => Number(argv[++i]);
		if (a === "--limit") args.limit = num();
		else if (a === "--concurrency") args.concurrency = num();
		else if (a === "--throttle") args.throttleMs = num();
		else if (a === "--force") args.force = true;
	}
	if (!Number.isFinite(args.limit) || args.limit < 0) args.limit = 0;
	if (!Number.isFinite(args.concurrency) || args.concurrency < 1) {
		args.concurrency = 5;
	}
	if (!Number.isFinite(args.throttleMs) || args.throttleMs < 0) {
		args.throttleMs = 0;
	}
	return args;
}

const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Map an HTTP content-type to a media type the vision API accepts. */
function resolveMediaType(
	contentType: string | null,
): SupportedMediaType | null {
	const ct = (contentType ?? "").toLowerCase();
	if (ct.includes("png")) return "image/png";
	if (ct.includes("webp")) return "image/webp";
	if (ct.includes("jpeg") || ct.includes("jpg")) return "image/jpeg";
	return null;
}

/** Fetch a product image and return its base64 bytes + media type, or null. */
async function fetchImage(
	url: string,
): Promise<{ base64: string; mediaType: SupportedMediaType } | null> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`HTTP ${res.status}`);
	}
	// Trust the served content-type; fall back to JPEG (Abercrombie's Scene7 CDN
	// serves JPEG by default) when it's missing or unrecognized.
	const mediaType =
		resolveMediaType(res.headers.get("content-type")) ?? "image/jpeg";
	if (!supportedMediaTypes.includes(mediaType)) return null;
	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.length === 0) return null;
	return { base64: buf.toString("base64"), mediaType };
}

type Row = {
	product_id: string;
	name: string;
	category: string | null;
	image_url: string;
};

const counts = { ok: 0, skipped: 0, failed: 0 };

async function processRow(row: Row): Promise<void> {
	try {
		const image = await fetchImage(row.image_url);
		if (!image) {
			counts.skipped++;
			console.warn(`skip ${row.product_id}: unusable image`);
			return;
		}
		const analysis = await analyzeProductImage({
			imageBase64: image.base64,
			mediaType: image.mediaType,
			name: row.name,
			category: row.category,
		});
		if (!analysis) {
			counts.failed++;
			console.warn(`fail ${row.product_id}: no analysis returned`);
			return;
		}
		await updateCatalogProductImageAnalysis(row.product_id, analysis);
		counts.ok++;
	} catch (err) {
		counts.failed++;
		console.warn(`fail ${row.product_id}: ${(err as Error).message}`);
	}
}

/** Run `worker` over `items` with at most `concurrency` in flight. */
async function runPool<T>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<void>,
	onProgress: () => void,
	throttleMs: number,
): Promise<void> {
	let next = 0;
	async function lane(): Promise<void> {
		while (next < items.length) {
			const item = items[next++];
			await worker(item);
			onProgress();
			if (throttleMs > 0) await sleep(throttleMs);
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, lane),
	);
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));

	if (!config.anthropicApiKey) {
		console.error(
			"ANTHROPIC_API_KEY is not set (checked .env at repo root). Aborting.",
		);
		process.exitCode = 1;
		return;
	}

	const { rows } = await selectCatalogProductsForImageAnalysis(
		!args.force,
		args.limit,
	);
	if (rows.length === 0) {
		console.log(
			args.force
				? "No products with images to analyze."
				: "Nothing to do — all products with images are already analyzed (use --force to redo).",
		);
		return;
	}

	console.log(
		`Analyzing ${rows.length} product image(s) with ${config.recommenderModel} ` +
			`(concurrency ${args.concurrency}${args.throttleMs ? `, throttle ${args.throttleMs}ms` : ""}${args.force ? ", force" : ""})…`,
	);

	const total = rows.length;
	let done = 0;
	await runPool(
		rows as Row[],
		args.concurrency,
		processRow,
		() => {
			done++;
			if (done % 25 === 0 || done === total) {
				console.log(
					`  ${done}/${total} — ok ${counts.ok}, skipped ${counts.skipped}, failed ${counts.failed}`,
				);
			}
		},
		args.throttleMs,
	);

	console.log(
		`Done. analyzed ${counts.ok}, skipped ${counts.skipped}, failed ${counts.failed} of ${total}.`,
	);
	if (counts.failed > 0) {
		console.log("Re-run the command to retry the failures (it is resumable).");
	}
}

main()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(() => closeDb());
