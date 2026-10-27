import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getSourceLinkDocumentId } from "@/lib/documents/sourceLinks";
import { evidenceStateRecheck } from "@/lib/services/evidenceStateService";
import type { CreateJournalItemInput, UpdateJournalItemInput } from "@/lib/validation/journal";

const journalItemSelect = {
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
};

export function listJournalItemsForCase(caseId: string, situationId: string | null) {
  return prisma.journalItem.findMany({
    where: {
      case_id: caseId,
      situation_id: situationId
    },
    orderBy: [{ section: "asc" }, { display_order: "asc" }, { created_at: "asc" }],
    select: journalItemSelect
  });
}

export function getJournalItemById(id: string) {
  return prisma.journalItem.findUnique({
    where: { id },
    select: journalItemSelect
  });
}

export async function createJournalItemForCase(caseId: string, situationId: string, input: CreateJournalItemInput) {
  const maxDisplayOrder = await prisma.journalItem.aggregate({
    where: {
      case_id: caseId,
      situation_id: situationId,
      section: input.section
    },
    _max: {
      display_order: true
    }
  });

  return prisma.journalItem.create({
    data: {
      case_id: caseId,
      situation_id: situationId,
      section: input.section,
      item_type: input.item_type,
      title: input.title,
      value: input.value ?? null,
      explanation: input.explanation ?? null,
      evidence_state: input.evidence_state,
      status: input.status,
      display_order: input.display_order ?? ((maxDisplayOrder._max.display_order ?? 0) + 1),
      source_links_json: input.source_links_json
    },
    select: journalItemSelect
  });
}

export async function updateJournalItem(id: string, input: UpdateJournalItemInput) {
  await prisma.journalItem.update({
    where: { id },
    data: input,
    select: journalItemSelect
  });

  await evidenceStateRecheck(id);

  return getJournalItemById(id);
}

export function markJournalItemObsolete(id: string) {
  return prisma.journalItem.update({
    where: { id },
    data: { status: "obsolete" },
    select: journalItemSelect
  });
}

// Compare structured IDs, never substrings in serialized JSON or user text.
function parseSourceLinks(value: string): Record<string, unknown>[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((link): link is Record<string, unknown> =>
          link !== null && typeof link === "object" && !Array.isArray(link))
      : [];
  } catch {
    return [];
  }
}

export async function removeDocumentJournalItems(
  transaction: Prisma.TransactionClient,
  situationId: string,
  documentId: string
) {
  const analyses = await transaction.document.findMany({
    where: { parent_document_id: documentId, document_type: "analysis" },
    select: { id: true }
  });
  const documentIds = new Set([documentId, ...analyses.map((document) => document.id)]);
  const insights = await transaction.documentInsight.findMany({
    where: { OR: [{ document_id: { in: [...documentIds] } }, { source_document_id: documentId }] },
    select: { id: true, source_pin_id: true, journal_item_id: true }
  });
  const pins = await transaction.documentPin.findMany({
    where: {
      OR: [
        { document_id: { in: [...documentIds] } },
        { id: { in: insights.flatMap((insight) => insight.source_pin_id ? [insight.source_pin_id] : []) } }
      ]
    },
    select: { id: true, document_id: true }
  });
  const pinIds = new Set(pins.map((pin) => pin.id));
  const insightIds = new Set(insights.map((insight) => insight.id));
  const directItemIds = new Set(insights.map((insight) => insight.journal_item_id));
  const journalItems = await transaction.journalItem.findMany({
    select: { id: true, situation_id: true, source_links_json: true }
  });
  const relatedItems = journalItems.filter((item) =>
    item.situation_id === situationId && (
      directItemIds.has(item.id) || parseSourceLinks(item.source_links_json).some((link) =>
        documentIds.has(getSourceLinkDocumentId(link) ?? "") ||
        (typeof link.analysisDocumentId === "string" && documentIds.has(link.analysisDocumentId)) ||
        (typeof link.pinId === "string" && pinIds.has(link.pinId)) ||
        (typeof link.insightId === "string" && insightIds.has(link.insightId))
      )
    )
  );
  const removedIds = relatedItems.map((item) => item.id);
  await transaction.journalItem.deleteMany({ where: { id: { in: removedIds }, situation_id: situationId } });

  // Insights and pins are document-owned, not Situation-owned. Clear projections
  // removed here, but retain records needed by any other Situation.
  await transaction.documentInsight.updateMany({
    where: { journal_item_id: { in: removedIds }, status: "journalized" },
    data: { status: "approved" }
  });
  await transaction.documentInsight.updateMany({
    where: { journal_item_id: { in: removedIds } },
    data: { journal_item_id: null }
  });
  const remainingItems = journalItems.filter((item) => !removedIds.includes(item.id));
  const referencedPinIds = new Set(remainingItems.flatMap((item) =>
    parseSourceLinks(item.source_links_json).map((link) => link.pinId)
  ));
  const sharedDocuments = await transaction.situationDocument.findMany({
    where: { situation_id: { not: situationId }, document_id: { in: pins.map((pin) => pin.document_id) } },
    select: { document_id: true }
  });
  const sharedDocumentIds = new Set(sharedDocuments.map((link) => link.document_id));
  const retainedInsights = await transaction.documentInsight.findMany({
    where: {
      source_pin_id: { in: [...pinIds] },
      OR: [
        { journal_item_id: { not: null } },
        { document: { situation_documents: { some: { situation_id: { not: situationId } } } } }
      ]
    },
    select: { source_pin_id: true }
  });
  for (const insight of retainedInsights) referencedPinIds.add(insight.source_pin_id);
  const unusedPinIds = pins
    .filter((pin) => !sharedDocumentIds.has(pin.document_id) && !referencedPinIds.has(pin.id))
    .map((pin) => pin.id);
  await transaction.documentInsight.updateMany({
    where: { source_pin_id: { in: unusedPinIds } },
    data: { source_pin_id: null }
  });
  await transaction.documentPin.deleteMany({ where: { id: { in: unusedPinIds } } });
}


export async function removeBookmarkLinksForPin(pinId: string) {
  const journalItems = await prisma.journalItem.findMany({
    select: {
      id: true,
      source_links_json: true
    }
  });

  const updatedJournalItems = [];

  for (const journalItem of journalItems) {
    let parsedLinks: unknown;

    try {
      parsedLinks = JSON.parse(journalItem.source_links_json);
    } catch {
      continue;
    }

    if (!Array.isArray(parsedLinks)) {
      continue;
    }

    const nextLinks = parsedLinks.filter((link) => {
      if (!link || typeof link !== "object") {
        return true;
      }

      const candidate = link as { pinId?: unknown };
      return candidate.pinId !== pinId;
    });

    if (nextLinks.length === parsedLinks.length) {
      continue;
    }

    const updatedJournalItem = await prisma.journalItem.update({
      where: { id: journalItem.id },
      data: {
        source_links_json: JSON.stringify(nextLinks)
      }
    });

    updatedJournalItems.push(updatedJournalItem);
  }

  return updatedJournalItems;
}
