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

export type OrderHistoryScenario = "standard" | "denim-heavy" | "returns" | "empty" | "error";

export type OrderHistoryItem = {
  sku: string;
  productName: string;
  category: string;
  sizeLabel: string;
  fit: string;
  wash: string;
  quantity: number;
  unitPrice: number;
  kept: boolean;
  returnReason: string | null;
};

export type OrderHistoryOrder = {
  orderId: string;
  orderedAt: string;
  channel: "web" | "store" | "mobile";
  status: "processing" | "delivered" | "returned" | "exchanged";
  items: OrderHistoryItem[];
};

export type OrderHistory = {
  customerId: string;
  scenario: OrderHistoryScenario;
  orders: OrderHistoryOrder[];
};
