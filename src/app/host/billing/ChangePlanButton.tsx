"use client";

import { changeSubscriptionPlan } from "../billing-actions";

/**
 * Bouton "Changer pour cette formule" pour les plans à prix fixe (Essentiel,
 * Duo). Confirmation native avant exécution — la modification est immédiate
 * et impacte la prochaine facture (prorata géré par Stripe).
 */
export function ChangePlanButton({
  planId,
  planName,
  highlighted,
}: {
  planId: string;
  planName: string;
  highlighted?: boolean;
}) {
  return (
    <form
      action={changeSubscriptionPlan}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Passer à la formule "${planName}" ? La différence sera ajustée au prorata sur votre prochaine facture Stripe.`
          )
        ) {
          e.preventDefault();
        }
      }}
      className="mt-6"
    >
      <input type="hidden" name="planId" value={planId} />
      <button
        type="submit"
        className={`w-full rounded-full px-5 py-3 text-center font-semibold transition ${
          highlighted
            ? "bg-accent text-white hover:bg-accent-dark"
            : "bg-brand text-white hover:bg-brand-dark"
        }`}
      >
        Changer pour cette formule
      </button>
    </form>
  );
}
