import { NextResponse } from "next/server";
import {
  createMockAnalysisDocument,
  deleteAnalysisDocument
} from "@/lib/services/documents";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ documentId: string }>;
};

export async function POST(_request: Request, context: Context) {
  const { documentId } = await context.params;
  const document = await createMockAnalysisDocument(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ document }, { status: 201 });
}

export async function DELETE(_request: Request, context: Context) {
  const { documentId } = await context.params;
  const deleted = await deleteAnalysisDocument(documentId);

  if (!deleted) {
    return NextResponse.json({ error: "Analysis document not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
