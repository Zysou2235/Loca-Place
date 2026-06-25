import crypto from "crypto";

/**
 * Jeton signé pour réinitialiser un mot de passe. Embarque la version de
 * session de l'hôte : dès que le reset aboutit, on incrémente cette version,
 * ce qui rend le lien inutilisable une seconde fois (et révoque les sessions).
 */
const PURPOSE = "pwreset";
const TTL_MS = 60 * 60 * 1000; // 1 h

function secret(): string {
  return process.env.SESSION_SECRET ?? "insecure-dev-secret";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createResetToken(hostId: string, tokenVersion: number): string {
  const payload = Buffer.from(
    JSON.stringify({ hostId, v: tokenVersion, exp: Date.now() + TTL_MS, p: PURPOSE })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyResetToken(
  token: string
): { hostId: string; v: number } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      d.p !== PURPOSE ||
      typeof d.hostId !== "string" ||
      typeof d.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > d.exp) return null;
    return { hostId: d.hostId, v: typeof d.v === "number" ? d.v : 0 };
  } catch {
    return null;
  }
}
