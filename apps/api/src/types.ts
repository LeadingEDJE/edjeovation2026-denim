import { z } from "zod";

export const fittingInputSchema = z.object({
  customerName: z.string().min(1).max(120),
  heightInches: z.number().int().min(48).max(90),
  waistInches: z.number().min(20).max(70),
  hipInches: z.number().min(28).max(80),
  inseamInches: z.number().min(20).max(40),
  fitPreference: z.enum(["skinny", "slim", "straight", "relaxed", "wide"]),
  stretchPreference: z.enum(["rigid", "comfort-stretch", "high-stretch"])
});

export type FittingInput = z.infer<typeof fittingInputSchema>;

export type FittingSession = FittingInput & {
  id: string;
  createdAt: string;
};

export type DenimRecommendation = {
  id: string;
  sessionId: string;
  styleName: string;
  sizeLabel: string;
  confidence: number;
  rationale: string;
  createdAt: string;
};

// Query params for browsing the scraped catalog. Coerced from strings since
// they arrive on the query string.
export const catalogQuerySchema = z.object({
  fit: z.enum(["skinny", "slim", "straight", "relaxed", "wide"]).optional(),
  rise: z.enum(["ultra-high", "high", "mid", "low"]).optional(),
  stretch: z.enum(["rigid", "comfort-stretch", "high-stretch"]).optional(),
  category: z.string().min(1).max(120).optional(),
  q: z.string().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export type CatalogProduct = {
  productId: string;
  source: string;
  name: string;
  category: string | null;
  productUrl: string;
  imageUrl: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  fit: string | null;
  rise: string | null;
  stretch: string | null;
  sizes: string[];
  colors: string[];
  scrapedAt: string;
};
