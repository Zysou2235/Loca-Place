"use client";

import { deactivateBox, reactivateBox } from "./box-actions";

/**
 * Petits boutons d'action rapide sur chaque carte de box du dashboard :
 * désactiver (si active) ou réactiver (si désactivée). Confirmation native
 * pour la désactivation — éviter les clics accidentels qui couperaient la
 * page voyageur.
 *
 * Implémentation : la confirmation est posée dans onClick du bouton (pas
 * onSubmit du form), pour que e.preventDefault() empêche proprement la
 * soumission de l'action serveur. stopPropagation évite que le clic ne
 * traverse jusqu'au Link parent qui couvre la carte.
 */
export function BoxQuickActions({
  boxId,
  active,
}: {
  boxId: string;
  active: boolean;
}) {
  if (active) {
    return (
      <form action={deactivateBox} className="absolute right-3 top-3 z-10">
        <input type="hidden" name="boxId" value={boxId} />
        <button
          type="submit"
          title="Désactiver cette box"
          aria-label="Désactiver cette box"
          onClick={(e) => {
            e.stopPropagation();
            if (
              !window.confirm(
                "Désactiver cette box ? La page voyageur ne sera plus accessible et le produit sera retiré. Vous pourrez la réactiver à tout moment."
              )
            ) {
              e.preventDefault();
            }
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-brand/60 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
          </svg>
        </button>
      </form>
    );
  }

  return (
    <form action={reactivateBox} className="absolute right-3 top-3 z-10">
      <input type="hidden" name="boxId" value={boxId} />
      <button
        type="submit"
        title="Réactiver cette box"
        aria-label="Réactiver cette box"
        onClick={(e) => e.stopPropagation()}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-300 bg-white text-amber-700 shadow-sm transition hover:bg-amber-50"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </button>
    </form>
  );
}
