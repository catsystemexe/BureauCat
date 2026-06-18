import { z } from "zod";
import {
  evidenceStateSchema,
  journalItemTypeSchema,
  journalSectionSchema
} from "@/lib/validation/journal";

export const documentInsightTypeSchema = z.enum([
  "fact",
  "claim",
  "risk",
  "question",
  "legal_reference",
  "term",
  "identifier",
  "conflict"
]);

export const documentInsightStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "journalized"
]);

export const createDocumentInsightSchema = z
  .object({
    source_document_id: z.string().trim().min(1).nullable().optional(),
    source_pin_id: z.string().trim().min(1).nullable().optional(),
    insight_type: documentInsightTypeSchema,
    target_section: journalSectionSchema,
    target_item_type: journalItemTypeSchema,
    title: z.string().trim().min(1),
    content: z.string().nullable().optional(),
    evidence_state: evidenceStateSchema.default("inferred"),
    source_text: z.string().nullable().optional(),
    source_start_offset: z.number().int().nullable().optional(),
    source_end_offset: z.number().int().nullable().optional(),
    analysis_start_offset: z.number().int().nullable().optional(),
    analysis_end_offset: z.number().int().nullable().optional()
  })
  .strict();

export const updateDocumentInsightSchema = z
  .object({
    status: documentInsightStatusSchema.optional(),
    title: z.string().trim().min(1).optional(),
    content: z.string().nullable().optional(),
    evidence_state: evidenceStateSchema.optional(),
    source_text: z.string().nullable().optional(),
    source_start_offset: z.number().int().nullable().optional(),
    source_end_offset: z.number().int().nullable().optional(),
    analysis_start_offset: z.number().int().nullable().optional(),
    analysis_end_offset: z.number().int().nullable().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one insight field must be provided."
  });

export type CreateDocumentInsightInput = z.infer<typeof createDocumentInsightSchema>;
export type UpdateDocumentInsightInput = z.infer<typeof updateDocumentInsightSchema>;
