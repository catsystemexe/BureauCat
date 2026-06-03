import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { approveAISuggestion } from "@/lib/services/suggestions";
import { approveSuggestionSchema } from "@/lib/validation/suggestions";

type SuggestionApproveRouteContext = {
  params: Promise<{ suggestionId: string }>;
};

function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    { error: "Invalid request body.", issues: error.issues },
    { status: 400 }
  );
}

function invalidSuggestedItemResponse(error?: ZodError) {
  return NextResponse.json(
    {
      error: "Invalid suggested journal item.",
      issues: error?.issues ?? []
    },
    { status: 400 }
  );
}

async function readJson(request: Request) {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request, context: SuggestionApproveRouteContext) {
  const { suggestionId } = await context.params;
  const body = await readJson(request);
  const result = approveSuggestionSchema.safeParse(body);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const serviceResult = await approveAISuggestion(suggestionId, result.data);

  if (!serviceResult.ok) {
    switch (serviceResult.error) {
      case "not_found":
        return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
      case "not_pending":
        return NextResponse.json({ error: "Suggestion is not pending." }, { status: 409 });
      case "invalid_json":
        return NextResponse.json(
          { error: "Suggested item JSON is invalid." },
          { status: 400 }
        );
      case "invalid_item":
        return invalidSuggestedItemResponse(serviceResult.validationError);
    }
  }

  return NextResponse.json(serviceResult.data);
}
