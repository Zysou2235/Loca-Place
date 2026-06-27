"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentHost, clearSession } from "@/lib/auth";
import { deleteHostAccount } from "@/lib/account";

export type ProfileState = { ok?: boolean; error?: string };

function clean(v: FormDataEntryValue | null, max = 120): string | null {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
}

/** L'hôte renseigne ses infos légales/facturation et son adresse de livraison. */
export async function updateHostProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const host = await getCurrentHost();
  if (!host) return { error: "Non authentifié." };

  const phone = clean(formData.get("phone"), 30);

  // Facturation / légal
  const companyName = clean(formData.get("companyName"));
  const siret = clean(formData.get("siret"), 20);
  const billingLine1 = clean(formData.get("billingLine1"), 200);
  const billingZip = clean(formData.get("billingZip"), 20);
  const billingCity = clean(formData.get("billingCity"));
  const billingCountry = clean(formData.get("billingCountry")) ?? "France";

  // Livraison — si « identique à la facturation » est coché, on recopie.
  const sameAsBilling = formData.get("sameAsBilling") === "on";
  const deliveryName = sameAsBilling
    ? companyName ?? host.name
    : clean(formData.get("deliveryName"));
  const deliveryLine1 = sameAsBilling
    ? billingLine1
    : clean(formData.get("deliveryLine1"), 200);
  const deliveryZip = sameAsBilling ? billingZip : clean(formData.get("deliveryZip"), 20);
  const deliveryCity = sameAsBilling ? billingCity : clean(formData.get("deliveryCity"));
  const deliveryCountry = sameAsBilling
    ? billingCountry
    : clean(formData.get("deliveryCountry")) ?? "France";

  await prisma.host.update({
    where: { id: host.id },
    data: {
      phone,
      companyName,
      siret,
      billingLine1,
      billingZip,
      billingCity,
      billingCountry,
      deliveryName,
      deliveryLine1,
      deliveryZip,
      deliveryCity,
      deliveryCountry,
    },
  });

  revalidatePath("/host/profil");
  revalidatePath("/host");
  return { ok: true };
}

/** Droit à l'effacement (RGPD) : l'hôte supprime lui-même son compte. */
export async function deleteOwnAccount() {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");
  await deleteHostAccount(host!.id);
  await clearSession();
  redirect("/?compte_supprime=1");
}
