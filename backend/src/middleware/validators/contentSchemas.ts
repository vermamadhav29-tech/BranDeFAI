import { z } from "zod";

export const generateContentSchema = z.object({
  productImageId: z.string().uuid("Invalid product image ID").optional(),
});

export const regenerateCaptionSchema = z.object({
  campaignBrief: z.string().max(500, "Campaign brief must be at most 500 characters").trim().optional().default(""),
  goal: z.enum(["promotional", "awareness", "engagement"]).optional().default("promotional"),
});

export type GenerateContentInput = z.infer<typeof generateContentSchema>;
export type RegenerateCaptionInput = z.infer<typeof regenerateCaptionSchema>;
