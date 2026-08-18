import { prisma } from "@/lib/prisma";

type BookmarkSourceLink = {
  type: "bookmark";
  pinId: string;
  documentId: string;
  caseBookmarkNumber: number | null;
  color?: string | null;
  insightId?: string | null;
  analysisDocumentId?: string | null;
  sourceDocumentName?: string | null;
};

function parseBookmarkSourceLinks(sourceLinksJson: string): BookmarkSourceLink[] {
  try {
    const parsed = JSON.parse(sourceLinksJson) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((link): link is BookmarkSourceLink => {
      if (!link || typeof link !== "object") return false;

      const candidate = link as Partial<BookmarkSourceLink>;

      return (
        candidate.type === "bookmark" &&
        typeof candidate.pinId === "string" &&
        typeof candidate.documentId === "string" &&
        (typeof candidate.caseBookmarkNumber === "number" || candidate.caseBookmarkNumber === null) &&
        (candidate.color === undefined || typeof candidate.color === "string" || candidate.color === null) &&
        (candidate.insightId === undefined || typeof candidate.insightId === "string" || candidate.insightId === null) &&
        (candidate.analysisDocumentId === undefined ||
          typeof candidate.analysisDocumentId === "string" ||
          candidate.analysisDocumentId === null) &&
        (candidate.sourceDocumentName === undefined ||
          typeof candidate.sourceDocumentName === "string" ||
          candidate.sourceDocumentName === null)
      );
    });
  } catch {
    return [];
  }
}

function getDocumentDisplayName(document: { filename: string; display_name: string | null }) {
  return document.display_name ?? document.filename;
}

function getDocumentTextPreview(document: {
  processed_markdown: string | null;
  processed_text: string | null;
  extracted_text: string | null;
}) {
  const text = document.processed_markdown ?? document.processed_text ?? document.extracted_text ?? "";
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length > 600 ? `${normalized.slice(0, 600)}…` : normalized;
}

export async function buildCaseContext(caseId: string, situationId: string | null) {
  const caseItem = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      title: true,
      area: true,
      status: true,
      icon: true,
      icon_color: true,
      created_at: true,
      updated_at: true
    }
  });

  if (!caseItem) {
    return null;
  }

  const situations = await prisma.situation.findMany({
    where: { case_id: caseId },
    orderBy: [{ display_order: "asc" }, { created_at: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      display_order: true,
      created_at: true,
      updated_at: true
    }
  });

  const selectedSituation =
    situationId
      ? await prisma.situation.findFirst({
          where: { id: situationId, case_id: caseId },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            display_order: true,
            created_at: true,
            updated_at: true
          }
        })
      : null;

  if (situationId && !selectedSituation) {
    return {
      case: caseItem,
      error: "SITUATION_NOT_FOUND" as const
    };
  }

  const journalItems = await prisma.journalItem.findMany({
    where: {
      case_id: caseId,
      ...(situationId ? { situation_id: situationId } : {})
    },
    orderBy: [{ section: "asc" }, { display_order: "asc" }, { created_at: "asc" }],
    select: {
      id: true,
      case_id: true,
      situation_id: true,
      section: true,
      item_type: true,
      title: true,
      value: true,
      explanation: true,
      evidence_state: true,
      status: true,
      display_order: true,
      source_links_json: true,
      created_at: true,
      updated_at: true
    }
  });

  const documents = await prisma.document.findMany({
    where: {
      case_id: caseId,
      ...(situationId
        ? {
            OR: [
              {
                situation_documents: {
                  some: { situation_id: situationId }
                }
              },
              {
                document_type: "analysis",
                parent_document: {
                  situation_documents: {
                    some: { situation_id: situationId }
                  }
                }
              }
            ]
          }
        : {})
    },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      case_id: true,
      filename: true,
      display_name: true,
      filetype: true,
      document_type: true,
      analysis_type: true,
      parent_document_id: true,
      processed_markdown: true,
      processed_text: true,
      extracted_text: true,
      processing_status: true,
      processing_error: true,
      validation_status: true,
      ai_summary: true,
      created_at: true
    }
  });

  const documentIds = documents.map((document) => document.id);

  const pins = await prisma.documentPin.findMany({
    where: {
      document_id: { in: documentIds }
    },
    orderBy: [{ case_bookmark_number: "asc" }, { created_at: "asc" }],
    select: {
      id: true,
      document_id: true,
      selected_text: true,
      start_offset: true,
      end_offset: true,
      visual_offset: true,
      case_bookmark_number: true,
      color: true,
      note_text: true,
      created_at: true,
      updated_at: true
    }
  });

  const insights = await prisma.documentInsight.findMany({
    where: {
      document: {
        case_id: caseId
      },
      status: {
        in: ["approved", "journalized"]
      },
      ...(situationId
        ? {
            OR: [
              { journal_item_id: { in: journalItems.map((item) => item.id) } },
              { source_pin_id: { in: pins.map((pin) => pin.id) } }
            ]
          }
        : {})
    },
    orderBy: { created_at: "asc" },
    select: {
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
    }
  });

  const documentById = new Map(documents.map((document) => [document.id, document]));
  const pinById = new Map(pins.map((pin) => [pin.id, pin]));

  const journalWithAnchors = journalItems.map((item) => {
    const bookmarkLinks = parseBookmarkSourceLinks(item.source_links_json);

    return {
      ...item,
      bookmark_links: bookmarkLinks.map((link) => {
        const document = documentById.get(link.documentId);
        const pin = pinById.get(link.pinId);

        return {
          ...link,
          documentName: document ? getDocumentDisplayName(document) : link.sourceDocumentName ?? null,
          quotedText: pin?.selected_text ?? null,
          pinNote: pin?.note_text ?? null,
          startOffset: pin?.start_offset ?? null,
          endOffset: pin?.end_offset ?? null
        };
      })
    };
  });

  const context = {
    generated_at: new Date().toISOString(),
    case: caseItem,
    situation: selectedSituation,
    situations,
    documents: documents.map((document) => ({
      id: document.id,
      case_id: document.case_id,
      filename: document.filename,
      display_name: document.display_name,
      name: getDocumentDisplayName(document),
      filetype: document.filetype,
      document_type: document.document_type,
      analysis_type: document.analysis_type,
      parent_document_id: document.parent_document_id,
      processing_status: document.processing_status,
      processing_error: document.processing_error,
      validation_status: document.validation_status,
      ai_summary: document.ai_summary,
      text_preview: getDocumentTextPreview(document),
      created_at: document.created_at
    })),
    pins,
    journal_items: journalWithAnchors,
    confirmed_anchors: journalWithAnchors.filter((item) => item.status === "active"),
    approved_insights: insights,
    open_questions: journalWithAnchors.filter(
      (item) => item.status === "active" && item.item_type === "QUESTION"
    ),
    risks: journalWithAnchors.filter(
      (item) => item.status === "active" && item.item_type === "RISK"
    ),
    goals: journalWithAnchors.filter(
      (item) => item.status === "active" && item.item_type === "GOAL"
    )
  };

  return context;
}
