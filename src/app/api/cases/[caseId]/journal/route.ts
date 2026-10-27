import { NextResponse } from "next/server";
import { getCaseById } from "@/lib/services/cases";
import { getSituationById } from "@/lib/services/situations";
import { createJournalItemForCase, listJournalItemsForCase, readJournalEvidence } from "@/lib/services/journal";
import { createJournalItemSchema } from "@/lib/validation/journal";

type CaseJournalRouteContext = {
  params: Promise<{ caseId: string }>;
};

function notFoundResponse() {
  return NextResponse.json({ error: "Case not found." }, { status: 404 });
}

export async function GET(request: Request, context: CaseJournalRouteContext) {
  const { caseId } = await context.params;
  const situationId = new URL(request.url).searchParams.get("situationId");
  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return notFoundResponse();
  }

  if (!situationId) {
    return NextResponse.json({ journal: [] });
  }

  const situation = await getSituationById(situationId);

  if (!situation || situation.case_id !== caseId) {
    return NextResponse.json({ error: "Situation not found." }, { status: 404 });
  }

  const journal = await listJournalItemsForCase(caseId, situationId);

  const evidence = await readJournalEvidence(caseId, situationId, journal.filter((item) => item.status !== "obsolete"));
  return NextResponse.json({ journal, evidence });
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

  const situationId = parsed.data.situation_id;

  if (!situationId) {
    return NextResponse.json({ error: "Situation id is required." }, { status: 400 });
  }

  const situation = await getSituationById(situationId);

  if (!situation || situation.case_id !== caseId) {
    return NextResponse.json({ error: "Situation not found." }, { status: 404 });
  }

  const journalItem = await createJournalItemForCase(caseId, situationId, parsed.data);

  return NextResponse.json({ journalItem }, { status: 201 });
}
