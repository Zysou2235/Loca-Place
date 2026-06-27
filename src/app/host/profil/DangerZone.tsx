"use client";

import { deleteOwnAccount } from "../profile-actions";

export function DangerZone() {
  return (
    <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="font-display font-bold text-red-700">Supprimer mon compte</h2>
      <p className="mt-1 text-sm text-red-700/80">
        Cette action est <strong>définitive</strong> : votre compte, vos box,
        votre catalogue et l&apos;historique de vos ventes seront supprimés, et
        votre abonnement résilié. Cette action est irréversible.
      </p>
      <form
        action={deleteOwnAccount}
        onSubmit={(e) => {
          if (
            !window.confirm(
              "Supprimer définitivement votre compte et toutes vos données ? Cette action est irréversible."
            )
          ) {
            e.preventDefault();
          }
        }}
        className="mt-4"
      >
        <button
          type="submit"
          className="rounded-full border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
        >
          Supprimer définitivement mon compte
        </button>
      </form>
    </section>
  );
}
