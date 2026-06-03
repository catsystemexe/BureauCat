import { z } from "zod";

export const caseStatusSchema = z.enum(["draft", "active", "closed"]);

export const createCaseSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required."),
    area: z.string().trim().min(1, "Area cannot be empty.").nullable().optional()
  })
  .strict();

export const updateCaseSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty.").optional(),
    area: z.string().trim().min(1, "Area cannot be empty.").nullable().optional(),
    status: caseStatusSchema.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one case field must be provided."
  });

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
