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

/** Require an authenticated admin; redirect otherwise. Returns the admin host. */
export async function requireAdmin() {
  const host = await getCurrentHost();
  if (!host) redirect("/host/login");
  if (!isAdminEmail(host.email)) redirect("/host");
  return host;
}
