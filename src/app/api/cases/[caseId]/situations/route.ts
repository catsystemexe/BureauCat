import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCaseById } from "@/lib/services/cases";
import { createSituation, listSituationsForCase } from "@/lib/services/situations";
import { createSituationSchema } from "@/lib/validation/situations";

type CaseSituationsRouteContext = {
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

export async function GET(_request: Request, context: CaseSituationsRouteContext) {
  const { caseId } = await context.params;
  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return notFoundResponse();
  }

  const situations = await listSituationsForCase(caseId);

  return NextResponse.json({ situations });
}

export async function POST(request: Request, context: CaseSituationsRouteContext) {
  const { caseId } = await context.params;
  const body = await readJson(request);
  const result = createSituationSchema.safeParse(body);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return notFoundResponse();
  }

  const situation = await createSituation(caseId, result.data);

  return NextResponse.json({ situation }, { status: 201 });
}
