import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, MINUTE } from "@/lib/rate-limit";
import { computeVisitorHash, browserLang } from "@/lib/visitor";
import { lookupGeo } from "@/lib/geo";
import { sendLandingVisitAlert } from "@/lib/notify";

/**
 * Enregistre une visite de la landing page marketing et alerte l'équipe par
 * email en temps réel (localisation dérivée de l'IP, jamais l'IP elle-même).
 * Best-effort : toute erreur est avalée pour ne jamais impacter la page.
 *
 * Anti-spam : un même visiteur (empreinte IP+UA) ne déclenche qu'une alerte
 * par tranche de 15 min, pour éviter une boîte mail saturée par les rechargements.
 */
export async function recordLandingVisit(path: string = "/"): Promise<void> {
  try {
    const h = await headers();
    const userAgent = h.get("user-agent");
    const referer = h.get("referer");

    if (userAgent && /bot|crawler|spider|preview|facebookexternalhit/i.test(userAgent)) {
      return;
    }

    const ip = await clientIp();
    if (!rateLimit(`landing:${ip}`, 1, 15 * MINUTE)) return;

    const [visitorHash, lang] = await Promise.all([
      computeVisitorHash(),
      browserLang(),
    ]);

    const visit = await prisma.landingVisit.create({
      data: {
        path: path.slice(0, 200),
        userAgent: userAgent?.slice(0, 300) ?? null,
        referer: referer?.slice(0, 300) ?? null,
        lang,
        visitorHash,
      },
      select: { id: true },
    });

    // Géolocalisation + email d'alerte en arrière-plan, après la réponse.
    after(async () => {
      try {
        const geo = await lookupGeo(ip);
        if (geo?.country) {
          await prisma.landingVisit.update({
            where: { id: visit.id },
            data: { country: geo.country, city: geo.city },
          });
        }
        await sendLandingVisitAlert({
          country: geo?.country ?? null,
          city: geo?.city ?? null,
          referer: referer?.slice(0, 300) ?? null,
          path,
        });
      } catch {
        // best-effort
      }
    });
  } catch (err) {
    console.warn("[landing-visits] enregistrement ignoré :", err);
  }
}
