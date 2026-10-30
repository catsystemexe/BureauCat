import { PlanningError } from "@/lib/services/situationPlanning";
import { prisma } from "@/lib/prisma";
import type { CreateGoalInput, UpdateGoalInput } from "@/lib/validation/goals";

const goalSelect = {
  id: true,
  situation_id: true,
  title: true,
  status: true,
  display_order: true,
  created_at: true,
  updated_at: true
};

export function listGoalsForSituation(situationId: string) {
  return prisma.goal.findMany({
    where: { situation_id: situationId },
    orderBy: [{ display_order: "asc" }, { created_at: "asc" }],
    select: goalSelect
  });
}

export function createGoal(situationId: string, input: CreateGoalInput) {
  return prisma.$transaction(async (transaction) => {
    await transaction.situation.update({ where: { id: situationId }, data: { workflow_revision: { increment: 1 } } });
    const lastGoal = await transaction.goal.findFirst({
      where: { situation_id: situationId },
      orderBy: { display_order: "desc" },
      select: { display_order: true }
    });

    return transaction.goal.create({
      data: {
        situation_id: situationId,
        title: input.title,
        status: "draft",
        display_order: (lastGoal?.display_order ?? -1) + 1
      },
      select: goalSelect
    });
  });
}

export function updateGoal(id: string, input: UpdateGoalInput) {
  return prisma.$transaction(async (transaction) => {
    const goal = await transaction.goal.findUniqueOrThrow({ where: { id } });
    if (goal.confirmed_at || input.status === "active") {
      throw new PlanningError("Potvrzený cíl měňte výslovným potvrzením v Analýze situace; původní plán musí být znovu přijat.");
    }
    await transaction.situation.update({ where: { id: goal.situation_id }, data: { workflow_revision: { increment: 1 } } });
    return transaction.goal.update({ where: { id }, data: input, select: goalSelect });
  });
}

export function archiveGoal(id: string) {
  return updateGoal(id, { status: "archived" });
}
