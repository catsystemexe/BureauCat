import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createGoal, listGoalsForSituation } from "@/lib/services/goals";
import { getSituationById } from "@/lib/services/situations";
import { createGoalSchema } from "@/lib/validation/goals";

type SituationGoalsRouteContext = {
  params: Promise<{ situationId: string }>;
};

function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    { error: "Invalid request body.", issues: error.issues },
    { status: 400 }
  );
}

function notFoundResponse() {
  return NextResponse.json({ error: "Situation not found." }, { status: 404 });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function GET(_request: Request, context: SituationGoalsRouteContext) {
  const { situationId } = await context.params;
  const situation = await getSituationById(situationId);

  if (!situation) {
    return notFoundResponse();
  }

  const goals = await listGoalsForSituation(situationId);

  return NextResponse.json({ goals });
}

export async function POST(request: Request, context: SituationGoalsRouteContext) {
  const { situationId } = await context.params;
  const body = await readJson(request);
  const result = createGoalSchema.safeParse(body);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const situation = await getSituationById(situationId);

  if (!situation) {
    return notFoundResponse();
  }

  const goal = await createGoal(situationId, result.data);

  return NextResponse.json({ goal }, { status: 201 });
}
