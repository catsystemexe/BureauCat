import type { Prisma } from "@prisma/client";
import { WORKFLOW_STEP_DEFINITIONS } from "@/lib/workflow/constants";

// Initialize a newly created Situation using its caller's transaction.
export function initializeSituationWorkflow(
  transaction: Prisma.TransactionClient,
  situationId: string
) {
  return transaction.workflowStep.createMany({
    data: WORKFLOW_STEP_DEFINITIONS.map(({ key, order }) => ({
      situation_id: situationId,
      step_key: key,
      status: key === "ANALYSIS" ? "ACTIVE" : "INACTIVE",
      display_order: order
    }))
  });
}
