"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getCurrentHost } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { getPlan, type PlanId } from "@/lib/plans";

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
    // Price created inline → no need to pre-create products/prices in Stripe.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: plan.currency,
          unit_amount: plan.priceCents,
          recurring: { interval: "month" },
          product_data: { name: `Eskale Box — ${plan.name}` },
        },
      },
    ],
    subscription_data: { metadata: { hostId: host.id, planId } },
    client_reference_id: host.id,
    metadata: { hostId: host.id, planId },
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

/**
 * Self-healing: read the host's real subscription state from Stripe and update
 * the DB. Works even if the post-checkout redirect failed (e.g. wrong base URL).
 */
export async function refreshSubscriptionStatus() {
  if (!process.env.STRIPE_SECRET_KEY) return;
  const host = await getCurrentHost();
  if (!host?.stripeCustomerId) return;

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
          ? { subscriptionPlan: sub.metadata.planId }
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
  if (!host?.stripeCustomerId) throw new Error("Aucun abonnement à gérer.");

  const session = await stripe.billingPortal.sessions.create({
    customer: host.stripeCustomerId,
    return_url: `${await getBaseUrl()}/host`,
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
