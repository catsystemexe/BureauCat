import { prisma } from "@/lib/prisma";

/**
 * Placeholder for MVP evidence-state recalculation.
 *
 * The product specification requires evidence_state to be rechecked after a
 * Journal Item edit. The real implementation will compare the item against its
 * source links and documents. For now, this service exists as the integration
 * point and deliberately leaves the user-edited item unchanged.
 */
export async function evidenceStateRecheck(journalItemId: string) {
  return prisma.journalItem.findUnique({
    where: { id: journalItemId }
  });
}

/**
 * Placeholder for MVP case-wide evidence-state recalculation.
 *
 * The product specification requires evidence_state to be rechecked after a
 * document upload. Real matching against documents will be added in a later
 * slice; this integration point deliberately leaves existing Journal Items
 * unchanged for now.
 */
export async function evidenceStateRecheckForCase(caseId: string) {
  return prisma.case.findUnique({
    where: { id: caseId }
  });
}
