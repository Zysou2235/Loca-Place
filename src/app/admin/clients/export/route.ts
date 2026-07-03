import { requireAdmin } from "@/lib/admin";
import { buildContacts } from "../contacts";

export const dynamic = "force-dynamic";

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

/** Export CSV du fichier client (acheteurs + opt-ins) — réservé admin. */
export async function GET() {
  await requireAdmin();

  const contacts = await buildContacts();

  const headers = [
    "Email",
    "Telephone",
    "Type",
    "Nb achats",
    "Total depense (EUR)",
    "Box",
    "Hotes",
    "Premier contact",
    "Dernier contact",
  ];

  const rows = contacts.map((c) =>
    [
      c.email,
      c.phone,
      c.type,
      c.purchases,
      (c.totalCents / 100).toFixed(2),
      c.boxes.join(" / "),
      c.hosts.join(" / "),
      c.firstSeen.toISOString().slice(0, 10),
      c.lastSeen.toISOString().slice(0, 10),
    ]
      .map(csvCell)
      .join(";")
  );

  // BOM UTF-8 pour qu'Excel ouvre les accents correctement.
  const csv = "﻿" + [headers.map(csvCell).join(";"), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fichier-client-escalebox-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
