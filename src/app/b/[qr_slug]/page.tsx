import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/money";
import { createCheckoutSession } from "./actions";

export const dynamic = "force-dynamic";

export default async function BoxPage({
  params,
}: {
  params: Promise<{ qr_slug: string }>;
}) {
  const { qr_slug } = await params;

  const box = await prisma.box.findFirst({
    where: { qrSlug: qr_slug, active: true },
    include: {
      products: {
        where: { active: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!box) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10">
      <header className="border-b border-neutral-200 pb-5">
        <Image
          src="/eskale-box-logo.png"
          alt="Eskale Box"
          width={120}
          height={120}
          priority
          className="mb-3 h-auto w-28"
        />
        <h1 className="mt-1 text-2xl font-bold">{box.name}</h1>
        {box.location && (
          <p className="mt-1 text-sm text-neutral-500">{box.location}</p>
        )}
        <p className="mt-3 text-sm text-neutral-600">
          Choisissez un produit et payez en quelques secondes. Aucun compte
          requis.
        </p>
      </header>

      {box.products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          Aucun produit disponible pour le moment.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {box.products.map((product) => (
            <li
              key={product.id}
              className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              {product.photoUrl && (
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                  <Image
                    src={product.photoUrl}
                    alt={product.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
              )}

              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="font-semibold leading-snug">{product.name}</h2>
                {product.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                    {product.description}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="text-lg font-bold">
                    {formatPrice(product.priceCents, product.currency)}
                  </span>

                  <form action={createCheckoutSession}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="qrSlug" value={box.qrSlug} />
                    <button
                      type="submit"
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark active:bg-accent-dark"
                    >
                      Payer
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className="pt-4 text-center text-xs text-neutral-400">
        Paiement sécurisé par Stripe · Vendu par votre hôte
      </footer>
    </main>
  );
}
