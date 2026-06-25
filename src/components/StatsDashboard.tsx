import { formatPrice } from "@/lib/money";
import type { SalesStats } from "@/lib/stats";

export function StatsDashboard({
  stats,
  currency = "eur",
  showByBox = true,
}: {
  stats: SalesStats;
  currency?: string;
  showByBox?: boolean;
}) {
  if (stats.count === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-brand/40">
        Aucune vente pour le moment. Les statistiques s&apos;afficheront ici dès
        la première commande.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Totaux & moyennes */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Chiffre d'affaires" value={formatPrice(stats.revenueCents, currency)} />
        <KpiCard label="Ventes" value={String(stats.count)} />
        <KpiCard label="Panier moyen" value={formatPrice(stats.avgCents, currency)} />
        <KpiCard
          label="Ce mois-ci"
          value={formatPrice(stats.thisMonthCents, currency)}
          hint={`${formatPrice(stats.last7Cents, currency)} sur 7 j`}
        />
      </div>

      {/* Évolution par période */}
      <Panel title="Évolution (14 derniers jours)">
        <div className="flex h-40 items-end gap-1.5">
          {stats.byDay.map((d) => (
            <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-accent/80 transition group-hover:bg-accent"
                  style={{
                    height: `${Math.max(
                      2,
                      (d.revenueCents / stats.maxDayCents) * 100,
                    )}%`,
                  }}
                  title={`${d.label} : ${formatPrice(d.revenueCents, currency)}`}
                />
              </div>
              <span className="text-[10px] text-brand/40">{d.label}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className={`grid gap-6 ${showByBox ? "lg:grid-cols-2" : ""}`}>
        {/* Top objets vendus */}
        <Panel title="Objets les plus vendus">
          <ul className="divide-y divide-black/5">
            {stats.topProducts.map((p, i) => (
              <li key={p.name} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/5 text-xs font-bold text-brand/60">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium text-brand">{p.name}</span>
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="font-semibold text-brand">{p.qty} vendu(s)</span>
                  <span className="ml-2 text-brand/50">
                    {formatPrice(p.revenueCents, currency)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Répartition par box */}
        {showByBox && (
          <Panel title="Répartition par box">
            <ul className="divide-y divide-black/5">
              {stats.byBox.map((b) => (
                <li key={b.name} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate font-medium text-brand">{b.name}</span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="font-semibold text-brand">{b.qty} vente(s)</span>
                    <span className="ml-2 text-brand/50">
                      {formatPrice(b.revenueCents, currency)}
                    </span>
                    <span className="block text-xs text-brand/40">
                      Panier moyen {formatPrice(b.avgCents, currency)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
      <div className="text-sm text-brand/50">{label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold text-brand">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-brand/40">{hint}</div>}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
      <h2 className="font-display font-bold text-brand">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
