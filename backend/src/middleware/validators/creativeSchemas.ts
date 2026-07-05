import { z } from "zod";

export const generatePostSchema = z.object({
  productImageId: z.string().uuid().optional(),
});

export const updatePostStatusSchema = z.object({
  status: z.enum(["APPROVED", "SCHEDULED", "POSTED", "PENDING_APPROVAL"]),
  scheduledAt: z.string().datetime().optional(),
});

export const updatePostCaptionSchema = z.object({
  caption: z.string().min(1).max(2000),
  hashtags: z.array(z.string()).optional(),
});

export type GeneratePostInput = z.infer<typeof generatePostSchema>;
export type UpdatePostStatusInput = z.infer<typeof updatePostStatusSchema>;
export type UpdatePostCaptionInput = z.infer<typeof updatePostCaptionSchema>;
