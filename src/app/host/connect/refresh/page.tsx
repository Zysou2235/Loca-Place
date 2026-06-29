import { redirect } from "next/navigation";
import { getCurrentHost } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

/**
 * Stripe redirige ici quand le lien d'onboarding Connect a expiré.
 * On régénère un nouveau lien et on renvoie l'hôte vers Stripe.
 */
export default async function ConnectRefreshPage() {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");
  if (!host.stripeAccountId) redirect("/host");

  const baseUrl = await getBaseUrl();
  const link = await stripe.accountLinks.create({
    account: host.stripeAccountId,
    refresh_url: `${baseUrl}/host/connect/refresh`,
    return_url: `${baseUrl}/host?connect=return`,
    type: "account_onboarding",
  });
  redirect(link.url);
}
