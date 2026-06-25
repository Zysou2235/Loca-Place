import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Preuve, côté navigateur, que c'est bien CE visiteur qui a lancé le paiement.
 * Sert à n'afficher le code d'ouverture sur la page de succès qu'à l'acheteur,
 * et pas à quiconque mettrait la main sur l'URL (qui contient le session_id).
 */
const PREFIX = "pc_";

function secret(): string {
  return process.env.SESSION_SECRET ?? "insecure-dev-secret";
}

function cookieName(sessionId: string): string {
  // Nom déterministe mais court, dérivé du session_id.
  return (
    PREFIX +
    crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 24)
  );
}

function sign(sessionId: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(sessionId)
    .digest("base64url");
}

/** À appeler au moment de créer la session Stripe (côté acheteur). */
export async function grantPurchaseAccess(sessionId: string): Promise<void> {
  const c = await cookies();
  c.set(cookieName(sessionId), sign(sessionId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2, // 2 h, le temps de finir le paiement et revenir
  });
}

/** true si ce navigateur est bien celui qui a initié ce paiement. */
export async function hasPurchaseAccess(sessionId: string): Promise<boolean> {
  const c = await cookies();
  const value = c.get(cookieName(sessionId))?.value;
  if (!value) return false;
  const expected = sign(sessionId);
  // Comparaison à temps constant.
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
