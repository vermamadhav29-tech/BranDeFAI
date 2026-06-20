import { z } from "zod";

export const generateContentSchema = z.object({
  productImageId: z.string().uuid("Invalid product image ID").optional(),
});

export type GenerateContentInput = z.infer<typeof generateContentSchema>;
