"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { sendAccessCodeEmail, sendAccessCodeSms } from "@/lib/notify";
import { generateLockCode } from "@/lib/lock-code";
import { createShippingLabel, type Carrier } from "@/lib/shipping";
import { deleteHostAccount } from "@/lib/account";
import { redirect } from "next/navigation";

/** Active manuellement un compte hôte (filet de sécurité support). Admin only. */
export async function verifyHostAccount(formData: FormData) {
  await requireAdmin();
  const hostId = String(formData.get("hostId") ?? "");
  if (!hostId) throw new Error("Hôte manquant.");
  await prisma.host.update({
    where: { id: hostId },
    data: { emailVerified: true },
  });
  revalidatePath(`/admin/hosts/${hostId}`);
}

/** Suppression d'un compte hôte par l'admin (RGPD / support). Admin only. */
export async function deleteHostByAdmin(formData: FormData) {
  await requireAdmin();
  const hostId = String(formData.get("hostId") ?? "");
  if (!hostId) throw new Error("Hôte manquant.");
  await deleteHostAccount(hostId);
  redirect("/admin");
}

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

/** Enregistre les notes internes d'un hôte (support/suivi). Admin only. */
export async function saveHostNotes(formData: FormData) {
  await requireAdmin();
  const hostId = String(formData.get("hostId") ?? "");
  if (!hostId) throw new Error("Hôte manquant.");
  const notes = String(formData.get("notes") ?? "").slice(0, 5000) || null;
  await prisma.host.update({ where: { id: hostId }, data: { adminNotes: notes } });
  revalidatePath(`/admin/hosts/${hostId}`);
}

/** Génère l'étiquette d'expédition d'une box via l'API du transporteur choisi
 *  par l'hôte (Mondial Relay, DPD ou Chronopost) et stocke suivi + PDF.
 *  Livraison en Point Relais pour Mondial Relay si la box en a un, sinon au
 *  domicile de l'hôte. Admin only. */
export async function generateShippingLabel(formData: FormData) {
  await requireAdmin();
  const boxId = String(formData.get("boxId") ?? "");
  if (!boxId) throw new Error("Box manquante.");

  const box = await prisma.box.findUnique({
    where: { id: boxId },
    select: {
      host: {
        select: {
          name: true,
          phone: true,
          email: true,
          deliveryName: true,
          deliveryLine1: true,
          deliveryZip: true,
          deliveryCity: true,
          deliveryCountry: true,
          deliveryRelayId: true,
          deliveryCarrier: true,
        },
      },
    },
  });
  if (!box) throw new Error("Box introuvable.");

  const h = box.host;
  const carrier = h.deliveryCarrier as Carrier | null;
  if (!carrier) throw new Error("Aucun transporteur choisi par cet hôte.");
  if (
    !h.deliveryRelayId &&
    !(h.deliveryLine1 && h.deliveryZip && h.deliveryCity)
  ) {
    throw new Error(
      "Aucun Point Relais ni adresse de livraison renseignés pour cet hôte."
    );
  }

  const result = await createShippingLabel(carrier, {
    destName: h.deliveryName || h.name,
    destAddress: h.deliveryLine1 ?? "",
    destZip: h.deliveryZip ?? "",
    destCity: h.deliveryCity ?? "",
    destCountry: h.deliveryCountry ?? "FR",
    destPhone: h.phone ?? undefined,
    destEmail: h.email,
    relayId: h.deliveryRelayId,
    ref: boxId.slice(-12),
  });

  await prisma.box.update({
    where: { id: boxId },
    data: {
      shippingTrackingNumber: result.expeditionNumber,
      shippingLabelUrl: result.labelUrl,
    },
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

