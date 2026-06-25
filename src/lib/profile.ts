/** Champs minimum requis avant de pouvoir commander (facturation + livraison). */
export const PROFILE_SELECT = {
  billingLine1: true,
  billingZip: true,
  billingCity: true,
  deliveryLine1: true,
  deliveryZip: true,
  deliveryCity: true,
} as const;

export type ProfileFields = {
  billingLine1: string | null;
  billingZip: string | null;
  billingCity: string | null;
  deliveryLine1: string | null;
  deliveryZip: string | null;
  deliveryCity: string | null;
};

/** Vrai si l'hôte a renseigné facturation ET livraison (pré-requis commande). */
export function isProfileComplete(p: ProfileFields | null | undefined): boolean {
  if (!p) return false;
  return Boolean(
    p.billingLine1 &&
      p.billingZip &&
      p.billingCity &&
      p.deliveryLine1 &&
      p.deliveryZip &&
      p.deliveryCity
  );
}
