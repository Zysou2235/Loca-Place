"use client";

import { useState } from "react";

/**
 * Certains navigateurs embarqués (webview d'app de messagerie, in-app
 * browser Instagram/LinkedIn…) n'implémentent pas window.print() et
 * l'appel échoue silencieusement — le clic ne produit alors aucun effet
 * visible. On détecte ce cas et on affiche un repli explicite plutôt que
 * de laisser l'hôte face à un bouton qui « ne fait rien ».
 */
export function PrintButton() {
  const [failed, setFailed] = useState(false);

  const handlePrint = () => {
    try {
      if (typeof window.print !== "function") {
        setFailed(true);
        return;
      }
      window.print();
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={handlePrint}
        className="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-accent-dark"
      >
        🖨️ Imprimer
      </button>
      {failed && (
        <p className="mt-2 max-w-[220px] text-right text-xs text-red-600">
          L&apos;impression automatique n&apos;est pas disponible ici.
          Ouvrez cette page dans votre navigateur (Safari, Chrome…) puis
          utilisez Ctrl+P (Cmd+P sur Mac) ou le menu ⋮ / partage de votre
          téléphone.
        </p>
      )}
    </div>
  );
}
