import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { computeStats } from "@/lib/stats";
import { StatsDashboard } from "@/components/StatsDashboard";
import { HostShell } from "../HostShell";

export const dynamic = "force-dynamic";

export default async function HostStatsPage() {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const orders = await prisma.order.findMany({
    where: { box: { hostId: host.id } },
    orderBy: { createdAt: "desc" },
    select: {
      productName: true,
      amountCents: true,
      createdAt: true,
      box: { select: { name: true } },
    },
  });

  const stats = computeStats(orders);
  const multiBox = stats.byBox.length > 1;

  return (
    <HostShell hostName={host.name}>
      <h1 className="font-display text-2xl font-bold text-brand">
        Statistiques de ventes
      </h1>
      <p className="mt-1 text-brand/60">
        Vue d&apos;ensemble de vos ventes et des objets vendus.
      </p>
      <div className="mt-8">
        <StatsDashboard stats={stats} showByBox={multiBox} />
      </div>
    </HostShell>
  );
}
