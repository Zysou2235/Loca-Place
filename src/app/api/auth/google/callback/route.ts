import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

/** Retour de Google : valide l'état, échange le code, connecte/crée l'hôte. */
export async function GET(req: NextRequest) {
  const base = await getBaseUrl();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const c = await cookies();
  const expectedState = c.get("g_oauth_state")?.value;
  c.delete("g_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${base}/host/login?error=oauth`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}/host/login?error=oauth_unconfigured`);
  }

  try {
    // 1) Échange le code contre un token d'accès.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${base}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.redirect(`${base}/host/login?error=oauth`);
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      return NextResponse.redirect(`${base}/host/login?error=oauth`);
    }

    // 2) Récupère le profil vérifié.
    const profileRes = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (!profileRes.ok) {
      return NextResponse.redirect(`${base}/host/login?error=oauth`);
    }
    const profile = (await profileRes.json()) as {
      email?: string;
      email_verified?: boolean | string;
      name?: string;
      picture?: string;
    };

    const emailVerified =
      profile.email_verified !== false && profile.email_verified !== "false";
    if (!profile.email || !emailVerified) {
      return NextResponse.redirect(`${base}/host/login?error=oauth_email`);
    }

    const email = profile.email.toLowerCase();

    // 3) Relie au compte existant (par email) ou en crée un — email vérifié.
    const host = await prisma.host.upsert({
      where: { email },
      update: {
        emailVerified: true,
        ...(profile.picture ? { image: profile.picture } : {}),
      },
      create: {
        email,
        name: profile.name?.slice(0, 120) || email,
        emailVerified: true,
        image: profile.picture ?? null,
        // Signup Google : pas de case à cocher (redirection directe), le
        // clic sur "S'inscrire avec Google" vaut acceptation (mentionné en
        // clair sous le bouton). Voir AuthForm pour le flux email/mdp.
        cgvAcceptedAt: new Date(),
      },
      select: { id: true, tokenVersion: true },
    });

    await setSession(host.id, host.tokenVersion);
    return NextResponse.redirect(`${base}/host`);
  } catch {
    return NextResponse.redirect(`${base}/host/login?error=oauth`);
  }
}
