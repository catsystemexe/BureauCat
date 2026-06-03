import { prisma } from "@/lib/prisma";
import { getCaseById } from "@/lib/services/cases";
import {
  meetingPrepResponseSchema,
  type MeetingPrep,
  type MeetingPrepResponse
} from "@/lib/validation/meetingPrep";

const journalItemSelect = {
  section: true,
  item_type: true,
  title: true,
  value: true,
  explanation: true,
  evidence_state: true,
  display_order: true,
  created_at: true
};

const documentSummarySelect = {
  filename: true,
  ai_summary: true,
  extracted_text: true
};

const chatMessageSelect = {
  role: true,
  content: true,
  created_at: true
};

type JournalItemContext = {
  section: string;
  item_type: string;
  title: string;
  value: string | null;
  explanation: string | null;
  evidence_state: string;
  display_order: number;
  created_at: Date;
};

type DocumentSummaryContext = {
  filename: string;
  ai_summary: string | null;
  extracted_text: string | null;
};

type ChatMessageContext = {
  role: string;
  content: string;
  created_at: Date;
};

type MeetingPrepContext = {
  case: NonNullable<Awaited<ReturnType<typeof getCaseById>>>;
  journalItems: JournalItemContext[];
  documentSummaries: DocumentSummaryContext[];
  lastMessages: ChatMessageContext[];
};

export type GenerateMeetingPrepResult =
  | { ok: true; data: MeetingPrepResponse }
  | { ok: false; error: "case_not_found" };

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function formatJournalValue(item: JournalItemContext) {
  return item.value ? `${item.title}: ${item.value}` : item.title;
}

function firstBySection(items: JournalItemContext[], section: string, fallback: string) {
  const values = items.filter((item) => item.section === section).map(formatJournalValue);

  return uniqueNonEmpty(values).slice(0, 5).concat(values.length === 0 ? [fallback] : []);
}

function summarizeDocuments(documents: DocumentSummaryContext[]) {
  return documents.map((document) => {
    const summary = document.ai_summary ?? document.extracted_text?.slice(0, 240) ?? "No summary yet.";

    return `${document.filename} — ${summary}`;
  });
}

function buildSummary(context: MeetingPrepContext) {
  const descriptionItems = context.journalItems.filter((item) => item.section === "description");
  const documentCount = context.documentSummaries.length;
  const messageCount = context.lastMessages.length;
  const description = descriptionItems.length > 0
    ? uniqueNonEmpty(descriptionItems.map(formatJournalValue)).slice(0, 3).join("; ")
    : "No journal description items have been recorded yet.";

  return `Mock meeting prep for ${context.case.title}. Case status: ${context.case.status}. ${description} Evidence includes ${documentCount} document${documentCount === 1 ? "" : "s"}. Recent chat context includes ${messageCount} message${messageCount === 1 ? "" : "s"}.`;
}

function buildGoals(context: MeetingPrepContext) {
  return firstBySection(context.journalItems, "goals", "Confirm the desired outcome for this case.");
}

function buildRisks(context: MeetingPrepContext) {
  const riskItems = firstBySection(context.journalItems, "risks", "Identify deadlines, missing evidence, and unresolved contradictions.");
  const conflictItems = context.journalItems
    .filter((item) => item.evidence_state === "conflict")
    .map((item) => `Resolve conflict: ${formatJournalValue(item)}`);

  return uniqueNonEmpty([...riskItems, ...conflictItems]).slice(0, 6);
}

function buildDocumentsToBring(context: MeetingPrepContext) {
  const documents = context.documentSummaries.map((document) => document.filename);

  if (documents.length === 0) {
    return ["Bring any original documents, correspondence, notices, contracts, photos, or screenshots related to the case."];
  }

  return uniqueNonEmpty(documents).slice(0, 10);
}

function buildQuestions(context: MeetingPrepContext) {
  const openQuestions = firstBySection(
    context.journalItems,
    "open_questions",
    "What facts, deadlines, or documents are still missing?"
  );
  const recentUserMessages = context.lastMessages
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => `Clarify recent point: ${message.content.slice(0, 120)}`);

  return uniqueNonEmpty([...openQuestions, ...recentUserMessages]).slice(0, 6);
}

function buildStrategy(context: MeetingPrepContext) {
  const strategyItems = context.journalItems.filter((item) => item.section === "strategy");
  const documentSummaries = summarizeDocuments(context.documentSummaries).slice(0, 3);

  if (strategyItems.length > 0) {
    return uniqueNonEmpty(strategyItems.map(formatJournalValue)).slice(0, 3).join("; ");
  }

  if (documentSummaries.length > 0) {
    return `Use the Journal as the working model, verify it against available documents, and focus the meeting on unresolved questions. Key evidence to review: ${documentSummaries.join(" | ")}`;
  }

  return "Use the Journal as the working model, confirm the user's goal, identify missing evidence, and turn unresolved points into concrete next actions.";
}

function buildMockMeetingPrep(context: MeetingPrepContext): MeetingPrepResponse {
  const meetingPrep: MeetingPrep = {
    summary: buildSummary(context),
    goals: buildGoals(context),
    risks: buildRisks(context),
    documents_to_bring: buildDocumentsToBring(context),
    questions_to_ask: buildQuestions(context),
    strategy: buildStrategy(context)
  };

  return meetingPrepResponseSchema.parse({
    meetingPrep,
    suggestions: []
  });
}

export async function generateMeetingPrep(caseId: string): Promise<GenerateMeetingPrepResult> {
  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return { ok: false, error: "case_not_found" };
  }

  const [journalItems, documentSummaries, lastMessages] = await Promise.all([
    prisma.journalItem.findMany({
      where: { case_id: caseId },
      orderBy: [{ section: "asc" }, { display_order: "asc" }, { created_at: "asc" }],
      select: journalItemSelect
    }),
    prisma.document.findMany({
      where: { case_id: caseId },
      orderBy: { created_at: "desc" },
      select: documentSummarySelect
    }),
    prisma.chatMessage.findMany({
      where: { case_id: caseId },
      orderBy: { created_at: "desc" },
      take: 10,
      select: chatMessageSelect
    })
  ]);

  return {
    ok: true,
    data: buildMockMeetingPrep({
      case: foundCase,
      journalItems,
      documentSummaries,
      lastMessages: lastMessages.reverse()
    })
  };
}
