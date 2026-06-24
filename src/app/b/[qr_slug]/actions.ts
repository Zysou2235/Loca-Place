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

  // The product must be the one currently selected in this box.
  const box = await prisma.box.findFirst({
    where: { qrSlug, active: true, selectedProductId: productId },
    include: { selectedProduct: true, host: true },
  });

  const product = box?.selectedProduct;
  if (!box || !product || !product.active) {
    throw new Error("Produit introuvable.");
  }

  // The box must have a lock code before it can sell — the code is sent to the
  // traveler after payment.
  if (!box.accessCode) {
    throw new Error("Cette box n'est pas encore disponible à la vente.");
  }

  const host = box.host;

  // Connect guard: if the host started onboarding but it isn't complete,
  // a destination charge would fail — block the sale with a clear message.
  if (host.stripeAccountId && !host.chargesEnabled) {
    throw new Error(
      "Cette boutique n'est pas encore prête à encaisser. Réessayez bientôt."
    );
  }
  const canReceive = Boolean(host.stripeAccountId && host.chargesEnabled);

  const baseUrl = await getBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    phone_number_collection: { enabled: true },
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
            // Stripe n'accepte que des URLs publiques (pas les images importées
            // en data URL) — on ne les transmet que si c'est une URL http(s).
            ...(product.photoUrl && /^https?:\/\//.test(product.photoUrl)
              ? { images: [product.photoUrl] }
              : {}),
          },
        },
      },
    ],
    // Destination charge → full amount goes to the host (0% commission).
    ...(canReceive
      ? {
          payment_intent_data: {
            on_behalf_of: host.stripeAccountId!,
            transfer_data: { destination: host.stripeAccountId! },
          },
        }
      : {}),
    metadata: {
      productId: product.id,
      boxId: box.id,
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
