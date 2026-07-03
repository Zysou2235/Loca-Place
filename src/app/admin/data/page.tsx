import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { formatPrice } from "@/lib/money";
import { AdminNav } from "../AdminNav";
import { DataFilters } from "./DataFilters";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------- helpers */

function deviceOf(ua: string | null): string {
  if (!ua) return "Inconnu";
  if (/iPhone|iPod/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android.*Mobile/i.test(ua)) return "Android";
  if (/Android/i.test(ua)) return "Tablette Android";
  if (/Windows|Macintosh|Linux/i.test(ua)) return "Ordinateur";
  return "Autre";
}

function refererOf(ref: string | null): string {
  if (!ref) return "Direct (scan QR)";
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    if (/escalebox|localhost/.test(host)) return "Navigation interne";
    return host;
  } catch {
    return "Autre";
  }
}

const PAYMENT_LABELS: Record<string, string> = {
  card: "Carte bancaire",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  link: "Stripe Link",
};

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}min ${s % 60}s`;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- page */

export default async function AdminDataPage({
  searchParams,
}: {
  searchParams: Promise<{ host?: string; box?: string }>;
}) {
  await requireAdmin();

  const { host: hostFilter = "", box: boxFilter = "" } = await searchParams;

  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const since14d = new Date(Date.now() - 14 * 24 * 3600 * 1000);

  // Périmètre : tout, un hôte, ou une box précise.
  const scanWhere = boxFilter
    ? { boxId: boxFilter }
    : hostFilter
      ? { box: { hostId: hostFilter } }
      : {};
  const boxWhere = boxFilter
    ? { id: boxFilter }
    : hostFilter
      ? { hostId: hostFilter }
      : {};

  const [scans, orders, boxes, allHosts, allBoxes, leads] = await Promise.all([
    prisma.scan.findMany({
      where: scanWhere,
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: {
        box: { select: { name: true, host: { select: { name: true, isTestAccount: true } } } },
      },
    }),
    prisma.order.findMany({
      where: scanWhere,
      orderBy: { createdAt: "desc" },
      take: 2000,
      include: { box: { select: { name: true, host: { select: { name: true } } } } },
    }),
    prisma.box.findMany({
      where: boxWhere,
      include: {
        host: { select: { name: true, isTestAccount: true } },
        _count: { select: { scans: true, orders: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Options des filtres — uniquement ce qui a au moins une box.
    prisma.host.findMany({
      where: { boxes: { some: {} } },
      select: { id: true, name: true, email: true, isTestAccount: true },
      orderBy: { name: "asc" },
    }),
    prisma.box.findMany({
      select: {
        id: true,
        name: true,
        hostId: true,
        host: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Opt-ins — pas de filtre de périmètre ici : un visiteur identifié via une
    // autre box reste identifié (c'est la même personne). boxId sert juste au
    // calcul du taux de captation scopé plus bas.
    prisma.lead.findMany({
      select: { email: true, visitorHash: true, boxId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  /* ---- Identité & récurrence des visiteurs (empreinte anonyme) */
  const visitCount = new Map<string, number>();
  for (const s of scans) {
    if (s.visitorHash) {
      visitCount.set(s.visitorHash, (visitCount.get(s.visitorHash) ?? 0) + 1);
    }
  }
  const identity = new Map<string, { email: string; phone?: string | null }>();
  for (const o of orders) {
    if (o.visitorHash && o.customerEmail && !identity.has(o.visitorHash)) {
      identity.set(o.visitorHash, {
        email: o.customerEmail,
        phone: o.customerPhone,
      });
    }
  }
  for (const l of leads) {
    if (l.visitorHash && !identity.has(l.visitorHash)) {
      identity.set(l.visitorHash, { email: l.email });
    }
  }
  const uniqueVisitors = visitCount.size;
  const returningVisitors = [...visitCount.values()].filter((n) => n > 1).length;
  const identifiedVisitors = [...visitCount.keys()].filter((h) =>
    identity.has(h)
  ).length;

  // Taux de captation email, scopé au périmètre courant (boxes filtrées).
  // Plafonné à 100% pour l'affichage : en pratique un lead peut exister sans
  // scan compté en face (rate-limit sur l'enregistrement des scans, données
  // anciennes sans empreinte) — le ratio brut peut dépasser 100% sans que ce
  // soit un vrai signal, ça brouillerait juste la lecture.
  const boxIdsInScope = new Set(boxes.map((b) => b.id));
  const leadsInScope = leads.filter((l) => boxIdsInScope.has(l.boxId)).length;
  const captureRate = uniqueVisitors
    ? Math.min(100, Math.round((leadsInScope / uniqueVisitors) * 100))
    : 0;

  const filteredHost = hostFilter
    ? allHosts.find((h) => h.id === hostFilter)
    : null;
  const filteredBox = boxFilter
    ? allBoxes.find((b) => b.id === boxFilter)
    : null;
  const scopeLabel = filteredBox
    ? `${filteredBox.name} (${filteredBox.host.name})`
    : filteredHost
      ? `${filteredHost.name} — toutes ses box`
      : null;

  /* ---- KPIs globaux */
  const totalRevenue = orders.reduce((n, o) => n + o.amountCents, 0);
  const avgBasket = orders.length ? Math.round(totalRevenue / orders.length) : 0;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthRevenue = orders
    .filter((o) => o.createdAt >= monthStart)
    .reduce((n, o) => n + o.amountCents, 0);
  const conversion = scans.length
    ? Math.round((orders.length / scans.length) * 1000) / 10
    : 0;
  const durations = scans.filter((s) => s.durationMs != null);
  const avgDuration = durations.length
    ? durations.reduce((n, s) => n + (s.durationMs ?? 0), 0) / durations.length
    : null;
  const codesSent = orders.filter((o) => o.codeSent).length;

  /* ---- Tendance : scans/jour sur 14 j (comparaison 7 j vs 7 j précédents) */
  const byDay = new Map<
    string,
    { scans: number; orders: number; revenueCents: number }
  >();
  for (let i = 29; i >= 0; i--) {
    byDay.set(dayKey(new Date(Date.now() - i * 24 * 3600 * 1000)), {
      scans: 0,
      orders: 0,
      revenueCents: 0,
    });
  }
  for (const s of scans) {
    if (s.createdAt < since30d) continue;
    const e = byDay.get(dayKey(s.createdAt));
    if (e) e.scans++;
  }
  for (const o of orders) {
    if (o.createdAt < since30d) continue;
    const e = byDay.get(dayKey(o.createdAt));
    if (e) {
      e.orders++;
      e.revenueCents += o.amountCents;
    }
  }
  const dayRows = [...byDay.entries()].slice(-14); // 14 derniers jours pour le graphique
  const maxDayScans = Math.max(1, ...dayRows.map(([, v]) => v.scans));
  const scans7d = scans.filter((s) => s.createdAt >= since7d).length;
  const scansPrev7d = scans.filter(
    (s) => s.createdAt >= since14d && s.createdAt < since7d
  ).length;
  const scansTrend =
    scansPrev7d > 0
      ? Math.round(((scans7d - scansPrev7d) / scansPrev7d) * 100)
      : null;

  /* ---- Par heure de la journée */
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const s of scans) byHour[s.createdAt.getHours()]++;
  const maxHour = Math.max(1, ...byHour);
  const peakHour = byHour.indexOf(Math.max(...byHour));

  /* ---- Répartitions secondaires */
  const count = (list: string[]) => {
    const m = new Map<string, number>();
    for (const k of list) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const devices = count(scans.map((s) => deviceOf(s.userAgent)));
  const referers = count(scans.map((s) => refererOf(s.referer)));
  const payments = count(
    orders.map((o) => PAYMENT_LABELS[o.paymentMethod ?? ""] ?? o.paymentMethod ?? "Non renseigné")
  );
  const topProducts = count(orders.map((o) => o.productName));
  const locations = count(
    scans.map((s) =>
      s.country ? (s.city ? `${s.city}, ${s.country}` : s.country) : "Non localisé"
    )
  );
  const langName = new Intl.DisplayNames(["fr"], { type: "language" });
  const languages = count(
    scans.map((s) => {
      if (!s.lang) return "Inconnue";
      const base = s.lang.split("-")[0]!.toLowerCase();
      try {
        const label = langName.of(base);
        return label ? label.charAt(0).toUpperCase() + label.slice(1) : s.lang;
      } catch {
        return s.lang;
      }
    })
  );

  /* ---- Par box (activité) */
  const boxRows = boxes
    .map((b) => {
      const revenue = orders
        .filter((o) => o.boxId === b.id)
        .reduce((n, o) => n + o.amountCents, 0);
      return {
        id: b.id,
        name: b.name,
        hostId: b.hostId,
        host: b.host.name,
        isTest: b.host.isTestAccount,
        active: b.active,
        scans: b._count.scans,
        orders: b._count.orders,
        revenue,
        conv: b._count.scans
          ? Math.round((b._count.orders / b._count.scans) * 100)
          : 0,
      };
    })
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 25);

  /* ---- Derniers scans (détail) */
  const recentScans = scans.slice(0, 30);

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav current="/admin/data" />

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-2xl font-bold text-brand">
          Données
          {scopeLabel && (
            <span className="ml-2 align-middle text-base font-medium text-brand/50">
              — {scopeLabel}
            </span>
          )}
        </h1>
        <p className="mt-1 text-brand/60">
          {scopeLabel
            ? "Analyse limitée au périmètre sélectionné."
            : "L'essentiel pour piloter le business, puis les détails si besoin."}
        </p>

        <DataFilters
          hosts={allHosts.map((h) => ({
            id: h.id,
            name: h.name,
            email: h.email,
            isTest: h.isTestAccount,
          }))}
          boxes={allBoxes.map((b) => ({
            id: b.id,
            name: b.name,
            hostId: b.hostId,
            hostName: b.host.name,
          }))}
          currentHost={hostFilter}
          currentBox={boxFilter}
        />

        {/* ============================================ L'ESSENTIEL */}
        <h2 className="mt-8 text-xs font-bold uppercase tracking-wide text-brand/40">
          L&apos;essentiel
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            big
            label="Chiffre d'affaires"
            value={formatPrice(totalRevenue, "eur")}
            hint={`dont ${formatPrice(monthRevenue, "eur")} ce mois-ci`}
          />
          <Stat big label="Ventes" value={orders.length.toLocaleString("fr-FR")} />
          <Stat
            big
            label="Conversion"
            value={`${conversion}%`}
            hint="scans → achat"
          />
          <Stat big label="Panier moyen" value={formatPrice(avgBasket, "eur")} />
        </div>

        {/* ============================================ VOS CLIENTS */}
        <h2 className="mt-8 text-xs font-bold uppercase tracking-wide text-brand/40">
          Vos clients (marketing)
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Visiteurs uniques"
            value={uniqueVisitors.toLocaleString("fr-FR")}
            hint={
              uniqueVisitors
                ? `${Math.round((returningVisitors / uniqueVisitors) * 100)}% reviennent`
                : undefined
            }
          />
          <Stat
            label="Emails captés"
            value={leadsInScope.toLocaleString("fr-FR")}
            hint={`${captureRate}% des visiteurs uniques`}
          />
          <Stat
            label="Visiteurs identifiés"
            value={identifiedVisitors.toLocaleString("fr-FR")}
            hint="email connu (achat ou opt-in)"
          />
          <div className="rounded-2xl border border-dashed border-accent/30 bg-accent/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand/40">
              Fichier client
            </div>
            <Link
              href="/admin/clients"
              className="mt-1 inline-block font-display text-lg font-bold text-accent hover:underline"
            >
              Voir &amp; exporter →
            </Link>
            <div className="mt-0.5 text-xs text-brand/40">
              Base pour vos sondages post-séjour
            </div>
          </div>
        </div>

        {/* ============================================ TENDANCE */}
        <Section
          title="Tendance — scans des 14 derniers jours"
          subtitle={
            scansTrend != null
              ? `${scans7d} scans cette semaine, ${scansTrend >= 0 ? "+" : ""}${scansTrend}% vs la semaine précédente.`
              : `${scans7d} scans cette semaine.`
          }
        >
          <TrendChart data={dayRows} max={maxDayScans} />
        </Section>

        {/* ============================================ CE QUI SE VEND */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <BreakdownCard
            title="Produits les plus vendus"
            rows={topProducts}
            total={orders.length}
            empty="Aucune vente pour l'instant"
          />
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-card">
            <h2 className="font-display font-bold text-brand">
              Moyens de paiement
            </h2>
            {payments.length === 0 ? (
              <p className="mt-4 text-sm text-brand/40">
                Aucune vente pour l&apos;instant
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {payments.map(([label, n]) => (
                  <li key={label} className="flex items-baseline justify-between text-sm">
                    <span className="text-brand/80">{label}</span>
                    <span className="font-medium text-brand">
                      {n}{" "}
                      <span className="text-xs text-brand/40">
                        ({Math.round((n / orders.length) * 100)}%)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Par box */}
        <Section
          title="Activité par box"
          subtitle="Triées par nombre de scans — cliquez sur une box ou un hôte pour filtrer toute la page sur ce périmètre."
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 text-xs text-brand/40">
              <tr>
                <th className="py-2 pr-4 font-medium">Box</th>
                <th className="py-2 pr-4 font-medium">Hôte</th>
                <th className="py-2 pr-4 font-medium">Scans</th>
                <th className="py-2 pr-4 font-medium">Ventes</th>
                <th className="py-2 pr-4 font-medium">Conv.</th>
                <th className="py-2 font-medium">CA</th>
              </tr>
            </thead>
            <tbody>
              {boxRows.map((b) => (
                <tr key={b.id} className="border-b border-black/5 last:border-0">
                  <td className="py-2 pr-4 font-medium">
                    <Link
                      href={`/admin/data?host=${b.hostId}&box=${b.id}`}
                      className="text-brand hover:text-accent hover:underline"
                    >
                      {b.name}
                    </Link>
                    {b.isTest && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                        test
                      </span>
                    )}
                    {!b.active && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                        off
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/data?host=${b.hostId}`}
                      className="text-brand/70 hover:text-accent hover:underline"
                    >
                      {b.host}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{b.scans}</td>
                  <td className="py-2 pr-4">{b.orders}</td>
                  <td className="py-2 pr-4 text-brand/60">{b.conv}%</td>
                  <td className="py-2">{formatPrice(b.revenue, "eur")}</td>
                </tr>
              ))}
              {boxRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-brand/40">
                    Aucune box dans ce périmètre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        {/* ============================================ DÉTAILS (repliés) */}
        <details className="mt-8 rounded-2xl border border-black/5 bg-white shadow-card">
          <summary className="cursor-pointer select-none px-6 py-4 font-display font-bold text-brand/70 hover:text-brand">
            Détails visiteurs &amp; technique — appareils, provenance,
            localisation, horaires, santé des envois
          </summary>
          <div className="space-y-8 border-t border-black/5 px-6 py-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Temps moyen sur page"
                value={avgDuration != null ? fmtDuration(avgDuration) : "—"}
                hint={
                  avgDuration == null
                    ? "Se remplit avec les scans"
                    : `${durations.length} visites mesurées`
                }
              />
              <Stat
                label="Codes délivrés"
                value={`${codesSent}/${orders.length}`}
                hint="emails/SMS envoyés après paiement"
              />
              <Stat
                label="Heure de pointe"
                value={orders.length || scans.length ? `${peakHour}h` : "—"}
                hint="pic de scans dans la journée"
              />
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand/40">
                Scans par heure de la journée
              </h3>
              <HourSparkline data={byHour} max={maxHour} />
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <BreakdownCard title="Localisation" rows={locations} total={scans.length} compact />
              <BreakdownCard title="Langues" rows={languages} total={scans.length} compact />
              <BreakdownCard title="Appareils" rows={devices} total={scans.length} compact />
              <BreakdownCard title="Provenance" rows={referers} total={scans.length} compact />
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand/40">
                Derniers scans (journal)
              </h3>
              <p className="mt-0.5 text-xs text-brand/50">
                Chaque visite en détail — utile pour du débogage ou du support
                ponctuel, pas pour le pilotage quotidien.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-black/5 text-xs text-brand/40">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Box</th>
                      <th className="py-2 pr-4 font-medium">Produit présenté</th>
                      <th className="py-2 pr-4 font-medium">Temps</th>
                      <th className="py-2 pr-4 font-medium">Appareil</th>
                      <th className="py-2 pr-4 font-medium">Localisation</th>
                      <th className="py-2 pr-4 font-medium">Langue</th>
                      <th className="py-2 font-medium">Visiteur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentScans.map((s) => {
                      const visits = s.visitorHash
                        ? (visitCount.get(s.visitorHash) ?? 1)
                        : 1;
                      const who = s.visitorHash ? identity.get(s.visitorHash) : null;
                      return (
                        <tr key={s.id} className="border-b border-black/5 last:border-0">
                          <td className="py-2 pr-4 text-brand/70">
                            {s.createdAt.toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2 pr-4 font-medium text-brand">{s.box.name}</td>
                          <td className="py-2 pr-4 text-brand/70">
                            {s.productName ?? "Aucun article"}
                          </td>
                          <td className="py-2 pr-4">
                            {s.durationMs != null ? fmtDuration(s.durationMs) : "—"}
                          </td>
                          <td className="py-2 pr-4 text-brand/60">{deviceOf(s.userAgent)}</td>
                          <td className="py-2 pr-4 text-brand/60">
                            {s.country
                              ? s.city
                                ? `${s.city}, ${s.country}`
                                : s.country
                              : "—"}
                          </td>
                          <td className="py-2 pr-4 text-brand/60">
                            {s.lang ? s.lang.split("-")[0]!.toUpperCase() : "—"}
                          </td>
                          <td className="py-2">
                            {who ? (
                              <div>
                                <div className="font-medium text-brand">{who.email}</div>
                                {who.phone && (
                                  <div className="text-xs text-brand/40">{who.phone}</div>
                                )}
                              </div>
                            ) : s.visitorHash ? (
                              <span className="font-mono text-xs text-brand/40">
                                {s.visitorHash.slice(0, 6)}
                              </span>
                            ) : (
                              "—"
                            )}
                            {visits > 1 && (
                              <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent-dark">
                                ×{visits} visites
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {recentScans.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-brand/40">
                          Aucun scan pour l&apos;instant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </details>

        <p className="mt-8 text-xs text-brand/40">
          Temps passé, localisation, langue et empreinte visiteur sont mesurés
          à partir de maintenant — les scans antérieurs au déploiement
          n&apos;en ont pas. La localisation (pays/ville) est dérivée de
          l&apos;IP puis l&apos;IP est jetée ; l&apos;empreinte visiteur est un
          hash anonyme et l&apos;identité n&apos;apparaît que si la personne a
          acheté ou laissé son email. Données personnelles réservées à
          l&apos;admin — à couvrir dans la politique de confidentialité.
        </p>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------ UI bits */

function Stat({
  label,
  value,
  hint,
  big,
}: {
  label: string;
  value: string;
  hint?: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand/40">
        {label}
      </div>
      <div
        className={`mt-1 font-display font-extrabold text-brand ${big ? "text-3xl" : "text-2xl"}`}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-brand/40">{hint}</div>}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-black/5 bg-white p-6 shadow-card">
      <h2 className="font-display font-bold text-brand">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-brand/50">{subtitle}</p>}
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  );
}

/** Barre de magnitude mono-teinte (accent), fine, extrémité arrondie. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="h-2 w-full rounded-full bg-black/5">
      <div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

// Hauteur en pixels (pas en %) : un % de hauteur sur un enfant de flex-item
// ne se résout pas de façon fiable sans que le parent ait une hauteur figée
// à chaque niveau d'imbrication — plus simple et robuste de calculer en px.
const TREND_CHART_PX = 128;
const HOUR_CHART_PX = 64;

/** Graphique en barres verticales — tendance des scans sur 14 jours. */
function TrendChart({
  data,
  max,
}: {
  data: [string, { scans: number; orders: number; revenueCents: number }][];
  max: number;
}) {
  return (
    <div
      className="flex items-end gap-1.5 sm:gap-2"
      style={{ height: TREND_CHART_PX }}
    >
      {data.map(([day, v]) => {
        const heightPx = Math.max(
          3,
          Math.round((v.scans / max) * TREND_CHART_PX)
        );
        const label = new Date(day).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        });
        return (
          <div key={day} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              title={`${label} — ${v.scans} scan${v.scans > 1 ? "s" : ""}, ${v.orders} vente${v.orders > 1 ? "s" : ""}`}
              className={`w-full rounded-t transition ${
                v.orders > 0 ? "bg-accent" : "bg-brand/30"
              }`}
              style={{ height: heightPx }}
            />
            <span className="text-[9px] text-brand/40">{label.slice(0, 2)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 24 barres fines côte à côte — distribution des scans par heure. */
function HourSparkline({ data, max }: { data: number[]; max: number }) {
  return (
    <div
      className="mt-2 flex items-end gap-0.5"
      style={{ height: HOUR_CHART_PX }}
    >
      {data.map((n, h) => {
        const heightPx = Math.max(2, Math.round((n / max) * HOUR_CHART_PX));
        return (
          <div key={h} className="flex flex-1 flex-col items-center gap-1">
            <div
              title={`${h}h — ${n} scan${n > 1 ? "s" : ""}`}
              className="w-full rounded-t bg-accent/70"
              style={{ height: heightPx }}
            />
            {h % 4 === 0 && <span className="text-[9px] text-brand/30">{h}h</span>}
          </div>
        );
      })}
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  total,
  empty,
  compact,
}: {
  title: string;
  rows: [string, number][];
  total: number;
  empty?: string;
  compact?: boolean;
}) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-card">
      <h2 className="font-display font-bold text-brand">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-brand/40">{empty ?? "Aucune donnée"}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.slice(0, compact ? 5 : 8).map(([label, n]) => (
            <li key={label} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-brand/80">{label}</span>
                <span className="shrink-0 font-medium text-brand">
                  {n}
                  <span className="ml-1 text-xs text-brand/40">
                    ({total ? Math.round((n / total) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="mt-1">
                <Bar value={n} max={max} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
