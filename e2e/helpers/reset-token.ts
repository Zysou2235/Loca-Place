import crypto from "crypto";

/**
 * Reproduit src/lib/reset-token.ts pour fabriquer un lien de reset valide en
 * test, sans dépendre d'un vrai envoi d'email (RESEND_API_KEY absent en CI).
 */
const PURPOSE = "pwreset";
const TTL_MS = 60 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return Buffer.from(crypto.createHmac("sha256", secret).update(payload).digest())
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createResetToken(hostId: string, tokenVersion: number): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET requis pour le helper de test.");
  const payload = Buffer.from(
    JSON.stringify({ hostId, v: tokenVersion, exp: Date.now() + TTL_MS, p: PURPOSE })
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${payload}.${sign(payload, secret)}`;
}
