import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "../AdminNav";
import { grantTestAccess, revokeTestAccess } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminTestPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; revoked?: string; error?: string }>;
}) {
  await requireAdmin();
  const { ok, revoked, error } = await searchParams;

  const testHosts = await prisma.host.findMany({
    where: { isTestAccount: true },
    orderBy: { createdAt: "desc" },
    include: {
      boxes: {
        orderBy: { createdAt: "asc" },
        include: {
          selectedProduct: { select: { name: true } },
        },
      },
    },
  });

  const totalTestBoxes = testHosts.reduce((n, h) => n + h.boxes.length, 0);

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav current="/admin/test" />

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-2xl font-bold text-brand">
          Tests MVP — box offertes
        </h1>
        <p className="mt-1 text-brand/60">
          Offrez un accès gratuit à des testeurs : compte activé sans paiement,
          box provisionnées immédiatement. Exclu du MRR.
        </p>

        {ok && (
          <Banner tone="green">
            Accès test créé : les box sont provisionnées. Le testeur se connecte
            avec « Mot de passe oublié » (ou Google) sur son adresse email.
          </Banner>
        )}
        {revoked && <Banner tone="green">Accès test retiré, box désactivées.</Banner>}
        {error === "email" && <Banner tone="red">Adresse email invalide.</Banner>}
        {error === "paying" && (
          <Banner tone="red">
            Ce compte a un vrai abonnement Stripe actif — impossible de
            l&apos;écraser avec un accès test.
          </Banner>
        )}
        {error === "notatest" && (
          <Banner tone="red">Ce compte n&apos;est pas un compte test.</Banner>
        )}

        {/* Formulaire d'attribution */}
        <form
          action={grantTestAccess}
          className="mt-8 rounded-2xl border border-black/5 bg-white p-6 shadow-card"
        >
          <h2 className="font-display font-bold text-brand">
            Offrir des box à un testeur
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5 lg:col-span-2">
              <span className="text-sm font-medium text-brand/80">Email du testeur</span>
              <input
                name="email"
                type="email"
                required
                placeholder="testeur@exemple.fr"
                className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-brand/80">
                Nom <span className="text-brand/40">(si nouveau compte)</span>
              </span>
              <input
                name="name"
                placeholder="Marie Dupont"
                className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-brand/80">Nombre de box</span>
              <input
                name="boxes"
                type="number"
                min={1}
                max={50}
                defaultValue={4}
                className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
              <span className="text-sm font-medium text-brand/80">
                Note interne <span className="text-brand/40">(optionnel — ex. « voisin », « conciergerie Lyon »)</span>
              </span>
              <input
                name="notes"
                placeholder="Contexte du test"
                className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </label>
          </div>
          <button
            type="submit"
            className="mt-4 rounded-full bg-accent px-6 py-2.5 font-semibold text-white transition hover:bg-accent-dark"
          >
            Activer l&apos;accès test
          </button>
        </form>

        {/* Liste des comptes test */}
        <div className="mt-10 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-brand">
            Comptes test actifs
          </h2>
          <span className="text-sm text-brand/50">
            {testHosts.length} testeur(s) · {totalTestBoxes} box
          </span>
        </div>

        {testHosts.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-brand/50">
            Aucun compte test pour le moment.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {testHosts.map((h) => {
              return (
                <div
                  key={h.id}
                  className="rounded-2xl border border-black/5 bg-white p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/hosts/${h.id}`}
                        className="font-display font-bold text-brand hover:text-accent"
                      >
                        {h.name}
                      </Link>
                      <div className="text-sm text-brand/60">{h.email}</div>
                      {h.adminNotes && (
                        <div className="mt-1 whitespace-pre-line text-xs text-brand/40">
                          {h.adminNotes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Les chiffres détaillés vivent dans « Données »
                          (filtrées sur ce testeur) — pas de doublon ici. */}
                      <Link
                        href={`/admin/data?host=${h.id}`}
                        className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand/70 transition hover:bg-black/5"
                      >
                        📊 Voir ses données →
                      </Link>
                      <form action={revokeTestAccess}>
                        <input type="hidden" name="hostId" value={h.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Retirer l&apos;accès
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Box du testeur : slug, code cadenas, produit, activité */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-black/5 text-xs text-brand/40">
                        <tr>
                          <th className="py-2 pr-4 font-medium">Box</th>
                          <th className="py-2 pr-4 font-medium">QR</th>
                          <th className="py-2 pr-4 font-medium">Code cadenas</th>
                          <th className="py-2 pr-4 font-medium">Produit</th>
                          <th className="py-2 font-medium">Expédiée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {h.boxes.map((b) => (
                          <tr key={b.id} className="border-b border-black/5 last:border-0">
                            <td className="py-2 pr-4 font-medium text-brand">
                              {b.name}
                              {!b.active && (
                                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                                  off
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              <Link
                                href={`/b/${b.qrSlug}`}
                                className="text-accent hover:underline"
                              >
                                /b/{b.qrSlug}
                              </Link>
                            </td>
                            <td className="py-2 pr-4 font-mono">{b.accessCode ?? "—"}</td>
                            <td className="py-2 pr-4 text-brand/70">
                              {b.selectedProduct?.name ?? "—"}
                            </td>
                            <td className="py-2">
                              {b.shippedAt
                                ? b.shippedAt.toLocaleDateString("fr-FR")
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-xs text-brand/40">
          Comment le testeur accède à son compte : il va sur{" "}
          <span className="font-medium">escalebox.fr/host/reset</span> avec son
          email (« Mot de passe oublié ») ou se connecte avec Google si
          l&apos;email correspond. Les comptes test n&apos;ont pas de moyen de
          paiement — aucune facturation ne peut se déclencher.
        </p>
      </main>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "green" | "red";
  children: React.ReactNode;
}) {
  return (
    <p
      className={`mt-6 rounded-2xl border p-4 text-sm ${
        tone === "green"
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {children}
    </p>
  );
}
