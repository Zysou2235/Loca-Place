import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { getPlan } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import { saveHostNotes } from "../../actions";

export const dynamic = "force-dynamic";

function isActive(s: string) {
  return s === "active" || s === "trialing";
}

export default async function HostDetailPage({
  params,
}: {
  params: Promise<{ hostId: string }>;
}) {
  await requireAdmin();
  const { hostId } = await params;

  const host = await prisma.host.findUnique({
    where: { id: hostId },
    include: {
      boxes: {
        orderBy: { createdAt: "asc" },
        include: {
          selectedProduct: { select: { name: true } },
          orders: { orderBy: { createdAt: "desc" } },
          _count: { select: { scans: true } },
        },
      },
    },
  });
  if (!host) notFound();

  const orders = host.boxes.flatMap((b) =>
    b.orders.map((o) => ({ ...o, boxName: b.name }))
  );
  orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const revenueCents = orders.reduce((n, o) => n + o.amountCents, 0);
  const scansTotal = host.boxes.reduce((n, b) => n + b._count.scans, 0);
  const plan = getPlan(host.subscriptionPlan);
  const active = isActive(host.subscriptionStatus);

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link href="/admin" className="text-sm font-medium text-accent">
          ← Retour à l&apos;administration
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-brand">
            {host.name}
          </h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              active ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {active ? `${plan?.name ?? "Actif"} · ${host.subscriptionStatus}` : "Sans abonnement"}
          </span>
        </div>

        {/* KPIs du client */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi label="Box" value={String(host.boxes.length)} />
          <Kpi label="Ventes" value={String(orders.length)} />
          <Kpi label="Volume de ventes" value={formatPrice(revenueCents)} />
          <Kpi label="Scans QR" value={String(scansTotal)} />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {/* Contact & légal */}
          <Section title="Contact & informations légales">
            <Row label="Email" value={host.email} />
            <Row label="Téléphone" value={host.phone} />
            <Row label="Raison sociale" value={host.companyName} />
            <Row label="SIRET" value={host.siret} />
            <Row
              label="Email vérifié"
              value={host.emailVerified ? "Oui" : "Non"}
            />
            <Row
              label="Inscrit le"
              value={host.createdAt.toLocaleDateString("fr-FR")}
            />
          </Section>

          {/* Abonnement & Stripe */}
          <Section title="Abonnement & paiements">
            <Row label="Formule" value={plan?.name ?? "—"} />
            <Row label="Statut" value={host.subscriptionStatus} />
            <Row
              label="Versements (Connect)"
              value={host.chargesEnabled ? "Activés" : "Non configurés"}
            />
            <Row label="Stripe client" value={host.stripeCustomerId} mono />
            <Row label="Stripe compte" value={host.stripeAccountId} mono />
          </Section>

          {/* Facturation */}
          <Section title="Adresse de facturation">
            <Address
              line1={host.billingLine1}
              zip={host.billingZip}
              city={host.billingCity}
              country={host.billingCountry}
            />
          </Section>

          {/* Livraison */}
          <Section title="Adresse de livraison">
            <Row label="Destinataire" value={host.deliveryName} />
            <Address
              line1={host.deliveryLine1}
              zip={host.deliveryZip}
              city={host.deliveryCity}
              country={host.deliveryCountry}
            />
          </Section>
        </div>

        {/* Box du client */}
        <Section title="Box" className="mt-5">
          {host.boxes.length === 0 ? (
            <p className="text-sm text-brand/40">Aucune box.</p>
          ) : (
            <ul className="divide-y divide-black/5 text-sm">
              {host.boxes.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-brand">
                    <strong>{b.name}</strong>
                    <span className="text-brand/40">
                      {" "}
                      · {b.selectedProduct?.name ?? "aucun article"} · code{" "}
                      {b.accessCode ?? "—"}
                    </span>
                  </span>
                  <span className="text-xs text-brand/50">
                    {b.shippedAt
                      ? `📦 expédiée ${b.shippedAt.toLocaleDateString("fr-FR")}${
                          b.shippingTrackingNumber ? ` · ${b.shippingTrackingNumber}` : ""
                        }`
                      : "en préparation"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Historique des ventes */}
        <Section title={`Historique des ventes (${orders.length})`} className="mt-5">
          {orders.length === 0 ? (
            <p className="text-sm text-brand/40">Aucune vente.</p>
          ) : (
            <ul className="divide-y divide-black/5 text-sm">
              {orders.slice(0, 50).map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-brand/70">
                    {o.createdAt.toLocaleDateString("fr-FR")} · {o.productName}
                    <span className="text-brand/40"> · {o.boxName}</span>
                  </span>
                  <span className="text-right">
                    <span className="font-semibold text-brand">
                      {formatPrice(o.amountCents, o.currency)}
                    </span>
                    {o.customerEmail && (
                      <span className="ml-2 text-brand/40">{o.customerEmail}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Notes internes */}
        <Section title="Notes internes (admin)" className="mt-5">
          <form action={saveHostNotes} className="space-y-3">
            <input type="hidden" name="hostId" value={host.id} />
            <textarea
              name="notes"
              defaultValue={host.adminNotes ?? ""}
              rows={4}
              placeholder="Notes de suivi, échanges, points d'attention…"
              className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
            <button
              type="submit"
              className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Enregistrer les notes
            </button>
          </form>
        </Section>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 text-center shadow-card">
      <div className="font-display text-xl font-extrabold text-brand">{value}</div>
      <div className="mt-0.5 text-xs text-brand/50">{label}</div>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-black/5 bg-white p-5 shadow-card ${className ?? ""}`}>
      <h2 className="font-display font-bold text-brand">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-brand/50">{label}</span>
      <span className={`text-right text-brand ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function Address({
  line1,
  zip,
  city,
  country,
}: {
  line1?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
}) {
  if (!line1 && !city) {
    return <p className="text-sm text-brand/40">Non renseignée.</p>;
  }
  return (
    <p className="text-sm text-brand/80">
      {line1}
      <br />
      {zip} {city}
      <br />
      {country}
    </p>
  );
}
