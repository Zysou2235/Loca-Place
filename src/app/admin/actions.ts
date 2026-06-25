"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { sendAccessCodeEmail, sendAccessCodeSms } from "@/lib/notify";
import { generateLockCode } from "@/lib/lock-code";

/**
 * Génère (ou régénère) le code du cadenas d'une box. Admin only.
 * Le code n'est jamais saisi à la main : on tire un code à 3 chiffres pour
 * éviter les fautes de frappe et garantir qu'il corresponde au cadenas.
 * Régénération bloquée une fois la box expédiée (le cadenas est déjà réglé).
 */
export async function generateBoxCode(formData: FormData) {
  await requireAdmin();

  const boxId = String(formData.get("boxId") ?? "");
  if (!boxId) throw new Error("Box manquante.");

  const box = await prisma.box.findUnique({
    where: { id: boxId },
    select: { shippedAt: true },
  });
  if (!box) throw new Error("Box introuvable.");
  if (box.shippedAt) {
    throw new Error(
      "Box déjà expédiée : le code du cadenas ne peut plus être modifié."
    );
  }

  await prisma.box.update({
    where: { id: boxId },
    data: { accessCode: generateLockCode() },
  });
  revalidatePath("/admin");
}

/** Enregistre les infos d'expédition d'une box (n° de suivi + URL étiquette).
 *  Étape manuelle en attendant l'automatisation Mondial Relay. Admin only. */
export async function setBoxShipping(formData: FormData) {
  await requireAdmin();

  const boxId = String(formData.get("boxId") ?? "");
  if (!boxId) throw new Error("Box manquante.");

  const tracking =
    String(formData.get("tracking") ?? "")
      .trim()
      .slice(0, 100) || null;
  const labelUrl = String(formData.get("labelUrl") ?? "").trim().slice(0, 500);

  // N'accepte qu'une URL https valide pour l'étiquette (ou vide).
  let safeLabelUrl: string | null = null;
  if (labelUrl) {
    try {
      const u = new URL(labelUrl);
      if (u.protocol !== "https:") throw new Error("https requis");
      safeLabelUrl = u.toString();
    } catch {
      throw new Error("URL d'étiquette invalide (https requis).");
    }
  }

  await prisma.box.update({
    where: { id: boxId },
    data: { shippingTrackingNumber: tracking, shippingLabelUrl: safeLabelUrl },
  });
  revalidatePath("/admin");
}

/** Marque une box comme expédiée à l'hôte. Bloqué si le code n'est pas défini
 *  (impossible de régler le cadenas une fois la box partie). Admin only. */
export async function markBoxShipped(formData: FormData) {
  await requireAdmin();

  const boxId = String(formData.get("boxId") ?? "");
  if (!boxId) throw new Error("Box manquante.");

  const box = await prisma.box.findUnique({
    where: { id: boxId },
    select: { accessCode: true },
  });
  if (!box) throw new Error("Box introuvable.");
  if (!box.accessCode) {
    throw new Error(
      "Impossible d'expédier : définissez d'abord le code du cadenas. Il ne pourra plus être réglé une fois la box chez l'hôte."
    );
  }

  await prisma.box.update({
    where: { id: boxId },
    data: { shippedAt: new Date() },
  });
  revalidatePath("/admin");
}

/** Annule l'expédition (erreur / box retournée). Admin only. */
export async function unmarkBoxShipped(formData: FormData) {
  await requireAdmin();

  const boxId = String(formData.get("boxId") ?? "");
  if (!boxId) throw new Error("Box manquante.");

  await prisma.box.update({
    where: { id: boxId },
    data: { shippedAt: null },
  });
  revalidatePath("/admin");
}

/** Resend the box access code for an order (email + SMS). Admin only. */
export async function resendCode(formData: FormData) {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "");
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { box: { select: { accessCode: true, name: true } } },
  });
  if (!order) throw new Error("Commande introuvable.");
  if (!order.box.accessCode) throw new Error("Cette box n'a pas de code défini.");

  const payload = {
    code: order.box.accessCode,
    boxName: order.box.name,
    productName: order.productName,
    email: order.customerEmail,
    phone: order.customerPhone,
  };
  const emailed = await sendAccessCodeEmail(payload);
  const smsed = await sendAccessCodeSms(payload);

  await prisma.order.update({
    where: { id: order.id },
    data: { codeSent: order.codeSent || emailed || smsed },
  });
  revalidatePath("/admin/orders");
}

