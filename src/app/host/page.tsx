import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { getPlan, maxBoxesFor } from "@/lib/plans";
import { isAdminEmail } from "@/lib/admin";
import { HostShell } from "./HostShell";
import { createBox, deleteBox } from "./box-actions";
import {
  connectOnboard,
  openBillingPortal,
  refreshConnectStatus,
  refreshSubscriptionStatus,
  syncSubscriptionFromCheckout,
} from "./billing-actions";

export const dynamic = "force-dynamic";

export default async function HostDashboard({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  let host = await getCurrentHost();
  if (!host) redirect("/host/login");

  // Reconcile state after Stripe redirects.
  const { session_id } = await searchParams;
  if (session_id) {
    await syncSubscriptionFromCheckout(session_id);
  }
  await refreshSubscriptionStatus();
  await refreshConnectStatus();
  host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const boxes = await prisma.box.findMany({
    where: { hostId: host.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { products: true } } },
  });

  const plan = getPlan(host.subscriptionPlan);
  const subscribed =
    host.subscriptionStatus === "active" ||
    host.subscriptionStatus === "trialing";
  const limit = maxBoxesFor(host.subscriptionPlan);
  const canCreate = subscribed && boxes.length < limit;

  return (
    <HostShell hostName={host.name}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-brand">
          Bonjour {host.name.split(" ")[0]} 👋
        </h1>
        {isAdminEmail(host.email) && (
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
        <h2 className="font-display text-xl font-bold text-brand">Mes box</h2>
      </div>

      <div className="mt-4 space-y-3">
        {boxes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-brand/50">
            Aucune box pour le moment.
          </p>
        ) : (
          boxes.map((box) => (
            <div
              key={box.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-card"
            >
              <div>
                <div className="font-semibold text-brand">{box.name}</div>
                {box.location && (
                  <div className="text-sm text-brand/50">{box.location}</div>
                )}
                <div className="mt-1 text-xs text-brand/40">
                  {box._count.products} produit(s) ·{" "}
                  <Link
                    href={`/b/${box.qrSlug}`}
                    className="text-accent hover:underline"
                  >
                    /b/{box.qrSlug}
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/host/boxes/${box.id}`}
                  className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  Gérer les produits
                </Link>
                <form action={deleteBox}>
                  <input type="hidden" name="boxId" value={box.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create box */}
      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6 shadow-card">
        <h3 className="font-display font-bold text-brand">Ajouter une box</h3>
        {canCreate ? (
          <form action={createBox} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              name="name"
              placeholder="Nom du logement (ex. Appartement Bellecour)"
              required
              className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
            <input
              name="location"
              placeholder="Ville / adresse (optionnel)"
              className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 font-semibold text-white transition hover:bg-accent-dark"
            >
              Créer
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-brand/60">
            {subscribed
              ? `Votre formule ${plan?.name ?? ""} autorise ${limit} logement(s). `
              : "Activez un abonnement pour créer vos box. "}
            <Link href="/host/billing" className="font-semibold text-accent">
              Voir les formules
            </Link>
          </p>
        )}
      </div>
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
