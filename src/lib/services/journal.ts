import { prisma } from "@/lib/prisma";
import { evidenceStateRecheck } from "@/lib/services/evidenceStateService";
import type { CreateJournalItemInput, UpdateJournalItemInput } from "@/lib/validation/journal";

const journalItemSelect = {
  id: true,
  case_id: true,
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

export function listJournalItemsForCase(caseId: string) {
  return prisma.journalItem.findMany({
    where: { case_id: caseId },
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

export async function createJournalItemForCase(caseId: string, input: CreateJournalItemInput) {
  const maxDisplayOrder = await prisma.journalItem.aggregate({
    where: {
      case_id: caseId,
      section: input.section
    },
    _max: {
      display_order: true
    }
  });

  return prisma.journalItem.create({
    data: {
      case_id: caseId,
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
