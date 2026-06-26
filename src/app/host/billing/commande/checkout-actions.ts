"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";

const CARRIERS = ["mondial_relay", "dpd", "chronopost"] as const;

function clean(v: FormDataEntryValue | null, max = 120): string | null {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
}

function planParam(formData: FormData): string {
  return encodeURIComponent(String(formData.get("planId") ?? ""));
}

/** Étape 1 — coordonnées de facturation + adresse. Puis → livraison. */
export async function saveCheckoutInfos(formData: FormData) {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const sameAsBilling = formData.get("sameAsBilling") === "on";
  const billingLine1 = clean(formData.get("billingLine1"), 200);
  const billingZip = clean(formData.get("billingZip"), 20);
  const billingCity = clean(formData.get("billingCity"));
  const billingCountry = clean(formData.get("billingCountry")) ?? "France";
  const companyName = clean(formData.get("companyName"));

  await prisma.host.update({
    where: { id: host!.id },
    data: {
      companyName,
      siret: clean(formData.get("siret"), 20),
      phone: clean(formData.get("phone"), 30),
      billingLine1,
      billingZip,
      billingCity,
      billingCountry,
      deliveryName: sameAsBilling
        ? companyName ?? host!.name
        : clean(formData.get("deliveryName")),
      deliveryLine1: sameAsBilling ? billingLine1 : clean(formData.get("deliveryLine1"), 200),
      deliveryZip: sameAsBilling ? billingZip : clean(formData.get("deliveryZip"), 20),
      deliveryCity: sameAsBilling ? billingCity : clean(formData.get("deliveryCity")),
      deliveryCountry: sameAsBilling
        ? billingCountry
        : clean(formData.get("deliveryCountry")) ?? "France",
    },
  });

  redirect(`/host/billing/commande?plan=${planParam(formData)}&step=livraison`);
}

/** Étape 2 — choix du transporteur (+ point relais si Mondial Relay). → paiement. */
export async function saveCheckoutDelivery(formData: FormData) {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const plan = planParam(formData);
  const carrier = String(formData.get("carrier") ?? "");
  if (!CARRIERS.includes(carrier as (typeof CARRIERS)[number])) {
    redirect(`/host/billing/commande?plan=${plan}&step=livraison&error=carrier`);
  }

  const relayId = clean(formData.get("relayId"), 20);
  const relayLabel = clean(formData.get("relayLabel"));

  if (carrier === "mondial_relay" && !relayId) {
    redirect(`/host/billing/commande?plan=${plan}&step=livraison&error=relay`);
  }

  await prisma.host.update({
    where: { id: host!.id },
    data: {
      deliveryCarrier: carrier,
      // Le point relais ne concerne que Mondial Relay ; sinon on l'efface.
      deliveryRelayId: carrier === "mondial_relay" ? relayId : null,
      deliveryRelayLabel: carrier === "mondial_relay" ? relayLabel : null,
    },
  });

  redirect(`/host/billing/commande?plan=${plan}&step=paiement`);
}
