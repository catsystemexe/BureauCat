import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { archiveGoal, updateGoal } from "@/lib/services/goals";
import { updateGoalSchema } from "@/lib/validation/goals";

type GoalRouteContext = {
  params: Promise<{ goalId: string }>;
};

function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    { error: "Invalid request body.", issues: error.issues },
    { status: 400 }
  );
}

function notFoundResponse() {
  return NextResponse.json({ error: "Goal not found." }, { status: 404 });
}

function isNotFoundError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function PATCH(request: Request, context: GoalRouteContext) {
  const { goalId } = await context.params;
  const body = await readJson(request);
  const result = updateGoalSchema.safeParse(body);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  try {
    const goal = await updateGoal(goalId, result.data);
    return NextResponse.json({ goal });
  } catch (error) {
    if (isNotFoundError(error)) {
      return notFoundResponse();
    }

    throw error;
  }
}

export async function DELETE(_request: Request, context: GoalRouteContext) {
  const { goalId } = await context.params;

  try {
    const goal = await archiveGoal(goalId);
    return NextResponse.json({ goal });
  } catch (error) {
    if (isNotFoundError(error)) {
      return notFoundResponse();
    }

    throw error;
  }
}
