/**
 * Source unique de vérité pour savoir si une box peut vendre. Utilisée à la
 * fois côté voyageur (/b/[qr_slug], pour afficher ou non le bouton d'achat)
 * et côté hôte (dashboard + fiche box, pour expliquer ce qu'il manque).
 */
export type BoxSellability = {
  sellable: boolean;
  missingAccessCode: boolean;
  missingProduct: boolean;
  missingPayments: boolean;
};

export function checkBoxSellable(
  box: {
    accessCode: string | null;
    selectedProduct: { active: boolean } | null;
  },
  host: { stripeAccountId: string | null; chargesEnabled: boolean }
): BoxSellability {
  const missingAccessCode = !box.accessCode;
  const missingProduct = !(box.selectedProduct && box.selectedProduct.active);
  const missingPayments = !(host.stripeAccountId && host.chargesEnabled);
  return {
    sellable: !missingAccessCode && !missingProduct && !missingPayments,
    missingAccessCode,
    missingProduct,
    missingPayments,
  };
}
