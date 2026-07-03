import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

/**
 * Fiche QR à imprimer au format A5 (148 × 210 mm), à coller sur la box.
 * À l'écran : aperçu fidèle + bouton Imprimer. À l'impression : la feuille
 * seule, calée sur une page A5 sans marges.
 */
export default async function HostQrPrintPage({
  params,
}: {
  params: Promise<{ boxId: string }>;
}) {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const { boxId } = await params;
  const box = await prisma.box.findFirst({
    where: { id: boxId, hostId: host.id },
    select: { qrSlug: true, name: true },
  });
  if (!box) notFound();

  const targetUrl = `${await getBaseUrl()}/b/${box.qrSlug}`;
  const displayUrl = targetUrl.replace(/^https?:\/\//, "");

  const steps = [
    { n: "1", title: "Scannez", desc: "avec l'appareil photo de votre téléphone" },
    { n: "2", title: "Payez", desc: "en ligne, sans appli ni compte" },
    { n: "3", title: "Ouvrez", desc: "avec le code reçu par email" },
  ];

  return (
    <main className="min-h-screen bg-cream py-10 print:min-h-0 print:bg-white print:py-0">
      {/* Barre d'outils — écran uniquement */}
      <div className="mx-auto mb-6 flex w-[148mm] max-w-full items-center justify-between px-4 print:hidden">
        <Link
          href={`/host/boxes/${boxId}`}
          className="text-sm font-medium text-accent hover:underline"
        >
          ← Retour à la box
        </Link>
        <PrintButton />
      </div>

      {/* ------------------------------------------------ Feuille A5 */}
      <div className="qr-sheet mx-auto flex h-[210mm] w-[148mm] max-w-full flex-col items-center overflow-hidden bg-white px-[12mm] py-[9mm] text-center shadow-soft print:shadow-none">
        {/* En-tête : logo + nom de la box */}
        <Image
          src="/escale-box-logo.png"
          alt="Escale Box"
          width={280}
          height={280}
          priority
          className="h-auto w-[30mm]"
        />
        <h1 className="mt-[4mm] font-display text-[8mm] font-extrabold leading-tight text-brand">
          Une petite envie&nbsp;?
        </h1>
        <p className="mt-[1.5mm] text-[3.6mm] leading-snug text-brand/60">
          Découvrez ce que votre hôte vous a préparé dans cette box.
        </p>

        {/* QR encadré, badge orange par-dessus */}
        <div className="relative mt-[7mm]">
          <div className="rounded-[6mm] border-[0.8mm] border-brand p-[4mm]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr/${box.qrSlug}`}
              alt={`QR code — ${box.name}`}
              width={1024}
              height={1024}
              className="h-[72mm] w-[72mm]"
            />
          </div>
          <span className="absolute -top-[3.5mm] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-[5mm] py-[1.6mm] text-[3.4mm] font-bold uppercase tracking-[0.06em] text-white">
            Scannez-moi
          </span>
        </div>

        {/* Les 3 étapes */}
        <div className="mt-[7mm] grid w-full grid-cols-3 gap-[4mm]">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col items-center">
              <span className="flex h-[8mm] w-[8mm] items-center justify-center rounded-full bg-brand text-[4mm] font-bold text-white">
                {s.n}
              </span>
              <span className="mt-[2mm] text-[3.8mm] font-bold text-brand">
                {s.title}
              </span>
              <span className="mt-[0.5mm] text-[2.9mm] leading-snug text-brand/55">
                {s.desc}
              </span>
            </div>
          ))}
        </div>

        {/* Pied : branding + URL de secours — jamais le nom interne de la
            box (identifiant technique, sans intérêt pour le voyageur). */}
        <div className="mt-auto w-full">
          <div className="rounded-[4mm] bg-brand px-[6mm] py-[3.5mm] text-white">
            <div className="font-display text-[4.2mm] font-bold">
              Escale Box
            </div>
            <div className="mt-[0.8mm] break-all text-[3mm] text-white/70">
              Sans appareil photo&nbsp;? Tapez&nbsp;: {displayUrl}
            </div>
          </div>
          <p className="mt-[2.5mm] text-[2.8mm] text-brand/40">
            Paiement sécurisé par Stripe · Sans application
          </p>
        </div>
      </div>

      <p className="mx-auto mt-6 w-[148mm] max-w-full px-4 text-center text-xs text-brand/40 print:hidden">
        Imprimez en A5 (ou A4 : cochez «&nbsp;Ajuster à la page&nbsp;»), puis
        collez la fiche sur votre Escale Box. Le QR code reste valable
        indéfiniment pour cette box.
      </p>
    </main>
  );
}
