import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getBaseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

/** Démarre le flux Google OAuth (Authorization Code). */
export async function GET() {
  const base = await getBaseUrl();
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${base}/host/login?error=oauth_unconfigured`);
  }

  // Paramètre anti-CSRF : stocké en cookie, revérifié au retour.
  const state = crypto.randomBytes(16).toString("hex");
  const c = await cookies();
  c.set("g_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${base}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
