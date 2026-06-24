import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/plans";
import { requireAdmin } from "@/lib/admin";
import { logout } from "../host/auth-actions";
import { setBoxCode } from "./actions";

export const dynamic = "force-dynamic";

function isActive(status: string) {
  return status === "active" || status === "trialing";
}

export default async function AdminPage() {
  const admin = await requireAdmin();

  const hosts = await prisma.host.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      boxes: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { products: true } } },
      },
    },
  });

  const totalBoxes = hosts.reduce((n, h) => n + h.boxes.length, 0);
  const activeSubs = hosts.filter((h) => isActive(h.subscriptionStatus)).length;

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <span className="font-display text-xl font-extrabold text-brand">
            éskale <span className="text-accent">box</span>
            <span className="ml-2 align-middle text-xs font-medium text-red-500">
              admin
            </span>
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-brand/60 sm:inline">{admin.email}</span>
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

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Stat label="Hôtes" value={hosts.length} />
          <Stat label="Abonnements actifs" value={activeSubs} />
          <Stat label="Box au total" value={totalBoxes} />
        </div>

        {/* Hosts */}
        <div className="mt-10 space-y-5">
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
                    <div className="font-semibold text-brand">{host.name}</div>
                    <div className="text-sm text-brand/50">{host.email}</div>
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
                                · {box._count.products} produit(s) · /b/
                                {box.qrSlug}
                              </span>
                            </div>
                            <Link
                              href={`/admin/boxes/${box.id}/qr`}
                              className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
                            >
                              🖨️ QR à imprimer
                            </Link>
                          </div>

                          {/* Code de la boîte (obligatoire pour vendre) */}
                          <form
                            action={setBoxCode}
                            className="mt-2 flex flex-wrap items-center gap-2"
                          >
                            <input type="hidden" name="boxId" value={box.id} />
                            <span
                              className={`text-xs font-semibold ${
                                box.accessCode ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {box.accessCode ? "Code défini ✓" : "⚠️ Code manquant"}
                            </span>
                            <input
                              name="code"
                              defaultValue={box.accessCode ?? ""}
                              placeholder="Code de la boîte (ex. 4821)"
                              required
                              className="flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                            />
                            <button
                              type="submit"
                              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-black/5"
                            >
                              Enregistrer le code
                            </button>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 text-center shadow-card">
      <div className="font-display text-3xl font-extrabold text-brand">
        {value}
      </div>
      <div className="mt-1 text-sm text-brand/50">{label}</div>
    </div>
  );
}
