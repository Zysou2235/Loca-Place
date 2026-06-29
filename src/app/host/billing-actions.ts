"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getCurrentHost } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import {
  getPlan,
  boxesFor,
  priceCentsFor,
  type PlanId,
} from "@/lib/plans";
import { PROFILE_SELECT, isProfileComplete } from "@/lib/profile";

function assertStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe n'est pas configuré (STRIPE_SECRET_KEY manquante).");
  }
}

// Anti-martèlement : le tableau de bord hôte appelle les refresh Stripe à
// chaque chargement. On limite à 1 appel / 10 min par hôte (en mémoire process)
// pour éviter coût et rate-limit Stripe. Le retour de Checkout (session_id)
// passe, lui, par syncSubscriptionFromCheckout qui n'est pas limité.
const REFRESH_TTL_MS = 10 * 60 * 1000;
const lastRefreshAt = new Map<string, number>();

function shouldRefresh(key: string): boolean {
  const now = Date.now();
  const last = lastRefreshAt.get(key) ?? 0;
  if (now - last < REFRESH_TTL_MS) return false;
  lastRefreshAt.set(key, now);
  return true;
}

/* ----------------------------------------------------- Subscriptions */

export async function placeSubscriptionOrder(formData: FormData) {
  assertStripe();
  const host = await getCurrentHost();
  if (!host) throw new Error("Non authentifié.");

  const planId = String(formData.get("planId") ?? "") as PlanId;
  const plan = getPlan(planId);
  if (!plan) throw new Error("Formule inconnue.");

  // Nb de box (formule Multi : choix de l'hôte) — conservé dans les URLs du tunnel.
  const boxes = boxesFor(planId, Number(formData.get("boxes") ?? 0));
  const q = `plan=${planId}&boxes=${boxes}`;

  // Déjà abonné : pas de 2e souscription — on renvoie vers le portail Stripe
  // (changement/résiliation de formule s'y font proprement).
  if (
    host.subscriptionStatus === "active" ||
    host.subscriptionStatus === "trialing"
  ) {
    if (host.stripeCustomerId) {
      const result = await tryCreatePortalSession(host.stripeCustomerId);
      if ("url" in result) redirect(result.url);
      redirect(
        `/host?billingError=portal&msg=${encodeURIComponent(result.error)}`
      );
    }
    redirect("/host");
  }

  // Tunnel : chaque étape doit être complétée avant le paiement.
  const profile = await prisma.host.findUnique({
    where: { id: host.id },
    select: {
      ...PROFILE_SELECT,
      deliveryCarrier: true,
      deliveryRelayId: true,
    },
  });
  if (!isProfileComplete(profile)) {
    redirect(`/host/billing/commande?${q}&step=infos`);
  }
  if (!profile?.deliveryCarrier) {
    redirect(`/host/billing/commande?${q}&step=livraison`);
  }
  if (profile.deliveryCarrier === "mondial_relay" && !profile.deliveryRelayId) {
    redirect(`/host/billing/commande?${q}&step=livraison&error=relay`);
  }

  // Prix mensuel TTC correspondant à la formule + nb de box.
  const unitAmount = priceCentsFor(planId, boxes);
  const label =
    planId === "multi" ? `${plan.name} — ${boxes} box` : plan.name;

  // Ensure a Stripe customer for this host.
  let customerId = host.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: host.email,
      name: host.name,
      metadata: { hostId: host.id },
    });
    customerId = customer.id;
    await prisma.host.update({
      where: { id: host.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const baseUrl = await getBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    // Prix créé à la volée (TTC) — pas de produit à pré-créer dans Stripe.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: plan.currency,
          unit_amount: unitAmount,
          recurring: { interval: "month" },
          product_data: { name: `Escale Box — ${label}` },
        },
      },
    ],
    subscription_data: {
      metadata: { hostId: host.id, planId, boxes: String(boxes) },
    },
    client_reference_id: host.id,
    metadata: { hostId: host.id, planId, boxes: String(boxes) },
    success_url: `${baseUrl}/host?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/host/billing`,
  });

  if (!session.url) throw new Error("Création de la session impossible.");
  redirect(session.url);
}

/** Reconcile subscription status after returning from Checkout (fallback to webhook). */
export async function syncSubscriptionFromCheckout(sessionId: string) {
  if (!process.env.STRIPE_SECRET_KEY) return;
  const host = await getCurrentHost();
  if (!host) return;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (
      session.metadata?.hostId === host.id &&
      session.status === "complete" &&
      session.mode === "subscription"
    ) {
      const planId = session.metadata?.planId ?? host.subscriptionPlan;
      const boxes = boxesFor(planId, Number(session.metadata?.boxes ?? 0));
      await prisma.host.update({
        where: { id: host.id },
        data: {
          subscriptionStatus: "active",
          subscriptionPlan: planId,
          boxQuota: boxes,
          stripeCustomerId:
            (session.customer as string) ?? host.stripeCustomerId,
        },
      });
    }
  } catch {
    // ignore — webhook will reconcile eventually.
  }
}

/**
 * Self-healing: read the host's real subscription state from Stripe and update
 * the DB. Works even if the post-checkout redirect failed (e.g. wrong base URL).
 */
export async function refreshSubscriptionStatus() {
  if (!process.env.STRIPE_SECRET_KEY) return;
  const host = await getCurrentHost();
  if (!host?.stripeCustomerId) return;
  if (!shouldRefresh(`sub:${host.id}`)) return;

  try {
    const subs = await stripe.subscriptions.list({
      customer: host.stripeCustomerId,
      status: "all",
      limit: 1,
    });
    const sub = subs.data[0];
    if (!sub) return;

    const active = sub.status === "active" || sub.status === "trialing";
    await prisma.host.update({
      where: { id: host.id },
      data: {
        subscriptionStatus: sub.status,
        ...(active && sub.metadata?.planId
          ? {
              subscriptionPlan: sub.metadata.planId,
              boxQuota: boxesFor(
                sub.metadata.planId,
                Number(sub.metadata?.boxes ?? 0)
              ),
            }
          : {}),
      },
    });
  } catch {
    // ignore
  }
}

export async function openBillingPortal() {
  assertStripe();
  const host = await getCurrentHost();
  if (!host?.stripeCustomerId) redirect("/host?billingError=nocustomer");

  const result = await tryCreatePortalSession(host!.stripeCustomerId!);
  if ("url" in result) redirect(result.url);
  redirect(`/host?billingError=portal&msg=${encodeURIComponent(result.error)}`);
}

/**
 * Crée une session du portail client Stripe. Renvoie `{ error }` (au lieu de jeter)
 * si le portail n'est pas encore configuré côté Dashboard Stripe — l'appelant
 * peut alors rediriger vers /host avec un message clair.
 */
async function tryCreatePortalSession(
  customerId: string
): Promise<{ url: string } | { error: string }> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${await getBaseUrl()}/host`,
    });
    return { url: session.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe] billingPortal.sessions.create failed:", msg);
    return { error: msg.slice(0, 300) };
  }
}

/* -------------------------------------------------- Stripe Connect */

export async function connectOnboard() {
  assertStripe();
  const host = await getCurrentHost();
  if (!host) throw new Error("Non authentifié.");

  let accountId = host.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: host.email,
      metadata: { hostId: host.id },
    });
    accountId = account.id;
    await prisma.host.update({
      where: { id: host.id },
      data: { stripeAccountId: accountId },
    });
  }

  const baseUrl = await getBaseUrl();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/host`,
    return_url: `${baseUrl}/host`,
    type: "account_onboarding",
  });
  redirect(link.url);
}

/** Refresh the host's Connect payout status from Stripe. */
export async function refreshConnectStatus() {
  if (!process.env.STRIPE_SECRET_KEY) return;
  const host = await getCurrentHost();
  if (!host?.stripeAccountId) return;
  if (!shouldRefresh(`acct:${host.id}`)) return;
  try {
    const account = await stripe.accounts.retrieve(host.stripeAccountId);
    await prisma.host.update({
      where: { id: host.id },
      data: { chargesEnabled: account.charges_enabled ?? false },
    });
  } catch {
    // ignore
  }
}
