import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/money";
import { recordScan } from "@/lib/scans";
import { createCheckoutSession } from "./actions";
import { ScanTracker } from "./ScanTracker";
import { EmailCaptureForm } from "./EmailCaptureForm";

export const dynamic = "force-dynamic";

// Pages accessibles uniquement en scannant le QR physique — aucune raison
// d'apparaître dans Google (des dizaines de pages quasi identiques seraient
// du contenu dupliqué pénalisant). noindex plutôt que robots.txt : Google
// doit pouvoir crawler la page pour voir la directive.
export const metadata = {
  title: "La boutique de votre logement — Escale Box",
  robots: { index: false, follow: false },
};

const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  missing: "Un problème est survenu. Rechargez la page et réessayez.",
  unavailable:
    "Ce produit vient de devenir indisponible. Rechargez la page pour voir l'offre à jour.",
  payment:
    "Le paiement n'a pas pu démarrer suite à un problème technique. Réessayez dans un instant.",
};

export default async function BoxPage({
  params,
  searchParams,
}: {
  params: Promise<{ qr_slug: string }>;
  searchParams: Promise<{ checkoutError?: string }>;
}) {
  const { qr_slug } = await params;
  const { checkoutError } = await searchParams;

  const box = await prisma.box.findFirst({
    where: { qrSlug: qr_slug, active: true },
    include: {
      selectedProduct: true,
      host: { select: { stripeAccountId: true, chargesEnabled: true } },
    },
  });

  if (!box) {
    notFound();
  }

  const product =
    box.selectedProduct && box.selectedProduct.active
      ? box.selectedProduct
      : null;

  // L'hôte doit pouvoir encaisser (Stripe Connect actif) pour que la vente
  // soit autorisée — sinon l'argent n'irait pas sur son compte.
  const hostCanReceive = Boolean(
    box.host?.stripeAccountId && box.host?.chargesEnabled
  );
  const sellable = Boolean(box.accessCode && product && hostCanReceive);

  // Trace le scan du QR code (instantané du produit présenté), best-effort.
  const scanId = await recordScan({
    boxId: box.id,
    productId: product?.id,
    productName: product?.name,
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10">
      {/* Mesure du temps passé sur la page (beacon à la fermeture) */}
      {scanId && <ScanTracker scanId={scanId} />}
      <header className="border-b border-neutral-200 pb-5">
        <Image
          src="/escale-box-logo.png"
          alt="Escale Box"
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

      {checkoutError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {CHECKOUT_ERROR_MESSAGES[checkoutError] ?? CHECKOUT_ERROR_MESSAGES.payment}
        </p>
      )}

      {!sellable || !product ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          Cette boutique sera bientôt disponible. Revenez un peu plus tard&nbsp;!
        </p>
      ) : (
        <div className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          {product.photoUrl && (
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.photoUrl}
                alt={product.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="font-semibold leading-snug">{product.name}</h2>
            {product.description && (
              <p className="mt-1 text-sm text-neutral-500">
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
        </div>
      )}

      {/* Opt-in email — sondage/avis (Fichier client admin) */}
      <EmailCaptureForm qrSlug={box.qrSlug} />

      <footer className="pt-4 text-center text-xs text-neutral-400">
        Paiement sécurisé par Stripe · Vendu par votre hôte
      </footer>
    </main>
  );
}
