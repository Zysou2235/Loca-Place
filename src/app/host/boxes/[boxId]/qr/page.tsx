import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

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
    select: { qrSlug: true, name: true, location: true },
  });
  if (!box) notFound();

  const targetUrl = `${await getBaseUrl()}/b/${box.qrSlug}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center px-6 py-10">
      <div className="mb-8 flex w-full items-center justify-between print:hidden">
        <Link
          href={`/host/boxes/${boxId}`}
          className="text-sm font-medium text-accent"
        >
          ← Retour
        </Link>
        <PrintButton />
      </div>

      <div className="flex w-full flex-col items-center rounded-3xl border border-black/10 bg-white p-10 text-center shadow-card print:border-0 print:shadow-none">
        <Image
          src="/escale-box-logo.png"
          alt="Escale Box"
          width={200}
          height={200}
          priority
          className="h-auto w-40"
        />

        <h1 className="mt-6 font-display text-2xl font-extrabold text-brand">
          {box.name}
        </h1>
        {box.location && (
          <p className="mt-1 text-sm text-brand/50">{box.location}</p>
        )}

        <p className="mt-6 font-display text-lg font-semibold text-brand">
          Scannez pour découvrir &amp; acheter
        </p>

        <div className="mt-4 rounded-2xl border border-black/10 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr/${box.qrSlug}`}
            alt={`QR code de ${box.name}`}
            width={320}
            height={320}
            className="h-72 w-72"
          />
        </div>

        <p className="mt-4 break-all text-xs text-brand/40">{targetUrl}</p>

        <p className="mt-6 max-w-xs text-sm text-brand/60">
          Pointez l&apos;appareil photo de votre téléphone vers ce code —
          paiement sécurisé, sans application.
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-brand/40 print:hidden">
        Imprimez cette page et collez-la sur votre Escale Box. Le QR code reste
        valable indéfiniment pour cette box.
      </p>
    </main>
  );
}
