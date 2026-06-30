import { z } from "zod";

export const generateImageSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(1000, "Prompt must be 1000 characters or fewer"),
  style: z.string().max(100).default("photorealistic"),
  format: z.enum(["1:1", "4:5", "16:9"]).default("1:1"),
  referenceImageUrl: z.string().url().optional(),
  includeLogo: z.boolean().optional().default(false),
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;

export const generatePostBriefsSchema = z.object({
  productImageIds: z
    .array(z.string().uuid("Each ID must be a valid UUID"))
    .min(1, "At least 1 image is required")
    .max(15, "Maximum 15 images allowed"),
});

export type GeneratePostBriefsInput = z.infer<typeof generatePostBriefsSchema>;

export const generateProductPostsSchema = z.object({
  briefId: z.string().uuid("briefId must be a valid UUID"),
});

export type GenerateProductPostsInput = z.infer<typeof generateProductPostsSchema>;

export const lifestyleImageSchema = z.object({
  brief: z.string().min(1, "Brief is required").max(500, "Brief must be 500 characters or fewer"),
  brandId: z.string().uuid("brandId must be a valid UUID"),
});

export type LifestyleImageInput = z.infer<typeof lifestyleImageSchema>;
