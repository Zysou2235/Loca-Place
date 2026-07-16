/**
 * Traductions de la page voyageur (/b/[qr_slug]) et de la fiche à imprimer.
 * Le contenu saisi par l'hôte (nom/description produit) n'est PAS traduit —
 * seul le texte fixe de l'interface l'est.
 */
export type TravelerLang = "fr" | "en" | "es" | "it";

export const TRAVELER_LANGS: { code: TravelerLang; flag: string; label: string }[] = [
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "it", flag: "🇮🇹", label: "Italiano" },
];

export function isTravelerLang(v: string | undefined | null): v is TravelerLang {
  return v === "fr" || v === "en" || v === "es" || v === "it";
}

type Dict = Record<TravelerLang, string>;

export const travelerText = {
  intro: {
    fr: "Choisissez un produit et payez en quelques secondes. Aucun compte requis.",
    en: "Choose a product and pay in a few seconds. No account needed.",
    es: "Elige un producto y paga en unos segundos. Sin necesidad de cuenta.",
    it: "Scegli un prodotto e paga in pochi secondi. Nessun account richiesto.",
  },
  soonAvailable: {
    fr: "Cette boutique sera bientôt disponible. Revenez un peu plus tard !",
    en: "This shop will be available soon. Please check back a bit later!",
    es: "Esta tienda estará disponible pronto. ¡Vuelve un poco más tarde!",
    it: "Questo negozio sarà presto disponibile. Ricontrolla tra un po'!",
  },
  pay: {
    fr: "Payer",
    en: "Pay",
    es: "Pagar",
    it: "Paga",
  },
  footer: {
    fr: "Paiement sécurisé par Stripe · Vendu par votre hôte",
    en: "Secure payment by Stripe · Sold by your host",
    es: "Pago seguro con Stripe · Vendido por tu anfitrión",
    it: "Pagamento sicuro con Stripe · Venduto dal tuo host",
  },
  errorMissing: {
    fr: "Un problème est survenu. Rechargez la page et réessayez.",
    en: "Something went wrong. Reload the page and try again.",
    es: "Ha ocurrido un problema. Recarga la página e inténtalo de nuevo.",
    it: "Si è verificato un problema. Ricarica la pagina e riprova.",
  },
  errorUnavailable: {
    fr: "Ce produit vient de devenir indisponible. Rechargez la page pour voir l'offre à jour.",
    en: "This product just became unavailable. Reload the page to see the current offer.",
    es: "Este producto acaba de quedar no disponible. Recarga la página para ver la oferta actual.",
    it: "Questo prodotto è appena diventato non disponibile. Ricarica la pagina per vedere l'offerta aggiornata.",
  },
  errorPayment: {
    fr: "Le paiement n'a pas pu démarrer suite à un problème technique. Réessayez dans un instant.",
    en: "Payment couldn't start due to a technical issue. Please try again in a moment.",
    es: "El pago no pudo iniciarse por un problema técnico. Inténtalo de nuevo en un momento.",
    it: "Il pagamento non è potuto partire per un problema tecnico. Riprova tra poco.",
  },
  reviewTitle: {
    fr: "Votre avis nous intéresse 💬",
    en: "We'd love your feedback 💬",
    es: "Tu opinión nos interesa 💬",
    it: "La tua opinione ci interessa 💬",
  },
  reviewSubtitle: {
    fr: "Laissez votre email pour donner votre avis sur cette box et découvrir les nouveautés.",
    en: "Leave your email to share your feedback on this box and hear about new arrivals.",
    es: "Deja tu email para dar tu opinión sobre esta box y descubrir las novedades.",
    it: "Lascia la tua email per dare la tua opinione su questa box e scoprire le novità.",
  },
  reviewThanks: {
    fr: "Merci ! Votre avis compte — on revient vers vous très vite. 🙌",
    en: "Thank you! Your feedback matters — we'll be in touch very soon. 🙌",
    es: "¡Gracias! Tu opinión importa — te contactaremos muy pronto. 🙌",
    it: "Grazie! La tua opinione conta — ti ricontatteremo molto presto. 🙌",
  },
  send: {
    fr: "Envoyer",
    en: "Send",
    es: "Enviar",
    it: "Invia",
  },
  emailPlaceholder: {
    fr: "vous@exemple.fr",
    en: "you@example.com",
    es: "tu@ejemplo.com",
    it: "tu@esempio.it",
  },
  consent: {
    fr: "En laissant votre email, vous acceptez d'être recontacté par Escale Box (avis, sondage). Désinscription sur simple demande.",
    en: "By leaving your email, you agree to be contacted by Escale Box (feedback, surveys). You can unsubscribe at any time.",
    es: "Al dejar tu email, aceptas ser contactado por Escale Box (opinión, encuesta). Puedes darte de baja cuando quieras.",
    it: "Lasciando la tua email, accetti di essere ricontattato da Escale Box (opinioni, sondaggi). Puoi annullare l'iscrizione quando vuoi.",
  },
} satisfies Record<string, Dict>;

export function tt(key: keyof typeof travelerText, lang: TravelerLang): string {
  return travelerText[key][lang];
}

/** Fiche imprimable — titre/sous-titre/badge/pied, version courte par langue (place limitée). */
export const printText = {
  title: {
    fr: "Une petite envie ?",
    en: "Fancy a little something?",
    es: "¿Te apetece algo?",
    it: "Una vogliolina?",
  },
  scanMe: {
    fr: "Scannez-moi",
    en: "Scan me",
    es: "Escanéame",
    it: "Scansionami",
  },
  trust: {
    fr: "Paiement sécurisé · Sans application",
    en: "Secure payment · No app",
    es: "Pago seguro · Sin app",
    it: "Pagamento sicuro · Senza app",
  },
} satisfies Record<string, Dict>;

/** Étapes de la fiche imprimable — libellé court par langue (place limitée). */
export const printSteps: {
  n: string;
  title: Dict;
  desc: Dict;
}[] = [
  {
    n: "1",
    title: {
      fr: "Scannez",
      en: "Scan",
      es: "Escanea",
      it: "Scansiona",
    },
    desc: {
      fr: "avec l'appareil photo de votre téléphone",
      en: "with your phone's camera",
      es: "con la cámara de tu móvil",
      it: "con la fotocamera del telefono",
    },
  },
  {
    n: "2",
    title: {
      fr: "Payez",
      en: "Pay",
      es: "Paga",
      it: "Paga",
    },
    desc: {
      fr: "en ligne, sans appli ni compte",
      en: "online, no app or account",
      es: "online, sin app ni cuenta",
      it: "online, senza app né account",
    },
  },
  {
    n: "3",
    title: {
      fr: "Ouvrez",
      en: "Open",
      es: "Abre",
      it: "Apri",
    },
    desc: {
      fr: "avec le code reçu par email",
      en: "with the code sent by email",
      es: "con el código recibido por email",
      it: "con il codice ricevuto via email",
    },
  },
];
