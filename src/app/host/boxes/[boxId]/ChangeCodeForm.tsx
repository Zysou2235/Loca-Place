"use client";

import { useState } from "react";
import { changeBoxCode } from "../../box-actions";

/**
 * Parcours guidé pour que l'hôte change lui-même le code du cadenas.
 * Garde-fous : repliable, code à 3 chiffres, case de confirmation « cadenas
 * réglé », et confirmation finale — pour éviter tout changement par erreur.
 */
export function ChangeCodeForm({ boxId }: { boxId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-brand transition hover:bg-black/5"
      >
        🔧 Changer le code
      </button>
    );
  }

  return (
    <form
      action={changeBoxCode}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Confirmer le nouveau code ? L'ancien ne fonctionnera plus. Assurez-vous que le cadenas est bien réglé sur ce code."
          )
        ) {
          e.preventDefault();
        }
      }}
      className="mt-4 rounded-xl border border-black/10 bg-brand/5 p-4"
    >
      <input type="hidden" name="boxId" value={boxId} />

      <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-brand/70">
        <li>Réglez les molettes du cadenas sur le nouveau code souhaité.</li>
        <li>Saisissez ce même code ci-dessous.</li>
        <li>Confirmez : il sera envoyé aux prochains voyageurs.</li>
      </ol>

      <label className="block text-sm font-medium text-brand/80">
        Nouveau code (3 chiffres)
        <input
          name="code"
          inputMode="numeric"
          pattern="\d{3}"
          maxLength={3}
          required
          placeholder="ex. 042"
          className="mt-1 block w-28 rounded-lg border border-black/10 px-3 py-2 font-mono text-lg tracking-widest outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>

      <label className="mt-3 flex items-start gap-2 text-sm text-brand/70">
        <input
          type="checkbox"
          name="confirmed"
          required
          className="mt-0.5 h-4 w-4 rounded border-black/20"
        />
        <span>
          J&apos;ai bien réglé le cadenas physique sur ce nouveau code.
        </span>
      </label>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark"
        >
          Enregistrer le nouveau code
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-brand/60 transition hover:bg-black/5"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
