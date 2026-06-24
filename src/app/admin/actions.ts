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

