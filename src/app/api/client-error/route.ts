import { NextRequest } from "next/server";
import { clientIp, rateLimit, MINUTE } from "@/lib/rate-limit";
import { reportServerError } from "@/lib/error-report";

export const dynamic = "force-dynamic";

/**
 * Reçoit les erreurs de rendu remontées par error.tsx (client) et les
 * alerte comme une erreur serveur (email/Slack). Limité par IP pour éviter
 * qu'une erreur en boucle ne sature les alertes.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = await clientIp();
    if (!rateLimit(`client-error:${ip}`, 5, 10 * MINUTE)) {
      return new Response("ok", { status: 200 });
    }

    const body = await req.json();
    const message = String(body?.message ?? "").slice(0, 500);
    const digest = String(body?.digest ?? "").slice(0, 100);
    const path = String(body?.path ?? "").slice(0, 300);

    await reportServerError(
      `Erreur de rendu — ${path || "page inconnue"}`,
      new Error(`${message}${digest ? ` (digest: ${digest})` : ""}`)
    );
    return new Response("ok", { status: 200 });
  } catch {
    return new Response("ok", { status: 200 });
  }
}
