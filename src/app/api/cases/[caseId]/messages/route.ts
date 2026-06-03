import { NextResponse } from "next/server";
import { getCaseById } from "@/lib/services/cases";
import { listChatMessagesForCase } from "@/lib/services/chat";

type CaseMessagesRouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function GET(_request: Request, context: CaseMessagesRouteContext) {
  const { caseId } = await context.params;
  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  const messages = await listChatMessagesForCase(caseId);

  return NextResponse.json({ messages });
}
