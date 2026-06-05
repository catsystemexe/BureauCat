import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  archiveSituation,
  LastActiveSituationError,
  updateSituation
} from "@/lib/services/situations";
import { updateSituationSchema } from "@/lib/validation/situations";

type SituationRouteContext = {
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

function lastActiveSituationResponse() {
  return NextResponse.json(
    { error: "A case must keep at least one active situation." },
    { status: 409 }
  );
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function PATCH(request: Request, context: SituationRouteContext) {
  const { situationId } = await context.params;
  const body = await readJson(request);
  const result = updateSituationSchema.safeParse(body);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  try {
    const situation = await updateSituation(situationId, result.data);

    if (!situation) {
      return notFoundResponse();
    }

    return NextResponse.json({ situation });
  } catch (error) {
    if (error instanceof LastActiveSituationError) {
      return lastActiveSituationResponse();
    }

    throw error;
  }
}

export async function DELETE(_request: Request, context: SituationRouteContext) {
  const { situationId } = await context.params;
  try {
    const situation = await archiveSituation(situationId);

    if (!situation) {
      return notFoundResponse();
    }

    return NextResponse.json({ situation });
  } catch (error) {
    if (error instanceof LastActiveSituationError) {
      return lastActiveSituationResponse();
    }

    throw error;
  }
}
