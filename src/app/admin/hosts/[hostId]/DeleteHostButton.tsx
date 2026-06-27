"use client";

import { deleteHostByAdmin } from "../../actions";

export function DeleteHostButton({
  hostId,
  hostName,
}: {
  hostId: string;
  hostName: string;
}) {
  return (
    <form
      action={deleteHostByAdmin}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Supprimer définitivement le compte de ${hostName} et toutes ses données (box, ventes, scans) ? Action irréversible.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="hostId" value={hostId} />
      <button
        type="submit"
        className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
      >
        Supprimer ce compte
      </button>
    </form>
  );
}
