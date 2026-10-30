import { getSituationPlanning } from "@/lib/services/situationPlanning";
import { effectiveRequiredInputs } from "@/lib/workflow/planning";
import { prisma } from "@/lib/prisma";
import { WORKFLOW_STEP_DEFINITIONS } from "@/lib/workflow/constants";

export async function ensureSituationWorkflow(situationId: string) {
  const situation = await prisma.situation.findUnique({
    where: { id: situationId },
    select: { id: true }
  });

  if (!situation) {
    return null;
  }

  await prisma.$transaction(
    WORKFLOW_STEP_DEFINITIONS.map(({ key, order }) =>
      prisma.workflowStep.upsert({
        where: {
          situation_id_step_key: {
            situation_id: situationId,
            step_key: key
          }
        },
        create: {
          situation_id: situationId,
          step_key: key,
          status: key === "ANALYSIS" ? "ACTIVE" : "INACTIVE",
          display_order: order
        },
        update: {}
      })
    )
  );

  return getSituationWorkflow(situationId);
}

export async function getSituationWorkflow(situationId: string) {
  const workflow = await prisma.situation.findUnique({
    where: { id: situationId },
    select: {
      id: true,
      case_id: true,
      goals: {
        where: { status: { not: "archived" } },
        orderBy: [{ display_order: "asc" }, { created_at: "asc" }]
      },
      workflow_steps: {
        orderBy: [{ display_order: "asc" }, { created_at: "asc" }]
      },
      required_inputs: {
        orderBy: [{ display_order: "asc" }, { created_at: "asc" }],
        include: {
          criteria: {
            orderBy: [{ display_order: "asc" }, { created_at: "asc" }]
          }
        }
      },
      workflow_tasks: {
        orderBy: [{ display_order: "asc" }, { created_at: "asc" }]
      },
      workflow_overrides: {
        where: { revoked_at: null },
        orderBy: { created_at: "asc" }
      }
    }
  });
  if (!workflow) return null;
  const planning = await getSituationPlanning(situationId, workflow.case_id);
  return { ...workflow, required_inputs: effectiveRequiredInputs(workflow.required_inputs, planning), planning };
}
