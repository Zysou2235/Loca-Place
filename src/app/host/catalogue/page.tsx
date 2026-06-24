import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { ImageDropInput } from "@/components/ImageDropInput";
import { HostShell } from "../HostShell";
import { createProduct, deleteProduct, updateProduct } from "../box-actions";

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const products = await prisma.product.findMany({
    where: { hostId: host.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { selectedInBoxes: true } } },
  });

  return (
    <HostShell hostName={host.name}>
      <h1 className="font-display text-2xl font-bold text-brand">
        Mon catalogue d&apos;articles
      </h1>
      <p className="mt-1 text-brand/60">
        Vos articles réutilisables. Choisissez-en un dans chaque box (page de la
        box) pour le mettre en vente.
      </p>

      {/* Liste */}
      <div className="mt-8 space-y-3">
        {products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-brand/50">
            Aucun article pour le moment. Ajoutez-en un ci-dessous.
          </p>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-black/5 bg-white p-4 shadow-card"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photoUrl}
                      alt={p.name}
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-black/5 text-xl">
                      🖼️
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-brand">{p.name}</div>
                    <div className="text-sm text-brand/60">
                      {formatPrice(p.priceCents, p.currency)}
                      {p._count.selectedInBoxes > 0 && (
                        <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                          dans {p._count.selectedInBoxes} box
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <form action={deleteProduct}>
                  <input type="hidden" name="productId" value={p.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </form>
              </div>

              <details className="group mt-3 [&_summary]:list-none">
                <summary className="cursor-pointer text-sm font-medium text-accent">
                  Modifier
                </summary>
                <form
                  action={updateProduct}
                  className="mt-3 grid gap-3 border-t border-black/5 pt-3 sm:grid-cols-2"
                >
                  <input type="hidden" name="productId" value={p.id} />
                  <input
                    name="name"
                    defaultValue={p.name}
                    placeholder="Nom de l'article"
                    required
                    className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  />
                  <input
                    name="price"
                    defaultValue={(p.priceCents / 100).toFixed(2).replace(".", ",")}
                    placeholder="Prix en € (ex. 12,50)"
                    required
                    inputMode="decimal"
                    className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  />
                  <ImageDropInput defaultValue={p.photoUrl} />
                  <textarea
                    name="description"
                    defaultValue={p.description ?? ""}
                    placeholder="Description (optionnel)"
                    rows={2}
                    className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 sm:col-span-2"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white transition hover:bg-brand-dark sm:col-span-2"
                  >
                    Enregistrer
                  </button>
                </form>
              </details>
            </div>
          ))
        )}
      </div>

      {/* Ajouter */}
      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6 shadow-card">
        <h3 className="font-display font-bold text-brand">Ajouter un article</h3>
        <form action={createProduct} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            name="name"
            placeholder="Nom de l'article"
            required
            className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <input
            name="price"
            placeholder="Prix en € (ex. 12,50)"
            required
            inputMode="decimal"
            className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <ImageDropInput />
          <textarea
            name="description"
            placeholder="Description (optionnel)"
            rows={2}
            className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 sm:col-span-2"
          />
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 font-semibold text-white transition hover:bg-accent-dark sm:col-span-2"
          >
            Ajouter au catalogue
          </button>
        </form>
      </div>
    </HostShell>
  );
}
