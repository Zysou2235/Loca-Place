/**
 * Registre des guides SEO — source unique pour l'index /guides, le sitemap
 * et les métadonnées de chaque article. Ajouter un guide = ajouter une entrée
 * ici + un dossier src/app/guides/<slug>/page.tsx.
 */
export type Guide = {
  slug: string;
  /** Titre SEO (balise <title>) — mots-clés recherchés en premier. */
  title: string;
  /** H1 affiché en haut de l'article. */
  h1: string;
  description: string;
  /** Accroche affichée sur la carte de l'index. */
  excerpt: string;
  datePublished: string;
};

export const GUIDES: Guide[] = [
  {
    slug: "revenus-complementaires-airbnb",
    title: "Revenus complémentaires Airbnb : 7 idées concrètes pour hôtes",
    h1: "7 idées de revenus complémentaires pour votre Airbnb",
    description:
      "Petit-déjeuner, minibar, location de vélos, late check-out… 7 pistes concrètes pour augmenter le revenu de votre location saisonnière sans baisser vos prix.",
    excerpt:
      "Votre logement peut rapporter plus que son prix par nuit. Tour d'horizon des sources de revenus additionnels qui fonctionnent vraiment pour les hôtes.",
    datePublished: "2026-07-04",
  },
  {
    slug: "minibar-airbnb-gite",
    title: "Minibar dans un Airbnb ou un gîte : que proposer, comment le rentabiliser",
    h1: "Minibar dans un Airbnb ou un gîte : le guide complet",
    description:
      "Quels produits proposer dans le minibar de votre location, à quel prix, et comment encaisser sans friction : le guide pratique pour hôtes et conciergeries.",
    excerpt:
      "Le minibar est la source de revenu additionnel la plus simple à mettre en place dans une location. Produits, prix, encaissement : tout pour bien démarrer.",
    datePublished: "2026-07-04",
  },
  {
    slug: "accueil-voyageurs-5-etoiles",
    title: "Accueil voyageurs : les attentions qui font les avis 5 étoiles",
    h1: "Accueil voyageurs : les petites attentions qui font les avis 5 étoiles",
    description:
      "Panier d'accueil, produits locaux, check-in fluide : comment soigner l'accueil de vos voyageurs pour récolter des avis 5 étoiles — sans y passer vos week-ends.",
    excerpt:
      "Les avis 5 étoiles se gagnent sur les détails. Ce qui marque vraiment les voyageurs, de la réservation au départ — et comment le faire à moindre effort.",
    datePublished: "2026-07-04",
  },
];

export function getGuide(slug: string): Guide {
  const guide = GUIDES.find((g) => g.slug === slug);
  if (!guide) throw new Error(`Guide inconnu : ${slug}`);
  return guide;
}
