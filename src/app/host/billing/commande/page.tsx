import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import {
  getPlan,
  boxesFor,
  priceCentsFor,
  type PlanId,
} from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import { PROFILE_SELECT, isProfileComplete } from "@/lib/profile";
import { HostShell } from "../../HostShell";
import { placeSubscriptionOrder } from "../../billing-actions";
import { InfosStep } from "./InfosStep";
import { DeliveryStep } from "./DeliveryStep";

export const dynamic = "force-dynamic";

type Step = "infos" | "livraison" | "paiement";

const CARRIER_LABEL: Record<string, string> = {
  mondial_relay: "Mondial Relay (Point Relais)",
  dpd: "DPD (à domicile)",
  chronopost: "Chronopost (express)",
};

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{
    plan?: string;
    step?: string;
    error?: string;
    boxes?: string;
  }>;
}) {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const { plan: planParam, step: stepParam, error, boxes: boxesParam } =
    await searchParams;
  const plan = getPlan(planParam as PlanId);
  if (!plan) redirect("/host/billing");

  const boxes = boxesFor(plan.id, Number(boxesParam ?? 0));
  const priceLabel = formatPrice(priceCentsFor(plan.id, boxes));
  // Suffixe à conserver dans toutes les URLs internes du tunnel.
  const q = `plan=${plan.id}&boxes=${boxes}`;

  const p = await prisma.host.findUnique({
    where: { id: host.id },
    select: {
      ...PROFILE_SELECT,
      companyName: true,
      siret: true,
      phone: true,
      billingCountry: true,
      deliveryName: true,
      deliveryCountry: true,
      deliveryCarrier: true,
      deliveryRelayId: true,
      deliveryRelayLabel: true,
    },
  });

  const infosComplete = isProfileComplete(p);
  const hasCarrier = Boolean(p?.deliveryCarrier);

  // Détermine l'étape effective (avec garde-fous d'enchaînement).
  let step = (["infos", "livraison", "paiement"] as Step[]).includes(
    stepParam as Step
  )
    ? (stepParam as Step)
    : null;
  if (!infosComplete) step = "infos";
  else if (!step) step = hasCarrier ? "paiement" : "livraison";
  else if (step === "paiement" && !hasCarrier) step = "livraison";

  return (
    <HostShell hostName={host.name}>
      <Link href="/host/billing" className="text-sm font-medium text-accent">
        ← Changer de formule
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-brand">
        Commande — {plan.name}
      </h1>

      <Stepper current={step} />

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_300px]">
        <div>
          {step === "infos" && (
            <InfosStep
              planId={plan.id}
              boxes={boxes}
              defaults={{
                companyName: p?.companyName ?? host.name ?? "",
                siret: p?.siret ?? "",
                phone: p?.phone ?? "",
                billingLine1: p?.billingLine1 ?? "",
                billingZip: p?.billingZip ?? "",
                billingCity: p?.billingCity ?? "",
                billingCountry: p?.billingCountry ?? "France",
                deliveryName: p?.deliveryName ?? "",
                deliveryLine1: p?.deliveryLine1 ?? "",
                deliveryZip: p?.deliveryZip ?? "",
                deliveryCity: p?.deliveryCity ?? "",
                deliveryCountry: p?.deliveryCountry ?? "France",
              }}
            />
          )}

          {step === "livraison" && (
            <DeliveryStep
              planId={plan.id}
              boxes={boxes}
              error={error}
              defaults={{
                carrier: (p?.deliveryCarrier as "mondial_relay" | "dpd" | "chronopost") ?? "",
                relayId: p?.deliveryRelayId ?? "",
                relayLabel: p?.deliveryRelayLabel ?? "",
              }}
            />
          )}

          {step === "paiement" && (
            <div className="space-y-5 rounded-2xl border border-black/5 bg-white p-6 shadow-card">
              <h2 className="font-display font-bold text-brand">
                Récapitulatif & paiement
              </h2>

              <Recap title="Facturation" editHref={`/host/billing/commande?${q}&step=infos`}>
                {p?.companyName || host.name}
                <br />
                {p?.billingLine1}
                <br />
                {p?.billingZip} {p?.billingCity}
              </Recap>

              <Recap title="Livraison" editHref={`/host/billing/commande?${q}&step=livraison`}>
                {CARRIER_LABEL[p?.deliveryCarrier ?? ""] ?? "—"}
                {p?.deliveryCarrier === "mondial_relay" && p?.deliveryRelayId && (
                  <>
                    <br />
                    Point Relais : {p.deliveryRelayId}
                    {p.deliveryRelayLabel ? ` — ${p.deliveryRelayLabel}` : ""}
                  </>
                )}
                {p?.deliveryCarrier !== "mondial_relay" && (
                  <>
                    <br />
                    {p?.deliveryLine1}, {p?.deliveryZip} {p?.deliveryCity}
                  </>
                )}
              </Recap>

              <form action={placeSubscriptionOrder} className="border-t border-black/5 pt-5">
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="boxes" value={boxes} />
                <button
                  type="submit"
                  className="w-full rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-accent-dark"
                >
                  Payer {priceLabel} / mois →
                </button>
                <p className="mt-2 text-center text-xs text-brand/50">
                  Paiement sécurisé par Stripe. Sans engagement.
                </p>
              </form>
            </div>
          )}
        </div>

        {/* Récap formule */}
        <aside className="h-fit rounded-2xl border border-black/5 bg-white p-6 shadow-card">
          <h2 className="font-display font-bold text-brand">Votre formule</h2>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-semibold text-brand">
              {plan.name}
              {plan.id === "multi" ? ` · ${boxes} box` : ""}
            </span>
            <span className="font-display text-xl font-extrabold text-brand">
              {priceLabel}
              <span className="text-sm font-medium text-brand/50"> / mois</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-brand/60">{plan.tagline}</p>
          <ul className="mt-4 space-y-1.5 text-sm text-brand/80">
            {plan.features.slice(0, 5).map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
        </aside>
      </div>
    </HostShell>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "infos", label: "Informations" },
    { id: "livraison", label: "Livraison" },
    { id: "paiement", label: "Paiement" },
  ];
  const idx = steps.findIndex((s) => s.id === current);
  return (
    <div className="mt-5 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.id} className="flex flex-1 items-center gap-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              i <= idx ? "bg-accent text-white" : "bg-black/10 text-brand/50"
            }`}
          >
            {i + 1}
          </span>
          <span
            className={`text-sm font-medium ${
              i === idx ? "text-brand" : "text-brand/40"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className="mx-1 hidden h-px flex-1 bg-black/10 sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}

function Recap({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand">{title}</h3>
        <Link href={editHref} className="text-xs font-medium text-accent hover:underline">
          Modifier
        </Link>
      </div>
      <p className="mt-1 text-sm text-brand/70">{children}</p>
    </div>
  );
}
