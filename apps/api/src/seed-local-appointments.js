import { readFile } from "node:fs/promises";

const DATASET_NAME = "local-appointments-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const fixtureBaseUrl = new URL(
	"../../../infra/wiremock/__files/",
	import.meta.url,
);

const appointmentSpecs = [
	{
		customerId: "cust_avery_001",
		storeId: "anf_soho_001",
		stylistId: "sty_001",
		dayOffset: -29,
		hourUtc: 15,
		status: "completed",
		occasion: "Work capsule refresh",
		focusColors: "dark rinse, black, ecru",
		avoidColors: "acid wash, bright white",
		styleKeywords: ["minimal", "timeless essentials"],
		guidance: "Looking for polished denim that works with blazers.",
		sessionNotes:
			"Straight-leg comfort stretch worked best; avoid cropped inseams unless styled with boots.",
		recap:
			"Pulled a dark straight jean and ecru layer for a cleaner work-week rotation.",
		associateFeedback:
			"Customer reacted well to high-rise straight fits and wanted easy laundering.",
		rating: 5,
		feedbackComment: "The dark wash was exactly what I needed for work.",
	},
	{
		customerId: "cust_jordan_002",
		storeId: "anf_soho_001",
		stylistId: "sty_002",
		dayOffset: -28,
		hourUtc: 18,
		status: "completed",
		occasion: "Weekend travel",
		focusColors: "medium wash, olive, grey",
		avoidColors: "skinny fits, heavy distressing",
		styleKeywords: ["relaxed", "sporty"],
		guidance: "Needs room through the thigh without looking oversized.",
		sessionNotes:
			"Relaxed rigid denim felt right when sized up one waist; cuffed length looked intentional.",
		recap:
			"Recommended relaxed denim with a structured tee and overshirt for travel days.",
		associateFeedback:
			"Mobility was the deciding factor; keep rigid but not tight.",
		rating: 4,
		feedbackComment:
			"Helpful to try relaxed fits I would not have picked online.",
	},
	{
		customerId: "cust_riley_003",
		storeId: "anf_easton_002",
		stylistId: "sty_003",
		dayOffset: -27,
		hourUtc: 16,
		status: "cancelled",
		occasion: "Birthday dinner",
		focusColors: "black, dark wash, soft pink",
		avoidColors: "baggy silhouettes",
		styleKeywords: ["feminine", "subtly dressed-up"],
		guidance: "Wanted slim denim with a dressier top option.",
		cancelReason: "Customer had a schedule conflict and asked to rebook.",
	},
	{
		customerId: "cust_morgan_004",
		storeId: "anf_century_003",
		stylistId: "sty_004",
		dayOffset: -26,
		hourUtc: 21,
		status: "no_show",
		occasion: "Festival outfit",
		focusColors: "light wash, white, washed black",
		avoidColors: "low rise",
		styleKeywords: ["trend-forward", "bold"],
		guidance: "Interested in wide-leg statement denim.",
	},
	{
		customerId: "cust_taylor_005",
		storeId: "anf_easton_002",
		stylistId: "sty_003",
		dayOffset: -25,
		hourUtc: 17,
		status: "completed",
		occasion: "First office week",
		focusColors: "black, dark rinse, navy",
		avoidColors: "light distressing",
		styleKeywords: ["minimal", "soft"],
		guidance: "Needs high-stretch skinny options that still feel polished.",
		sessionNotes:
			"Skinny high-stretch in black was the strongest fit; customer preferred ankle length.",
		recap:
			"Built a simple office look around black skinny denim and a tucked knit.",
		associateFeedback:
			"Customer wants familiar silhouettes but more polished washes.",
		rating: 5,
		feedbackComment:
			"Loved having petite-friendly options pulled before I arrived.",
	},
	{
		customerId: "cust_avery_001",
		storeId: "anf_easton_002",
		stylistId: "sty_005",
		dayOffset: -24,
		hourUtc: 15,
		status: "completed",
		occasion: "Fit troubleshooting",
		focusColors: "medium wash, dark wash",
		avoidColors: "rigid denim",
		styleKeywords: ["effortless", "minimal"],
		guidance: "Prior jeans gapped at the waist after a few wears.",
		sessionNotes:
			"Curve-aware straight fits reduced waist gap; customer preferred regular length.",
		recap:
			"Compared straight and slim options to solve waist-gap without losing ease.",
		associateFeedback: "Strong candidate for repeat fit-check follow-up.",
		rating: 4,
		feedbackComment: "The notes about waist gap were useful.",
	},
	{
		customerId: "cust_jordan_002",
		storeId: "anf_soho_001",
		stylistId: "sty_002",
		dayOffset: -23,
		hourUtc: 20,
		status: "cancelled",
		occasion: "Casual Friday",
		focusColors: "dark wash, tan, white",
		avoidColors: "cropped inseams",
		styleKeywords: ["preppy", "menswear-inspired"],
		guidance: "Wanted denim to wear with loafers and button-downs.",
		cancelReason: "Customer cancelled through the app after a travel delay.",
	},
	{
		customerId: "cust_riley_003",
		storeId: "anf_soho_001",
		stylistId: "sty_001",
		dayOffset: -22,
		hourUtc: 16,
		status: "completed",
		occasion: "Concert night",
		focusColors: "washed black, silver, dark wash",
		avoidColors: "brown, beige",
		styleKeywords: ["bold", "trend-forward"],
		guidance: "Open to a statement fit but needs stretch.",
		sessionNotes:
			"Slim high-stretch base worked; statement came from wash and styling rather than volume.",
		recap:
			"Styled washed-black denim with a fitted top and jacket for a night-out look.",
		associateFeedback:
			"Keep Riley in high-stretch options even for trend-led pulls.",
		rating: 5,
		feedbackComment: "Felt like me, just more styled.",
	},
	{
		customerId: "cust_morgan_004",
		storeId: "anf_century_003",
		stylistId: "sty_006",
		dayOffset: -21,
		hourUtc: 20,
		status: "completed",
		occasion: "Client dinner",
		focusColors: "dark rinse, ivory, black",
		avoidColors: "distressed hems",
		styleKeywords: ["polished", "minimal"],
		guidance: "Needs wide-leg denim that can pass for dinner.",
		sessionNotes:
			"Wide-leg dark rinse was best with a heel; long length worked without hemming.",
		recap: "Built a polished dark-rinse wide-leg look for evening plans.",
		associateFeedback: "Customer prefers wide fits with structure, not drape.",
		rating: 4,
		feedbackComment: "The darker wide leg was more elevated than I expected.",
	},
	{
		customerId: "cust_taylor_005",
		storeId: "anf_easton_002",
		stylistId: "sty_005",
		dayOffset: -20,
		hourUtc: 18,
		status: "no_show",
		occasion: "Exchange help",
		focusColors: "medium wash, black",
		avoidColors: "low stretch",
		styleKeywords: ["soft", "effortless"],
		guidance: "Wanted to exchange denim that felt too tight after sitting.",
	},
	{
		customerId: "cust_avery_001",
		storeId: "anf_soho_001",
		stylistId: "sty_001",
		dayOffset: -19,
		hourUtc: 17,
		status: "completed",
		occasion: "Everyday denim drawer",
		focusColors: "medium wash, ecru, black",
		avoidColors: "destroyed knees",
		styleKeywords: ["effortless", "timeless essentials"],
		guidance: "Wants two dependable pairs for errands and casual dinners.",
		sessionNotes:
			"Customer chose medium straight and dark slim; skipped low-rise options.",
		recap:
			"Recommended two core denim washes to simplify weekly outfit planning.",
		associateFeedback: "Repeat customer; start with straight fit in waist 29.",
		rating: 5,
		feedbackComment: "The two-pair approach made the choices easier.",
	},
	{
		customerId: "cust_jordan_002",
		storeId: "anf_easton_002",
		stylistId: "sty_005",
		dayOffset: -18,
		hourUtc: 16,
		status: "completed",
		occasion: "Return recovery",
		focusColors: "dark wash, medium wash",
		avoidColors: "tight thigh, low rise",
		styleKeywords: ["relaxed", "effortless"],
		guidance: "Two online orders were returned for thigh tightness.",
		sessionNotes:
			"Relaxed and straight fits both worked; customer disliked rigid low-rise.",
		recap:
			"Reset sizing expectations after prior returns and documented better fits.",
		associateFeedback:
			"Use returned items as a fit signal before making trend pulls.",
		rating: 4,
		feedbackComment: "Better than guessing from the website.",
	},
	{
		customerId: "cust_riley_003",
		storeId: "anf_easton_002",
		stylistId: "sty_003",
		dayOffset: -17,
		hourUtc: 15,
		status: "completed",
		occasion: "Petite length check",
		focusColors: "light wash, cream, soft blue",
		avoidColors: "full puddle length",
		styleKeywords: ["feminine", "soft"],
		guidance: "Needs jeans that do not overwhelm a shorter inseam.",
		sessionNotes:
			"Short inseam slim and straight options worked; full-length wide leg overwhelmed.",
		recap:
			"Focused on proportion and shorter inseams for softer spring outfits.",
		associateFeedback: "Start Riley with slim high-stretch in short length.",
		rating: 5,
		feedbackComment: "Finally found a length that did not need tailoring.",
	},
	{
		customerId: "cust_morgan_004",
		storeId: "anf_century_003",
		stylistId: "sty_004",
		dayOffset: -16,
		hourUtc: 22,
		status: "cancelled",
		occasion: "Vacation packing",
		focusColors: "white, light wash, olive",
		avoidColors: "black denim",
		styleKeywords: ["trend-forward", "effortless"],
		guidance: "Wanted warm-weather denim options.",
		cancelReason: "Customer rebooked for a later day with more time.",
	},
	{
		customerId: "cust_taylor_005",
		storeId: "anf_soho_001",
		stylistId: "sty_001",
		dayOffset: -15,
		hourUtc: 18,
		status: "completed",
		occasion: "New job photos",
		focusColors: "dark rinse, black, white",
		avoidColors: "faded knees",
		styleKeywords: ["minimal", "subtly dressed-up"],
		guidance: "Needs denim that photographs cleanly for casual headshots.",
		sessionNotes:
			"Black skinny and dark slim were strongest; white denim was too seasonal.",
		recap: "Kept the look simple with dark denim and a structured top.",
		associateFeedback: "Customer values confidence and familiar fits.",
		rating: 5,
		feedbackComment: "I felt ready for the photos.",
	},
	{
		customerId: "cust_avery_001",
		storeId: "anf_soho_001",
		stylistId: "sty_002",
		dayOffset: -14,
		hourUtc: 19,
		status: "no_show",
		occasion: "Dinner after work",
		focusColors: "black, dark wash",
		avoidColors: "light wash",
		styleKeywords: ["minimal", "polished"],
		guidance: "Asked for a fast pull before a post-work dinner.",
	},
	{
		customerId: "cust_jordan_002",
		storeId: "anf_soho_001",
		stylistId: "sty_002",
		dayOffset: -13,
		hourUtc: 17,
		status: "completed",
		occasion: "Brunch outfit",
		focusColors: "medium wash, cream, navy",
		avoidColors: "black",
		styleKeywords: ["preppy", "relaxed"],
		guidance: "Looking for a looser jean that still works with a tucked polo.",
		sessionNotes:
			"Relaxed medium wash was best; customer liked clean hem over distressing.",
		recap: "Created an easy brunch look with medium relaxed denim and layers.",
		associateFeedback: "Clean hems matter more than trend details.",
		rating: 4,
		feedbackComment: "Good balance between relaxed and put-together.",
	},
	{
		customerId: "cust_riley_003",
		storeId: "anf_century_003",
		stylistId: "sty_006",
		dayOffset: -12,
		hourUtc: 21,
		status: "completed",
		occasion: "LA weekend",
		focusColors: "light wash, black, silver",
		avoidColors: "brown, olive",
		styleKeywords: ["trend-forward", "soft"],
		guidance: "Wants an outfit that feels playful but fitted.",
		sessionNotes:
			"Slim base was right; customer liked styling with a lighter jacket.",
		recap: "Balanced Riley's fitted preference with a lighter weekend palette.",
		associateFeedback:
			"Can introduce trend pieces if the denim silhouette stays slim.",
		rating: 4,
		feedbackComment: "The outfit felt fun without being too much.",
	},
	{
		customerId: "cust_morgan_004",
		storeId: "anf_century_003",
		stylistId: "sty_004",
		dayOffset: -11,
		hourUtc: 20,
		status: "completed",
		occasion: "Denim trend trial",
		focusColors: "washed black, light wash, ecru",
		avoidColors: "skinny fits",
		styleKeywords: ["bold", "boundary-pushing"],
		guidance: "Open to ultra-loose fits and statement washes.",
		sessionNotes:
			"Ultra-loose was a hit in washed black; customer skipped low-rise options.",
		recap: "Pulled a bolder wide-leg story while preserving rise comfort.",
		associateFeedback:
			"Morgan is a strong candidate for trend-led wide-leg pulls.",
		rating: 5,
		feedbackComment: "Loved that the pulls felt current.",
	},
	{
		customerId: "cust_taylor_005",
		storeId: "anf_easton_002",
		stylistId: "sty_003",
		dayOffset: -10,
		hourUtc: 15,
		status: "cancelled",
		occasion: "Closet refresh",
		focusColors: "black, medium wash, cream",
		avoidColors: "rigid denim",
		styleKeywords: ["minimal", "effortless"],
		guidance: "Looking for a second everyday skinny fit.",
		cancelReason: "Customer found an earlier appointment at another store.",
	},
	{
		customerId: "cust_avery_001",
		storeId: "anf_easton_002",
		stylistId: "sty_005",
		dayOffset: -9,
		hourUtc: 18,
		status: "completed",
		occasion: "Return exchange",
		focusColors: "dark wash, medium wash",
		avoidColors: "waist gap, low stretch",
		styleKeywords: ["effortless", "timeless essentials"],
		guidance: "Exchanging a pair that stretched out at the waist.",
		sessionNotes:
			"Smaller waist with comfort stretch solved the issue; customer kept regular length.",
		recap: "Documented the exchange reason and better size direction.",
		associateFeedback:
			"Recommend size consistency over chasing new silhouettes.",
		rating: 4,
		feedbackComment: "The exchange felt much less frustrating.",
	},
	{
		customerId: "cust_jordan_002",
		storeId: "anf_soho_001",
		stylistId: "sty_001",
		dayOffset: -8,
		hourUtc: 16,
		status: "completed",
		occasion: "Date night",
		focusColors: "black, dark rinse",
		avoidColors: "baggy stacking",
		styleKeywords: ["timeless essentials", "subtly dressed-up"],
		guidance: "Wants a cleaner jean than the weekend relaxed pair.",
		sessionNotes:
			"Straight dark rinse was best; relaxed fit felt too casual for the occasion.",
		recap: "Recommended a cleaner straight jean for dinner plans.",
		associateFeedback:
			"Jordan can flex between relaxed and straight based on occasion.",
		rating: 5,
		feedbackComment: "The straight fit was a good surprise.",
	},
	{
		customerId: "cust_riley_003",
		storeId: "anf_soho_001",
		stylistId: "sty_002",
		dayOffset: -7,
		hourUtc: 19,
		status: "completed",
		occasion: "Casual campus week",
		focusColors: "medium wash, black, soft grey",
		avoidColors: "low rise, rigid",
		styleKeywords: ["sporty", "soft"],
		guidance: "Needs comfortable denim for long walking days.",
		sessionNotes:
			"High-stretch slim was best; customer also liked one relaxed option sized down.",
		recap: "Prioritized comfort for active days while keeping a fitted look.",
		associateFeedback:
			"Comfort language works well for Riley; avoid rigid suggestions.",
		rating: 4,
		feedbackComment: "Good options for walking around all day.",
	},
	{
		customerId: "cust_morgan_004",
		storeId: "anf_century_003",
		stylistId: "sty_006",
		dayOffset: -6,
		hourUtc: 22,
		status: "no_show",
		occasion: "Office-to-evening",
		focusColors: "dark rinse, ivory",
		avoidColors: "frayed hems",
		styleKeywords: ["polished", "trend-forward"],
		guidance: "Asked for wide-leg denim that moves from work to dinner.",
	},
	{
		customerId: "cust_taylor_005",
		storeId: "anf_easton_002",
		stylistId: "sty_005",
		dayOffset: -5,
		hourUtc: 17,
		status: "completed",
		occasion: "Fit confidence",
		focusColors: "black, dark wash",
		avoidColors: "waist pinching",
		styleKeywords: ["soft", "minimal"],
		guidance: "Concerned high-stretch jeans lose shape after a few wears.",
		sessionNotes:
			"High-stretch skinny fit still worked; advised darker washes and regular length.",
		recap:
			"Focused on a confidence-building skinny fit in durable darker washes.",
		associateFeedback: "Taylor needs reassurance on fabric recovery and care.",
		rating: 5,
		feedbackComment: "I appreciated the care notes.",
	},
	{
		customerId: "cust_avery_001",
		storeId: "anf_soho_001",
		stylistId: "sty_001",
		dayOffset: -4,
		hourUtc: 20,
		status: "cancelled",
		occasion: "Quick lunch break",
		focusColors: "ecru, medium wash",
		avoidColors: "black",
		styleKeywords: ["effortless", "minimal"],
		guidance: "Wanted a fast in-store pull during lunch.",
		cancelReason: "Work meeting ran long.",
	},
	{
		customerId: "cust_jordan_002",
		storeId: "anf_easton_002",
		stylistId: "sty_003",
		dayOffset: -3,
		hourUtc: 18,
		status: "completed",
		occasion: "Family photos",
		focusColors: "dark wash, cream, navy",
		avoidColors: "distressing",
		styleKeywords: ["preppy", "timeless essentials"],
		guidance: "Needs clean denim for outdoor family photos.",
		sessionNotes:
			"Dark straight denim photographed cleanly; relaxed fit was too casual.",
		recap: "Selected a clean dark straight fit for photos with light layers.",
		associateFeedback: "For photos, guide Jordan toward straight over relaxed.",
		rating: 5,
		feedbackComment: "The photo outfit felt easy.",
	},
	{
		customerId: "cust_riley_003",
		storeId: "anf_soho_001",
		stylistId: "sty_001",
		dayOffset: -2,
		hourUtc: 16,
		status: "completed",
		occasion: "Summer internship",
		focusColors: "dark rinse, light blue, white",
		avoidColors: "destroyed hems",
		styleKeywords: ["minimal", "soft"],
		guidance: "Needs something professional but not stiff.",
		sessionNotes:
			"Slim dark rinse worked with a soft shirt; customer skipped rigid straight.",
		recap:
			"Kept the outfit internship-ready with softer colors and a slim fit.",
		associateFeedback: "Riley is ready for a follow-up workwear appointment.",
		rating: 5,
		feedbackComment: "Exactly the balance I wanted.",
	},
	{
		customerId: "cust_morgan_004",
		storeId: "anf_century_003",
		stylistId: "sty_004",
		dayOffset: -1,
		hourUtc: 20,
		status: "completed",
		occasion: "Statement denim pull",
		focusColors: "washed black, light wash, red",
		avoidColors: "skinny fits, mid rise",
		styleKeywords: ["bold", "boundary-pushing"],
		guidance: "Wants the most directional wide-leg options in store.",
		sessionNotes:
			"Ultra-loose and wide-leg were strongest; customer chose washed black.",
		recap: "Prepared an expressive wide-leg story around statement washes.",
		associateFeedback:
			"Morgan responds to editorial language and trend context.",
		rating: 5,
		feedbackComment: "The pulls felt curated.",
	},
	{
		customerId: "cust_taylor_005",
		storeId: "anf_soho_001",
		stylistId: "sty_002",
		dayOffset: -1,
		hourUtc: 22,
		status: "completed",
		occasion: "Last-minute dinner",
		focusColors: "black, dark rinse",
		avoidColors: "light wash, wide leg",
		styleKeywords: ["subtly dressed-up", "minimal"],
		guidance: "Needs a reliable skinny fit for dinner tonight.",
		sessionNotes:
			"Black high-stretch skinny was the clear winner; customer skipped straight fits.",
		recap: "Prepared a simple dinner look around black skinny denim.",
		associateFeedback: "Taylor values speed when the fit is familiar.",
		rating: 4,
		feedbackComment: "Fast and helpful.",
	},
	{
		customerId: "cust_avery_001",
		storeId: "anf_soho_001",
		stylistId: "sty_001",
		status: "checked_in",
		currentOffsetMinutes: -30,
		durationMinutes: 60,
		occasion: "Today fit check",
		focusColors: "dark wash, ecru",
		avoidColors: "rigid denim",
		styleKeywords: ["minimal", "effortless"],
		guidance: "Checking whether the newer straight fit solves waist gap.",
		sessionNotes:
			"Customer arrived with prior pair; compare against curve-aware straight options.",
	},
	{
		customerId: "cust_riley_003",
		storeId: "anf_soho_001",
		stylistId: "sty_001",
		dayOffset: 1,
		hourUtc: 15,
		status: "scheduled",
		occasion: "Internship follow-up",
		focusColors: "dark rinse, white, soft grey",
		avoidColors: "rigid denim, low rise",
		styleKeywords: ["minimal", "soft"],
		guidance:
			"Please pull slim high-stretch options that feel professional but comfortable.",
		sessionNotes:
			"Prep slim high-stretch workwear options before Riley arrives.",
	},
	{
		customerId: "cust_morgan_004",
		storeId: "anf_century_003",
		stylistId: "sty_006",
		dayOffset: 2,
		hourUtc: 21,
		status: "scheduled",
		occasion: "Vacation denim",
		focusColors: "light wash, white, olive",
		avoidColors: "skinny fits",
		styleKeywords: ["trend-forward", "effortless"],
		guidance: "Interested in packable wide-leg denim for a long weekend.",
		sessionNotes: "Pull lightweight wide-leg and relaxed options.",
	},
	{
		customerId: "cust_taylor_005",
		storeId: "anf_easton_002",
		stylistId: "sty_003",
		dayOffset: 3,
		hourUtc: 16,
		status: "scheduled",
		occasion: "Exchange appointment",
		focusColors: "black, medium wash",
		avoidColors: "rigid denim, low stretch",
		styleKeywords: ["soft", "minimal"],
		guidance:
			"Needs help replacing a skinny pair that feels tight when sitting.",
		sessionNotes: "Start with high-stretch skinny and slim alternatives.",
	},
];

async function readFixture(name) {
	return JSON.parse(await readFile(new URL(name, fixtureBaseUrl), "utf8"));
}

function uuidFor(prefix, index) {
	return `00000000-${prefix}-4000-8000-${String(index).padStart(12, "0")}`;
}

function addMinutes(date, minutes) {
	return new Date(date.getTime() + minutes * MINUTE_MS);
}

function slotFromSpec(now, spec) {
	if (spec.currentOffsetMinutes != null) {
		const start = addMinutes(now, spec.currentOffsetMinutes);
		return {
			start,
			end: addMinutes(start, spec.durationMinutes ?? 60),
		};
	}

	const base = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
	const start = new Date(
		base.getTime() + spec.dayOffset * DAY_MS + spec.hourUtc * 60 * MINUTE_MS,
	);
	return {
		start,
		end: addMinutes(start, spec.durationMinutes ?? 60),
	};
}

function normalizeCatalogProduct(row) {
	return {
		productId: String(row.product_id),
		source: String(row.source),
		name: String(row.name),
		category: row.category,
		productUrl: String(row.product_url),
		imageUrl: row.image_url,
		description: row.description,
		price: row.price == null ? null : Number(row.price),
		currency: row.currency,
		fit: row.fit,
		rise: row.rise,
		stretch: row.stretch,
		sizes: Array.isArray(row.sizes) ? row.sizes : [],
		colors: Array.isArray(row.colors) ? row.colors : [],
		scrapedAt: new Date(String(row.scraped_at)).toISOString(),
	};
}

function chooseProducts(catalog, user, spec, index) {
	const preferredFit = user.preferences.fitPreference;
	const preferredStretch = user.preferences.stretchPreference;
	const focusTokens = spec.focusColors
		.toLowerCase()
		.split(",")
		.map((token) => token.trim())
		.filter(Boolean);

	const scored = catalog
		.map((product) => {
			const colorText = product.colors.join(" ").toLowerCase();
			const nameText = product.name.toLowerCase();
			const colorScore = focusTokens.filter(
				(token) => colorText.includes(token) || nameText.includes(token),
			).length;
			const fitScore = product.fit === preferredFit ? 4 : 0;
			const stretchScore = product.stretch === preferredStretch ? 3 : 0;
			const categoryScore = String(product.category ?? "").includes("jeans")
				? 2
				: 0;

			return {
				product,
				score: fitScore + stretchScore + categoryScore + colorScore,
			};
		})
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return a.product.productId.localeCompare(b.product.productId);
		});

	const start = index % Math.max(scored.length - 4, 1);
	return scored
		.slice(start, start + 4)
		.map(({ product, score }, rankIndex) => ({
			rank: rankIndex + 1,
			rationale: rationaleForProduct(product, spec, user),
			score: Number((score / 12).toFixed(3)),
			product,
			prepStatus: prepStatusFor(spec.status, rankIndex),
			associateNote: associateNoteFor(spec.status, rankIndex),
		}));
}

function rationaleForProduct(product, spec, user) {
	const signals = [
		product.fit === user.preferences.fitPreference
			? `${product.fit} fit matches the customer's preference`
			: `${product.fit ?? "alternate"} fit adds useful comparison`,
		product.stretch === user.preferences.stretchPreference
			? `${product.stretch} fabric supports comfort goals`
			: `${product.stretch ?? "available"} fabric broadens the fitting set`,
		`works with ${spec.occasion.toLowerCase()}`,
	];
	return signals.join("; ");
}

function prepStatusFor(status, rankIndex) {
	if (status === "completed") return rankIndex === 2 ? "skipped" : "pulled";
	if (status === "checked_in") return rankIndex < 2 ? "pulled" : "suggested";
	if (status === "scheduled") return rankIndex === 0 ? "pulled" : "suggested";
	return "suggested";
}

function associateNoteFor(status, rankIndex) {
	if (status === "completed" && rankIndex === 0) {
		return "Customer tried this first and used it as the fit baseline.";
	}
	if (status === "completed" && rankIndex === 2) {
		return "Skipped after comparing rise and fabric feel.";
	}
	if (status === "checked_in" && rankIndex === 0) {
		return "In fitting room now for first comparison.";
	}
	if (status === "scheduled" && rankIndex === 0) {
		return "Pulled ahead of arrival.";
	}
	return "";
}

function statusTimestamps(spec, slotStart, slotEnd) {
	const checkedInAt =
		spec.status === "checked_in" || spec.status === "completed"
			? addMinutes(slotStart, 4)
			: null;
	const completedAt =
		spec.status === "completed" ? addMinutes(slotEnd, 12) : null;
	const cancelledAt =
		spec.status === "cancelled" ? addMinutes(slotStart, -18 * 60) : null;
	const noShowAt = spec.status === "no_show" ? addMinutes(slotEnd, 15) : null;

	return { checkedInAt, completedAt, cancelledAt, noShowAt };
}

function orderHistorySummaryFor(user, spec, index) {
	const sizeLabel = `${Math.round(user.measurements.waistInches)}`;
	const repeat = index % 3;
	const returnedItems =
		spec.status === "cancelled" ||
		spec.guidance.toLowerCase().includes("return")
			? 1
			: repeat === 0
				? 1
				: 0;

	return {
		totalOrders: 2 + repeat,
		denimItems: 1 + repeat,
		returnedItems,
		preferredSizes: [sizeLabel, `${sizeLabel} Regular`],
	};
}

function messagesFor(spec) {
	if (spec.status === "cancelled") {
		return [
			{
				authorType: "customer",
				body: spec.cancelReason ?? "I need to cancel this appointment.",
			},
		];
	}

	if (spec.status === "no_show") return [];

	const messages = [
		{
			authorType: "customer",
			body: spec.guidance,
		},
	];

	if (spec.status === "scheduled" || spec.status === "checked_in") {
		messages.push({
			authorType: "associate",
			body: "Thanks, I will have those options ready when you arrive.",
		});
	}

	if (spec.status === "completed") {
		messages.push({
			authorType: "associate",
			body: "I saved the fit notes from today's appointment for next time.",
		});
	}

	return messages;
}

function notificationsFor(appointmentId, slotStart, createdAt, index) {
	const reminderFor = addMinutes(slotStart, -24 * 60);
	const future = slotStart > new Date();
	const reminderSent = !future;

	return [
		{
			id: uuidFor("0002", index * 2 - 1),
			appointmentId,
			type: "confirmation",
			status: "sent",
			scheduledFor: createdAt,
			sentAt: createdAt,
			createdAt,
		},
		{
			id: uuidFor("0002", index * 2),
			appointmentId,
			type: "reminder",
			status: reminderSent ? "sent" : "queued",
			scheduledFor: reminderFor,
			sentAt: reminderSent ? reminderFor : null,
			createdAt,
		},
	];
}

function buildAppointment(spec, context, index) {
	const { usersById, storesById, stylistsById, catalog, now } = context;
	const user = usersById.get(spec.customerId);
	const store = storesById.get(spec.storeId);
	const stylist = stylistsById.get(spec.stylistId);

	if (!user)
		throw new Error(
			`Seed appointment references missing user ${spec.customerId}`,
		);
	if (!store)
		throw new Error(
			`Seed appointment references missing store ${spec.storeId}`,
		);
	if (!stylist) {
		throw new Error(
			`Seed appointment references missing stylist ${spec.stylistId}`,
		);
	}
	if (stylist.store.storeId !== store.storeId) {
		throw new Error(
			`Seed stylist ${stylist.id} is not assigned to store ${store.storeId}`,
		);
	}

	const { start, end } = slotFromSpec(now, spec);
	const timestamps = statusTimestamps(spec, start, end);
	const createdAt = addMinutes(
		start,
		spec.status === "scheduled" ? -3 * 24 * 60 : -7 * 24 * 60,
	);
	const id = uuidFor("0000", index);
	const orderHistorySummary = orderHistorySummaryFor(user, spec, index);
	const suggestedProducts = chooseProducts(catalog, user, spec, index);

	return {
		id,
		customerId: user.customerId,
		loyaltyId: user.loyaltyId,
		customerName: user.displayName,
		slotStart: start,
		slotEnd: end,
		storeSnapshot: store,
		occasion: spec.occasion,
		focusColors: spec.focusColors,
		avoidColors: spec.avoidColors,
		styleKeywords: spec.styleKeywords,
		guidance: spec.guidance,
		sessionNotes: spec.sessionNotes ?? "",
		status: spec.status,
		museTag: museTagFor(spec.styleKeywords),
		assignedStylist: stylist,
		orderHistorySummary,
		suggestedProducts,
		sourcePayload: {
			seedDataset: DATASET_NAME,
			story: storyFor(user.customerId),
			input: {
				storeId: spec.storeId,
				slotStart: start.toISOString(),
				occasion: spec.occasion,
				focusColors: spec.focusColors,
				avoidColors: spec.avoidColors,
				styleKeywords: spec.styleKeywords,
				guidance: spec.guidance,
			},
			currentUser: user,
			store,
		},
		checkedInAt: timestamps.checkedInAt,
		completedAt: timestamps.completedAt,
		cancelledAt: timestamps.cancelledAt,
		noShowAt: timestamps.noShowAt,
		cancelReason: spec.cancelReason ?? null,
		customerRecap: spec.recap ?? "",
		associateFeedback: spec.associateFeedback ?? "",
		customerFeedbackRating: spec.rating ?? null,
		customerFeedbackComment: spec.feedbackComment ?? "",
		customerFeedbackAt: spec.rating
			? addMinutes(timestamps.completedAt ?? end, 90)
			: null,
		createdAt,
		messages: messagesFor(spec).map((message, messageIndex) => ({
			id: uuidFor("0001", index * 10 + messageIndex),
			appointmentId: id,
			...message,
			createdAt: addMinutes(createdAt, 10 + messageIndex * 15),
		})),
		notifications: notificationsFor(id, start, createdAt, index),
	};
}

function museTagFor(styleKeywords) {
	const keywordSet = new Set(styleKeywords);
	if (
		["trend-forward", "bold", "boundary-pushing"].some((keyword) =>
			keywordSet.has(keyword),
		)
	) {
		return "Statement Maker";
	}
	if (
		["feminine", "soft", "subtly dressed-up"].some((keyword) =>
			keywordSet.has(keyword),
		)
	) {
		return "Romantic Muse";
	}
	if (
		["preppy", "relaxed", "sporty", "menswear-inspired"].some((keyword) =>
			keywordSet.has(keyword),
		)
	) {
		return "Boyish Muse";
	}
	return "Clean Muse";
}

function storyFor(customerId) {
	const stories = {
		cust_avery_001:
			"Repeat fit-troubleshooting customer building a polished straight-leg denim wardrobe.",
		cust_jordan_002:
			"Relaxed-fit customer recovering from online fit misses and refining occasion-based choices.",
		cust_riley_003:
			"Petite slim-fit customer balancing high-stretch comfort with internship and night-out styling.",
		cust_morgan_004:
			"Wide-leg trend customer who responds to expressive pulls and polished LA styling.",
		cust_taylor_005:
			"Skinny-fit customer looking for high-stretch confidence, exchanges, and polished basics.",
	};
	return stories[customerId] ?? "Local seeded appointment story.";
}

async function loadContext(pool) {
	const [usersFixture, storesFixture, stylistsFixture, catalogResult] =
		await Promise.all([
			readFixture("users.json"),
			readFixture("stores.json"),
			readFixture("stylists.json"),
			pool.query(`
				SELECT *
				FROM public.catalog_products
				WHERE category ILIKE '%jeans%'
				ORDER BY product_id ASC
			`),
		]);

	const catalog = catalogResult.rows.map(normalizeCatalogProduct);
	if (catalog.length < 4) {
		throw new Error("Seed appointments require at least four catalog products");
	}

	return {
		usersById: new Map(
			usersFixture.users.map((user) => [user.customerId, user]),
		),
		storesById: new Map(
			storesFixture.stores.map((store) => [store.storeId, store]),
		),
		stylistsById: new Map(
			stylistsFixture.stylists.map((stylist) => [stylist.id, stylist]),
		),
		catalog,
		now: new Date(),
	};
}

async function upsertAppointment(pool, appointment) {
	await pool.query(
		`
			INSERT INTO public.appointments (
				id, customer_id, loyalty_id, customer_name, slot_start, slot_end, store_snapshot,
				occasion, focus_colors, avoid_colors, style_keywords, guidance, session_notes,
				status, muse_tag, assigned_stylist, order_history_summary, suggested_products,
				source_payload, checked_in_at, completed_at, cancelled_at, no_show_at,
				cancel_reason, customer_recap, associate_feedback, customer_feedback_rating,
				customer_feedback_comment, customer_feedback_at, created_at
			)
			VALUES (
				$1, $2, $3, $4, $5, $6, $7,
				$8, $9, $10, $11, $12, $13,
				$14, $15, $16, $17, $18,
				$19, $20, $21, $22, $23,
				$24, $25, $26, $27,
				$28, $29, $30
			)
			ON CONFLICT (id) DO UPDATE SET
				customer_id = EXCLUDED.customer_id,
				loyalty_id = EXCLUDED.loyalty_id,
				customer_name = EXCLUDED.customer_name,
				slot_start = EXCLUDED.slot_start,
				slot_end = EXCLUDED.slot_end,
				store_snapshot = EXCLUDED.store_snapshot,
				occasion = EXCLUDED.occasion,
				focus_colors = EXCLUDED.focus_colors,
				avoid_colors = EXCLUDED.avoid_colors,
				style_keywords = EXCLUDED.style_keywords,
				guidance = EXCLUDED.guidance,
				session_notes = EXCLUDED.session_notes,
				status = EXCLUDED.status,
				muse_tag = EXCLUDED.muse_tag,
				assigned_stylist = EXCLUDED.assigned_stylist,
				order_history_summary = EXCLUDED.order_history_summary,
				suggested_products = EXCLUDED.suggested_products,
				source_payload = EXCLUDED.source_payload,
				checked_in_at = EXCLUDED.checked_in_at,
				completed_at = EXCLUDED.completed_at,
				cancelled_at = EXCLUDED.cancelled_at,
				no_show_at = EXCLUDED.no_show_at,
				cancel_reason = EXCLUDED.cancel_reason,
				customer_recap = EXCLUDED.customer_recap,
				associate_feedback = EXCLUDED.associate_feedback,
				customer_feedback_rating = EXCLUDED.customer_feedback_rating,
				customer_feedback_comment = EXCLUDED.customer_feedback_comment,
				customer_feedback_at = EXCLUDED.customer_feedback_at,
				created_at = EXCLUDED.created_at
		`,
		[
			appointment.id,
			appointment.customerId,
			appointment.loyaltyId,
			appointment.customerName,
			appointment.slotStart,
			appointment.slotEnd,
			JSON.stringify(appointment.storeSnapshot),
			appointment.occasion,
			appointment.focusColors,
			appointment.avoidColors,
			JSON.stringify(appointment.styleKeywords),
			appointment.guidance,
			appointment.sessionNotes,
			appointment.status,
			appointment.museTag,
			JSON.stringify(appointment.assignedStylist),
			JSON.stringify(appointment.orderHistorySummary),
			JSON.stringify(appointment.suggestedProducts),
			JSON.stringify(appointment.sourcePayload),
			appointment.checkedInAt,
			appointment.completedAt,
			appointment.cancelledAt,
			appointment.noShowAt,
			appointment.cancelReason,
			appointment.customerRecap,
			appointment.associateFeedback,
			appointment.customerFeedbackRating,
			appointment.customerFeedbackComment,
			appointment.customerFeedbackAt,
			appointment.createdAt,
		],
	);
}

async function insertMessages(pool, messages) {
	for (const message of messages) {
		await pool.query(
			`
				INSERT INTO public.appointment_messages (
					id, appointment_id, author_type, body, created_at
				)
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT (id) DO UPDATE SET
					appointment_id = EXCLUDED.appointment_id,
					author_type = EXCLUDED.author_type,
					body = EXCLUDED.body,
					created_at = EXCLUDED.created_at
			`,
			[
				message.id,
				message.appointmentId,
				message.authorType,
				message.body,
				message.createdAt,
			],
		);
	}
}

async function insertNotifications(pool, notifications) {
	for (const notification of notifications) {
		await pool.query(
			`
				INSERT INTO public.appointment_notifications (
					id, appointment_id, type, status, scheduled_for, sent_at, created_at
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
				ON CONFLICT (id) DO UPDATE SET
					appointment_id = EXCLUDED.appointment_id,
					type = EXCLUDED.type,
					status = EXCLUDED.status,
					scheduled_for = EXCLUDED.scheduled_for,
					sent_at = EXCLUDED.sent_at,
					created_at = EXCLUDED.created_at
			`,
			[
				notification.id,
				notification.appointmentId,
				notification.type,
				notification.status,
				notification.scheduledFor,
				notification.sentAt,
				notification.createdAt,
			],
		);
	}
}

export async function seedLocalAppointments(pool) {
	if (process.env.SEED_LOCAL_APPOINTMENTS === "false") {
		return { skipped: true, count: 0 };
	}

	const context = await loadContext(pool);
	const appointments = appointmentSpecs.map((spec, index) =>
		buildAppointment(spec, context, index + 1),
	);
	const appointmentIds = appointments.map((appointment) => appointment.id);

	await pool.query("BEGIN");
	try {
		await pool.query(
			`
				DELETE FROM public.appointments
				WHERE source_payload->>'seedDataset' = $1
					AND NOT (id = ANY($2::uuid[]))
			`,
			[DATASET_NAME, appointmentIds],
		);
		await pool.query(
			"DELETE FROM public.appointment_messages WHERE appointment_id = ANY($1::uuid[])",
			[appointmentIds],
		);
		await pool.query(
			"DELETE FROM public.appointment_notifications WHERE appointment_id = ANY($1::uuid[])",
			[appointmentIds],
		);

		for (const appointment of appointments) {
			await upsertAppointment(pool, appointment);
			await insertMessages(pool, appointment.messages);
			await insertNotifications(pool, appointment.notifications);
		}

		await pool.query("COMMIT");
	} catch (error) {
		await pool.query("ROLLBACK");
		throw error;
	}

	return { skipped: false, count: appointments.length };
}
