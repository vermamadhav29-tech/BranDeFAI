import { z } from "zod";

const BRAND_TONES = ["Professional", "Playful", "Inspirational", "Bold", "Minimal", "Luxury", "Witty"];

export const brandSchema = z.object({
  brandName: z.string().min(2, "Brand name must be at least 2 characters").max(80, "Brand name must be at most 80 characters"),
  industry: z
    .string()
    .min(2, "Industry must be at least 2 characters")
    .max(100, "Industry must be at most 100 characters")
    .trim(),
  targetAudience: z.string().min(10, "Target audience must be at least 10 characters").max(400, "Target audience must be at most 400 characters"),
  // One to three tones, comma-separated, e.g. "Professional, Witty". The first is the lead tone.
  tone: z
    .string()
    .refine(
      (v) => {
        const parts = v.split(",").map((t) => t.trim());
        return parts.length >= 1 && parts.length <= 3 && new Set(parts).size === parts.length && parts.every((t) => BRAND_TONES.includes(t));
      },
      { message: "Choose between one and three valid tones" },
    ),
  platforms: z.array(z.string()).optional().default([]),
  brandBrief: z.string().max(500, "Brand brief must be at most 500 characters").trim().optional(),
  whatTheySell: z.string().max(300, "What they sell must be at most 300 characters").trim().optional(),
  city: z.string().max(80, "City must be at most 80 characters").trim().optional(),
  logoUrl: z.string().url("Invalid logo URL").optional().nullable(),
  instagramUrl: z.string().max(200, "Instagram URL must be at most 200 characters").trim().optional(),
  websiteUrl: z.string().max(200, "Website URL must be at most 200 characters").trim().optional(),
  googleBusinessUrl: z.string().max(500, "Google Business URL must be at most 500 characters").trim().optional(),
});

export const logoUrlSchema = z.object({
  logoUrl: z.string().url("Invalid logo URL").nullable(),
});

export const generateFieldSchema = z.object({
  brandName: z.string().min(2).max(80),
  industry: z.string().min(2).max(100).trim(),
  tone: z.string().min(1),
  platforms: z.array(z.string()).default([]),
  field: z.enum(["targetAudience", "brandBrief"]),
  // What the owner has typed so far. When present the AI refines and expands it instead of starting from scratch.
  draft: z.string().max(1000).optional(),
});

export type BrandInput = z.infer<typeof brandSchema>;
export type LogoUrlInput = z.infer<typeof logoUrlSchema>;
export type GenerateFieldInput = z.infer<typeof generateFieldSchema>;
