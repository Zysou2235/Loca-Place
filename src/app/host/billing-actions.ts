"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getCurrentHost } from "@/lib/auth";
import { getPlan, planPriceId, type PlanId } from "@/lib/plans";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

function assertStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe n'est pas configuré (STRIPE_SECRET_KEY manquante).");
  }
}

/* ----------------------------------------------------- Subscriptions */

export async function subscribe(formData: FormData) {
  assertStripe();
  const host = await getCurrentHost();
  if (!host) throw new Error("Non authentifié.");

  const planId = String(formData.get("planId") ?? "") as PlanId;
  const plan = getPlan(planId);
  if (!plan) throw new Error("Formule inconnue.");

  const priceId = planPriceId(planId);
  if (!priceId) {
    throw new Error(
      `Le tarif Stripe n'est pas configuré (${plan.priceEnv} manquante).`
    );
  }

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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: host.id,
    metadata: { hostId: host.id, planId },
    success_url: `${BASE_URL}/host?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/host/billing`,
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
      await prisma.host.update({
        where: { id: host.id },
        data: {
          subscriptionStatus: "active",
          subscriptionPlan: session.metadata?.planId ?? host.subscriptionPlan,
          stripeCustomerId:
            (session.customer as string) ?? host.stripeCustomerId,
        },
      });
    }
  } catch {
    // ignore — webhook will reconcile eventually.
  }
}

export async function openBillingPortal() {
  assertStripe();
  const host = await getCurrentHost();
  if (!host?.stripeCustomerId) throw new Error("Aucun abonnement à gérer.");

  const session = await stripe.billingPortal.sessions.create({
    customer: host.stripeCustomerId,
    return_url: `${BASE_URL}/host`,
  });
  redirect(session.url);
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

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${BASE_URL}/host`,
    return_url: `${BASE_URL}/host`,
    type: "account_onboarding",
  });
  redirect(link.url);
}

/** Refresh the host's Connect payout status from Stripe. */
export async function refreshConnectStatus() {
  if (!process.env.STRIPE_SECRET_KEY) return;
  const host = await getCurrentHost();
  if (!host?.stripeAccountId) return;
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
