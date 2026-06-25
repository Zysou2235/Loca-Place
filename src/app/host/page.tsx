import Link from "next/link";
import Image from "next/image";
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
    include: {
      selectedProduct: { select: { name: true } },
      _count: { select: { scans: true, orders: true } },
    },
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

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {boxes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-brand/50 sm:col-span-2">
            Aucune box pour le moment.
          </p>
        ) : (
          boxes.map((box) => (
            <div
              key={box.id}
              className="group relative rounded-2xl border border-black/5 bg-white p-5 shadow-card transition hover:border-accent/40 hover:shadow-md"
            >
              {/* Toute la carte est cliquable → gestion de la box */}
              <Link
                href={`/host/boxes/${box.id}`}
                aria-label={`Gérer ${box.name}`}
                className="absolute inset-0 rounded-2xl"
              />
              <div className="pointer-events-none flex items-center gap-4">
                <Image
                  src="/eskale-box-logo.png"
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
                    {box.selectedProduct
                      ? `Article : ${box.selectedProduct.name}`
                      : "Aucun article sélectionné"}
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
              {/* Supprimer — au-dessus du lien */}
              <form
                action={deleteBox}
                className="relative z-10 mt-3 flex justify-end border-t border-black/5 pt-3"
              >
                <input type="hidden" name="boxId" value={box.id} />
                <button
                  type="submit"
                  className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Supprimer
                </button>
              </form>
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
