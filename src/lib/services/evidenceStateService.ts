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
