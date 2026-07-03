import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, MINUTE } from "@/lib/rate-limit";
import { computeVisitorHash, browserLang } from "@/lib/visitor";
import { lookupGeo } from "@/lib/geo";
import { getCurrentHost } from "@/lib/auth";
import { sendLandingVisitAlert } from "@/lib/notify";

/**
 * Identifie le visiteur pour l'alerte, avec le nom quand on l'a : hôte
 * connecté (nom + email de son compte), visiteur déjà identifié par email
 * (a acheté ou laissé son email sur une box, relié via l'empreinte visiteur
 * — si cet email correspond à un compte hôte, on donne aussi son nom),
 * visiteur récurrent anonyme (déjà vu, jamais identifié), ou nouveau visiteur.
 */
async function identifyVisitor(
  visitorHash: string | null,
  currentVisitId: string
): Promise<string> {
  const host = await getCurrentHost();
  if (host) return `Hôte connecté : ${host.name} (${host.email})`;

  if (!visitorHash) return "Nouveau visiteur";

  const [lead, order, priorVisit] = await Promise.all([
    prisma.lead.findFirst({ where: { visitorHash }, select: { email: true } }),
    prisma.order.findFirst({
      where: { visitorHash, customerEmail: { not: null } },
      select: { customerEmail: true },
    }),
    prisma.landingVisit.findFirst({
      where: { visitorHash, id: { not: currentVisitId } },
      select: { id: true },
    }),
  ]);
  const knownEmail = lead?.email ?? order?.customerEmail;
  if (knownEmail) {
    const matchingHost = await prisma.host.findUnique({
      where: { email: knownEmail },
      select: { name: true },
    });
    return matchingHost
      ? `Visiteur connu : ${matchingHost.name} (${knownEmail})`
      : `Visiteur connu : ${knownEmail}`;
  }
  if (priorVisit) return "Visiteur récurrent (déjà venu, identité inconnue)";
  return "Nouveau visiteur";
}

/**
 * Enregistre une visite de la landing page marketing et alerte l'équipe en
 * temps réel (email + Slack, selon ce qui est configuré) avec localisation
 * approximative (dérivée de l'IP, jamais l'IP elle-même) et identité du
 * visiteur si connue. Best-effort : toute erreur est avalée pour ne jamais
 * impacter la page.
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

    // Géolocalisation + identification + alerte en arrière-plan, après la réponse.
    after(async () => {
      try {
        const [geo, identity] = await Promise.all([
          lookupGeo(ip),
          identifyVisitor(visitorHash, visit.id),
        ]);
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
          identity,
        });
      } catch {
        // best-effort
      }
    });
  } catch (err) {
    console.warn("[landing-visits] enregistrement ignoré :", err);
  }
}
