import { LegalShell, LegalSection } from "@/components/LegalShell";

export const metadata = { title: "Politique de confidentialité — Eskale Box" };

export default function ConfidentialitePage() {
  return (
    <LegalShell title="Politique de confidentialité" updatedAt="2026">
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ Modèle à compléter (champs entre crochets) et à faire valider avant
        la mise en production.
      </p>

      <LegalSection title="Responsable du traitement">
        <p>[Raison sociale], [adresse], [email de contact].</p>
      </LegalSection>

      <LegalSection title="Données collectées">
        <p>
          <strong>Hôtes</strong> : nom, email, mot de passe (chiffré),
          informations d&apos;abonnement et de compte Stripe Connect.
        </p>
        <p>
          <strong>Voyageurs</strong> : email et, le cas échéant, numéro de
          téléphone, afin de délivrer le code d&apos;accès. Les données de
          paiement sont traitées directement par Stripe et ne sont pas stockées
          par Eskale Box.
        </p>
      </LegalSection>

      <LegalSection title="Finalités">
        <p>
          Gestion des comptes hôtes et abonnements, traitement des paiements,
          livraison des codes d&apos;accès, suivi des ventes et support.
        </p>
      </LegalSection>

      <LegalSection title="Sous-traitants">
        <p>
          Stripe (paiement), Railway (hébergement), Resend (emails),
          Twilio (SMS, le cas échéant).
        </p>
      </LegalSection>

      <LegalSection title="Conservation">
        <p>
          Les données sont conservées le temps nécessaire aux finalités
          ci-dessus, puis archivées ou supprimées conformément aux obligations
          légales.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits (RGPD)">
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement, d&apos;opposition et de portabilité. Pour les
          exercer : [email de contact].
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Le site utilise un cookie de session strictement nécessaire à
          l&apos;authentification des hôtes. Aucun cookie publicitaire
          n&apos;est utilisé.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
