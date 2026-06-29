export type PlanId = "essentiel" | "duo" | "multi";

export interface Plan {
  id: PlanId;
  name: string;
  price: string; // libellé d'affichage (TTC)
  period: string;
  tagline: string;
  maxBoxes: number; // nb de box de base (multi = minimum, extensible)
  features: string[];
  highlighted?: boolean;
  currency: string;
}

// Tarifs TTC, en centimes.
export const ESSENTIEL_CENTS = 1490;
export const DUO_CENTS = 2490;
export const EXTRA_BOX_CENTS = 900; // par box au-delà de 2 (formule Multi)
export const MULTI_MIN_BOXES = 3;
export const MAX_BOXES = 50;

export const PLANS: Plan[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    price: "14,90€",
    period: "/ mois",
    tagline: "Pour un logement",
    maxBoxes: 1,
    currency: "eur",
    features: [
      "1 box dédiée",
      "QR code unique",
      "Catalogue de produits illimité",
      "0% de commission sur vos ventes",
      "Versement direct (Stripe)",
      "Suivi des ventes",
    ],
  },
  {
    id: "duo",
    name: "Duo",
    price: "24,90€",
    period: "/ mois",
    tagline: "Pour deux logements",
    maxBoxes: 2,
    currency: "eur",
    features: [
      "2 box dédiées",
      "Tout le plan Essentiel",
      "Tableau de bord multi-box",
      "Suivi des ventes consolidé",
    ],
  },
  {
    id: "multi",
    name: "Multi",
    price: "dès 33,90€",
    period: "/ mois",
    tagline: "Pour les multi-propriétaires",
    maxBoxes: MULTI_MIN_BOXES,
    highlighted: true,
    currency: "eur",
    features: [
      "À partir de 3 box",
      "+9€ / mois par box supplémentaire",
      "Tout le plan Duo",
      "Statistiques avancées",
      "Support prioritaire",
    ],
  },
];

export function getPlan(id?: string | null): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** Nombre de box pour une formule (multi : choix de l'hôte, borné). */
export function boxesFor(planId?: string | null, requested = 0): number {
  if (planId === "essentiel") return 1;
  if (planId === "duo") return 2;
  if (planId === "multi") {
    return Math.min(
      MAX_BOXES,
      Math.max(MULTI_MIN_BOXES, requested || MULTI_MIN_BOXES)
    );
  }
  return 0;
}

/** Prix mensuel TTC (centimes) d'une formule pour un nb de box donné. */
export function priceCentsFor(planId?: string | null, boxes = 0): number {
  if (planId === "essentiel") return ESSENTIEL_CENTS;
  if (planId === "duo") return DUO_CENTS;
  if (planId === "multi") {
    const n = boxesFor("multi", boxes);
    return DUO_CENTS + EXTRA_BOX_CENTS * (n - 2);
  }
  return 0;
}
