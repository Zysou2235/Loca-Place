import Link from "next/link";
import { GuideShell, GuideSection, GuideTip } from "../GuideShell";
import { getGuide } from "../guides-data";

const guide = getGuide("revenus-complementaires-airbnb");

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
        Le prix par nuit n&apos;est pas le seul levier de revenu d&apos;une
        location saisonnière — et c&apos;est souvent le plus difficile à
        augmenter sans perdre en taux d&apos;occupation. Les hôtes les plus
        rentables raisonnent autrement&nbsp;: chaque séjour est une occasion de
        proposer des services et produits que les voyageurs sont contents de
        payer. Voici 7 pistes concrètes, de la plus simple à mettre en place à
        la plus ambitieuse.
      </p>

      <GuideSection title="1. La boutique en libre-service (minibar nouvelle génération)">
        <p>
          C&apos;est la piste au meilleur rapport effort/revenu&nbsp;: une
          sélection de produits — boissons, snacks, produits locaux, essentiels
          oubliés — en libre-service dans le logement. Le voyageur arrive
          souvent tard, fatigué, les commerces sont fermés&nbsp;: il est prêt à
          payer pour ne pas ressortir.
        </p>
        <p>
          Le point clé, c&apos;est l&apos;encaissement. La boîte à
          confiance avec des pièces fonctionne mal (personne n&apos;a de
          monnaie) ; le paiement par QR code, en ligne et sans application,
          supprime cette friction. C&apos;est exactement ce que fait{" "}
          <Link href="/" className="font-medium text-accent hover:underline">
            Escale Box
          </Link>{" "}
          : le voyageur scanne, paie, et reçoit le code du cadenas.
        </p>
        <p>
          Pour le choix des produits et des prix, on a écrit un{" "}
          <Link
            href="/guides/minibar-airbnb-gite"
            className="font-medium text-accent hover:underline"
          >
            guide complet du minibar en location
          </Link>
          .
        </p>
      </GuideSection>

      <GuideSection title="2. Early check-in et late check-out payants">
        <p>
          Arriver plus tôt ou partir plus tard est l&apos;un des services les
          plus demandés — et beaucoup d&apos;hôtes l&apos;offrent gratuitement
          alors que les hôtels le facturent systématiquement. Si votre planning
          de ménage le permet, proposez ces créneaux en supplément dans votre
          message de pré-arrivée. C&apos;est un revenu sans aucun coût.
        </p>
      </GuideSection>

      <GuideSection title="3. Le panier petit-déjeuner">
        <p>
          Simple à préparer avec des produits locaux longue conservation
          (confitures, jus, biscuits, café) ou en partenariat avec la
          boulangerie du village. Proposé à la réservation ou la veille de
          l&apos;arrivée, il transforme un coût d&apos;accueil en source de
          revenu — et il alimente les avis&nbsp;: «&nbsp;petit-déjeuner avec
          des produits de la région, on a adoré&nbsp;».
        </p>
      </GuideSection>

      <GuideSection title="4. La location d'équipements">
        <p>
          Vélos, barbecue, matériel bébé (lit parapluie, chaise haute),
          paddle, raquettes… selon votre région, le matériel que vous possédez
          déjà peut se louer à la nuit ou au séjour. Indiquez-le dans votre
          annonce&nbsp;: c&apos;est aussi un critère de choix qui vous
          différencie des logements voisins.
        </p>
      </GuideSection>

      <GuideSection title="5. Les partenariats locaux">
        <p>
          Caviste, producteur, loueur de kayaks, spa, restaurant&nbsp;:
          proposez à des acteurs locaux d&apos;être recommandés à vos
          voyageurs, en échange d&apos;une remise pour eux ou d&apos;une
          commission pour vous. Les voyageurs cherchent des adresses de
          confiance&nbsp;; vous êtes leur source la plus crédible.
        </p>
      </GuideSection>

      <GuideSection title="6. Les consommables premium">
        <p>
          Bois pour la cheminée ou le poêle, jetons de spa, recharge de
          machine à café en grains, bouteille de vin de la région… Tout ce qui
          améliore le séjour «&nbsp;sur place, tout de suite&nbsp;» se vend
          bien mieux qu&apos;on ne l&apos;imagine, surtout hors saison.
        </p>
      </GuideSection>

      <GuideSection title="7. Les services à la demande">
        <p>
          Ménage supplémentaire en cours de séjour, panier de courses prêt à
          l&apos;arrivée, transfert gare/aéroport… Ces services demandent plus
          d&apos;organisation, mais pour les séjours longs ou les logements
          haut de gamme, ils justifient des montants significatifs.
        </p>
      </GuideSection>

      <GuideSection title="Par où commencer ?">
        <p>
          Commencez par ce qui ne demande aucune présence physique&nbsp;: la
          boutique en libre-service et le late check-out. Ce sont les deux
          leviers qui génèrent du revenu même quand vous n&apos;êtes pas là —
          et dans une activité où votre temps est la vraie ressource rare,
          c&apos;est ce qui change tout.
        </p>
        <GuideTip>
          Testez une offre à la fois et regardez ce que vos voyageurs achètent
          réellement pendant un mois avant d&apos;élargir. Mieux vaut 6
          produits qui tournent que 20 qui dorment.
        </GuideTip>
      </GuideSection>
    </GuideShell>
  );
}
