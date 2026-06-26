import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

function csvCell(v: string | null | undefined): string {
  const s = (v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

/** Export CSV de tous les clients (hôtes) — réservé admin. */
export async function GET() {
  await requireAdmin();

  const hosts = await prisma.host.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { boxes: true } } },
  });

  const headers = [
    "Nom",
    "Email",
    "Telephone",
    "Raison sociale",
    "SIRET",
    "Adresse facturation",
    "CP facturation",
    "Ville facturation",
    "Adresse livraison",
    "CP livraison",
    "Ville livraison",
    "Abonnement",
    "Statut",
    "Email verifie",
    "Nb box",
    "Inscrit le",
  ];

  const rows = hosts.map((h) =>
    [
      h.name,
      h.email,
      h.phone,
      h.companyName,
      h.siret,
      h.billingLine1,
      h.billingZip,
      h.billingCity,
      h.deliveryLine1,
      h.deliveryZip,
      h.deliveryCity,
      h.subscriptionPlan,
      h.subscriptionStatus,
      h.emailVerified ? "oui" : "non",
      String(h._count.boxes),
      h.createdAt.toISOString().slice(0, 10),
    ]
      .map(csvCell)
      .join(",")
  );

  // BOM pour qu'Excel ouvre l'UTF-8 correctement.
  const csv = "﻿" + [headers.map(csvCell).join(","), ...rows].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-escalebox-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
