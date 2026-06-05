import { prisma } from "@/lib/prisma";
import type {
  CreateSituationInput,
  UpdateSituationInput
} from "@/lib/validation/situations";

const situationSelect = {
  id: true,
  case_id: true,
  title: true,
  description: true,
  status: true,
  display_order: true,
  created_at: true,
  updated_at: true
};

export class LastActiveSituationError extends Error {
  constructor() {
    super("A case must keep at least one active situation.");
    this.name = "LastActiveSituationError";
  }
}

export function listSituationsForCase(caseId: string) {
  return prisma.situation.findMany({
    where: { case_id: caseId },
    orderBy: [{ display_order: "asc" }, { created_at: "asc" }],
    select: situationSelect
  });
}

export function getSituationById(id: string) {
  return prisma.situation.findUnique({
    where: { id },
    select: situationSelect
  });
}

export function createSituation(caseId: string, input: CreateSituationInput) {
  return prisma.$transaction(async (transaction) => {
    const lastSituation = await transaction.situation.findFirst({
      where: { case_id: caseId },
      orderBy: { display_order: "desc" },
      select: { display_order: true }
    });

    return transaction.situation.create({
      data: {
        case_id: caseId,
        title: input.title,
        description: input.description ?? null,
        status: "active",
        display_order: (lastSituation?.display_order ?? -1) + 1
      },
      select: situationSelect
    });
  });
}

export function updateSituation(id: string, input: UpdateSituationInput) {
  return prisma.$transaction(async (transaction) => {
    const situation = await transaction.situation.findUnique({
      where: { id },
      select: { case_id: true, status: true }
    });

    if (!situation) {
      return null;
    }

    if (situation.status === "active" && input.status === "archived") {
      const activeSituationCount = await transaction.situation.count({
        where: { case_id: situation.case_id, status: "active" }
      });

      if (activeSituationCount <= 1) {
        throw new LastActiveSituationError();
      }
    }

    return transaction.situation.update({
      where: { id },
      data: input,
      select: situationSelect
    });
  });
}

export function archiveSituation(id: string) {
  return updateSituation(id, { status: "archived" });
}
