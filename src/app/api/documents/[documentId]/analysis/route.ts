import { NextResponse } from "next/server";
import {
  createAIAnalysisDocument,
  deleteAnalysisDocument
} from "@/lib/services/documents";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ documentId: string }>;
};

export async function POST(_request: Request, context: Context) {
  console.log("[analysis route env]", {
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    openAIModel: process.env.OPENAI_MODEL ?? null
  });

  const { documentId } = await context.params;

  try {
    const document = await createAIAnalysisDocument(documentId);

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
