import Link from "next/link";
import { GuideShell, GuideSection, GuideTip } from "../GuideShell";
import { getGuide } from "../guides-data";

const guide = getGuide("accueil-voyageurs-5-etoiles");

export const metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: `/guides/${guide.slug}` },
  openGraph: {
    title: guide.title,
    description: guide.description,
    url: `/guides/${guide.slug}`,
  },
};

export default function Page() {
  return (
    <GuideShell guide={guide}>
      <p className="text-lg leading-relaxed text-brand/75">
        Sur Airbnb comme sur Booking, la note fait le classement, le
        classement fait les réservations. Et la note ne se joue presque jamais
        sur la taille du logement — elle se joue sur des détails
        d&apos;attention que le voyageur remarque et raconte. Bonne
        nouvelle&nbsp;: la plupart ne coûtent presque rien, et certains
        peuvent même vous rapporter.
      </p>

      <GuideSection title="Avant l'arrivée : la communication qui rassure">
        <p>
          L&apos;expérience commence à la réservation. Un message de
          confirmation chaleureux, puis un message de pré-arrivée 2-3 jours
          avant avec les infos pratiques (accès, parking, horaires) évite 90%
          des frictions. C&apos;est aussi le bon moment pour proposer vos
          services payants — arrivée anticipée, panier petit-déjeuner — au
          moment où le voyageur organise son trajet.
        </p>
      </GuideSection>

      <GuideSection title="Le jour J : un check-in sans accroc">
        <p>
          Le stress du voyageur est maximal entre la route et la porte
          d&apos;entrée. Boîte à clés fiable, instructions avec photos, un
          message «&nbsp;bien arrivés&nbsp;?&nbsp;» en début de soirée&nbsp;:
          la fluidité du premier quart d&apos;heure pèse énormément dans
          l&apos;impression générale — et donc dans l&apos;avis final.
        </p>
      </GuideSection>

      <GuideSection title="Les attentions qui marquent (et celles qui rapportent)">
        <p>
          C&apos;est ici que se gagnent les 5 étoiles. Les grands
          classiques&nbsp;:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Le mot de bienvenue</strong>, manuscrit si possible, avec
            vos adresses préférées du coin — restaurant, marché, balade.
          </li>
          <li>
            <strong>Les basiques garantis</strong>&nbsp;: café, thé, sucre,
            sel, huile. Leur absence est l&apos;une des remarques négatives
            les plus fréquentes en location.
          </li>
          <li>
            <strong>La touche locale</strong>&nbsp;: quelques produits de la
            région en accès libre (une confiture, des biscuits) — ou mieux,
            une vraie{" "}
            <Link
              href="/guides/minibar-airbnb-gite"
              className="font-medium text-accent hover:underline"
            >
              boutique de produits locaux en libre-service
            </Link>
            &nbsp;: l&apos;attention est là, et elle génère du revenu au lieu
            d&apos;en coûter. Avec une box en libre-service type{" "}
            <Link href="/" className="font-medium text-accent hover:underline">
              Escale Box
            </Link>
            , le voyageur vit une expérience originale dont il parle dans son
            avis — et vous encaissez.
          </li>
        </ul>
        <GuideTip>
          Une attention offerte + une offre payante fonctionne mieux que tout
          payant&nbsp;: le cadeau crée la sympathie, la boutique convertit
          l&apos;envie.
        </GuideTip>
      </GuideSection>

      <GuideSection title="Pendant le séjour : présent sans être pesant">
        <p>
          Un message à mi-séjour pour les longues durées, une réponse rapide
          quand on vous sollicite, et c&apos;est tout. Les voyageurs
          plébiscitent les hôtes «&nbsp;disponibles mais discrets&nbsp;». Un
          livret d&apos;accueil complet (WiFi, appareils, tri, numéros utiles)
          réduit drastiquement les sollicitations.
        </p>
      </GuideSection>

      <GuideSection title="Après le départ : transformer le séjour en avis">
        <p>
          Remerciez dans les 24&nbsp;h, dites que ce fut un plaisir de les
          accueillir, et laissez un avis voyageur de votre côté&nbsp;: la
          réciprocité joue à plein. Si un problème a eu lieu pendant le
          séjour, réglez-le <em>avant</em> de demander quoi que ce soit —
          un problème bien géré fait souvent un meilleur avis qu&apos;un
          séjour sans histoire.
        </p>
      </GuideSection>

      <GuideSection title="L'essentiel">
        <p>
          Communication claire, arrivée fluide, une attention locale qui
          surprend&nbsp;: voilà le trio qui remplit la colonne des 5 étoiles.
          Et si cette attention peut aussi générer du revenu — c&apos;est
          l&apos;objet de notre guide des{" "}
          <Link
            href="/guides/revenus-complementaires-airbnb"
            className="font-medium text-accent hover:underline"
          >
            revenus complémentaires pour votre location
          </Link>{" "}
          — vous gagnez sur les deux tableaux.
        </p>
      </GuideSection>
    </GuideShell>
  );
}
