import { NextResponse } from "next/server";
import { getDocumentById } from "@/lib/services/documents";
import { readAnalysisReferences } from "@/lib/services/analysisReferences";

export async function GET(_request: Request, context: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await context.params;
  const document = await getDocumentById(documentId);
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return NextResponse.json(await readAnalysisReferences(document));
}
