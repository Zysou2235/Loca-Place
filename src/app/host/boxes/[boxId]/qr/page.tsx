import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { isEffectiveAdmin } from "@/lib/admin";
import { getBaseUrl } from "@/lib/base-url";
import { PrintButton } from "./PrintButton";
import { printSteps, printText } from "@/lib/traveler-i18n";

export const dynamic = "force-dynamic";

/**
 * Fiche QR à imprimer au format A4 (210 × 297 mm), à coller sur la box.
 * À l'écran : aperçu fidèle + bouton Imprimer. À l'impression : la feuille
 * seule, calée sur une page A4 sans marges.
 *
 * Accès : l'hôte propriétaire de la box, OU un admin (pour imprimer et
 * coller l'étiquette avant expédition, avant même que l'hôte se connecte —
 * cas des box offertes depuis /admin/test).
 */
export default async function HostQrPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ boxId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const admin = isEffectiveAdmin(host);
  const { boxId } = await params;
  const { from } = await searchParams;

  const box = await prisma.box.findFirst({
    where: admin ? { id: boxId } : { id: boxId, hostId: host.id },
    select: { qrSlug: true, name: true },
  });
  if (!box) notFound();

  // Retour : vers la page admin d'origine si on y accède en admin, sinon
  // vers la gestion de la box (côté hôte).
  const backHref =
    admin && from === "admin-test"
      ? "/admin/test"
      : admin && from === "admin"
        ? "/admin"
        : `/host/boxes/${boxId}`;

  const targetUrl = `${await getBaseUrl()}/b/${box.qrSlug}`;
  const displayUrl = targetUrl.replace(/^https?:\/\//, "");

  return (
    <main className="min-h-screen bg-cream py-10 print:min-h-0 print:bg-white print:py-0">
      {/* Barre d'outils — écran uniquement */}
      <div className="mx-auto mb-6 flex w-[210mm] max-w-full items-center justify-between px-4 print:hidden">
        <Link
          href={backHref}
          className="text-sm font-medium text-accent hover:underline"
        >
          ← Retour
        </Link>
        <PrintButton />
      </div>

      {/* ------------------------------------------------ Feuille A4 */}
      <div className="qr-sheet mx-auto flex h-[297mm] w-[210mm] max-w-full flex-col items-center overflow-hidden bg-white px-[17mm] py-[12.8mm] text-center shadow-soft print:shadow-none">
        {/* En-tête : logo + nom de la box */}
        <Image
          src="/escale-box-logo.png"
          alt="Escale Box"
          width={280}
          height={280}
          priority
          className="h-auto w-[42.6mm]"
        />
        <h1 className="mt-[4.5mm] font-display text-[11.4mm] font-extrabold leading-tight text-brand">
          {printText.title.fr}
        </h1>
        <p className="mt-[1.6mm] text-[5.1mm] leading-snug text-brand/60">
          Découvrez ce que votre hôte vous a préparé dans cette box.
        </p>
        <p className="mt-[0.7mm] whitespace-nowrap text-[2.6mm] text-brand/35">
          🇬🇧{printText.title.en}·🇪🇸{printText.title.es}·🇮🇹{printText.title.it}
        </p>

        {/* QR encadré, badge orange par-dessus */}
        <div className="relative mt-[6.5mm]">
          <div className="rounded-[8.5mm] border-[1.1mm] border-brand p-[5mm]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr/${box.qrSlug}`}
              alt={`QR code — ${box.name}`}
              width={1024}
              height={1024}
              className="h-[96mm] w-[96mm]"
            />
          </div>
          <span className="absolute -top-[5mm] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-[7.1mm] py-[2.3mm] text-[4.8mm] font-bold uppercase tracking-[0.06em] text-white">
            Scannez-moi
          </span>
        </div>

        {/* Les 3 étapes — en français, avec le mot-clé en 3 langues pour les
            voyageurs étrangers (la page scannée s'adapte, elle, entièrement). */}
        <div className="mt-[7.5mm] grid w-full grid-cols-3 gap-[4.3mm]">
          {printSteps.map((s) => (
            <div key={s.n} className="flex flex-col items-center">
              <span className="flex h-[10mm] w-[10mm] items-center justify-center rounded-full bg-brand text-[5mm] font-bold text-white">
                {s.n}
              </span>
              <span className="mt-[2.3mm] text-[5mm] font-bold text-brand">
                {s.title.fr}
              </span>
              <span className="mt-[0.7mm] text-[3.7mm] leading-snug text-brand/55">
                {s.desc.fr}
              </span>
              <span className="mt-[1mm] whitespace-nowrap text-[2.6mm] leading-snug text-brand/40">
                🇬🇧{s.title.en}·🇪🇸{s.title.es}·🇮🇹{s.title.it}
              </span>
            </div>
          ))}
        </div>

        {/* Pied : branding + URL de secours — jamais le nom interne de la
            box (identifiant technique, sans intérêt pour le voyageur). */}
        <div className="mt-auto w-full">
          <div className="rounded-[5.7mm] bg-brand px-[8.5mm] py-[5mm] text-white">
            <div className="font-display text-[6mm] font-bold">
              Escale Box
            </div>
            <div className="mt-[1.1mm] break-all text-[4.3mm] text-white/70">
              Sans appareil photo&nbsp;? Tapez&nbsp;: {displayUrl}
            </div>
          </div>
          <p className="mt-[2.5mm] text-[4mm] text-brand/40">
            {printText.trust.fr}
          </p>
          <p className="whitespace-nowrap text-[2.6mm] text-brand/30">
            🇬🇧{printText.trust.en}·🇪🇸{printText.trust.es}·🇮🇹{printText.trust.it}
          </p>
        </div>
      </div>

      <p className="mx-auto mt-6 w-[210mm] max-w-full px-4 text-center text-xs text-brand/40 print:hidden">
        Imprimez en A4, puis collez la fiche sur votre Escale Box. Le QR code
        reste valable indéfiniment pour cette box.
      </p>
    </main>
  );
}
