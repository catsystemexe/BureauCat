import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCaseById, updateCase } from "@/lib/services/cases";
import { updateCaseSchema } from "@/lib/validation/cases";

type CaseRouteContext = {
  params: Promise<{ caseId: string }>;
};

function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    { error: "Invalid request body.", issues: error.issues },
    { status: 400 }
  );
}

function notFoundResponse() {
  return NextResponse.json({ error: "Case not found." }, { status: 404 });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function GET(_request: Request, context: CaseRouteContext) {
  const { caseId } = await context.params;
  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return notFoundResponse();
  }

  return NextResponse.json({ case: foundCase });
}

export async function PATCH(request: Request, context: CaseRouteContext) {
  const { caseId } = await context.params;
  const body = await readJson(request);
  const result = updateCaseSchema.safeParse(body);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const existingCase = await getCaseById(caseId);

  if (!existingCase) {
    return notFoundResponse();
  }

  const updatedCase = await updateCase(caseId, result.data);

  return NextResponse.json({ case: updatedCase });
}
