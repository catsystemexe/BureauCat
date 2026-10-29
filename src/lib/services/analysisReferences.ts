import { prisma } from "@/lib/prisma";
import { documentInsightSelect } from "@/lib/services/documentInsights";
import { resolveAnalysisReferences } from "@/lib/analysis/references";

/** SELECT-only snapshot. Case-wide pin numbers are checked, never allocated/repaired. */
export async function readAnalysisReferences(document: { id: string; case_id: string }) {
  const insights = await prisma.documentInsight.findMany({ where: {
    document: { case_id: document.case_id }, OR: [{ document_id: document.id }, { source_document_id: document.id }]
  }, select: documentInsightSelect, orderBy: { created_at: "asc" } });
  const pins = await prisma.documentPin.findMany({ where: { document: { case_id: document.case_id } },
    select: { id: true, document_id: true, case_bookmark_number: true, color: true, selected_text: true, start_offset: true, end_offset: true } });
  const documents = await prisma.document.findMany({ where: { case_id: document.case_id,
    id: { in: insights.flatMap((insight) => insight.source_document_id ? [insight.source_document_id] : []) } },
    select: { id: true, processed_markdown: true, processed_text: true, extracted_text: true } });
  const result = resolveAnalysisReferences(insights, pins, documents.map((doc) => ({ id: doc.id, text: doc.processed_markdown ?? doc.processed_text ?? doc.extracted_text ?? "" })));
  return { insights, ...result };
}
