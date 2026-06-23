import { headers } from "next/headers";

/**
 * Public base URL for building absolute links (Stripe redirects, etc.).
 * Uses NEXT_PUBLIC_BASE_URL if set, otherwise derives it from the request host
 * so deployments work even when the env var hasn't been configured.
 */
export async function getBaseUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
