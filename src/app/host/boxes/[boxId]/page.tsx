import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { ImageDropInput } from "@/components/ImageDropInput";
import { HostShell } from "../../HostShell";
import {
  assignProductToBox,
  createProduct,
  removeProductFromBox,
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
    include: { selectedProduct: true },
  });
  if (!box) notFound();

  const catalog = await prisma.product.findMany({
    where: { hostId: host.id },
    orderBy: { createdAt: "desc" },
  });

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

      {/* Code de la box (lecture seule) — pour recharger la boîte */}
      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-5 shadow-card">
        <h3 className="font-display font-bold text-brand">
          🔑 Code d&apos;ouverture de la box
        </h3>
        {box.accessCode ? (
          <>
            <p className="mt-2 inline-block rounded-xl bg-brand/5 px-5 py-2 font-mono text-2xl font-bold tracking-widest text-brand">
              {box.accessCode}
            </p>
            <p className="mt-2 text-sm text-brand/60">
              Gardez ce code : il vous permet d&apos;ouvrir la boîte pour la{" "}
              <strong>recharger</strong>. C&apos;est aussi celui envoyé au
              voyageur après son achat.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-amber-700">
            ⏳ En attente d&apos;attribution du code par Eskale Box. Vous le
            verrez ici dès qu&apos;il sera défini.
          </p>
        )}
      </div>

      {/* QR code */}
      <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-black/5 bg-white p-5 shadow-card sm:flex-row">
        <div className="rounded-xl border border-black/10 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr/${box.qrSlug}`}
            alt={`QR code de ${box.name}`}
            width={140}
            height={140}
            className="h-32 w-32"
          />
        </div>
        <div className="text-center sm:text-left">
          <h3 className="font-display font-bold text-brand">Le QR code de votre box</h3>
          <p className="mt-1 text-sm text-brand/60">
            Associé <strong>définitivement</strong> à cette box, il mène vos
            voyageurs vers votre boutique.
          </p>
          <Link
            href={`/host/boxes/${box.id}/qr`}
            className="mt-3 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark"
          >
            🖨️ Voir / imprimer le QR
          </Link>
        </div>
      </div>

      {/* Article actuellement dans la box */}
      <div className="mt-8 rounded-2xl border border-black/5 bg-white p-5 shadow-card">
        <h3 className="font-display font-bold text-brand">
          Article dans cette box
        </h3>
        {box.selectedProduct ? (
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              {box.selectedProduct.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={box.selectedProduct.photoUrl}
                  alt={box.selectedProduct.name}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-black/5 text-2xl">
                  🖼️
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold text-brand">
                  {box.selectedProduct.name}
                </div>
                <div className="text-sm text-brand/60">
                  {formatPrice(
                    box.selectedProduct.priceCents,
                    box.selectedProduct.currency,
                  )}
                </div>
              </div>
            </div>
            <form action={removeProductFromBox}>
              <input type="hidden" name="boxId" value={box.id} />
              <button
                type="submit"
                className="rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium text-brand/70 transition hover:bg-black/5"
              >
                Retirer
              </button>
            </form>
          </div>
        ) : (
          <p className="mt-2 rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-brand/50">
            Aucun article sélectionné. Choisissez-en un dans votre catalogue
            ci-dessous.
          </p>
        )}
      </div>

      {/* Choisir un article du catalogue */}
      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-brand">
            Choisir dans mon catalogue
          </h3>
          <Link href="/host/catalogue" className="text-sm font-medium text-accent">
            Gérer le catalogue →
          </Link>
        </div>

        {catalog.length === 0 ? (
          <p className="mt-3 text-sm text-brand/50">
            Votre catalogue est vide. Ajoutez un premier article ci-dessous.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {catalog.map((p) => {
              const current = p.id === box.selectedProductId;
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-3">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photoUrl}
                        alt={p.name}
                        className="h-10 w-10 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-black/5">
                        🖼️
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-brand">
                        {p.name}
                      </span>
                      <span className="text-sm text-brand/50">
                        {formatPrice(p.priceCents, p.currency)}
                      </span>
                    </span>
                  </span>
                  {current ? (
                    <span className="shrink-0 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                      ✓ Dans la box
                    </span>
                  ) : (
                    <form action={assignProductToBox}>
                      <input type="hidden" name="boxId" value={box.id} />
                      <input type="hidden" name="productId" value={p.id} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-dark"
                      >
                        Mettre dans la box
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Ajout rapide d'un nouvel article (placé directement dans la box) */}
      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6 shadow-card">
        <h3 className="font-display font-bold text-brand">
          Nouvel article (placé dans cette box)
        </h3>
        <form action={createProduct} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="boxId" value={box.id} />
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
            Ajouter et mettre dans la box
          </button>
        </form>
      </div>
    </HostShell>
  );
}
