export type PlanId = "essentiel" | "duo" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  tagline: string;
  maxBoxes: number;
  features: string[];
  highlighted?: boolean;
  /** Monthly price in cents — used to create the Stripe price inline. */
  priceCents: number;
  currency: string;
}

export const PLANS: Plan[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    price: "19€",
    period: "/ mois",
    tagline: "Pour un logement",
    maxBoxes: 1,
    priceCents: 1900,
    currency: "eur",
    features: [
      "1 logement équipé",
      "Box + QR code dédié",
      "Catalogue de produits illimité",
      "0% de commission sur vos ventes",
      "Versement direct (Stripe)",
      "Suivi des ventes",
    ],
  },
  {
    id: "duo",
    name: "Duo",
    price: "29,90€",
    period: "/ mois",
    tagline: "Pour deux logements",
    maxBoxes: 2,
    priceCents: 2990,
    currency: "eur",
    features: [
      "2 logements équipés (2 box)",
      "Tout le plan Essentiel",
      "Tableau de bord multi-sites",
      "Suivi des ventes consolidé",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "49€",
    period: "/ mois",
    tagline: "Pour les multi-propriétaires",
    maxBoxes: 5,
    highlighted: true,
    priceCents: 4900,
    currency: "eur",
    features: [
      "Jusqu'à 5 logements",
      "Tout le plan Duo",
      "Statistiques avancées",
      "Support prioritaire",
    ],
  },
];

export function getPlan(id?: string | null): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function maxBoxesFor(planId?: string | null): number {
  return getPlan(planId)?.maxBoxes ?? 0;
}

