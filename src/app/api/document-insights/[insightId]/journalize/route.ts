import { NextResponse } from "next/server";
import { journalizeDocumentInsight } from "@/lib/services/documentInsights";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ insightId: string }>;
};

export async function POST(request: Request, context: Context) {
  const { insightId } = await context.params;
  const body = (await request.json().catch(() => null)) as { situation_id?: unknown } | null;

  if (!body || typeof body.situation_id !== "string" || body.situation_id.trim().length === 0) {
    return NextResponse.json({ error: "Situation id is required." }, { status: 400 });
  }

  try {
    const result = await journalizeDocumentInsight(insightId, body.situation_id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Insight se nepodařilo zapsat." },
      { status: 400 }
    );
  }
}
