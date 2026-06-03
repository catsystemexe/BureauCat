import { NextResponse } from "next/server";
import { rejectAISuggestion } from "@/lib/services/suggestions";

type SuggestionRejectRouteContext = {
  params: Promise<{ suggestionId: string }>;
};

export async function POST(_request: Request, context: SuggestionRejectRouteContext) {
  const { suggestionId } = await context.params;
  const serviceResult = await rejectAISuggestion(suggestionId);

  if (!serviceResult.ok) {
    switch (serviceResult.error) {
      case "not_found":
        return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
      case "not_pending":
        return NextResponse.json({ error: "Suggestion is not pending." }, { status: 409 });
      case "invalid_json":
      case "invalid_item":
        return NextResponse.json({ error: "Invalid suggestion." }, { status: 400 });
    }
  }

  return NextResponse.json(serviceResult.data);
}
