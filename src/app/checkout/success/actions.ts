"use server";

import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendAccessCodeEmail, sendAccessCodeSms } from "@/lib/notify";

/** Traveler-triggered resend of the box code for a paid checkout session. */
export async function resendForSession(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) redirect("/");

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid" && session.mode === "payment") {
      const boxId = session.metadata?.boxId;
      const box = boxId
        ? await prisma.box.findUnique({
            where: { id: boxId },
            select: { accessCode: true, name: true },
          })
        : null;
      const order = await prisma.order.findUnique({
        where: { stripeSessionId: sessionId },
        select: { productName: true },
      });

      if (box?.accessCode) {
        const payload = {
          code: box.accessCode,
          boxName: box.name,
          productName: order?.productName ?? "votre commande",
          email: session.customer_details?.email,
          phone: session.customer_details?.phone,
        };
        const emailed = await sendAccessCodeEmail(payload);
        const smsed = await sendAccessCodeSms(payload);
        if (emailed || smsed) {
          await prisma.order.updateMany({
            where: { stripeSessionId: sessionId },
            data: { codeSent: true },
          });
        }
      }
    }
  } catch {
    // ignore — fall through to the confirmation
  }

  redirect(`/checkout/success?session_id=${sessionId}&resent=1`);
}
