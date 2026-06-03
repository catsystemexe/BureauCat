import { NextResponse } from "next/server";
import { getDocumentById } from "@/lib/services/documents";

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
