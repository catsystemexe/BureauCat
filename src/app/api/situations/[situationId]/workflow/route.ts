import { NextResponse } from "next/server";
import { getSituationWorkflow } from "@/lib/services/workflow";

type SituationWorkflowRouteContext = {
  params: Promise<{ situationId: string }>;
};

export async function GET(_request: Request, context: SituationWorkflowRouteContext) {
  const { situationId } = await context.params;
  const workflow = await getSituationWorkflow(situationId);

  if (!workflow) {
    return NextResponse.json({ error: "Situation not found." }, { status: 404 });
  }

  return NextResponse.json({ workflow });
}
