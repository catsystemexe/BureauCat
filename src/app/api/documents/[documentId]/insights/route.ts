import { NextResponse } from "next/server";
import { getDocumentById } from "@/lib/services/documents";
import {
  createDocumentInsight,
  listDocumentInsights
} from "@/lib/services/documentInsights";
import { createDocumentInsightSchema } from "@/lib/validation/documentInsights";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ documentId: string }>;
};

export async function GET(_request: Request, context: Context) {
  const { documentId } = await context.params;
  const document = await getDocumentById(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const insights = await listDocumentInsights(documentId);
  return NextResponse.json({ insights });
}

export async function POST(request: Request, context: Context) {
  const { documentId } = await context.params;
  const document = await getDocumentById(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createDocumentInsightSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid document insight payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const insight = await createDocumentInsight({
    document_id: documentId,
    ...parsed.data
  });

  return NextResponse.json({ insight }, { status: 201 });
}
