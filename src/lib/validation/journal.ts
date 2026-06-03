import { z } from "zod";

export const journalSectionSchema = z.enum([
  "description",
  "goals",
  "risks",
  "open_questions",
  "strategy"
]);

export const journalItemTypeSchema = z.enum([
  "FACT",
  "CLAIM",
  "GOAL",
  "QUESTION",
  "ACTION",
  "RISK"
]);

export const evidenceStateSchema = z.enum([
  "verified",
  "inferred",
  "unverified",
  "conflict"
]);

export const journalItemStatusSchema = z.enum([
  "active",
  "resolved",
  "obsolete"
]);

export const sourceLinksJsonSchema = z.string().refine(
  (value) => {
    try {
      return Array.isArray(JSON.parse(value));
    } catch {
      return false;
    }
  },
  { message: "Source links must be a JSON array string." }
);

export const updateJournalItemSchema = z
  .object({
    section: journalSectionSchema.optional(),
    item_type: journalItemTypeSchema.optional(),
    title: z.string().trim().min(1, "Title cannot be empty.").optional(),
    value: z.string().nullable().optional(),
    explanation: z.string().nullable().optional(),
    evidence_state: evidenceStateSchema.optional(),
    status: journalItemStatusSchema.optional(),
    display_order: z.number().int().optional(),
    source_links_json: sourceLinksJsonSchema.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one journal field must be provided."
  });

export type UpdateJournalItemInput = z.infer<typeof updateJournalItemSchema>;
