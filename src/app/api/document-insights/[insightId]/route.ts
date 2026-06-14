import { NextResponse } from "next/server";
import {
  deleteDocumentInsight,
  getDocumentInsightById,
  updateDocumentInsight
} from "@/lib/services/documentInsights";
import { updateDocumentInsightSchema } from "@/lib/validation/documentInsights";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ insightId: string }>;
};

export async function GET(_request: Request, context: Context) {
  const { insightId } = await context.params;
  const insight = await getDocumentInsightById(insightId);

  if (!insight) {
    return NextResponse.json({ error: "Document insight not found." }, { status: 404 });
  }

  return NextResponse.json({ insight });
}

export async function PATCH(request: Request, context: Context) {
  const { insightId } = await context.params;
  const existingInsight = await getDocumentInsightById(insightId);

  if (!existingInsight) {
    return NextResponse.json({ error: "Document insight not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateDocumentInsightSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid document insight payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const insight = await updateDocumentInsight(insightId, parsed.data);
  return NextResponse.json({ insight });
}

export async function DELETE(_request: Request, context: Context) {
  const { insightId } = await context.params;

  try {
    const insight = await deleteDocumentInsight(insightId);
    return NextResponse.json({ deleted: true, insight });
  } catch {
    return NextResponse.json({ error: "Document insight not found." }, { status: 404 });
  }
}
