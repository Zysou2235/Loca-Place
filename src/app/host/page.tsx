import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { getPlan } from "@/lib/plans";
import { isEffectiveAdmin } from "@/lib/admin";
import { provisionBoxesForHost } from "@/lib/box-provisioning";
import { HostShell } from "./HostShell";
import {
  connectOnboard,
  openBillingPortal,
  refreshConnectStatus,
  refreshSubscriptionStatus,
  resetStripeIdentifiers,
  syncSubscriptionFromCheckout,
} from "./billing-actions";

export const dynamic = "force-dynamic";

export default async function HostDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    billingError?: string;
    msg?: string;
    connect?: string;
    planChanged?: string;
  }>;
}) {
  let host = await getCurrentHost();
  if (!host) redirect("/host/login");

  // Reconcile state after Stripe redirects.
  const { session_id, billingError, msg, connect, planChanged } =
    await searchParams;
  if (session_id) {
    await syncSubscriptionFromCheckout(session_id);
  }
  await refreshSubscriptionStatus();
  // Au retour d'onboarding Stripe Connect, on force le refresh (sinon le
  // rate-limit anti-martèlement de 10 min empêche la mise à jour de
  // chargesEnabled, et le dashboard reste sur "À configurer").
  await refreshConnectStatus(connect === "return");
  host = await getCurrentHost();
  if (!host) redirect("/host/login");

  // Filet de sécurité : provisionne les box manquantes pour les abonnés qui
  // se sont inscrits avant l'arrivée de la création auto (idempotent).
  const subActive =
    host.subscriptionStatus === "active" ||
    host.subscriptionStatus === "trialing";
  if (subActive && host.boxQuota > 0) {
    await provisionBoxesForHost(host.id, host.boxQuota);
  }

  const boxes = await prisma.box.findMany({
    where: { hostId: host.id },
    orderBy: { createdAt: "desc" },
    include: {
      selectedProduct: { select: { name: true } },
      _count: { select: { scans: true, orders: true } },
    },
  });

  const plan = getPlan(host.subscriptionPlan);
  const subscribed =
    host.subscriptionStatus === "active" ||
    host.subscriptionStatus === "trialing";
  const limit = host.boxQuota;
  const justSubscribed = Boolean(session_id) && subscribed;

  return (
    <HostShell hostName={host.name} back={false}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-brand">
          Bonjour {host.name.split(" ")[0]} 👋
        </h1>
        {isEffectiveAdmin(host) && (
          <Link
            href="/admin"
            className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            Espace admin →
          </Link>
        )}
      </div>
      <p className="mt-1 text-brand/60">
        Pilotez vos box, vos produits et votre abonnement.
      </p>

      {planChanged && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
          <h2 className="font-display text-sm font-bold text-green-800">
            ✅ Votre formule a été modifiée
          </h2>
          <p className="mt-1 text-sm text-green-700">
            La différence sera appliquée au prorata sur votre prochaine facture.
            {host.boxQuota > 0 && (
              <>
                {" "}
                Votre quota est maintenant de {host.boxQuota} box.
              </>
            )}
          </p>
        </div>
      )}

      {justSubscribed && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
          <h2 className="font-display text-lg font-bold text-green-800">
            🎉 Merci, votre abonnement est actif !
          </h2>
          <p className="mt-1 text-sm text-green-700">
            Nous préparons votre box et l&apos;expédions sous 3 à 5 jours ouvrés.
            Vous recevrez un email avec le numéro de suivi. En attendant, vous
            pouvez créer votre première box et votre catalogue de produits.
          </p>
          <p className="mt-1 text-xs text-green-700/70">
            Un reçu de paiement vous est envoyé par Stripe.
          </p>
        </div>
      )}

      {billingError === "portal" && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-display text-sm font-bold text-amber-800">
            La gestion d&apos;abonnement est momentanément indisponible
          </h2>
          <p className="mt-1 text-sm text-amber-700">
            Veuillez réessayer dans quelques instants. Si le problème persiste,
            écrivez-nous à{" "}
            <a
              href="mailto:contact@escalebox.fr"
              className="font-semibold underline"
            >
              contact@escalebox.fr
            </a>
            .
          </p>
          {msg && isEffectiveAdmin(host) && (
            <>
              <pre className="mt-3 max-w-full overflow-x-auto rounded-lg bg-amber-100 p-3 text-xs text-amber-900">
                {msg}
              </pre>
              {msg.includes("No such customer") && (
                <form action={resetStripeIdentifiers} className="mt-3">
                  <button
                    type="submit"
                    className="rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                  >
                    Réinitialiser mes identifiants Stripe (admin)
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}

      {/* Status cards */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Card title="Abonnement">
          {subscribed ? (
            <>
              <Badge ok>{plan ? plan.name : "Actif"}</Badge>
              <p className="mt-2 text-sm text-brand/60">
                {boxes.length} / {limit} logement(s) utilisé(s).
              </p>
              <form action={openBillingPortal} className="mt-4">
                <SmallButton>Gérer mon abonnement</SmallButton>
              </form>
            </>
          ) : (
            <>
              <Badge>Aucun abonnement actif</Badge>
              <p className="mt-2 text-sm text-brand/60">
                Choisissez une formule pour activer vos box.
              </p>
              <Link
                href="/host/billing"
                className="mt-4 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark"
              >
                Choisir une formule
              </Link>
            </>
          )}
        </Card>

        <Card title="Paiements (versements)">
          {host.chargesEnabled ? (
            <>
              <Badge ok>Activés</Badge>
              <p className="mt-2 text-sm text-brand/60">
                Vos ventes sont versées directement sur votre compte.
              </p>
            </>
          ) : (
            <>
              <Badge>À configurer</Badge>
              <p className="mt-2 text-sm text-brand/60">
                Connectez votre compte pour recevoir l&apos;argent de vos ventes.
              </p>
              <form action={connectOnboard} className="mt-4">
                <SmallButton>Configurer les paiements</SmallButton>
              </form>
            </>
          )}
        </Card>
      </div>

      {/* Boxes */}
      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-brand">
          Mes box{" "}
          {subscribed && (
            <span className="ml-1 text-sm font-medium text-brand/40">
              {boxes.length}/{limit}
            </span>
          )}
        </h2>
        <p className="text-xs text-brand/40">
          Cliquez sur une box pour la renommer ou y attribuer un produit
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {boxes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-brand/50 sm:col-span-2">
            {subscribed
              ? "Vos box seront créées automatiquement. Rechargez la page si elles n'apparaissent pas."
              : "Activez un abonnement pour recevoir vos box."}
          </p>
        ) : (
          boxes.map((box) => (
            <div
              key={box.id}
              className={`group relative rounded-2xl border p-5 shadow-card transition hover:shadow-md ${
                box.active
                  ? "border-black/5 bg-white hover:border-accent/40"
                  : "border-red-200 bg-red-50/40 opacity-80 hover:border-red-300"
              }`}
            >
              {/* Toute la carte est cliquable → gestion de la box */}
              <Link
                href={`/host/boxes/${box.id}`}
                aria-label={`Gérer ${box.name}`}
                className="absolute inset-0 rounded-2xl"
              />
              {!box.active ? (
                <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                  Désactivée
                </span>
              ) : !box.selectedProduct ? (
                <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  {box._count.orders > 0 ? "Vide" : "Disponible"}
                </span>
              ) : null}
              <div className="pointer-events-none flex items-center gap-4">
                <Image
                  src="/escale-box-logo.png"
                  alt=""
                  width={56}
                  height={56}
                  className="h-12 w-12 shrink-0 object-contain"
                />
                <div className="min-w-0">
                  <div className="truncate font-display font-bold text-brand">
                    {box.name}
                  </div>
                  {box.location && (
                    <div className="truncate text-sm text-brand/50">
                      {box.location}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-brand/40">
                    {!box.active
                      ? "Désactivée — cliquez pour réactiver"
                      : box.selectedProduct
                        ? `Article : ${box.selectedProduct.name}`
                        : box._count.orders > 0
                          ? "Vide — cliquez pour réattribuer un produit"
                          : "À attribuer — cliquez pour configurer"}
                  </div>
                </div>
                <span className="ml-auto shrink-0 text-brand/30 transition group-hover:text-accent">
                  →
                </span>
              </div>
              {/* Scans / ventes / conversion */}
              <div className="pointer-events-none mt-3 flex gap-2 text-xs">
                <span className="rounded-full bg-brand/5 px-2.5 py-1 font-medium text-brand/70">
                  👁️ {box._count.scans} scan{box._count.scans > 1 ? "s" : ""}
                </span>
                <span className="rounded-full bg-green-100 px-2.5 py-1 font-medium text-green-700">
                  🛒 {box._count.orders} vente{box._count.orders > 1 ? "s" : ""}
                </span>
                {box._count.scans > 0 && (
                  <span className="rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent-dark">
                    {Math.round((box._count.orders / box._count.scans) * 100)}% conv.
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {!subscribed && (
        <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-4 text-center text-sm text-brand/60">
          Activez un abonnement pour recevoir vos box.{" "}
          <Link href="/host/billing" className="font-semibold text-accent">
            Voir les formules
          </Link>
        </p>
      )}
    </HostShell>
  );
}

/* --------------------------------------------------------------- UI bits */

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-card">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-brand/40">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Badge({
  children,
  ok,
}: {
  children: React.ReactNode;
  ok?: boolean;
}) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
        ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {children}
    </span>
  );
}

function SmallButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-black/5"
    >
      {children}
    </button>
  );
}
