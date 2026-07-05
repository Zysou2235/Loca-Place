import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "eskale_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    // Never allow a guessable signing key in production — sessions would be forgeable.
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production.");
    }
    return "insecure-dev-secret";
  }
  return value;
}

/* ----------------------------------------------------------- Passwords */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

/* ----------------------------------------------------------- Sessions */

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string): string {
  return b64url(
    crypto.createHmac("sha256", secret()).update(payload).digest()
  );
}

function createToken(hostId: string, tokenVersion: number): string {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = b64url(JSON.stringify({ hostId, v: tokenVersion, exp }));
  return `${payload}.${sign(payload)}`;
}

type TokenData = { hostId: string; v: number };

/** Vérifie signature + expiration (sans accès base). */
function readToken(token: string): TokenData | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64").toString());
    if (typeof data.hostId !== "string" || typeof data.exp !== "number") {
      return null;
    }
    if (Date.now() > data.exp) return null;
    const v = typeof data.v === "number" ? data.v : 0;
    return { hostId: data.hostId, v };
  } catch {
    return null;
  }
}

async function readCookieToken(): Promise<TokenData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readToken(token);
}

export async function setSession(
  hostId: string,
  tokenVersion: number
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createToken(hostId, tokenVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** hostId si la session est valide ET non révoquée (tokenVersion à jour). */
export async function getSessionHostId(): Promise<string | null> {
  const data = await readCookieToken();
  if (!data) return null;
  const host = await prisma.host.findUnique({
    where: { id: data.hostId },
    select: { id: true, tokenVersion: true },
  });
  if (!host || host.tokenVersion !== data.v) return null;
  return host.id;
}

/** Returns the logged-in host (without passwordHash) or null. */
export async function getCurrentHost() {
  const data = await readCookieToken();
  if (!data) return null;
  const host = await prisma.host.findUnique({
    where: { id: data.hostId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      tokenVersion: true,
      stripeAccountId: true,
      chargesEnabled: true,
      stripeCustomerId: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      boxQuota: true,
      trialEndsAt: true,
    },
  });
  if (!host || host.tokenVersion !== data.v) return null;
  return host;
}
