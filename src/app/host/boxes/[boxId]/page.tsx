import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { HostShell } from "../../HostShell";
import {
  createProduct,
  deleteProduct,
  toggleProduct,
  updateProduct,
} from "../../box-actions";

export const dynamic = "force-dynamic";

export default async function ManageBoxPage({
  params,
}: {
  params: Promise<{ boxId: string }>;
}) {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const { boxId } = await params;
  const box = await prisma.box.findFirst({
    where: { id: boxId, hostId: host.id },
    include: { products: { orderBy: { createdAt: "asc" } } },
  });
  if (!box) notFound();

  return (
    <HostShell hostName={host.name}>
      <Link href="/host" className="text-sm font-medium text-accent">
        ← Tableau de bord
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-brand">
        {box.name}
      </h1>
      <p className="mt-1 text-sm text-brand/60">
        Page publique :{" "}
        <Link href={`/b/${box.qrSlug}`} className="text-accent hover:underline">
          /b/{box.qrSlug}
        </Link>
      </p>

      {/* Products list */}
      <div className="mt-8 space-y-3">
        {box.products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-brand/50">
            Aucun produit. Ajoutez-en un ci-dessous.
          </p>
        ) : (
          box.products.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-black/5 bg-white p-4 shadow-card"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {p.photoUrl && (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                      <Image
                        src={p.photoUrl}
                        alt={p.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-brand">
                      {p.name}{" "}
                      {!p.active && (
                        <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
                          masqué
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-brand/60">
                      {formatPrice(p.priceCents, p.currency)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={toggleProduct}>
                    <input type="hidden" name="productId" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium text-brand/70 transition hover:bg-black/5"
                    >
                      {p.active ? "Masquer" : "Afficher"}
                    </button>
                  </form>
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
              </div>

              {/* Modifier (prix / article) */}
              <details className="group mt-3 [&_summary]:list-none">
                <summary className="cursor-pointer text-sm font-medium text-accent">
                  Modifier le prix / l&apos;article
                </summary>
                <form
                  action={updateProduct}
                  className="mt-3 grid gap-3 border-t border-black/5 pt-3 sm:grid-cols-2"
                >
                  <input type="hidden" name="productId" value={p.id} />
                  <input
                    name="name"
                    defaultValue={p.name}
                    placeholder="Nom du produit"
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
                  <input
                    name="photoUrl"
                    defaultValue={p.photoUrl ?? ""}
                    placeholder="URL de la photo (optionnel)"
                    className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 sm:col-span-2"
                  />
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
                    Enregistrer les modifications
                  </button>
                </form>
              </details>
            </div>
          ))
        )}
      </div>

      {/* Add product */}
      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6 shadow-card">
        <h3 className="font-display font-bold text-brand">Ajouter un produit</h3>
        <form action={createProduct} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="boxId" value={box.id} />
          <input
            name="name"
            placeholder="Nom du produit"
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
          <input
            name="photoUrl"
            placeholder="URL de la photo (optionnel)"
            className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 sm:col-span-2"
          />
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
            Ajouter le produit
          </button>
        </form>
      </div>
    </HostShell>
  );
}
