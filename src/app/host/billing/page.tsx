import { redirect } from "next/navigation";
import { getCurrentHost } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { HostShell } from "../HostShell";
import { subscribe } from "../billing-actions";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const subscribed =
    host.subscriptionStatus === "active" ||
    host.subscriptionStatus === "trialing";

  return (
    <HostShell hostName={host.name}>
      <h1 className="font-display text-2xl font-bold text-brand">
        Votre abonnement
      </h1>
      <p className="mt-1 text-brand/60">
        Sans engagement, résiliable à tout moment. 0% de commission sur vos
        ventes.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const current = subscribed && host.subscriptionPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl p-7 ${
                plan.highlighted
                  ? "bg-brand text-white shadow-soft ring-2 ring-accent"
                  : "border border-black/5 bg-white text-brand shadow-card"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Le plus choisi
                </span>
              )}
              <h3 className="font-display text-lg font-bold">{plan.name}</h3>
              <p
                className={`mt-1 text-sm ${
                  plan.highlighted ? "text-white/70" : "text-brand/60"
                }`}
              >
                {plan.tagline}
              </p>
              <div className="mt-4 flex items-end gap-1">
                <span className="font-display text-4xl font-extrabold">
                  {plan.price}
                </span>
                <span
                  className={`mb-1 text-sm ${
                    plan.highlighted ? "text-white/70" : "text-brand/60"
                  }`}
                >
                  {plan.period}
                </span>
              </div>

              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className={
                      plan.highlighted ? "text-white/90" : "text-brand/80"
                    }
                  >
                    ✓ {f}
                  </li>
                ))}
              </ul>

              {current ? (
                <div className="mt-6 rounded-full bg-green-100 px-5 py-3 text-center text-sm font-semibold text-green-700">
                  Formule actuelle
                </div>
              ) : (
                <form action={subscribe} className="mt-6">
                  <input type="hidden" name="planId" value={plan.id} />
                  <button
                    type="submit"
                    className={`w-full rounded-full px-5 py-3 text-center font-semibold transition ${
                      plan.highlighted
                        ? "bg-accent text-white hover:bg-accent-dark"
                        : "bg-brand text-white hover:bg-brand-dark"
                    }`}
                  >
                    {subscribed ? "Changer pour cette formule" : "S'abonner"}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-brand/50">
        Paiement sécurisé par Stripe. Vous serez redirigé pour finaliser votre
        abonnement.
      </p>
    </HostShell>
  );
}
