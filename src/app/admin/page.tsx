import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import { requireAdmin } from "@/lib/admin";
import { logout } from "../host/auth-actions";
import {
  markBoxShipped,
  unmarkBoxShipped,
  setBoxShipping,
  verifyHostAccount,
  generateMondialRelayLabel,
} from "./actions";
import { GenerateCodeButton } from "./GenerateCodeButton";

export const dynamic = "force-dynamic";

function isActive(status: string) {
  return status === "active" || status === "trialing";
}

const ACTIVE_STATUSES = ["active", "trialing"];

type Filter = "tous" | "nouveaux" | "abonnes" | "a_expedier" | "expediees";

/** Construit le filtre Prisma à partir de l'onglet + recherche texte. */
function buildWhere(filter: Filter, q: string): Prisma.HostWhereInput {
  const and: Prisma.HostWhereInput[] = [];

  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (filter === "nouveaux") {
    and.push({ subscriptionStatus: { notIn: ACTIVE_STATUSES } });
  } else if (filter === "abonnes") {
    and.push({ subscriptionStatus: { in: ACTIVE_STATUSES } });
  } else if (filter === "a_expedier") {
    and.push({
      subscriptionStatus: { in: ACTIVE_STATUSES },
      boxes: { some: { shippedAt: null } },
    });
  } else if (filter === "expediees") {
    and.push({ boxes: { some: { shippedAt: { not: null } } } });
  }

  return and.length ? { AND: and } : {};
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const filters: Filter[] = [
    "tous",
    "nouveaux",
    "abonnes",
    "a_expedier",
    "expediees",
  ];
  const filter: Filter = filters.includes(sp.filter as Filter)
    ? (sp.filter as Filter)
    : "tous";

  // Compteurs par onglet (en tenant compte de la recherche en cours).
  const [cTous, cNouveaux, cAbonnes, cAExpedier, cExpediees] = await Promise.all(
    filters.map((f) => prisma.host.count({ where: buildWhere(f, q) }))
  );
  const counts: Record<Filter, number> = {
    tous: cTous,
    nouveaux: cNouveaux,
    abonnes: cAbonnes,
    a_expedier: cAExpedier,
    expediees: cExpediees,
  };

  const hosts = await prisma.host.findMany({
    where: buildWhere(filter, q),
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      boxes: {
        orderBy: { createdAt: "asc" },
        include: { selectedProduct: { select: { name: true } } },
      },
    },
  });

  const totalBoxes = hosts.reduce((n, h) => n + h.boxes.length, 0);
  const activeSubs = counts.abonnes;

  // KPIs société : MRR (revenu récurrent plateforme) + volume de ventes (GMV).
  const [activeHosts, gmvAgg] = await Promise.all([
    prisma.host.findMany({
      where: { subscriptionStatus: { in: ACTIVE_STATUSES } },
      select: { subscriptionPlan: true },
    }),
    prisma.order.aggregate({ _sum: { amountCents: true } }),
  ]);
  const mrrCents = activeHosts.reduce(
    (n, h) => n + (getPlan(h.subscriptionPlan)?.priceCents ?? 0),
    0
  );
  const gmvCents = gmvAgg._sum.amountCents ?? 0;

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <span className="font-display text-xl font-extrabold text-brand">
            Escale <span className="text-accent">Box</span>
            <span className="ml-2 align-middle text-xs font-medium text-red-500">
              admin
            </span>
          </span>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/host"
              className="rounded-full border border-black/10 px-3 py-1.5 font-medium text-brand/70 transition hover:bg-black/5"
            >
              ← Espace hôte
            </Link>
            <Link href="/admin" className="font-semibold text-brand">
              Comptes &amp; box
            </Link>
            <Link
              href="/admin/orders"
              className="font-medium text-brand/70 hover:text-brand"
            >
              Ventes
            </Link>
            <Link
              href="/admin/stats"
              className="font-medium text-brand/70 hover:text-brand"
            >
              Statistiques
            </Link>
            <form action={logout}>
              <button className="rounded-full border border-black/10 px-3 py-1.5 font-medium text-brand/70 transition hover:bg-black/5">
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-2xl font-bold text-brand">
          Administration
        </h1>
        <p className="mt-1 text-brand/60">
          Tous les comptes, abonnements et box de la plateforme.
        </p>

        {/* KPIs société */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Hôtes" value={counts.tous} />
          <Stat label="Abonnés actifs" value={activeSubs} />
          <Stat label="MRR (récurrent)" value={formatPrice(mrrCents)} />
          <Stat label="Volume de ventes" value={formatPrice(gmvCents)} />
        </div>
        <p className="mt-2 text-right text-xs text-brand/40">
          {totalBoxes} box affichées ·{" "}
          <a href="/admin/hosts/export" className="font-medium text-accent hover:underline">
            ⬇ Exporter les clients (CSV)
          </a>
        </p>

        {/* Recherche */}
        <form method="GET" className="mt-8 flex gap-2">
          <input type="hidden" name="filter" value={filter} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Rechercher un hôte : nom, email ou téléphone…"
            className="flex-1 rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="submit"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Rechercher
          </button>
          {q && (
            <Link
              href={`/admin?filter=${filter}`}
              className="rounded-full border border-black/10 px-4 py-2.5 text-sm font-medium text-brand/60 transition hover:bg-black/5"
            >
              Effacer
            </Link>
          )}
        </form>

        {/* Onglets de filtre */}
        <div className="mt-5 flex flex-wrap gap-2">
          <FilterTab current={filter} value="tous" label="Tous" count={counts.tous} q={q} />
          <FilterTab current={filter} value="nouveaux" label="Nouveaux comptes" count={counts.nouveaux} q={q} />
          <FilterTab current={filter} value="abonnes" label="Abonnés" count={counts.abonnes} q={q} />
          <FilterTab current={filter} value="a_expedier" label="À configurer / expédier" count={counts.a_expedier} q={q} />
          <FilterTab current={filter} value="expediees" label="Expédiées" count={counts.expediees} q={q} />
        </div>

        {/* Hosts */}
        <div className="mt-8 space-y-5">
          {hosts.length === 0 && (
            <p className="rounded-2xl border border-dashed border-black/10 bg-white p-8 text-center text-sm text-brand/50">
              Aucun hôte ne correspond à ce filtre{q ? " / cette recherche" : ""}.
            </p>
          )}
          {hosts.map((host) => {
            const plan = getPlan(host.subscriptionPlan);
            const active = isActive(host.subscriptionStatus);
            return (
              <div
                key={host.id}
                className="rounded-2xl border border-black/5 bg-white p-5 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-brand">
                      <Link
                        href={`/admin/hosts/${host.id}`}
                        className="hover:text-accent hover:underline"
                      >
                        {host.name}
                      </Link>
                      {host.emailVerified ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                          email vérifié
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          non vérifié
                        </span>
                      )}
                      {!host.emailVerified && (
                        <form action={verifyHostAccount}>
                          <input type="hidden" name="hostId" value={host.id} />
                          <button
                            type="submit"
                            className="rounded-full border border-green-300 px-2 py-0.5 text-[10px] font-semibold text-green-700 transition hover:bg-green-50"
                          >
                            ✓ Activer le compte
                          </button>
                        </form>
                      )}
                    </div>
                    <div className="text-sm text-brand/50">{host.email}</div>
                    {host.phone && (
                      <div className="text-sm text-brand/50">📞 {host.phone}</div>
                    )}
                    <div className="text-xs text-brand/40">
                      Inscrit le {host.createdAt.toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        active
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {active
                        ? `${plan?.name ?? "Actif"} · ${host.subscriptionStatus}`
                        : "Sans abonnement"}
                    </span>
                    <div className="mt-1 text-xs text-brand/40">
                      Paiements :{" "}
                      {host.chargesEnabled ? "activés" : "non configurés"}
                    </div>
                  </div>
                </div>

                {/* Boxes of this host */}
                <div className="mt-4 border-t border-black/5 pt-4">
                  {host.boxes.length === 0 ? (
                    <p className="text-sm text-brand/40">Aucune box.</p>
                  ) : (
                    <ul className="space-y-2">
                      {host.boxes.map((box) => (
                        <li
                          key={box.id}
                          className="rounded-xl bg-cream px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm">
                              <span className="font-medium text-brand">
                                {box.name}
                              </span>
                              <span className="text-brand/40">
                                {" "}
                                ·{" "}
                                {box.selectedProduct
                                  ? box.selectedProduct.name
                                  : "aucun article"}{" "}
                                · /b/{box.qrSlug}
                              </span>
                            </div>
                            <Link
                              href={`/admin/boxes/${box.id}/qr`}
                              className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
                            >
                              🖨️ QR à imprimer
                            </Link>
                          </div>

                          {/* Code de la boîte (obligatoire pour vendre) —
                              généré, jamais saisi à la main. Affiché en grisé
                              (lecture seule) pour ne pas l'effacer par erreur. */}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                box.accessCode ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {box.accessCode ? "Code défini ✓" : "⚠️ Code manquant"}
                            </span>
                            {box.accessCode && (
                              <span
                                title="Code du cadenas (lecture seule)"
                                className="cursor-not-allowed select-none rounded-lg border border-black/10 bg-black/5 px-3 py-1.5 font-mono text-sm font-bold tracking-widest text-brand/40"
                              >
                                {box.accessCode}
                              </span>
                            )}
                            {box.shippedAt ? (
                              <span className="text-xs text-brand/40">
                                🔒 Box expédiée — code verrouillé
                              </span>
                            ) : (
                              <GenerateCodeButton
                                boxId={box.id}
                                hasCode={!!box.accessCode}
                              />
                            )}
                          </div>

                          {/* Expédition — bloquée tant que le code n'est pas défini */}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {box.shippedAt ? (
                              <>
                                <span className="text-xs font-semibold text-green-600">
                                  📦 Expédiée le{" "}
                                  {box.shippedAt.toLocaleDateString("fr-FR")}
                                </span>
                                <form action={unmarkBoxShipped}>
                                  <input type="hidden" name="boxId" value={box.id} />
                                  <button
                                    type="submit"
                                    className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-brand/60 transition hover:bg-black/5"
                                  >
                                    Annuler l&apos;expédition
                                  </button>
                                </form>
                              </>
                            ) : box.accessCode ? (
                              <form action={markBoxShipped}>
                                <input type="hidden" name="boxId" value={box.id} />
                                <button
                                  type="submit"
                                  className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
                                >
                                  📦 Marquer comme expédiée
                                </button>
                              </form>
                            ) : (
                              <span
                                title="Définissez d'abord le code du cadenas"
                                className="cursor-not-allowed rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand/30"
                              >
                                📦 Expédition bloquée — code requis
                              </span>
                            )}
                          </div>

                          {/* Transporteur choisi + génération d'étiquette */}
                          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-black/5 pt-2">
                            <span className="text-xs text-brand/50">
                              🚚{" "}
                              {host.deliveryCarrier === "mondial_relay"
                                ? `Mondial Relay${host.deliveryRelayId ? ` · relais ${host.deliveryRelayId}` : ""}`
                                : host.deliveryCarrier === "dpd"
                                  ? "DPD (domicile)"
                                  : host.deliveryCarrier === "chronopost"
                                    ? "Chronopost (domicile)"
                                    : "Transporteur non choisi"}
                            </span>
                            {host.deliveryCarrier === "mondial_relay" && (
                              <form action={generateMondialRelayLabel}>
                                <input type="hidden" name="boxId" value={box.id} />
                                <button
                                  type="submit"
                                  className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-dark"
                                >
                                  🏷️ Générer l&apos;étiquette Mondial Relay
                                </button>
                              </form>
                            )}
                          </div>

                          {/* Expédition — saisie manuelle (repli si besoin) */}
                          <form
                            action={setBoxShipping}
                            className="mt-2 flex flex-wrap items-center gap-2 border-t border-black/5 pt-2"
                          >
                            <input type="hidden" name="boxId" value={box.id} />
                            <input
                              name="tracking"
                              defaultValue={box.shippingTrackingNumber ?? ""}
                              placeholder="N° de suivi"
                              className="w-36 rounded-lg border border-black/10 px-3 py-1.5 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                            />
                            <input
                              name="labelUrl"
                              defaultValue={box.shippingLabelUrl ?? ""}
                              placeholder="URL étiquette (https)"
                              className="w-48 rounded-lg border border-black/10 px-3 py-1.5 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                            />
                            <button
                              type="submit"
                              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-black/5"
                            >
                              Enregistrer le suivi
                            </button>
                            {box.shippingLabelUrl && (
                              <a
                                href={box.shippingLabelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
                              >
                                🏷️ Étiquette
                              </a>
                            )}
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function FilterTab({
  current,
  value,
  label,
  count,
  q,
}: {
  current: string;
  value: string;
  label: string;
  count: number;
  q: string;
}) {
  const active = current === value;
  const href = `/admin?filter=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-brand text-white"
          : "border border-black/10 bg-white text-brand/70 hover:bg-black/5"
      }`}
    >
      {label}
      <span
        className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
          active ? "bg-white/20" : "bg-black/5 text-brand/50"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 text-center shadow-card">
      <div className="font-display text-3xl font-extrabold text-brand">
        {value}
      </div>
      <div className="mt-1 text-sm text-brand/50">{label}</div>
    </div>
  );
}
