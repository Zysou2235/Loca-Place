import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { formatPrice } from "@/lib/money";
import { AdminNav } from "../AdminNav";
import { resendCode } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdmin();

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { box: { select: { name: true, accessCode: true } } },
  });

  const total = orders.reduce((n, o) => n + o.amountCents, 0);

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav current="/admin/orders" />

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-2xl font-bold text-brand">Ventes</h1>
        <p className="mt-1 text-brand/60">
          {orders.length} commande(s) · {formatPrice(total, "eur")} encaissés.
        </p>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 text-brand/50">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Box / Produit</th>
                <th className="px-4 py-3 font-medium">Montant</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-brand/40">
                    Aucune vente pour le moment.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-3 text-brand/60">
                      {o.createdAt.toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-brand">{o.box.name}</div>
                      <div className="text-brand/50">{o.productName}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-brand">
                      {formatPrice(o.amountCents, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-brand/60">
                      <div>{o.customerEmail ?? "—"}</div>
                      {o.customerPhone && (
                        <div className="text-brand/40">{o.customerPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-brand">
                      {o.box.accessCode ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          o.codeSent
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {o.codeSent ? "Envoyé" : "Non envoyé"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={resendCode}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-black/5"
                        >
                          Renvoyer le code
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
