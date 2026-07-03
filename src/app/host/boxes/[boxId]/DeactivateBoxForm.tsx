"use client";

import { deactivateBox } from "../../box-actions";

/**
 * Bouton de désactivation avec confirmation native — empêche tout clic
 * accidentel sur une opération qui rend la page voyageur indisponible.
 */
export function DeactivateBoxForm({ boxId }: { boxId: string }) {
  return (
    <form
      action={deactivateBox}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Désactiver cette box ? La page voyageur ne sera plus accessible et le produit attribué sera retiré. Vous pourrez la réactiver à tout moment."
          )
        ) {
          e.preventDefault();
        }
      }}
      className="mt-3"
    >
      <input type="hidden" name="boxId" value={boxId} />
      <button
        type="submit"
        className="rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
      >
        Désactiver
      </button>
    </form>
  );
}
