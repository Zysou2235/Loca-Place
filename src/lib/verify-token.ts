import crypto from "crypto";

/**
 * Jeton signé de vérification d'email (inscription par mot de passe).
 * Prouve la possession de la boîte mail avant d'activer le compte.
 */
const PURPOSE = "verify";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function secret(): string {
  return process.env.SESSION_SECRET ?? "insecure-dev-secret";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createVerifyToken(hostId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ hostId, exp: Date.now() + TTL_MS, p: PURPOSE })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyVerifyToken(token: string): { hostId: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (d.p !== PURPOSE || typeof d.hostId !== "string" || typeof d.exp !== "number") {
      return null;
    }
    if (Date.now() > d.exp) return null;
    return { hostId: d.hostId };
  } catch {
    return null;
  }
}
