import { z } from "zod";

export const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
});

const clipSchema = z.object({
  id: z.string().min(1),
  sourceUrl: z.string().url("Each clip must have a valid source URL"),
  duration: z.number().min(1).max(60),
  transitionType: z.enum(["crossfade", "none"]).optional(),
});

export const saveTimelineSchema = z.object({
  clips: z.array(clipSchema).min(1, "At least one clip is required"),
});

export const generateClipSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(500),
  duration: z.number().min(4).max(10).default(4),
  imageUrl: z.string().url().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type SaveTimelineInput = z.infer<typeof saveTimelineSchema>;
export type GenerateClipInput = z.infer<typeof generateClipSchema>;
