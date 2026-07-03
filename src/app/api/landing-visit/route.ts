import { NextRequest } from "next/server";
import { recordLandingVisit } from "@/lib/landing-visits";

export const dynamic = "force-dynamic";

/**
 * Beacon envoyé par la landing page au chargement (LandingVisitTracker).
 * Garde la page d'accueil statique/CDN-friendly tout en traçant les visites
 * côté serveur (IP/UA lus depuis les headers de la requête, pas du body).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = typeof body?.path === "string" ? body.path : "/";
    await recordLandingVisit(path);
    return new Response("ok", { status: 200 });
  } catch {
    return new Response("bad request", { status: 400 });
  }
}
