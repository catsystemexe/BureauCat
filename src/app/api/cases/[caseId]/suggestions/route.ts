import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCaseById } from "@/lib/services/cases";
import { listAISuggestionsForCase } from "@/lib/services/suggestions";
import { listAISuggestionsQuerySchema } from "@/lib/validation/suggestions";

type CaseSuggestionsRouteContext = {
  params: Promise<{ caseId: string }>;
};

function notFoundResponse() {
  return NextResponse.json({ error: "Case not found." }, { status: 404 });
}

function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    { error: "Invalid query parameters.", issues: error.issues },
    { status: 400 }
  );
}

export async function GET(request: Request, context: CaseSuggestionsRouteContext) {
  const { caseId } = await context.params;
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const result = listAISuggestionsQuerySchema.safeParse(query);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return notFoundResponse();
  }

  const suggestions = await listAISuggestionsForCase(caseId, result.data.status);

  return NextResponse.json({ suggestions });
}
