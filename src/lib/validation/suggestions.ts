import { z } from "zod";
import {
  evidenceStateSchema,
  journalItemStatusSchema,
  journalItemTypeSchema,
  journalSectionSchema,
  sourceLinksJsonSchema
} from "@/lib/validation/journal";

export const aiSuggestionStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const suggestionJournalItemSchema = z
  .object({
    section: journalSectionSchema,
    item_type: journalItemTypeSchema,
    title: z.string().trim().min(1, "Title is required."),
    value: z.string().nullable().optional(),
    explanation: z.string().nullable().optional(),
    evidence_state: evidenceStateSchema.default("unverified"),
    status: journalItemStatusSchema.default("active"),
    display_order: z.number().int().default(0),
    source_links_json: sourceLinksJsonSchema.default("[]")
  })
  .strict();

export const approveSuggestionSchema = z
  .object({
    edited_item: suggestionJournalItemSchema.optional()
  })
  .strict();

export const listAISuggestionsQuerySchema = z
  .object({
    status: aiSuggestionStatusSchema.optional()
  })
  .strict();

export type AISuggestionStatus = z.infer<typeof aiSuggestionStatusSchema>;
export type SuggestionJournalItemInput = z.infer<typeof suggestionJournalItemSchema>;
export type ApproveSuggestionInput = z.infer<typeof approveSuggestionSchema>;
export type ListAISuggestionsQuery = z.infer<typeof listAISuggestionsQuerySchema>;
