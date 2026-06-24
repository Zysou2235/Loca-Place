"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { sendAccessCodeEmail, sendAccessCodeSms } from "@/lib/notify";

/** Set (or update) the lock code of a box. Admin only. */
export async function setBoxCode(formData: FormData) {
  await requireAdmin();

  const boxId = String(formData.get("boxId") ?? "");
  const code = String(formData.get("code") ?? "")
    .trim()
    .slice(0, 32);
  if (!boxId) throw new Error("Box manquante.");
  if (!code) throw new Error("Le code ne peut pas être vide.");

  await prisma.box.update({
    where: { id: boxId },
    data: { accessCode: code },
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

