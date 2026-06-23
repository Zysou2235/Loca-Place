"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/base-url";

/**
 * Create a Stripe Checkout Session for a single product and redirect the
 * traveler to Stripe's hosted Checkout page (guest checkout, no account).
 *
 * Money routing (MVP): 0% Petz commission. When the host has a Stripe Connect
 * Express account, the full amount is sent to them via a destination charge
 * (`on_behalf_of` + `transfer_data.destination`, no `application_fee_amount`).
 */
export async function createCheckoutSession(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const qrSlug = String(formData.get("qrSlug") ?? "");

  if (!productId || !qrSlug) {
    throw new Error("Produit ou boîte manquant.");
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true, box: { qrSlug, active: true } },
    include: { box: { include: { host: true } } },
  });

  if (!product) {
    throw new Error("Produit introuvable.");
  }

  const host = product.box.host;

  const baseUrl = await getBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: product.currency,
          unit_amount: product.priceCents,
          product_data: {
            name: product.name,
            ...(product.description
              ? { description: product.description }
              : {}),
            ...(product.photoUrl ? { images: [product.photoUrl] } : {}),
          },
        },
      },
    ],
    // Destination charge → full amount goes to the host (0% commission at MVP).
    ...(host.stripeAccountId
      ? {
          payment_intent_data: {
            on_behalf_of: host.stripeAccountId,
            transfer_data: { destination: host.stripeAccountId },
          },
        }
      : {}),
    metadata: {
      productId: product.id,
      boxId: product.box.id,
      qrSlug,
    },
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/b/${qrSlug}`,
  });

  if (!session.url) {
    throw new Error("Impossible de créer la session de paiement.");
  }

  // redirect() throws internally — keep it outside any try/catch.
  redirect(session.url);
}
