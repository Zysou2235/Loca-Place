import { requireAdmin } from "@/lib/admin";
import { formatPrice } from "@/lib/money";
import { AdminNav } from "../AdminNav";
import { buildContacts } from "./contacts";

export const dynamic = "force-dynamic";

/**
 * Fichier client : tous les voyageurs dont on a l'email — acheteurs
 * (via Stripe) et visiteurs (opt-in sur la page de la box). Base d'envoi
 * pour les sondages post-séjour.
 */
export default async function AdminClientsPage() {
  await requireAdmin();

  const contacts = await buildContacts();
  const buyers = contacts.filter((c) => c.type === "acheteur");
  const since7d = Date.now() - 7 * 24 * 3600 * 1000;
  const new7d = contacts.filter((c) => c.firstSeen.getTime() >= since7d).length;

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav current="/admin/clients" />

      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand">
              Fichier client
            </h1>
            <p className="mt-1 text-brand/60">
              Voyageurs dont on a l&apos;email : acheteurs (Stripe) et
              visiteurs qui l&apos;ont laissé sur la page de la box. Base
              d&apos;envoi pour vos sondages.
            </p>
          </div>
          <a
            href="/admin/clients/export"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-dark"
          >
            ⬇ Exporter (CSV)
          </a>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Contacts" value={contacts.length} />
          <Stat label="Acheteurs" value={buyers.length} />
          <Stat label="Visiteurs (opt-in)" value={contacts.length - buyers.length} />
          <Stat label="Nouveaux (7 jours)" value={new7d} />
        </div>

        {/* Liste */}
        <div className="mt-8 overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 text-brand/50">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Achats</th>
                <th className="px-4 py-3 font-medium">Total dépensé</th>
                <th className="px-4 py-3 font-medium">Box / Hôte</th>
                <th className="px-4 py-3 font-medium">Dernier contact</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-brand/40">
                    Aucun contact pour le moment. Les emails arrivent avec les
                    premières ventes et les opt-ins sur les pages de box.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.email} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-brand">{c.email}</div>
                      {c.phone && (
                        <div className="text-xs text-brand/40">{c.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          c.type === "acheteur"
                            ? "bg-green-100 text-green-700"
                            : "bg-brand/5 text-brand/70"
                        }`}
                      >
                        {c.type === "acheteur" ? "Acheteur" : "Visiteur"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{c.purchases || "—"}</td>
                    <td className="px-4 py-3 font-medium text-brand">
                      {c.totalCents ? formatPrice(c.totalCents, "eur") : "—"}
                    </td>
                    <td className="px-4 py-3 text-brand/70">
                      <div>{c.boxes.join(", ")}</div>
                      <div className="text-xs text-brand/40">
                        {c.hosts.join(", ")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand/60">
                      {c.lastSeen.toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-brand/40">
          RGPD : les acheteurs peuvent être recontactés pour une enquête de
          satisfaction liée à leur achat ; les visiteurs ont explicitement
          consenti sur la page de la box. Toute demande de suppression doit
          être honorée sans délai. N&apos;utilisez pas cette base pour de la
          prospection sans rapport avec Escale Box.
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand/40">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-extrabold text-brand">
        {value.toLocaleString("fr-FR")}
      </div>
    </div>
  );
}
