import { NextResponse } from "next/server";
import { SituationDocumentLinkError, unlinkDocumentFromSituation } from "@/lib/services/documents";

type SituationDocumentRouteContext = {
  params: Promise<{ situationId: string; documentId: string }>;
};

export async function DELETE(_request: Request, context: SituationDocumentRouteContext) {
  const { situationId, documentId } = await context.params;
  try {
    await unlinkDocumentFromSituation(situationId, documentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SituationDocumentLinkError) {
      return NextResponse.json({ error: error.code }, { status: error.code === "CASE_MISMATCH" ? 409 : 404 });
    }
    throw error;
  }
}
