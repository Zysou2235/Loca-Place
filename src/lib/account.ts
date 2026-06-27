import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * Supprime définitivement un compte hôte et toutes ses données liées
 * (box, produits, commandes, scans — via les cascades Prisma). Annule au
 * préalable les abonnements Stripe pour stopper toute facturation.
 * Utilisé pour le droit à l'effacement (RGPD), côté hôte et admin.
 */
export async function deleteHostAccount(hostId: string): Promise<void> {
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { stripeCustomerId: true },
  });

  // Best-effort : couper la facturation côté Stripe.
  if (host?.stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: host.stripeCustomerId,
        status: "all",
        limit: 20,
      });
      for (const s of subs.data) {
        if (s.status !== "canceled" && s.status !== "incomplete_expired") {
          try {
            await stripe.subscriptions.cancel(s.id);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore — la suppression locale prime */
    }
  }

  await prisma.host.delete({ where: { id: hostId } });
}
