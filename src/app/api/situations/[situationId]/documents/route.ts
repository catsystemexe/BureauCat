import { NextResponse } from "next/server";
import {
  linkDocumentToSituation,
  listDocumentsForSituation,
  SituationDocumentLinkError
} from "@/lib/services/documents";
import { getSituationById } from "@/lib/services/situations";
import { linkDocumentToSituationSchema } from "@/lib/validation/documents";

type SituationDocumentsRouteContext = {
  params: Promise<{ situationId: string }>;
};

function situationNotFoundResponse() {
  return NextResponse.json({ error: "Situation not found." }, { status: 404 });
}

export async function GET(_request: Request, context: SituationDocumentsRouteContext) {
  const { situationId } = await context.params;
  const situation = await getSituationById(situationId);

  if (!situation) {
    return situationNotFoundResponse();
  }

  const documents = await listDocumentsForSituation(situationId);
  return NextResponse.json({ documents });
}

export async function POST(request: Request, context: SituationDocumentsRouteContext) {
  const { situationId } = await context.params;
  const situation = await getSituationById(situationId);

  if (!situation) {
    return situationNotFoundResponse();
  }

  const body = await request.json().catch(() => null);
  const result = linkDocumentToSituationSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: result.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const linkedDocument = await linkDocumentToSituation(situationId, result.data.document_id);
    return NextResponse.json(linkedDocument);
  } catch (error) {
    if (error instanceof SituationDocumentLinkError) {
      if (error.code === "SITUATION_NOT_FOUND") {
        return situationNotFoundResponse();
      }

      if (error.code === "DOCUMENT_NOT_FOUND") {
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
      }

      return NextResponse.json(
        { error: "Document and Situation must belong to the same Case." },
        { status: 409 }
      );
    }

    throw error;
  }
}
