import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { computeStats } from "@/lib/stats";
import { StatsDashboard } from "@/components/StatsDashboard";
import { AdminNav } from "../AdminNav";

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
      <AdminNav current="/admin/stats" />

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
