import { NextResponse } from "next/server";
import { createMockAnalysisDocument } from "@/lib/services/documents";

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
