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
  analysis_start_offset: true,
  analysis_end_offset: true,
  journal_item_id: true,
  created_at: true,
  updated_at: true
};

function getInsightBookmarkColor(insightType: string) {
  if (insightType === "risk" || insightType === "conflict") return "orange";
  if (insightType === "legal_reference" || insightType === "term") return "purple";
  if (insightType === "identifier") return "gray";
  if (insightType === "question") return "yellow";
  if (insightType === "fact" || insightType === "claim") return "green";
  return "blue";
}

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
  analysis_start_offset?: number | null;
  analysis_end_offset?: number | null;
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
      source_end_offset: input.source_end_offset ?? null,
      analysis_start_offset: input.analysis_start_offset ?? null,
      analysis_end_offset: input.analysis_end_offset ?? null
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
    analysis_start_offset?: number | null;
    analysis_end_offset?: number | null;
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

export async function journalizeDocumentInsight(insightId: string, situationId: string) {
  return prisma.$transaction(async (transaction) => {
    const insight = await transaction.documentInsight.findUnique({
      where: { id: insightId },
      select: documentInsightSelect
    });

    if (!insight) {
      throw new Error("Insight not found.");
    }

    if (!insight.source_document_id) {
      throw new Error("Insight nemá zdrojový dokument.");
    }

    if (insight.journal_item_id) {
      const existingJournalItem = await transaction.journalItem.findUnique({
        where: { id: insight.journal_item_id }
      });

      if (existingJournalItem) {
        const existingPin = insight.source_pin_id
          ? await transaction.documentPin.findUnique({ where: { id: insight.source_pin_id } })
          : null;

        return { insight, journalItem: existingJournalItem, pin: existingPin };
      }
    }

    const sourceDocument = await transaction.document.findUnique({
      where: { id: insight.source_document_id },
      select: { id: true, case_id: true, filename: true, display_name: true }
    });

    if (!sourceDocument) {
      throw new Error("Zdrojový dokument nebyl nalezen.");
    }

    const situation = await transaction.situation.findUnique({
      where: { id: situationId },
      select: { id: true, case_id: true }
    });

    if (!situation || situation.case_id !== sourceDocument.case_id) {
      throw new Error("Situace nepatří ke stejnému případu.");
    }

    const hasReliableSourceRange =
      insight.source_start_offset !== null &&
      insight.source_end_offset !== null &&
      insight.source_end_offset > insight.source_start_offset;

    let pin: {
      id: string;
      case_bookmark_number: number | null;
      color: string;
    } | null = null;

    if (hasReliableSourceRange) {
      const maxCaseBookmarkNumber = await transaction.documentPin.aggregate({
        where: {
          document: {
            case_id: sourceDocument.case_id
          }
        },
        _max: {
          case_bookmark_number: true
        }
      });

      pin = await transaction.documentPin.create({
        data: {
          document_id: sourceDocument.id,
          selected_text: insight.source_text ?? "",
          start_offset: insight.source_start_offset!,
          end_offset: insight.source_end_offset!,
          case_bookmark_number: (maxCaseBookmarkNumber._max.case_bookmark_number ?? 0) + 1,
          color: getInsightBookmarkColor(insight.insight_type),
          note_text: insight.title
        },
        select: {
          id: true,
          case_bookmark_number: true,
          color: true
        }
      });
    }

    const maxDisplayOrder = await transaction.journalItem.aggregate({
      where: {
        case_id: sourceDocument.case_id,
        situation_id: situationId,
        section: insight.target_section
      },
      _max: {
        display_order: true
      }
    });

    const sourceLink = pin
      ? {
          type: "bookmark",
          pinId: pin.id,
          documentId: sourceDocument.id,
          caseBookmarkNumber: pin.case_bookmark_number,
          color: pin.color,
          insightId: insight.id,
          analysisDocumentId: insight.document_id,
          sourceDocumentName: sourceDocument.display_name ?? sourceDocument.filename
        }
      : {
          type: "document_insight",
          documentId: sourceDocument.id,
          insightId: insight.id,
          analysisDocumentId: insight.document_id,
          sourceDocumentName: sourceDocument.display_name ?? sourceDocument.filename,
          sourceText: insight.source_text
        };

    const journalItem = await transaction.journalItem.create({
      data: {
        case_id: sourceDocument.case_id,
        situation_id: situationId,
        section: insight.target_section,
        item_type: insight.target_item_type,
        title: insight.title,
        value: insight.content,
        explanation: insight.source_text,
        evidence_state: insight.evidence_state,
        status: "active",
        display_order: (maxDisplayOrder._max.display_order ?? 0) + 1,
        source_links_json: JSON.stringify([sourceLink])
      }
    });

    const updatedInsight = await transaction.documentInsight.update({
      where: { id: insight.id },
      data: {
        status: "journalized",
        source_pin_id: pin?.id ?? null,
        journal_item_id: journalItem.id
      },
      select: documentInsightSelect
    });

    return { insight: updatedInsight, journalItem, pin };
  });
}
