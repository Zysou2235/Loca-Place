"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateBox, reactivateBox } from "./box-actions";

/**
 * Petits boutons d'action rapide sur chaque carte de box du dashboard.
 *
 * Implémentation : on évite le piège `<form action>` + `e.preventDefault()`
 * sur le click du bouton (React 19 enrôle l'action côté form, le preventDefault
 * du click n'empêche pas systématiquement la soumission). À la place on
 * appelle la server action directement via useTransition, ce qui rend la
 * confirmation parfaitement déterministe — et permet de désactiver le bouton
 * pendant l'aller-retour serveur pour éviter le double-clic.
 */
export function BoxQuickActions({
  boxId,
  active,
}: {
  boxId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      active &&
      !window.confirm(
        "Désactiver cette box ? La page voyageur ne sera plus accessible et le produit sera retiré. Vous pourrez la réactiver à tout moment."
      )
    ) {
      return;
    }
    const fd = new FormData();
    fd.set("boxId", boxId);
    startTransition(async () => {
      if (active) await deactivateBox(fd);
      else await reactivateBox(fd);
      // revalidatePath côté serveur invalide le cache, mais le composant
      // client a besoin d'un refresh pour ré-afficher le nouveau state.
      router.refresh();
    });
  };

  if (active) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title="Désactiver cette box"
        aria-label="Désactiver cette box"
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-brand/60 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title="Réactiver cette box"
      aria-label="Réactiver cette box"
      className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-amber-300 bg-white text-amber-700 shadow-sm transition hover:bg-amber-50 disabled:opacity-50"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 5v14l11-7z" fill="currentColor" />
      </svg>
    </button>
  );
}
