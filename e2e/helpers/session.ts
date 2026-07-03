import crypto from "crypto";
import type { BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const COOKIE_NAME = "eskale_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(payload).digest());
}

function createToken(hostId: string, tokenVersion: number, secret: string): string {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = b64url(JSON.stringify({ hostId, v: tokenVersion, exp }));
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Crée un hôte de test directement en DB et pose le cookie de session
 * dans le contexte Playwright — bypass complet du signup/login (et donc
 * du rate-limit). Idempotent par email.
 */
export async function loginAs(
  context: BrowserContext,
  prisma: PrismaClient,
  opts: {
    email?: string;
    name?: string;
    emailVerified?: boolean;
    subscriptionStatus?: "none" | "active" | "trialing" | "canceled" | "past_due";
    subscriptionPlan?: "essentiel" | "duo" | "multi" | null;
    boxQuota?: number;
    stripeCustomerId?: string | null;
    stripeAccountId?: string | null;
    chargesEnabled?: boolean;
  } = {}
): Promise<{ email: string; hostId: string }> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET requis pour le helper de test.");

  const email =
    opts.email ??
    `pwt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.escalebox.fr`;
  const name = opts.name ?? "Test Hôte";

  const host = await prisma.host.upsert({
    where: { email },
    update: {
      name,
      emailVerified: opts.emailVerified ?? true,
      subscriptionStatus: opts.subscriptionStatus ?? "none",
      subscriptionPlan: opts.subscriptionPlan ?? null,
      boxQuota: opts.boxQuota ?? 0,
      stripeCustomerId: opts.stripeCustomerId ?? null,
      stripeAccountId: opts.stripeAccountId ?? null,
      chargesEnabled: opts.chargesEnabled ?? false,
    },
    create: {
      name,
      email,
      emailVerified: opts.emailVerified ?? true,
      subscriptionStatus: opts.subscriptionStatus ?? "none",
      subscriptionPlan: opts.subscriptionPlan ?? null,
      boxQuota: opts.boxQuota ?? 0,
      stripeCustomerId: opts.stripeCustomerId ?? null,
      stripeAccountId: opts.stripeAccountId ?? null,
      chargesEnabled: opts.chargesEnabled ?? false,
    },
  });

  const token = createToken(host.id, host.tokenVersion, secret);
  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
    },
  ]);

  return { email, hostId: host.id };
}
