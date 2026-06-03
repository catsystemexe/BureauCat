import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { evidenceStateRecheck } from "@/lib/services/evidenceStateService";
import {
  type AISuggestionStatus,
  type ApproveSuggestionInput,
  type SuggestionJournalItemInput,
  suggestionJournalItemSchema
} from "@/lib/validation/suggestions";

const aiSuggestionSelect = {
  id: true,
  case_id: true,
  status: true,
  suggested_item_json: true,
  assistant_reply: true,
  created_at: true,
  updated_at: true
};

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

type SuggestionServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "not_found" | "not_pending" | "invalid_json" }
  | { ok: false; error: "invalid_item"; validationError: ZodError };

type SuggestionTransactionClient = {
  aISuggestion: Pick<typeof prisma.aISuggestion, "updateMany" | "findUniqueOrThrow">;
  journalItem: Pick<typeof prisma.journalItem, "create">;
};

function parseSuggestedItemJson(suggestedItemJson: string) {
  try {
    return { ok: true as const, value: JSON.parse(suggestedItemJson) as unknown };
  } catch {
    return { ok: false as const };
  }
}

export function listAISuggestionsForCase(caseId: string, status?: AISuggestionStatus) {
  return prisma.aISuggestion.findMany({
    where: {
      case_id: caseId,
      ...(status ? { status } : {})
    },
    orderBy: { created_at: "desc" },
    select: aiSuggestionSelect
  });
}

export function getAISuggestionById(id: string) {
  return prisma.aISuggestion.findUnique({
    where: { id },
    select: aiSuggestionSelect
  });
}

export async function approveAISuggestion(
  id: string,
  input: ApproveSuggestionInput
): Promise<
  SuggestionServiceResult<{
    journalItem: NonNullable<Awaited<ReturnType<typeof prisma.journalItem.findUnique>>>;
    suggestion: NonNullable<Awaited<ReturnType<typeof getAISuggestionById>>>;
  }>
> {
  const suggestion = await getAISuggestionById(id);

  if (!suggestion) {
    return { ok: false, error: "not_found" };
  }

  if (suggestion.status !== "pending") {
    return { ok: false, error: "not_pending" };
  }

  let finalItemCandidate: unknown = input.edited_item;

  if (!finalItemCandidate) {
    const parsedSuggestedItem = parseSuggestedItemJson(suggestion.suggested_item_json);

    if (!parsedSuggestedItem.ok) {
      return { ok: false, error: "invalid_json" };
    }

    finalItemCandidate = parsedSuggestedItem.value;
  }

  const validationResult = suggestionJournalItemSchema.safeParse(finalItemCandidate);

  if (!validationResult.success) {
    return {
      ok: false,
      error: "invalid_item",
      validationError: validationResult.error
    };
  }

  return createJournalItemAndApproveSuggestion(id, suggestion.case_id, validationResult.data);
}

async function createJournalItemAndApproveSuggestion(
  suggestionId: string,
  caseId: string,
  finalItem: SuggestionJournalItemInput
) {
  const transactionResult = await prisma.$transaction(async (tx: SuggestionTransactionClient) => {
    const updatedSuggestions = await tx.aISuggestion.updateMany({
      where: { id: suggestionId, status: "pending" },
      data: { status: "approved" }
    });

    if (updatedSuggestions.count === 0) {
      return null;
    }

    const journalItem = await tx.journalItem.create({
      data: {
        case_id: caseId,
        section: finalItem.section,
        item_type: finalItem.item_type,
        title: finalItem.title,
        value: finalItem.value ?? null,
        explanation: finalItem.explanation ?? null,
        evidence_state: finalItem.evidence_state,
        status: finalItem.status,
        display_order: finalItem.display_order,
        source_links_json: finalItem.source_links_json
      },
      select: journalItemSelect
    });

    const approvedSuggestion = await tx.aISuggestion.findUniqueOrThrow({
      where: { id: suggestionId },
      select: aiSuggestionSelect
    });

    return { journalItem, suggestion: approvedSuggestion };
  });

  if (!transactionResult) {
    return { ok: false as const, error: "not_pending" as const };
  }

  await evidenceStateRecheck(transactionResult.journalItem.id);

  const journalItem = await prisma.journalItem.findUniqueOrThrow({
    where: { id: transactionResult.journalItem.id },
    select: journalItemSelect
  });

  return {
    ok: true as const,
    data: {
      journalItem,
      suggestion: transactionResult.suggestion
    }
  };
}

export async function rejectAISuggestion(
  id: string
): Promise<
  SuggestionServiceResult<{
    suggestion: NonNullable<Awaited<ReturnType<typeof getAISuggestionById>>>;
  }>
> {
  const suggestion = await getAISuggestionById(id);

  if (!suggestion) {
    return { ok: false, error: "not_found" };
  }

  if (suggestion.status !== "pending") {
    return { ok: false, error: "not_pending" };
  }

  const updatedSuggestions = await prisma.aISuggestion.updateMany({
    where: { id, status: "pending" },
    data: { status: "rejected" }
  });

  if (updatedSuggestions.count === 0) {
    return { ok: false, error: "not_pending" };
  }

  const rejectedSuggestion = await getAISuggestionById(id);

  if (!rejectedSuggestion) {
    return { ok: false, error: "not_found" };
  }

  return {
    ok: true,
    data: { suggestion: rejectedSuggestion }
  };
}
