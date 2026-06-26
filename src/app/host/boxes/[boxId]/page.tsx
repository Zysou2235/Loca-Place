import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { ImageDropInput } from "@/components/ImageDropInput";
import { HostShell } from "../../HostShell";
import { ChangeCodeForm } from "./ChangeCodeForm";
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

  // Tracking des scans QR + conversion en ventes, détaillé par produit présenté.
  const [scanCount, salesCount, scansByProduct, ordersByProduct, lastScan] =
    await Promise.all([
      prisma.scan.count({ where: { boxId: box.id } }),
      prisma.order.count({ where: { boxId: box.id } }),
      prisma.scan.groupBy({
        by: ["productName"],
        where: { boxId: box.id },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ["productName"],
        where: { boxId: box.id },
        _count: { _all: true },
      }),
      prisma.scan.findFirst({
        where: { boxId: box.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

  const perProduct = new Map<string, { scans: number; sales: number }>();
  for (const s of scansByProduct) {
    const name = s.productName ?? "Aucun article";
    const e = perProduct.get(name) ?? { scans: 0, sales: 0 };
    e.scans += s._count._all;
    perProduct.set(name, e);
  }
  for (const o of ordersByProduct) {
    const name = o.productName ?? "Aucun article";
    const e = perProduct.get(name) ?? { scans: 0, sales: 0 };
    e.sales += o._count._all;
    perProduct.set(name, e);
  }
  const productRows = [...perProduct.entries()].sort(
    (a, b) => b[1].scans - a[1].scans || b[1].sales - a[1].sales,
  );
  const conversion =
    scanCount > 0 ? Math.round((salesCount / scanCount) * 100) : 0;

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

      {/* Tracking : scans du QR, ventes, conversion */}
      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-brand">
            📊 Scans &amp; conversion
          </h3>
          {lastScan && (
            <span className="text-xs text-brand/40">
              Dernier scan&nbsp;:{" "}
              {lastScan.createdAt.toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-brand/5 p-3">
            <div className="text-2xl font-bold text-brand">{scanCount}</div>
            <div className="text-xs text-brand/50">Scans QR</div>
          </div>
          <div className="rounded-xl bg-green-50 p-3">
            <div className="text-2xl font-bold text-green-700">{salesCount}</div>
            <div className="text-xs text-brand/50">Ventes</div>
          </div>
          <div className="rounded-xl bg-accent/10 p-3">
            <div className="text-2xl font-bold text-accent-dark">
              {conversion}%
            </div>
            <div className="text-xs text-brand/50">Conversion</div>
          </div>
        </div>

        {productRows.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand/40">
              Par article présenté
            </div>
            <ul className="divide-y divide-black/5 text-sm">
              {productRows.map(([name, s]) => (
                <li key={name} className="flex items-center justify-between py-2">
                  <span className="min-w-0 truncate text-brand/80">{name}</span>
                  <span className="shrink-0 text-brand/60">
                    👁️ {s.scans} · 🛒 {s.sales}
                    {s.scans > 0 && (
                      <span className="ml-1 text-brand/40">
                        ({Math.round((s.sales / s.scans) * 100)}%)
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {scanCount === 0 && (
          <p className="mt-3 text-sm text-brand/50">
            Aucun scan pour l&apos;instant. Flashez le QR code pour tester&nbsp;!
          </p>
        )}
      </div>

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
            <p className="mt-2 text-sm text-brand/60">
              Pour la sécurité, vous pouvez le changer quand vous voulez (par
              exemple après le départ d&apos;un voyageur). Réglez d&apos;abord le
              cadenas, puis saisissez le nouveau code ici.
            </p>
            <ChangeCodeForm boxId={box.id} />
          </>
        ) : (
          <p className="mt-2 text-sm text-amber-700">
            ⏳ En attente d&apos;attribution du code par Escale Box. Vous le
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
        <p className="mt-1 text-sm text-red-600">
          ⚠️ Un seul article est vendu à la fois. Pour plusieurs produits, créez
          un «&nbsp;Pack&nbsp;» et détaillez son contenu dans la description.
        </p>
        <form action={createProduct} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="boxId" value={box.id} />
          <input
            name="name"
            placeholder="Nom de l'article (ou « Pack apéro »)"
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
            placeholder="Description — pour un pack, listez chaque article (ex. 1 bière, chips, saucisson)"
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
