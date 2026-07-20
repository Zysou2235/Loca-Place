"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { provisionBoxesForHost } from "@/lib/box-provisioning";
import { MAX_BOXES } from "@/lib/plans";

/**
 * Offre un accès test à un hôte : compte activé gratuitement (plan "test",
 * exclu du MRR) avec N box provisionnées immédiatement.
 *
 * - Si le compte existe déjà : on ajoute l'accès test par-dessus (sans toucher
 *   à un vrai abonnement Stripe actif — dans ce cas on refuse).
 * - Si le compte n'existe pas : on le crée. La personne le récupère via
 *   « Mot de passe oublié » (le reset vérifie l'email) ou connexion Google.
 */
export async function grantTestAccess(formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  const name = String(formData.get("name") ?? "").trim().slice(0, 120) || null;
  const boxes = Math.min(
    MAX_BOXES,
    Math.max(1, Number(formData.get("boxes") ?? 4) || 4)
  );
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/admin/test?error=email");
  }

  const existing = await prisma.host.findUnique({
    where: { email },
    select: { id: true, subscriptionStatus: true, stripeCustomerId: true, adminNotes: true },
  });

  // Garde-fou : ne jamais écraser un vrai abonnement payant.
  if (
    existing &&
    existing.stripeCustomerId &&
    (existing.subscriptionStatus === "active" ||
      existing.subscriptionStatus === "trialing")
  ) {
    redirect("/admin/test?error=paying");
  }

  const stamp = `[TEST MVP ${new Date().toLocaleDateString("fr-FR")}] ${boxes} box offertes${notes ? ` — ${notes}` : ""}`;

  const host = existing
    ? await prisma.host.update({
        where: { id: existing.id },
        data: {
          subscriptionStatus: "active",
          subscriptionPlan: "test",
          boxQuota: boxes,
          isTestAccount: true,
          adminNotes: existing.adminNotes
            ? `${existing.adminNotes}\n${stamp}`
            : stamp,
        },
        select: { id: true },
      })
    : await prisma.host.create({
        data: {
          email,
          name: name ?? email.split("@")[0],
          subscriptionStatus: "active",
          subscriptionPlan: "test",
          boxQuota: boxes,
          isTestAccount: true,
          adminNotes: stamp,
          // Pas de mot de passe : la personne passe par « Mot de passe
          // oublié » (vérifie l'email) ou par Google OAuth.
        },
        select: { id: true },
      });

  // Provisionne immédiatement : l'admin voit les box + codes pour préparer
  // l'expédition sans attendre que le testeur se connecte.
  await provisionBoxesForHost(host.id, boxes);

  revalidatePath("/admin/test");
  redirect("/admin/test?ok=1");
}

/**
 * Retire l'accès test : abonnement coupé, box supprimées. Contrairement à un
 * vrai client qui résilie (box désactivées mais conservées pour la traçabilité
 * commerciale — voir deactivateBoxesForHost), un compte test n'a pas
 * d'historique réel à garder : on supprime pour de bon (scans/leads/commandes
 * liés suivent en cascade) afin qu'un octroi ultérieur reparte sur des box
 * neuves et fonctionnelles plutôt que de rester bloqué sur d'anciennes box
 * désactivées.
 */
export async function revokeTestAccess(formData: FormData) {
  await requireAdmin();

  const hostId = String(formData.get("hostId") ?? "");
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { id: true, isTestAccount: true },
  });
  // Uniquement les comptes test — jamais un vrai client.
  if (!host?.isTestAccount) redirect("/admin/test?error=notatest");

  await prisma.host.update({
    where: { id: hostId },
    data: {
      subscriptionStatus: "none",
      subscriptionPlan: null,
      boxQuota: 0,
      isTestAccount: false,
    },
  });
  await prisma.box.deleteMany({ where: { hostId } });

  revalidatePath("/admin/test");
  redirect("/admin/test?revoked=1");
}
