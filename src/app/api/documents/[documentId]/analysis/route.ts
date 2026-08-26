import { NextResponse } from "next/server";
import {
  createAIAnalysisDocument,
  deleteAnalysisDocument
} from "@/lib/services/documents";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ documentId: string }>;
};

export async function POST(request: Request, context: Context) {
  console.log("[analysis route env]", {
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    openAIModel: process.env.OPENAI_MODEL ?? null
  });

  const { documentId } = await context.params;
  const body = (await request.json().catch(() => null)) as { situation_id?: unknown } | null;

  if (!body || typeof body.situation_id !== "string" || body.situation_id.trim().length === 0) {
    return NextResponse.json({ error: "Situation id is required." }, { status: 400 });
  }

  try {
    const document = await createAIAnalysisDocument(documentId, body.situation_id.trim());

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI analysis failed." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { documentId } = await context.params;
  const deleted = await deleteAnalysisDocument(documentId);

  if (!deleted) {
    return NextResponse.json({ error: "Analysis document not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
