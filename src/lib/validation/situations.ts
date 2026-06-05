import { z } from "zod";

export const situationStatusSchema = z.enum(["active", "archived"]);

export const createSituationSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required."),
    description: z.string().nullable().optional()
  })
  .strict();

export const updateSituationSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty.").optional(),
    description: z.string().nullable().optional(),
    status: situationStatusSchema.optional(),
    display_order: z.number().int().min(0, "Display order cannot be negative.").optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one situation field must be provided."
  });

export type CreateSituationInput = z.infer<typeof createSituationSchema>;
export type UpdateSituationInput = z.infer<typeof updateSituationSchema>;
