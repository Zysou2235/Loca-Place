import Link from "next/link";
import { GuideShell, GuideSection, GuideTip } from "../GuideShell";
import { getGuide } from "../guides-data";

const guide = getGuide("minibar-airbnb-gite");

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
        Le minibar est probablement la source de revenu additionnel la plus
        simple à installer dans une location saisonnière&nbsp;: pas de
        présence requise, pas de compétence particulière, un investissement de
        départ minime. Mais entre le panier qui dort dans un placard et la
        boutique qui vend à chaque séjour, tout se joue sur trois
        décisions&nbsp;: quoi proposer, à quel prix, et comment encaisser.
      </p>

      <GuideSection title="Pourquoi ça marche">
        <p>
          Le voyageur type arrive en fin de journée, après la route, parfois
          après la fermeture des commerces — et dans beaucoup de villages, il
          n&apos;y a tout simplement plus de commerce. À ce moment précis, une
          boisson fraîche, un en-cas ou un produit du coin disponible{" "}
          <em>immédiatement</em> a beaucoup plus de valeur que son prix en
          supermarché. C&apos;est le même ressort que le minibar
          d&apos;hôtel&nbsp;: on paie la disponibilité, pas le produit.
        </p>
      </GuideSection>

      <GuideSection title="Que mettre dedans ?">
        <p>Les quatre familles qui fonctionnent, à adapter à votre région&nbsp;:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Boissons</strong> — eaux, sodas, jus locaux, bières
            artisanales de la région, éventuellement une bouteille de vin
            local. Les boissons sont le moteur du minibar.
          </li>
          <li>
            <strong>Snacks & épicerie fine</strong> — biscuits, chips
            artisanales, terrines, fromages sous vide, confiseries. Privilégiez
            les DLC longues.
          </li>
          <li>
            <strong>Produits locaux «&nbsp;souvenir&nbsp;»</strong> — miel,
            confiture, huile d&apos;olive, savon… Le voyageur repart avec un
            morceau de la région&nbsp;: c&apos;est un achat plaisir, pas un
            achat de dépannage, et il valorise votre logement.
          </li>
          <li>
            <strong>Essentiels oubliés</strong> — brosse à dents, chargeur,
            dosettes de lessive, kit pluie, jeux de cartes. Faible rotation
            mais énorme valeur perçue le jour où quelqu&apos;un en a besoin.
          </li>
        </ul>
        <GuideTip>
          Travaillez avec les producteurs du coin&nbsp;: prix d&apos;achat
          corrects, histoire à raconter dans l&apos;annonce, et les voyageurs
          adorent — c&apos;est ce qu&apos;ils mentionnent dans les avis.
        </GuideTip>
      </GuideSection>

      <GuideSection title="À quel prix vendre ?">
        <p>
          La règle simple&nbsp;: un prix «&nbsp;confort&nbsp;» mais pas
          «&nbsp;aéroport&nbsp;». Le voyageur compare inconsciemment avec le
          distributeur automatique ou la supérette, pas avec le supermarché.
          Un doublement du prix d&apos;achat est généralement bien accepté sur
          les petits montants&nbsp;; sur les produits locaux, alignez-vous sur
          le prix de la boutique du producteur — la valeur est dans le
          produit, pas dans la disponibilité.
        </p>
        <p>
          Restez sur des prix ronds et lisibles. Un minibar n&apos;est pas un
          rayon de supermarché&nbsp;: 6 à 12 références bien choisies suffisent
          largement, et simplifient votre réassort.
        </p>
      </GuideSection>

      <GuideSection title="L'encaissement : là où tout se joue">
        <p>Trois modèles existent, du plus artisanal au plus fluide&nbsp;:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>La boîte à confiance</strong> (espèces) — simple, mais
            plus personne n&apos;a de monnaie, les comptes sont invérifiables
            et la caisse peut disparaître.
          </li>
          <li>
            <strong>Le virement / Lydia / PayPal affiché</strong> — mieux,
            mais la friction est réelle&nbsp;: saisir un RIB ou chercher un
            contact pour 4&nbsp;€, beaucoup abandonnent.
          </li>
          <li>
            <strong>Le QR code avec paiement en ligne</strong> — le voyageur
            scanne, paie par carte ou Apple&nbsp;Pay en quelques secondes,
            sans application ni compte. C&apos;est le modèle{" "}
            <Link href="/" className="font-medium text-accent hover:underline">
              Escale Box
            </Link>
            &nbsp;: la box verrouillée s&apos;ouvre avec le code reçu après
            paiement, vous suivez ventes et stock depuis votre espace, et
            l&apos;argent arrive directement sur votre compte, sans commission
            sur les ventes.
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="La logistique au quotidien">
        <p>
          Intégrez le contrôle du minibar à votre routine de ménage&nbsp;:
          réassort, vérification des DLC, propreté de la présentation. Tenez
          une mini-liste de stock (ou laissez votre outil la tenir pour vous).
          Et surveillez ce qui se vend&nbsp;: au bout d&apos;un mois, vous
          saurez exactement quoi doubler et quoi retirer.
        </p>
      </GuideSection>

      <GuideSection title="Les erreurs à éviter">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Trop de références</strong> au lancement — commencez
            petit, élargissez avec les données.
          </li>
          <li>
            <strong>Des prix cachés</strong> — affichez clairement chaque
            prix&nbsp;: la mauvaise surprise tue la confiance (et les avis).
          </li>
          <li>
            <strong>Ignorer l&apos;alcool</strong> — la vente d&apos;alcool
            est réglementée&nbsp;: renseignez-vous sur vos obligations avant
            d&apos;en proposer.
          </li>
          <li>
            <strong>L&apos;oublier dans l&apos;annonce</strong> — votre
            boutique est un argument de réservation. Montrez-la en photo.
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="En résumé">
        <p>
          Un bon minibar, c&apos;est une petite sélection bien locale, des
          prix affichés et honnêtes, et surtout zéro friction au paiement.
          Bien fait, il rapporte à chaque séjour, améliore vos avis, et ne
          vous demande que quelques minutes par rotation. Pour aller plus
          loin, voyez nos{" "}
          <Link
            href="/guides/revenus-complementaires-airbnb"
            className="font-medium text-accent hover:underline"
          >
            autres idées de revenus complémentaires
          </Link>
          .
        </p>
      </GuideSection>
    </GuideShell>
  );
}
