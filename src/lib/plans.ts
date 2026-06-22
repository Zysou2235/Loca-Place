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
  /** Env var holding the Stripe Price ID for this plan. */
  priceEnv: string;
}

export const PLANS: Plan[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    price: "19€",
    period: "/ mois",
    tagline: "Pour un logement",
    maxBoxes: 1,
    priceEnv: "STRIPE_PRICE_ESSENTIEL",
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
    priceEnv: "STRIPE_PRICE_DUO",
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
    priceEnv: "STRIPE_PRICE_PRO",
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

export function planPriceId(id: PlanId): string | undefined {
  return process.env[getPlan(id)!.priceEnv];
}
