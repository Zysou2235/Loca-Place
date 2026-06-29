import { prisma } from "@/lib/prisma";
import { makeSlug } from "@/lib/slug";
import { generateLockCode } from "@/lib/lock-code";

/**
 * Crée les box manquantes pour atteindre `targetCount`. Idempotent : si l'hôte
 * a déjà N box (≥ target), on ne fait rien. Appelée à l'activation/mise à jour
 * d'un abonnement (via Checkout ou webhook).
 */
export async function provisionBoxesForHost(
  hostId: string,
  targetCount: number
): Promise<number> {
  if (targetCount <= 0) return 0;
  const existing = await prisma.box.count({ where: { hostId } });
  const toCreate = targetCount - existing;
  if (toCreate <= 0) return 0;

  for (let i = 0; i < toCreate; i++) {
    const index = existing + i + 1;
    const name = `Logement ${index}`;
    await prisma.box.create({
      data: {
        name,
        qrSlug: makeSlug(name),
        accessCode: generateLockCode(),
        hostId,
      },
    });
  }
  return toCreate;
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
