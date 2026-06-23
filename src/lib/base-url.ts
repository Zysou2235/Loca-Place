import { headers } from "next/headers";

/**
 * Public base URL for building absolute links (Stripe redirects, QR codes…).
 *
 * We derive it from the incoming request host FIRST, because that's always
 * correct at runtime. NEXT_PUBLIC_* vars are inlined at build time, so a stale
 * value (e.g. localhost) would otherwise stick. A non-public APP_BASE_URL can
 * override if ever needed.
 */
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  const env = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
  return env ? env.replace(/\/$/, "") : "http://localhost:3000";
}
