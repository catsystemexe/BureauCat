import { NextResponse } from "next/server";
import { getCaseById } from "@/lib/services/cases";
import { createJournalItemForCase, listJournalItemsForCase } from "@/lib/services/journal";
import { createJournalItemSchema } from "@/lib/validation/journal";

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


export async function POST(request: Request, context: CaseJournalRouteContext) {
  const { caseId } = await context.params;
  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return notFoundResponse();
  }

  const body = await request.json().catch(() => null);
  const parsed = createJournalItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid journal item payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const journalItem = await createJournalItemForCase(caseId, parsed.data);

  return NextResponse.json({ journalItem }, { status: 201 });
}
