import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "eskale_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.SESSION_SECRET ?? "insecure-dev-secret";
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

function createToken(hostId: string): string {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = b64url(JSON.stringify({ hostId, exp }));
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64").toString());
    if (typeof data.hostId !== "string" || typeof data.exp !== "number") {
      return null;
    }
    if (Date.now() > data.exp) return null;
    return data.hostId;
  } catch {
    return null;
  }
}

export async function setSession(hostId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createToken(hostId), {
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

export async function getSessionHostId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Returns the logged-in host (without passwordHash) or null. */
export async function getCurrentHost() {
  const hostId = await getSessionHostId();
  if (!hostId) return null;
  return prisma.host.findUnique({
    where: { id: hostId },
    select: {
      id: true,
      name: true,
      email: true,
      stripeAccountId: true,
      chargesEnabled: true,
      stripeCustomerId: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
    },
  });
}
