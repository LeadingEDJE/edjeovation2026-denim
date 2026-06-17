# AI Usage Explanation

## How AI Is Used

AI is used in two focused parts of the fitting experience.

1. **Product recommendations: deterministic scoring first.** The API first scores catalog products without AI. `recommendation-scoring.ts` compares products with the customer's fit profile, waist size, target inseam length, fit and stretch preferences, focus colors, avoid colors, and selected catalog audience. It then builds a shortlist, usually diversified across bottoms, tops, dresses, outerwear, and other categories. If a signed-off outfit analysis asks for "similar" items only, the candidate pool can be restricted to matching coarse garment categories.

2. **Product recommendations: Claude re-ranking and rationales.** `claude-reranker.ts` sends the rule-based shortlist to Claude through the `@anthropic-ai/sdk`. The configured default model is `claude-opus-4-8`, with support for an Anthropic-compatible proxy through `ANTHROPIC_BASE_URL`. Claude reorders only the provided candidates and returns a JSON summary plus ranked product IDs and associate-facing rationales. This is constrained re-ranking plus structured generation, not open-ended product generation. The stable system prompt is marked with Anthropic prompt caching via `cache_control: { type: "ephemeral" }`.

3. **Optional outfit-to-match analysis.** `outfit-analysis.ts` supports a stateless photo-analysis endpoint for customers who want to build around an existing outfit. Claude vision analyzes the uploaded image into a structured, text-only styling context: visible garments, colors, materials, descriptors, focus colors, style keywords, and a pairing instruction. If the customer opts into "This is me" analysis, the same call can return a hidden body-shape label used only to steer silhouette and fit choices. Image bytes are not written to disk, the database, or logs; only the returned text analysis can be saved.

## What model or tool is used?

The implementation uses **Claude via Anthropic's `@anthropic-ai/sdk`**. The model is read from `RECOMMENDER_MODEL` and defaults to `claude-opus-4-8`. The API key comes from `ANTHROPIC_API_KEY`. If `ANTHROPIC_BASE_URL` is set, the SDK is pointed at that Anthropic-compatible base URL, such as a LiteLLM gateway.

For recommendations, Claude receives a pre-scored candidate shortlist and returns ranked product IDs, a short summary, and rationales. For outfit analysis, Claude receives a base64 image plus instructions and returns a normalized JSON description. Both prompts request JSON in plain text rather than SDK structured-output schemas because compatible proxies may reject schema-based structured output.

## What does it do at that step?

Claude does not search the catalog, invent products, book appointments, or make final decisions. Its recommendation role is to apply qualitative styling judgment after deterministic filters have narrowed the options. It weighs occasion, color direction, style keywords, Muse tag, previously kept sizes, outfit pairing context, and confidential internal body-shape context when present.

For outfit analysis, Claude translates a customer-provided photo into styling signals that the recommendation engine can use. A skirt photo, for example, can become a pairing context that asks the re-ranker to recommend complementary tops rather than another bottom. The recommendation prompt explicitly forbids mentioning hidden body-shape context in summaries or rationales.

## What pattern is it following?

The main recommendation pattern is **hybrid re-ranking with structured generation**:

1. Deterministic scoring creates a bounded shortlist from known catalog products.
2. Claude re-ranks that shortlist and generates rationales.
3. The API validates that returned product IDs exist in the shortlist.
4. Invalid, empty, failed, or unavailable model responses fall back to the deterministic path.

The optional outfit feature uses **vision-to-structured-context extraction**. It turns a photo into normalized text fields that feed the same recommendation pipeline.

## Why AI Is the Right Fit

Without AI, the product still produces recommendations from fit, size, color, and category rules. That is reliable for hard constraints, but it is limited for subjective styling decisions: how a Muse tag, occasion, customer color direction, outfit pairing, and prior purchase context should trade off across different product types.

AI is useful here because the hardest part is not filtering inventory; it is producing a curated associate-ready point of view. Claude can explain why one item fits the customer's occasion and style better than another, and can turn those choices into concise talking points the associate can use during prep.

The optional outfit-analysis flow is also a good AI fit because customers may not describe garments in catalog language. A vision model can convert a photo into practical styling context without forcing the customer to manually enter every garment, color, fabric, and pairing goal.

## Level of AI Dependency

**Integrated.**

AI is a significant part of the personalized styling experience, but the product does not depend on AI to function. If no `ANTHROPIC_API_KEY` is configured, if the Claude call fails, if the response has no usable text, if JSON parsing fails, or if the model returns only product IDs outside the shortlist, the recommendation endpoint returns a rule-based ranking with scorer-derived rationales. The optional outfit-analysis endpoint also falls back to a canned sample analysis so the demo flow remains usable offline.

The appointment workflow, catalog scoring, associate dashboard, product prep states, and recommendation storage still work without Claude. AI improves recommendation quality and rationale richness; it is not the only operating path.

## Responsible AI Considerations

**Hallucination handling.** Claude is constrained to a known shortlist and explicitly instructed to rank only provided products by exact `productId`. The API filters out product IDs that are not in the shortlist, renumbers valid rankings, and falls back to rule-based results if nothing valid remains. Outfit analysis is normalized after parsing, and empty or unusable responses fall back to a sample result.

**Human oversight.** Recommendations are prep aids for store associates. Associates review the suggested products and rationales, can ignore or override them, update prep states, add notes, message the customer, and decide what to pull for the fitting room. AI prepares the context; the associate remains accountable for the customer interaction.

**Transparency.** The API records whether recommendation results came from `claude` or `rule-based`, and outfit analysis records whether the engine was `claude`, `sample`, or `manual`. The experience presents recommendations as system-generated suggestions rather than autonomous decisions.

**Out-of-scope and edge-case handling.** Missing keys, unreachable gateways, invalid JSON, empty shortlists, unsupported model responses, and third-party lookup hiccups are handled with fallbacks instead of blocking an appointment. Similar-only outfit requests restrict categories only when that still leaves candidate products; otherwise the engine returns to the broader catalog shortlist. Prompt rules also tell Claude to avoid specialized categories such as swimwear or sleepwear unless the occasion clearly calls for them.

**User data protection.** The recommendation prompt sends only the styling signals needed for ranking, such as fit profile, color preferences, style context, Muse tag, previously kept sizes, and optional outfit pairing context. Outfit image bytes are processed ephemerally and are not stored or logged by the API. The optional body-shape value is hidden internal context used only to steer silhouette and fit; prompts explicitly forbid mentioning it in summaries or rationales. Production use would still require explicit consent, retention, and privacy review.
