import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Bornes de plausibilité : en dessous c'est du bruit, au-dessus c'est un
// onglet oublié — on plafonne pour ne pas fausser les moyennes.
const MIN_MS = 500;
const MAX_MS = 30 * 60 * 1000; // 30 min

/**
 * Beacon de fin de visite : la page voyageur envoie { scanId, ms } via
 * navigator.sendBeacon quand le visiteur quitte la page. On enregistre le
 * temps passé sur le scan correspondant (une seule fois — pas d'écrasement).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const scanId = String(body?.scanId ?? "");
    const ms = Number(body?.ms);

    if (!/^c[a-z0-9]{20,32}$/i.test(scanId) || !Number.isFinite(ms)) {
      return new Response("bad request", { status: 400 });
    }

    const clamped = Math.min(MAX_MS, Math.max(MIN_MS, Math.round(ms)));
    // updateMany + filtre durationMs:null → idempotent, jamais d'erreur si
    // le scan n'existe pas ou si un premier beacon est déjà passé.
    await prisma.scan.updateMany({
      where: { id: scanId, durationMs: null },
      data: { durationMs: clamped },
    });
    return new Response("ok", { status: 200 });
  } catch {
    return new Response("bad request", { status: 400 });
  }
}
