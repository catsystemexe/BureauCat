import { mockChatAI } from "@/lib/ai/mockChatAI";
import { prisma } from "@/lib/prisma";
import { getCaseById } from "@/lib/services/cases";
import { aiChatResponseSchema, type CreateChatMessageInput } from "@/lib/validation/chat";

const chatMessageSelect = {
  id: true,
  case_id: true,
  role: true,
  content: true,
  created_at: true
};

const aiSuggestionSelect = {
  id: true,
  case_id: true,
  status: true,
  suggested_item_json: true,
  assistant_reply: true,
  created_at: true,
  updated_at: true
};

type ChatMessageRecord = {
  id: string;
  case_id: string;
  role: string;
  content: string;
  created_at: Date;
};

type AISuggestionRecord = {
  id: string;
  case_id: string;
  status: string;
  suggested_item_json: string;
  assistant_reply: string | null;
  created_at: Date;
  updated_at: Date;
};

type DocumentSummaryRecord = {
  filename: string;
  ai_summary: string | null;
  extracted_text: string | null;
};

type ChatTransactionClient = {
  chatMessage: Pick<typeof prisma.chatMessage, "create">;
  aISuggestion: Pick<typeof prisma.aISuggestion, "create">;
};

export type ChatContext = {
  case: NonNullable<Awaited<ReturnType<typeof getCaseById>>>;
  compactJournal: string[];
  documentSummaries: string[];
  lastMessages: ChatMessageRecord[];
  currentMessage: string;
};

export type SendChatMessageResult =
  | {
      ok: true;
      data: {
        assistantMessage: ChatMessageRecord;
        suggestions: AISuggestionRecord[];
      };
    }
  | { ok: false; error: "case_not_found" };

export function listChatMessagesForCase(caseId: string) {
  return prisma.chatMessage.findMany({
    where: { case_id: caseId },
    orderBy: { created_at: "asc" },
    select: chatMessageSelect
  });
}

async function listLastChatMessages(caseId: string) {
  const messages = await prisma.chatMessage.findMany({
    where: { case_id: caseId },
    orderBy: { created_at: "desc" },
    take: 10,
    select: chatMessageSelect
  });

  return messages.reverse();
}

function compactJournalItem(item: {
  item_type: string;
  title: string;
  value: string | null;
  evidence_state: string;
}) {
  const value = item.value ? ` | ${item.value}` : "";

  return `[${item.item_type}] ${item.title}${value} | ${item.evidence_state}`;
}

export async function buildChatContext(
  caseId: string,
  currentMessage: string
): Promise<ChatContext | null> {
  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return null;
  }

  const [journalItems, documents, lastMessages] = await Promise.all([
    prisma.journalItem.findMany({
      where: { case_id: caseId },
      orderBy: [{ section: "asc" }, { display_order: "asc" }, { created_at: "asc" }],
      select: {
        item_type: true,
        title: true,
        value: true,
        evidence_state: true
      }
    }),
    prisma.document.findMany({
      where: { case_id: caseId },
      orderBy: { created_at: "desc" },
      select: {
        filename: true,
        ai_summary: true,
        extracted_text: true
      }
    }),
    listLastChatMessages(caseId)
  ]);

  return {
    case: foundCase,
    compactJournal: journalItems.map(compactJournalItem),
    documentSummaries: documents.map((document: DocumentSummaryRecord) => {
      const summary =
        document.ai_summary ?? document.extracted_text?.slice(0, 500) ?? "Shrnutí zatím není k dispozici.";

      return `${document.filename}: ${summary}`;
    }),
    lastMessages,
    currentMessage
  };
}

export async function sendChatMessage(
  caseId: string,
  input: CreateChatMessageInput
): Promise<SendChatMessageResult> {
  const context = await buildChatContext(caseId, input.content);

  if (!context) {
    return { ok: false, error: "case_not_found" };
  }

  const aiResponse = await mockChatAI(context);
  const validationResult = aiChatResponseSchema.safeParse(aiResponse);
  const assistantReply = validationResult.success
    ? validationResult.data.assistant_reply
    : typeof aiResponse.assistant_reply === "string" && aiResponse.assistant_reply.trim()
      ? aiResponse.assistant_reply
      : "Vaši zprávu jsem zaznamenal.";
  const validSuggestions = validationResult.success ? validationResult.data.suggestions : [];

  const transactionResult = await prisma.$transaction(async (tx: ChatTransactionClient) => {
    await tx.chatMessage.create({
      data: {
        case_id: caseId,
        role: "user",
        content: input.content
      },
      select: chatMessageSelect
    });

    const assistantMessage = await tx.chatMessage.create({
      data: {
        case_id: caseId,
        role: "assistant",
        content: assistantReply
      },
      select: chatMessageSelect
    });

    const suggestions = await Promise.all(
      validSuggestions.map((suggestion) =>
        tx.aISuggestion.create({
          data: {
            case_id: caseId,
            status: "pending",
            suggested_item_json: JSON.stringify(suggestion),
            assistant_reply: assistantReply
          },
          select: aiSuggestionSelect
        })
      )
    );

    return { assistantMessage, suggestions };
  });

  return { ok: true, data: transactionResult };
}
