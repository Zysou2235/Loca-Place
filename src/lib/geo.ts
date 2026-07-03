/**
 * Géolocalisation approximative (pays/ville) à partir de l'IP, via l'API
 * gratuite ipwho.is. Best-effort : timeout court, toute erreur → null.
 * On ne stocke que le résultat (pays/ville), jamais l'IP.
 */

const PRIVATE_IP =
  /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1|fc|fe80|unknown)/i;

export type GeoResult = { country: string | null; city: string | null };

export async function lookupGeo(ip: string): Promise<GeoResult | null> {
  if (!ip || PRIVATE_IP.test(ip)) return null;
  if (process.env.GEO_LOOKUP === "0") return null; // désactivable (tests)

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,city`,
      { signal: ctrl.signal, cache: "no-store" }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      country?: string;
      city?: string;
    };
    if (!data.success) return null;
    return {
      country: data.country?.slice(0, 60) ?? null,
      city: data.city?.slice(0, 60) ?? null,
    };
  } catch {
    return null;
  }
}
