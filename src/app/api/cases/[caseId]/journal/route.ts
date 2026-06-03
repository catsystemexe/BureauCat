import { NextResponse } from "next/server";
import { getCaseById } from "@/lib/services/cases";
import { listJournalItemsForCase } from "@/lib/services/journal";

type CaseJournalRouteContext = {
  params: Promise<{ caseId: string }>;
};

function notFoundResponse() {
  return NextResponse.json({ error: "Case not found." }, { status: 404 });
}

export async function GET(_request: Request, context: CaseJournalRouteContext) {
  const { caseId } = await context.params;
  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return notFoundResponse();
  }

  const journal = await listJournalItemsForCase(caseId);

  return NextResponse.json({ journal });
}
