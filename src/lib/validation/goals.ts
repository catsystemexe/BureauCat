import { z } from "zod";

export const goalStatusSchema = z.enum(["active", "completed", "archived"]);

export const createGoalSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.")
  })
  .strict();

export const updateGoalSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty.").optional(),
    status: goalStatusSchema.optional(),
    display_order: z.number().int().min(0, "Display order cannot be negative.").optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one goal field must be provided."
  });

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
