import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { computeVisitorHash, browserLang } from "@/lib/visitor";
import { lookupGeo } from "@/lib/geo";

/**
 * Enregistre un scan (visite de la page publique d'une box). Best-effort :
 * toute erreur est avalée pour ne jamais casser l'affichage de la boutique.
 * Les bots/préchargements connus sont ignorés pour ne pas gonfler les chiffres.
 *
 * Données collectées (visibles admin uniquement) : appareil (user-agent),
 * provenance (referer), langue du navigateur, empreinte visiteur anonyme
 * (revisites), géolocalisation approximative pays/ville (dérivée de l'IP en
 * arrière-plan — l'IP brute n'est pas stockée).
 *
 * Renvoie l'id du scan créé (ou null si ignoré) — utilisé par le beacon
 * client pour rattacher le temps passé sur la page.
 */
export async function recordScan(params: {
  boxId: string;
  productId?: string | null;
  productName?: string | null;
}): Promise<string | null> {
  try {
    const h = await headers();
    const userAgent = h.get("user-agent");
    const referer = h.get("referer");

    if (userAgent && /bot|crawler|spider|preview|facebookexternalhit/i.test(userAgent)) {
      return null;
    }

    // Anti-gonflage : un même visiteur qui recharge la page ne compte qu'une
    // fois par tranche de 30 s (et borne la croissance de la table).
    const ip = await clientIp();
    if (!rateLimit(`scan:${ip}:${params.boxId}`, 1, 30 * 1000)) {
      return null;
    }

    const [visitorHash, lang] = await Promise.all([
      computeVisitorHash(),
      browserLang(),
    ]);

    const scan = await prisma.scan.create({
      data: {
        boxId: params.boxId,
        productId: params.productId ?? null,
        productName: params.productName ?? null,
        userAgent: userAgent?.slice(0, 300) ?? null,
        referer: referer?.slice(0, 300) ?? null,
        lang,
        visitorHash,
      },
      select: { id: true },
    });

    // Géolocalisation en arrière-plan, APRÈS l'envoi de la réponse — la page
    // voyageur ne doit jamais attendre un appel réseau externe.
    after(async () => {
      try {
        const geo = await lookupGeo(ip);
        if (geo?.country) {
          await prisma.scan.update({
            where: { id: scan.id },
            data: { country: geo.country, city: geo.city },
          });
        }
      } catch {
        // best-effort
      }
    });

    return scan.id;
  } catch (err) {
    console.warn("[scans] enregistrement ignoré :", err);
    return null;
  }
}
