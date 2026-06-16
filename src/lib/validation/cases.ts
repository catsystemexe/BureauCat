import { z } from "zod";

export const CASE_ICON_KEYS = [
  "folder",
  "file-text",
  "landmark",
  "users",
  "car",
  "scale",
  "shield",
  "briefcase",
  "building",
  "section",
  "swords",
  "alarm-clock",
  "cat",
  "handshake",
  "pen-tool",
  "puzzle",
  "hand-coins",
  "mail",
  "house",
  "message-square-warning"
] as const;

export const CASE_ICON_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#8b5cf6",
  "#22c55e"
] as const;

export const caseStatusSchema = z.enum(["draft", "active", "closed"]);
export const caseIconSchema = z.enum(CASE_ICON_KEYS);
export const caseIconColorSchema = z.enum(CASE_ICON_COLORS);

export const createCaseSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required."),
    area: z.string().trim().min(1, "Area cannot be empty.").nullable().optional(),
    icon: caseIconSchema.optional(),
    icon_color: caseIconColorSchema.optional()
  })
  .strict();

export const updateCaseSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty.").optional(),
    area: z.string().trim().min(1, "Area cannot be empty.").nullable().optional(),
    status: caseStatusSchema.optional(),
    icon: caseIconSchema.optional(),
    icon_color: caseIconColorSchema.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one case field must be provided."
  });

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
