import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentHost } from "@/lib/auth";
import { HostShell } from "../HostShell";
import { ProfileForm } from "./ProfileForm";
import { DangerZone } from "./DangerZone";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ incomplete?: string }>;
}) {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");

  const { incomplete } = await searchParams;

  const data = await prisma.host.findUnique({
    where: { id: host.id },
    select: {
      phone: true,
      companyName: true,
      siret: true,
      billingLine1: true,
      billingZip: true,
      billingCity: true,
      billingCountry: true,
      deliveryName: true,
      deliveryLine1: true,
      deliveryZip: true,
      deliveryCity: true,
      deliveryCountry: true,
    },
  });

  const defaults = {
    phone: data?.phone ?? "",
    companyName: data?.companyName ?? host.name ?? "",
    siret: data?.siret ?? "",
    billingLine1: data?.billingLine1 ?? "",
    billingZip: data?.billingZip ?? "",
    billingCity: data?.billingCity ?? "",
    billingCountry: data?.billingCountry ?? "France",
    deliveryName: data?.deliveryName ?? "",
    deliveryLine1: data?.deliveryLine1 ?? "",
    deliveryZip: data?.deliveryZip ?? "",
    deliveryCity: data?.deliveryCity ?? "",
    deliveryCountry: data?.deliveryCountry ?? "France",
  };

  return (
    <HostShell hostName={host.name}>
      <h1 className="font-display text-2xl font-bold text-brand">
        Mes informations
      </h1>
      <p className="mt-1 text-brand/60">
        Renseignez votre facturation et votre adresse de livraison pour recevoir
        votre box.
      </p>
      {incomplete && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Complétez d&apos;abord ces informations : elles sont nécessaires
          <strong> avant de vous abonner</strong> et pour l&apos;envoi de votre
          box.
        </div>
      )}
      <div className="mt-8">
        <ProfileForm defaults={defaults} />
      </div>
      <DangerZone />
    </HostShell>
  );
}
