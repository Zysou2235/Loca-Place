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

  const [scans, orders, boxes, allHosts, allBoxes] = await Promise.all([
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
  ]);

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
  const scans7d = scans.filter((s) => s.createdAt >= since7d).length;
  const totalRevenue = orders.reduce((n, o) => n + o.amountCents, 0);
  const avgBasket = orders.length ? Math.round(totalRevenue / orders.length) : 0;
  const conversion = scans.length
    ? Math.round((orders.length / scans.length) * 1000) / 10
    : 0;
  const durations = scans.filter((s) => s.durationMs != null);
  const avgDuration = durations.length
    ? durations.reduce((n, s) => n + (s.durationMs ?? 0), 0) / durations.length
    : null;
  const codesSent = orders.filter((o) => o.codeSent).length;

  /* ---- Par jour (30 j) */
  const byDay = new Map<string, { scans: number; orders: number }>();
  for (let i = 29; i >= 0; i--) {
    byDay.set(dayKey(new Date(Date.now() - i * 24 * 3600 * 1000)), {
      scans: 0,
      orders: 0,
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
    if (e) e.orders++;
  }
  const dayRows = [...byDay.entries()];
  const maxDayScans = Math.max(1, ...dayRows.map(([, v]) => v.scans));

  /* ---- Par heure de la journée (pourquoi ça scanne : à quel moment) */
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const s of scans) byHour[s.createdAt.getHours()]++;
  const maxHour = Math.max(1, ...byHour);

  /* ---- Appareils, provenance, paiement */
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
            : "Tout ce que la plateforme mesure : scans, temps passé, appareils, provenance, paiements, conversion."}{" "}
          ({scans.length.toLocaleString("fr-FR")} scan
          {scans.length > 1 ? "s" : ""} analysé{scans.length > 1 ? "s" : ""}.)
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

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Scans (total)" value={scans.length.toLocaleString("fr-FR")} />
          <Stat label="Scans (7 jours)" value={scans7d.toLocaleString("fr-FR")} />
          <Stat label="Ventes" value={orders.length.toLocaleString("fr-FR")} />
          <Stat label="Conversion" value={`${conversion}%`} />
          <Stat label="CA voyageurs" value={formatPrice(totalRevenue, "eur")} />
          <Stat label="Panier moyen" value={formatPrice(avgBasket, "eur")} />
          <Stat
            label="Temps moyen sur page"
            value={avgDuration != null ? fmtDuration(avgDuration) : "—"}
            hint={
              avgDuration == null
                ? "Se remplit dès les premiers scans après déploiement"
                : `${durations.length} visites mesurées`
            }
          />
          <Stat
            label="Codes délivrés"
            value={`${codesSent}/${orders.length}`}
            hint="Emails/SMS envoyés après paiement"
          />
        </div>

        {/* Activité par jour */}
        <Section title="Activité — 30 derniers jours">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 text-xs text-brand/40">
              <tr>
                <th className="py-2 pr-3 font-medium">Jour</th>
                <th className="py-2 pr-3 font-medium">Scans</th>
                <th className="w-1/2 py-2 pr-3 font-medium"></th>
                <th className="py-2 pr-3 font-medium">Ventes</th>
                <th className="py-2 font-medium">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {dayRows.map(([day, v]) => (
                <tr key={day} className="border-b border-black/5 last:border-0">
                  <td className="py-1.5 pr-3 text-brand/70">
                    {new Date(day).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </td>
                  <td className="py-1.5 pr-3 font-medium text-brand">{v.scans}</td>
                  <td className="py-1.5 pr-3">
                    <Bar value={v.scans} max={maxDayScans} />
                  </td>
                  <td className="py-1.5 pr-3">{v.orders}</td>
                  <td className="py-1.5 text-brand/60">
                    {v.scans ? Math.round((v.orders / v.scans) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Heures de scan */}
        <Section
          title="À quelle heure les voyageurs scannent"
          subtitle="Distribution des scans par heure de la journée — utile pour comprendre les pics (arrivées, soirées…)."
        >
          <table className="w-full text-left text-sm">
            <tbody>
              {byHour.map((n, h) => (
                <tr key={h}>
                  <td className="w-16 py-1 pr-3 text-brand/60">{h}h</td>
                  <td className="w-10 py-1 pr-3 font-medium text-brand">{n}</td>
                  <td className="py-1">
                    <Bar value={n} max={maxHour} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <BreakdownCard title="Appareils" rows={devices} total={scans.length} />
          <BreakdownCard title="Provenance" rows={referers} total={scans.length} />
          <BreakdownCard
            title="Moyens de paiement"
            rows={payments}
            total={orders.length}
            empty="Aucune vente pour l'instant"
          />
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

        {/* Derniers scans en détail */}
        <Section
          title="Derniers scans (détail)"
          subtitle="Chaque visite de page voyageur : produit présenté, temps passé, appareil."
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 text-xs text-brand/40">
              <tr>
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Box</th>
                <th className="py-2 pr-4 font-medium">Produit présenté</th>
                <th className="py-2 pr-4 font-medium">Temps passé</th>
                <th className="py-2 font-medium">Appareil</th>
              </tr>
            </thead>
            <tbody>
              {recentScans.map((s) => (
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
                  <td className="py-2 text-brand/60">{deviceOf(s.userAgent)}</td>
                </tr>
              ))}
              {recentScans.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-brand/40">
                    Aucun scan pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        <p className="mt-8 text-xs text-brand/40">
          Le « temps passé » est mesuré à partir de maintenant (beacon envoyé
          quand le voyageur quitte la page) — les scans antérieurs au
          déploiement n&apos;en ont pas. Voir aussi{" "}
          <Link href="/admin/stats" className="text-accent hover:underline">
            Statistiques
          </Link>{" "}
          pour les courbes de CA.
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
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand/40">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-extrabold text-brand">
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
      <div
        className="h-2 rounded-full bg-accent"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  total,
  empty,
}: {
  title: string;
  rows: [string, number][];
  total: number;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-card">
      <h2 className="font-display font-bold text-brand">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-brand/40">{empty ?? "Aucune donnée"}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.slice(0, 8).map(([label, n]) => (
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
