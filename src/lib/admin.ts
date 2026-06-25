import { redirect } from "next/navigation";
import { getCurrentHost } from "@/lib/auth";

/** Comma-separated allowlist of admin emails (env ADMIN_EMAILS). */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** Require an authenticated admin; redirect otherwise. Returns the admin host.
 *  L'email doit être VÉRIFIÉ (connexion Google ou lien email) : sans ça,
 *  n'importe qui pourrait revendiquer un email admin par simple inscription. */
export async function requireAdmin() {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");
  if (!host.emailVerified || !isAdminEmail(host.email)) redirect("/host");
  return host;
}

/** Vrai si le compte est un admin effectif (email listé ET vérifié). */
export function isEffectiveAdmin(host: {
  email: string;
  emailVerified: boolean;
}): boolean {
  return host.emailVerified && isAdminEmail(host.email);
}
