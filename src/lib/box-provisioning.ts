import { prisma } from "@/lib/prisma";
import { makeSlug } from "@/lib/slug";
import { generateLockCode } from "@/lib/lock-code";

/**
 * Amène l'hôte à `targetCount` box actives. Idempotent : si l'hôte a déjà
 * assez de box actives, on ne fait rien. Appelée à l'activation/mise à jour
 * d'un abonnement (via Checkout ou webhook), et à l'octroi d'un accès test.
 *
 * Réactive d'abord d'éventuelles box désactivées (ex. reprise d'abonnement
 * après résiliation) avant d'en créer de nouvelles — sinon un hôte qui se
 * réabonne se retrouve avec un quota "satisfait" en compte mais des box
 * restées désactivées pour toujours (le compte tourne, mais rien ne vend).
 */
export async function provisionBoxesForHost(
  hostId: string,
  targetCount: number
): Promise<number> {
  if (targetCount <= 0) return 0;

  const activeCount = await prisma.box.count({ where: { hostId, active: true } });
  let stillNeeded = targetCount - activeCount;
  if (stillNeeded <= 0) return 0;

  const reactivatable = await prisma.box.findMany({
    where: { hostId, active: false },
    orderBy: { createdAt: "asc" },
    take: stillNeeded,
    select: { id: true },
  });
  if (reactivatable.length > 0) {
    await prisma.box.updateMany({
      where: { id: { in: reactivatable.map((b) => b.id) } },
      data: { active: true },
    });
    stillNeeded -= reactivatable.length;
  }
  if (stillNeeded <= 0) return reactivatable.length;

  const existingTotal = await prisma.box.count({ where: { hostId } });
  for (let i = 0; i < stillNeeded; i++) {
    const index = existingTotal + i + 1;
    // Nom neutre : la box n'est pas encore attribuée à une adresse.
    // L'hôte la renommera quand il l'installera.
    const name = `Box #${index}`;
    await prisma.box.create({
      data: {
        name,
        qrSlug: makeSlug(name),
        accessCode: generateLockCode(),
        hostId,
      },
    });
  }
  return reactivatable.length + stillNeeded;
}

/**
 * Désactive toutes les box d'un hôte (à la résiliation de l'abonnement).
 * On ne supprime pas la ligne : la box physique peut encore exister chez
 * l'hôte et l'historique des ventes doit rester traçable. Une box inactive
 * ne génère plus de scan/vente côté voyageur.
 */
export async function deactivateBoxesForHost(hostId: string): Promise<void> {
  await prisma.box.updateMany({
    where: { hostId },
    data: { active: false },
  });
}
