import crypto from "crypto";
import { headers } from "next/headers";
import { clientIp } from "@/lib/rate-limit";

/**
 * Empreinte visiteur anonyme : HMAC(secret, ip|userAgent) tronqué à 16 hex.
 * - L'IP brute n'est jamais stockée : impossible de la retrouver depuis le hash.
 * - Stable dans le temps → permet de mesurer les revisites et de relier les
 *   visites à un email quand la personne achète ou fait un opt-in.
 */
export async function computeVisitorHash(): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  try {
    const h = await headers();
    const ip = await clientIp();
    const ua = h.get("user-agent") ?? "";
    if (!ip || ip === "unknown") return null;
    return crypto
      .createHmac("sha256", secret)
      .update(`${ip}|${ua}`)
      .digest("hex")
      .slice(0, 16);
  } catch {
    return null;
  }
}

/** Langue préférée du navigateur (1er tag Accept-Language, ex. "fr", "en-US"). */
export async function browserLang(): Promise<string | null> {
  try {
    const h = await headers();
    const raw = h.get("accept-language");
    if (!raw) return null;
    const first = raw.split(",")[0]?.trim().slice(0, 12);
    return first || null;
  } catch {
    return null;
  }
}
