"use client";

import { generateBoxCode } from "./actions";

/**
 * Bouton de (re)génération du code de cadenas. Quand un code existe déjà, on
 * demande confirmation pour éviter de l'écraser par erreur.
 */
export function GenerateCodeButton({
  boxId,
  hasCode,
}: {
  boxId: string;
  hasCode: boolean;
}) {
  return (
    <form
      action={generateBoxCode}
      onSubmit={(e) => {
        if (
          hasCode &&
          !window.confirm(
            "Régénérer le code ? L'ancien code ne fonctionnera plus. À ne faire que si le cadenas n'est pas encore réglé."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="boxId" value={boxId} />
      <button
        type="submit"
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          hasCode
            ? "border border-black/10 bg-white text-brand hover:bg-black/5"
            : "bg-accent text-white hover:bg-accent-dark"
        }`}
      >
        {hasCode ? "🔄 Régénérer le code" : "🎲 Générer le code"}
      </button>
    </form>
  );
}
