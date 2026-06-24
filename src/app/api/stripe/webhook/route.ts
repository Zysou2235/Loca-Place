import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { deliverBoxCode } from "@/lib/orders";

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
            await prisma.host.update({
              where: { id: hostId },
              data: {
                subscriptionStatus: "active",
                subscriptionPlan: planId,
                stripeCustomerId:
                  (session.customer as string) ?? undefined,
              },
            });
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
        await prisma.host.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: sub.status,
            ...(planId ? { subscriptionPlan: planId } : {}),
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.host.updateMany({
          where: { stripeCustomerId: sub.customer as string },
          data: { subscriptionStatus: "canceled" },
        });
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
    console.error("[stripe webhook] handler error", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
