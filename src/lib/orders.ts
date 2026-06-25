import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  sendAccessCodeEmail,
  sendAccessCodeSms,
  sendHostSaleEmail,
} from "@/lib/notify";

/**
 * Record a traveler order and deliver the box access code by email/SMS.
 * Idempotent (keyed on the Stripe session id), so it can safely be called from
 * both the Stripe webhook and the success page (fallback when no webhook).
 */
export async function deliverBoxCode(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment" || session.payment_status !== "paid") return;

  const boxId = session.metadata?.boxId;
  const productId = session.metadata?.productId;
  if (!boxId) return;

  const existing = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
  });
  if (existing) return;

  const box = await prisma.box.findUnique({
    where: { id: boxId },
    select: {
      accessCode: true,
      name: true,
      host: { select: { email: true, name: true } },
    },
  });
  const product = productId
    ? await prisma.product.findUnique({
        where: { id: productId },
        select: { name: true },
      })
    : null;

  const email = session.customer_details?.email ?? null;
  const phone = session.customer_details?.phone ?? null;
  const productName = product?.name ?? "Produit";

  // create() guards against races via the unique stripeSessionId.
  let order;
  try {
    order = await prisma.order.create({
      data: {
        stripeSessionId: session.id,
        boxId,
        productName,
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? "eur",
        customerEmail: email,
        customerPhone: phone,
      },
    });
  } catch {
    return; // already created by a concurrent call
  }

  if (box?.accessCode) {
    const payload = {
      code: box.accessCode,
      boxName: box.name,
      productName,
      email,
      phone,
    };
    const emailed = await sendAccessCodeEmail(payload);
    const smsed = await sendAccessCodeSms(payload);
    if (emailed || smsed) {
      await prisma.order.update({
        where: { id: order.id },
        data: { codeSent: true },
      });
    }
  }

  // Prévient l'hôte de la vente (best-effort, n'interrompt jamais la livraison).
  if (box?.host?.email) {
    await sendHostSaleEmail({
      hostEmail: box.host.email,
      hostName: box.host.name,
      boxName: box?.name ?? "votre box",
      productName,
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? "eur",
      customerEmail: email,
      customerPhone: phone,
    });
  }
}
