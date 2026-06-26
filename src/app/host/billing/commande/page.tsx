import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { getPlan, type PlanId } from "@/lib/plans";
import { PROFILE_SELECT, isProfileComplete } from "@/lib/profile";
import { HostShell } from "../../HostShell";
import { placeSubscriptionOrder } from "../../billing-actions";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; error?: string }>;
}) {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const { plan: planParam, error } = await searchParams;
  const plan = getPlan(planParam as PlanId);
  if (!plan) redirect("/host/billing");

  const profile = await prisma.host.findUnique({
    where: { id: host.id },
    select: {
      ...PROFILE_SELECT,
      companyName: true,
      deliveryRelayId: true,
      deliveryRelayLabel: true,
    },
  });
  if (!isProfileComplete(profile)) redirect("/host/profil?incomplete=1");

  return (
    <HostShell hostName={host.name}>
      <Link href="/host/billing" className="text-sm font-medium text-accent">
        ← Changer de formule
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-brand">
        Finaliser votre commande
      </h1>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        {/* Colonne gauche : livraison */}
        <form
          action={placeSubscriptionOrder}
          className="space-y-5 rounded-2xl border border-black/5 bg-white p-6 shadow-card"
        >
          <input type="hidden" name="planId" value={plan.id} />

          <div>
            <h2 className="font-display font-bold text-brand">
              1. Adresse de facturation
            </h2>
            <p className="mt-1 text-sm text-brand/70">
              {profile?.companyName || host.name}
              <br />
              {profile?.billingLine1}
              <br />
              {profile?.billingZip} {profile?.billingCity}
            </p>
            <Link
              href="/host/profil"
              className="mt-1 inline-block text-xs font-medium text-accent hover:underline"
            >
              Modifier
            </Link>
          </div>

          <div className="border-t border-black/5 pt-5">
            <h2 className="font-display font-bold text-brand">
              2. Livraison de votre box — Point Relais
            </h2>
            <p className="mt-1 text-sm text-brand/60">
              Choisissez le Point Relais Mondial Relay où recevoir votre box.{" "}
              <a
                href="https://www.mondialrelay.fr/trouver-le-point-relais-le-plus-proche/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:underline"
              >
                Trouver un Point Relais
              </a>
            </p>

            {error === "relay" && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                Veuillez indiquer votre Point Relais avant de payer.
              </p>
            )}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                name="relayId"
                required
                defaultValue={profile?.deliveryRelayId ?? ""}
                placeholder="N° du Point Relais (ex. 012345)"
                className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <input
                name="relayLabel"
                defaultValue={profile?.deliveryRelayLabel ?? ""}
                placeholder="Nom / ville du relais (optionnel)"
                className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>

          <div className="border-t border-black/5 pt-5">
            <button
              type="submit"
              className="w-full rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-accent-dark"
            >
              Payer {plan.price}{plan.period} →
            </button>
            <p className="mt-2 text-center text-xs text-brand/50">
              Paiement sécurisé par Stripe. Sans engagement, résiliable à tout
              moment.
            </p>
          </div>
        </form>

        {/* Colonne droite : récap formule */}
        <aside className="h-fit rounded-2xl border border-black/5 bg-white p-6 shadow-card">
          <h2 className="font-display font-bold text-brand">Votre formule</h2>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-semibold text-brand">{plan.name}</span>
            <span className="font-display text-xl font-extrabold text-brand">
              {plan.price}
              <span className="text-sm font-medium text-brand/50">
                {plan.period}
              </span>
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
