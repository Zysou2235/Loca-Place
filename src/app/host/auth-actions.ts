"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  setSession,
  clearSession,
} from "@/lib/auth";
import {
  sendVerificationEmail,
  sendExistingAccountEmail,
} from "@/lib/notify";
import { createVerifyToken } from "@/lib/verify-token";
import { getBaseUrl } from "@/lib/base-url";
import { clientIp, rateLimit, MINUTE, HOUR } from "@/lib/rate-limit";

export type AuthState = { error?: string; pending?: boolean };

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 120);
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  const password = String(formData.get("password") ?? "");
  const phone =
    String(formData.get("phone") ?? "")
      .trim()
      .slice(0, 30) || null;

  const ip = await clientIp();
  if (!rateLimit(`signup:${ip}`, 5, HOUR)) {
    return { error: "Trop de tentatives. Réessayez dans une heure." };
  }

  const acceptCgv = formData.get("acceptCgv") === "on";

  if (!name || !email || !password) {
    return { error: "Tous les champs sont requis." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Adresse email invalide." };
  }
  if (password.length < 8 || password.length > 200) {
    return { error: "Le mot de passe doit faire entre 8 et 200 caractères." };
  }
  if (!acceptCgv) {
    return { error: "Vous devez accepter les CGV pour créer un compte." };
  }

  const existing = await prisma.host.findUnique({
    where: { email },
    select: { id: true },
  });

  // Anti-énumération : la réponse est IDENTIQUE que l'email existe ou non.
  // Pas d'auto-connexion : l'utilisateur doit cliquer le lien reçu par email.
  if (existing) {
    await sendExistingAccountEmail(email); // best-effort
  } else {
    const host = await prisma.host.create({
      data: {
        name,
        email,
        phone,
        passwordHash: hashPassword(password),
        emailVerified: false,
        cgvAcceptedAt: new Date(),
      },
      select: { id: true },
    });
    const link = `${await getBaseUrl()}/host/verify?token=${encodeURIComponent(
      createVerifyToken(host.id)
    )}`;
    await sendVerificationEmail(email, link);
  }

  return { pending: true };
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  // Anti brute-force : par IP et par email ciblé.
  const ip = await clientIp();
  if (
    !rateLimit(`login-ip:${ip}`, 10, 15 * MINUTE) ||
    !rateLimit(`login-email:${email}`, 5, 15 * MINUTE)
  ) {
    return {
      error: "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
    };
  }

  const host = await prisma.host.findUnique({ where: { email } });
  if (!host?.passwordHash || !verifyPassword(password, host.passwordHash)) {
    return { error: "Identifiants incorrects." };
  }

  // Compte mot de passe non vérifié : on bloque (le lien a été envoyé à
  // l'inscription). Empêche aussi l'énumération via inscription + connexion.
  if (!host.emailVerified) {
    return {
      error:
        "Votre compte n'est pas encore activé. Cliquez sur le lien reçu par email (ou utilisez « Mot de passe oublié » pour en recevoir un nouveau).",
    };
  }

  await setSession(host.id, host.tokenVersion);
  redirect("/host");
}

export type ResendState = { error?: string; sent?: boolean };

/** Renvoie l'email d'activation (compte mot de passe non vérifié). Générique. */
export async function resendActivation(
  _prev: ResendState,
  formData: FormData
): Promise<ResendState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const ip = await clientIp();
  if (!rateLimit(`resend-activation:${ip}`, 5, HOUR)) {
    return { error: "Trop de demandes. Réessayez dans une heure." };
  }

  if (email) {
    const host = await prisma.host.findUnique({
      where: { email },
      select: { id: true, emailVerified: true, passwordHash: true },
    });
    // On n'envoie un lien que si le compte existe, a un mot de passe et n'est
    // pas encore vérifié — sans jamais le révéler dans la réponse.
    if (host?.passwordHash && !host.emailVerified) {
      const link = `${await getBaseUrl()}/host/verify?token=${encodeURIComponent(
        createVerifyToken(host.id)
      )}`;
      await sendVerificationEmail(email, link);
    }
  }

  return { sent: true };
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}
