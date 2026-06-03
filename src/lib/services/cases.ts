import { prisma } from "@/lib/prisma";
import type { CreateCaseInput, UpdateCaseInput } from "@/lib/validation/cases";

const caseSelect = {
  id: true,
  title: true,
  area: true,
  status: true,
  created_at: true,
  updated_at: true
};

export function listCases() {
  return prisma.case.findMany({
    orderBy: { created_at: "desc" },
    select: caseSelect
  });
}

export function createCase(input: CreateCaseInput) {
  return prisma.case.create({
    data: {
      title: input.title,
      area: input.area ?? null,
      status: "draft"
    },
    select: caseSelect
  });
}

export function getCaseById(id: string) {
  return prisma.case.findUnique({
    where: { id },
    select: caseSelect
  });
}

export function updateCase(id: string, input: UpdateCaseInput) {
  return prisma.case.update({
    where: { id },
    data: input,
    select: caseSelect
  });
}
