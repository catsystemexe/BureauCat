import { prisma } from "@/lib/prisma";

export const documentInsightSelect = {
  id: true,
  document_id: true,
  source_document_id: true,
  source_pin_id: true,
  insight_type: true,
  target_section: true,
  target_item_type: true,
  title: true,
  content: true,
  evidence_state: true,
  status: true,
  source_text: true,
  source_start_offset: true,
  source_end_offset: true,
  journal_item_id: true,
  created_at: true,
  updated_at: true
};

export type CreateDocumentInsightInput = {
  document_id: string;
  source_document_id?: string | null;
  source_pin_id?: string | null;
  insight_type: string;
  target_section: string;
  target_item_type: string;
  title: string;
  content?: string | null;
  evidence_state?: string;
  source_text?: string | null;
  source_start_offset?: number | null;
  source_end_offset?: number | null;
};

export function listDocumentInsights(documentId: string) {
  return prisma.documentInsight.findMany({
    where: { document_id: documentId },
    orderBy: { created_at: "asc" },
    select: documentInsightSelect
  });
}

export function getDocumentInsightById(id: string) {
  return prisma.documentInsight.findUnique({
    where: { id },
    select: documentInsightSelect
  });
}

export function createDocumentInsight(input: CreateDocumentInsightInput) {
  return prisma.documentInsight.create({
    data: {
      document_id: input.document_id,
      source_document_id: input.source_document_id ?? null,
      source_pin_id: input.source_pin_id ?? null,
      insight_type: input.insight_type,
      target_section: input.target_section,
      target_item_type: input.target_item_type,
      title: input.title,
      content: input.content ?? null,
      evidence_state: input.evidence_state ?? "inferred",
      source_text: input.source_text ?? null,
      source_start_offset: input.source_start_offset ?? null,
      source_end_offset: input.source_end_offset ?? null
    },
    select: documentInsightSelect
  });
}

export function updateDocumentInsight(
  id: string,
  input: {
    status?: "pending" | "approved" | "rejected" | "journalized";
    title?: string;
    content?: string | null;
    evidence_state?: string;
    source_text?: string | null;
    source_start_offset?: number | null;
    source_end_offset?: number | null;
  }
) {
  return prisma.documentInsight.update({
    where: { id },
    data: input,
    select: documentInsightSelect
  });
}

export function deleteDocumentInsight(id: string) {
  return prisma.documentInsight.delete({
    where: { id },
    select: documentInsightSelect
  });
}
