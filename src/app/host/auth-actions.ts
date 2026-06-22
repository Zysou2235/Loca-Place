"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  setSession,
  clearSession,
} from "@/lib/auth";

export type AuthState = { error?: string };

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

  if (!name || !email || !password) {
    return { error: "Tous les champs sont requis." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Adresse email invalide." };
  }
  if (password.length < 8 || password.length > 200) {
    return { error: "Le mot de passe doit faire entre 8 et 200 caractères." };
  }

  const existing = await prisma.host.findUnique({ where: { email } });
  if (existing) {
    return { error: "Un compte existe déjà avec cet email." };
  }

  const host = await prisma.host.create({
    data: { name, email, passwordHash: hashPassword(password) },
  });

  await setSession(host.id);
  redirect("/host");
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

  const host = await prisma.host.findUnique({ where: { email } });
  if (!host?.passwordHash || !verifyPassword(password, host.passwordHash)) {
    return { error: "Identifiants incorrects." };
  }

  await setSession(host.id);
  redirect("/host");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}
