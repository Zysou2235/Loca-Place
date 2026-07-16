"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/base-url";
import { grantPurchaseAccess } from "@/lib/purchase-cookie";
import { clientIp, rateLimit, HOUR } from "@/lib/rate-limit";
import { computeVisitorHash } from "@/lib/visitor";
import { withRetry } from "@/lib/retry";
import { reportServerError } from "@/lib/error-report";
import { isTravelerLang } from "@/lib/traveler-i18n";

export type LeadState = { done?: boolean; error?: string };

/**
 * Un voyageur laisse volontairement son email sur la page de la box
 * (consentement recontact : avis/sondage). Anti-abus : rate-limit par IP,
 * unicité email+box (revisite = silencieusement ignorée).
 */
export async function leaveEmail(
  _prev: LeadState,
  formData: FormData
): Promise<LeadState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  const qrSlug = String(formData.get("qrSlug") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Adresse email invalide." };
  }

  const ip = await clientIp();
  if (!rateLimit(`lead:${ip}`, 5, HOUR)) {
    return { error: "Trop de tentatives. Réessayez plus tard." };
  }

  const box = await prisma.box.findFirst({
    where: { qrSlug, active: true },
    select: { id: true },
  });
  if (!box) return { error: "Box introuvable." };

  // Empreinte visiteur : relie cet email aux scans du même visiteur
  // (récurrence + identité dans les Données admin).
  const visitorHash = await computeVisitorHash();

  try {
    await prisma.lead.create({ data: { email, boxId: box.id, visitorHash } });
  } catch (err) {
    // Doublon email+box (P2002) : déjà enregistré, on confirme quand même.
    // Toute autre erreur doit remonter — sinon on afficherait « merci »
    // sans avoir rien enregistré.
    const isDuplicate =
      typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
    if (!isDuplicate) {
      await reportServerError("Opt-in email voyageur (leaveEmail)", err);
      return { error: "Enregistrement impossible. Réessayez plus tard." };
    }
  }
  return { done: true };
}

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
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isTravelerLang(langRaw) ? langRaw : "fr";
  const langQuery = lang === "fr" ? "" : `&lang=${lang}`;

  // Retour vers la page de la box avec un message clair plutôt qu'un throw —
  // ce sont des états métier attendus (stock/produit qui a changé entre le
  // chargement de la page et le clic), pas des bugs à remonter à l'équipe.
  const backWithError = (code: string): never => {
    redirect(`/b/${qrSlug || ""}?checkoutError=${code}${langQuery}`);
  };

  if (!productId || !qrSlug) backWithError("missing");

  // The product must be the one currently selected in this box.
  const box = await prisma.box.findFirst({
    where: { qrSlug, active: true, selectedProductId: productId },
    include: { selectedProduct: true, host: true },
  });

  if (!box || !box.selectedProduct || !box.selectedProduct.active) {
    backWithError("unavailable");
  }
  const validBox = box!;
  const product = validBox.selectedProduct!;

  // The box must have a lock code before it can sell — the code is sent to the
  // traveler after payment.
  if (!validBox.accessCode) backWithError("unavailable");

  const host = validBox.host;

  // L'hôte DOIT pouvoir encaisser (Stripe Connect actif) : sinon l'argent
  // n'irait pas sur son compte. On bloque toute vente tant que ce n'est pas le cas.
  const canReceive = Boolean(host.stripeAccountId && host.chargesEnabled);
  if (!canReceive) backWithError("unavailable");

  const baseUrl = await getBaseUrl();
  const visitorHash = (await computeVisitorHash()) ?? "";

  let sessionUrl: string;
  let sessionId: string;
  try {
    // Réessaie une fois avant d'abandonner — la plupart des ratés Stripe à
    // cet endroit sont un simple pépin réseau transitoire.
    const session = await withRetry(() =>
      stripe.checkout.sessions.create({
        mode: "payment",
        locale: lang,
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
        payment_intent_data: {
          on_behalf_of: host.stripeAccountId!,
          transfer_data: { destination: host.stripeAccountId! },
        },
        metadata: {
          productId: product.id,
          boxId: validBox.id,
          qrSlug,
          // Empreinte visiteur : reliera l'achat aux scans du même visiteur.
          visitorHash,
        },
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/b/${qrSlug}${lang !== "fr" ? `?lang=${lang}` : ""}`,
      })
    );
    if (!session.url) throw new Error("Session Stripe créée sans URL");
    sessionUrl = session.url;
    sessionId = session.id;
  } catch (err) {
    await reportServerError(`Checkout voyageur (box ${qrSlug})`, err);
    backWithError("payment");
  }

  // sessionUrl/sessionId sont garantis assignés ici : le catch ci-dessus
  // redirige (throw) avant d'atteindre cette ligne en cas d'échec.
  // Marque ce navigateur comme l'acheteur : seul lui verra le code sur la page
  // de succès (l'URL contient le session_id, qui pourrait fuiter).
  await grantPurchaseAccess(sessionId!);

  // redirect() throws internally — keep it outside any try/catch.
  redirect(sessionUrl!);
}
