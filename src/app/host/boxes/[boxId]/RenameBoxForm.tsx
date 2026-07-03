"use client";

import { useState } from "react";
import { renameBox } from "../../box-actions";

/**
 * Formulaire repliable de renommage de la box (nom + ville/adresse).
 * Replié par défaut pour ne pas alourdir la page de gestion de box.
 */
export function RenameBoxForm({
  boxId,
  defaultName,
  defaultLocation,
}: {
  boxId: string;
  defaultName: string;
  defaultLocation: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-brand transition hover:bg-black/5"
      >
        ✏️ Renommer la box
      </button>
    );
  }

  return (
    <form
      action={renameBox}
      className="mt-4 rounded-xl border border-black/10 bg-brand/5 p-4"
    >
      <input type="hidden" name="boxId" value={boxId} />

      <label className="block text-sm font-medium text-brand/80">
        Nom de la box
        <input
          name="name"
          defaultValue={defaultName}
          required
          maxLength={120}
          placeholder="ex. Appartement Bellecour"
          className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>

      <label className="mt-3 block text-sm font-medium text-brand/80">
        Ville / adresse <span className="text-brand/40">(optionnel)</span>
        <input
          name="location"
          defaultValue={defaultLocation}
          maxLength={200}
          placeholder="ex. Lyon 2e"
          className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark"
        >
          Enregistrer
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
