import { z } from "zod";

export const autoAssignSchema = z.object({
  contentBatchId: z.string().min(1, "contentBatchId is required"),
});

export const createEntrySchema = z.object({
  calendarDay: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024).max(2099),
  contentType: z.enum(["CAPTION", "REEL_IDEA", "AD_COPY", "IMAGE", "VIDEO"]),
  contentId: z.string().min(1, "contentId is required"),
  notes: z.string().max(500).optional(),
});

export const updateEntrySchema = z.object({
  notes: z.string().max(500).optional(),
  status: z.enum(["SCHEDULED", "PUBLISHED", "SKIPPED"]).optional(),
  calendarDay: z.number().int().min(1).max(31).optional(),
});

export type AutoAssignInput = z.infer<typeof autoAssignSchema>;
export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
