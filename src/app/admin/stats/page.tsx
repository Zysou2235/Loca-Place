import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { computeStats } from "@/lib/stats";
import { StatsDashboard } from "@/components/StatsDashboard";
import { logout } from "../../host/auth-actions";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  await requireAdmin();

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      productName: true,
      amountCents: true,
      createdAt: true,
      box: { select: { name: true } },
    },
  });

  const stats = computeStats(orders);

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
            <Link href="/admin" className="font-medium text-brand/70 hover:text-brand">
              Comptes &amp; box
            </Link>
            <Link href="/admin/orders" className="font-medium text-brand/70 hover:text-brand">
              Ventes
            </Link>
            <Link href="/admin/stats" className="font-semibold text-brand">
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
          Statistiques globales
        </h1>
        <p className="mt-1 text-brand/60">
          Toutes les ventes de la plateforme, tous hôtes confondus.
        </p>
        <div className="mt-8">
          <StatsDashboard stats={stats} />
        </div>
      </main>
    </div>
  );
}
