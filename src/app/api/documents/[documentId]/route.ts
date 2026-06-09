import { NextResponse } from "next/server";
import {
  deleteDocumentById,
  getDocumentById,
  updateDocumentProcessedText,
  updateDocumentValidationStatus
} from "@/lib/services/documents";

export const runtime = "nodejs";

type DocumentRouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function GET(_request: Request, context: DocumentRouteContext) {
  const { documentId } = await context.params;
  const document = await getDocumentById(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ document });
}

export async function PATCH(request: Request, context: DocumentRouteContext) {
  const { documentId } = await context.params;
  const body = (await request.json()) as {
    processed_text?: unknown;
    validation_status?: unknown;
  };

  const existingDocument = await getDocumentById(documentId);

  if (!existingDocument) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (typeof body.validation_status === "string") {
    if (!["pending_validation", "validated"].includes(body.validation_status)) {
      return NextResponse.json({ error: "Invalid validation status." }, { status: 400 });
    }

    const document = await updateDocumentValidationStatus(
      documentId,
      body.validation_status as "pending_validation" | "validated"
    );

    return NextResponse.json({ document });
  }

  if (typeof body.processed_text === "string") {
    if (existingDocument.validation_status === "validated") {
      return NextResponse.json({ error: "Validated document text cannot be edited." }, { status: 409 });
    }

    const document = await updateDocumentProcessedText(documentId, body.processed_text);

    return NextResponse.json({ document });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}

export async function DELETE(_request: Request, context: DocumentRouteContext) {
  const { documentId } = await context.params;
  const document = await deleteDocumentById(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
