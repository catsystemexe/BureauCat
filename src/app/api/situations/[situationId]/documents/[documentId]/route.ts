import { NextResponse } from "next/server";
import { unlinkDocumentFromSituation } from "@/lib/services/documents";
import { getSituationById } from "@/lib/services/situations";

type SituationDocumentRouteContext = {
  params: Promise<{ situationId: string; documentId: string }>;
};

export async function DELETE(_request: Request, context: SituationDocumentRouteContext) {
  const { situationId, documentId } = await context.params;
  const situation = await getSituationById(situationId);

  if (!situation) {
    return NextResponse.json({ error: "Situation not found." }, { status: 404 });
  }

  await unlinkDocumentFromSituation(situationId, documentId);
  return NextResponse.json({ ok: true });
}
