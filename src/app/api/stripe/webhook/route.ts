import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { deliverBoxCode } from "@/lib/orders";
import { boxesFor } from "@/lib/plans";
import {
  provisionBoxesForHost,
  deactivateBoxesForHost,
} from "@/lib/box-provisioning";
import { reportServerError } from "@/lib/error-report";

// Stripe needs the raw request body to verify the signature.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return new Response(
      `Webhook signature verification failed: ${
        err instanceof Error ? err.message : "unknown"
      }`,
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          const hostId = session.metadata?.hostId;
          const planId = session.metadata?.planId ?? null;
          if (hostId) {
            const quota = boxesFor(planId, Number(session.metadata?.boxes ?? 0));
            // Statut réel (peut être "trialing" avec l'essai gratuit) plutôt
            // que de coder "active" en dur — sinon un abonnement en essai
            // s'affiche comme déjà payant.
            const subId = session.subscription;
            const sub =
              typeof subId === "string"
                ? await stripe.subscriptions.retrieve(subId)
                : null;
            await prisma.host.update({
              where: { id: hostId },
              data: {
                subscriptionStatus: sub?.status ?? "active",
                subscriptionPlan: planId,
                boxQuota: quota,
                trialEndsAt: sub?.trial_end
                  ? new Date(sub.trial_end * 1000)
                  : null,
                stripeCustomerId:
                  (session.customer as string) ?? undefined,
              },
            });
            // Auto-création des box pour atteindre le quota du plan.
            await provisionBoxesForHost(hostId, quota);
          }
        } else if (session.mode === "payment") {
          // Traveler purchase → record the order and deliver the box code.
          await deliverBoxCode(session);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const planId = sub.metadata?.planId;
        const quota = planId
          ? boxesFor(planId, Number(sub.metadata?.boxes ?? 0))
          : undefined;
        await prisma.host.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: sub.status,
            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
            ...(planId && quota !== undefined
              ? { subscriptionPlan: planId, boxQuota: quota }
              : {}),
          },
        });
        // Si la souscription devient active, on provisionne les box manquantes.
        if (
          (sub.status === "active" || sub.status === "trialing") &&
          quota !== undefined
        ) {
          const hosts = await prisma.host.findMany({
            where: { stripeCustomerId: customerId },
            select: { id: true },
          });
          for (const h of hosts) {
            await provisionBoxesForHost(h.id, quota);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const hosts = await prisma.host.findMany({
          where: { stripeCustomerId: sub.customer as string },
          select: { id: true },
        });
        await prisma.host.updateMany({
          where: { stripeCustomerId: sub.customer as string },
          data: { subscriptionStatus: "canceled" },
        });
        // Désactive les box (on ne supprime pas — le QR a peut-être déjà été
        // imprimé et collé sur la box physique).
        for (const h of hosts) {
          await deactivateBoxesForHost(h.id);
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await prisma.host.updateMany({
          where: { stripeAccountId: account.id },
          data: { chargesEnabled: account.charges_enabled ?? false },
        });
        break;
      }
    }
  } catch (err) {
    await reportServerError(`Stripe webhook (${event.type})`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
