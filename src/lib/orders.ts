import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
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

  // Moyen de paiement réel (card, apple_pay, google_pay, link…). La session
  // liste les types proposés ; le détail précis (wallet) vit sur le
  // PaymentIntent → charge. Best-effort : on prend ce qu'on peut lire.
  let paymentMethod: string | null =
    session.payment_method_types?.[0] ?? null;
  try {
    if (typeof session.payment_intent === "string") {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
        expand: ["latest_charge"],
      });
      const charge = pi.latest_charge as Stripe.Charge | null;
      const details = charge?.payment_method_details;
      if (details?.type === "card" && details.card?.wallet?.type) {
        paymentMethod = details.card.wallet.type; // apple_pay | google_pay | link
      } else if (details?.type) {
        paymentMethod = details.type;
      }
    }
  } catch {
    // on garde le fallback payment_method_types[0]
  }

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
        paymentMethod,
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

  // La box est vidée : on détache le produit pour que la page voyageur affiche
  // "bientôt disponible" et que l'hôte voie la box marquée comme "vide" sur
  // son dashboard. Une nouvelle attribution est nécessaire avant la prochaine
  // vente.
  await prisma.box.update({
    where: { id: boxId },
    data: { selectedProductId: null },
  });
}
