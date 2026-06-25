import { headers } from "next/headers";

/**
 * Limiteur de débit simple en mémoire (fenêtre fixe). Suffisant pour un MVP
 * mono-instance ; à remplacer par un store partagé (Redis/Upstash) le jour où
 * l'app tourne sur plusieurs instances. Le but : freiner brute-force, spam de
 * comptes et abus d'envois email/SMS (coût).
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Adresse IP du client (derrière le proxy Railway). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** true = autorisé, false = quota dépassé. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Nettoyage opportuniste pour éviter une croissance non bornée.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
  }

  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
