import { LegalShell, LegalSection } from "@/components/LegalShell";

export const metadata = { title: "CGV — Escale Box" };

export default function CgvPage() {
  return (
    <LegalShell title="Conditions générales de vente" updatedAt="2026">
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ Modèle à adapter avec un conseil juridique avant la mise en
        production (champs entre crochets).
      </p>

      <LegalSection title="1. Objet">
        <p>
          Les présentes CGV régissent les ventes de produits proposés par les
          hôtes via les boîtes Escale Box et achetés par les voyageurs sur le
          site. L&apos;hôte est le vendeur ; Escale Box fournit la plateforme
          technique et l&apos;encaissement via Stripe.
        </p>
      </LegalSection>

      <LegalSection title="2. Prix">
        <p>
          Les prix sont indiqués en euros, toutes taxes comprises. Le prix
          facturé est celui affiché au moment de la commande.
        </p>
      </LegalSection>

      <LegalSection title="3. Commande et paiement">
        <p>
          Le voyageur sélectionne un produit, paie en ligne (carte, Apple Pay,
          Google Pay) via Stripe. La commande est validée après confirmation du
          paiement.
        </p>
      </LegalSection>

      <LegalSection title="4. Livraison du produit">
        <p>
          Après paiement, un code d&apos;accès est communiqué au voyageur (à
          l&apos;écran, par email et/ou SMS) afin de récupérer immédiatement son
          produit dans la box mise à disposition par l&apos;hôte.
        </p>
      </LegalSection>

      <LegalSection title="5. Droit de rétractation">
        <p>
          Conformément à l&apos;article L221-28 du Code de la consommation, le
          droit de rétractation ne s&apos;applique pas aux biens descellés/à
          consommation rapide ni aux produits remis immédiatement. [À préciser
          selon la nature exacte des produits vendus.]
        </p>
      </LegalSection>

      <LegalSection title="6. Responsabilité">
        <p>
          L&apos;hôte est responsable de la conformité, de la qualité et de la
          disponibilité des produits proposés. Escale Box ne saurait être tenu
          responsable du contenu des boîtes.
        </p>
      </LegalSection>

      <LegalSection title="7. Réclamations">
        <p>
          Pour toute réclamation : [email de contact]. Si vous n&apos;avez pas
          reçu votre code, utilisez le lien « Je n&apos;ai pas reçu le code » sur
          la page de confirmation.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
