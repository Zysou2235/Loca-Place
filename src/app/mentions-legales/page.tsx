import { LegalShell, LegalSection } from "@/components/LegalShell";

export const metadata = {
  title: "Mentions légales — Escale Box",
  description: "Mentions légales du site Escale Box : éditeur, hébergeur, contact.",
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegalesPage() {
  return (
    <LegalShell title="Mentions légales" updatedAt="2026">
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ Modèle à compléter avec tes informations réelles avant la mise en
        production (champs entre crochets).
      </p>

      <LegalSection title="Éditeur du site">
        <p>
          Le site Escale Box est édité par [Raison sociale], [forme juridique]
          au capital de [montant] €, immatriculée au RCS de [ville] sous le
          numéro [SIREN/SIRET].
        </p>
        <p>Siège social : [adresse complète].</p>
        <p>
          Email : [email de contact] — Téléphone : [téléphone].
        </p>
        <p>Numéro de TVA intracommunautaire : [n° TVA].</p>
      </LegalSection>

      <LegalSection title="Directeur de la publication">
        <p>[Nom du directeur de la publication].</p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Le site est hébergé par Railway Corporation, 548 Market St, San
          Francisco, CA 94104, USA — railway.com.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          L&apos;ensemble des contenus du site (marque, logo, textes, visuels)
          est protégé. Toute reproduction sans autorisation est interdite.
        </p>
      </LegalSection>

      <LegalSection title="Paiements">
        <p>
          Les paiements sont traités de manière sécurisée par Stripe. Escale Box
          ne stocke aucune donnée de carte bancaire.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
