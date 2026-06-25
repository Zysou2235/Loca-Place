"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSession } from "@/lib/auth";
import { createResetToken, verifyResetToken } from "@/lib/reset-token";
import { sendPasswordResetEmail } from "@/lib/notify";
import { getBaseUrl } from "@/lib/base-url";
import { clientIp, rateLimit, HOUR } from "@/lib/rate-limit";

export type RequestState = { error?: string; sent?: boolean };

/** Demande un lien de réinitialisation. Réponse générique (anti-énumération). */
export async function requestPasswordReset(
  _prev: RequestState,
  formData: FormData
): Promise<RequestState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const ip = await clientIp();
  if (!rateLimit(`pwreset-ip:${ip}`, 5, HOUR)) {
    return { error: "Trop de demandes. Réessayez dans une heure." };
  }

  if (email) {
    const host = await prisma.host.findUnique({
      where: { email },
      select: { id: true, tokenVersion: true, passwordHash: true },
    });
    // On n'envoie un lien que si un compte avec mot de passe existe, mais on ne
    // le révèle jamais dans la réponse.
    if (host?.passwordHash) {
      const token = createResetToken(host.id, host.tokenVersion);
      const link = `${await getBaseUrl()}/host/reset/confirm?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail(email, link);
    }
  }

  return { sent: true };
}

export type ConfirmState = { error?: string };

/** Applique le nouveau mot de passe et révoque les anciennes sessions. */
export async function confirmPasswordReset(
  _prev: ConfirmState,
  formData: FormData
): Promise<ConfirmState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8 || password.length > 200) {
    return { error: "Le mot de passe doit faire entre 8 et 200 caractères." };
  }

  const data = verifyResetToken(token);
  if (!data) {
    return { error: "Lien invalide ou expiré. Refaites une demande." };
  }

  const host = await prisma.host.findUnique({
    where: { id: data.hostId },
    select: { id: true, tokenVersion: true },
  });
  if (!host || host.tokenVersion !== data.v) {
    return { error: "Lien déjà utilisé ou expiré. Refaites une demande." };
  }

  // Incrémente tokenVersion → invalide toutes les sessions existantes ; marque
  // l'email comme vérifié (le lien prouve la possession de la boîte mail).
  const updated = await prisma.host.update({
    where: { id: host.id },
    data: {
      passwordHash: hashPassword(password),
      emailVerified: true,
      tokenVersion: { increment: 1 },
    },
    select: { id: true, tokenVersion: true },
  });

  await setSession(updated.id, updated.tokenVersion);
  redirect("/host");
}
