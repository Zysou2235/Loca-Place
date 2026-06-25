import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Enregistre un scan (visite de la page publique d'une box). Best-effort :
 * toute erreur est avalée pour ne jamais casser l'affichage de la boutique.
 * Les bots/préchargements connus sont ignorés pour ne pas gonfler les chiffres.
 */
export async function recordScan(params: {
  boxId: string;
  productId?: string | null;
  productName?: string | null;
}): Promise<void> {
  try {
    const h = await headers();
    const userAgent = h.get("user-agent");
    const referer = h.get("referer");

    if (userAgent && /bot|crawler|spider|preview|facebookexternalhit/i.test(userAgent)) {
      return;
    }

    // Anti-gonflage : un même visiteur qui recharge la page ne compte qu'une
    // fois par tranche de 30 s (et borne la croissance de la table).
    const ip = await clientIp();
    if (!rateLimit(`scan:${ip}:${params.boxId}`, 1, 30 * 1000)) {
      return;
    }

    await prisma.scan.create({
      data: {
        boxId: params.boxId,
        productId: params.productId ?? null,
        productName: params.productName ?? null,
        userAgent: userAgent?.slice(0, 300) ?? null,
        referer: referer?.slice(0, 300) ?? null,
      },
    });
  } catch (err) {
    console.warn("[scans] enregistrement ignoré :", err);
  }
}
