"use client";

import { useActionState } from "react";
import { leaveEmail, type LeadState } from "./actions";

/**
 * Bloc opt-in discret en bas de la page voyageur : le visiteur laisse son
 * email pour donner son avis / recevoir les nouveautés de la box.
 * Consentement explicite dans le libellé (RGPD).
 */
export function EmailCaptureForm({ qrSlug }: { qrSlug: string }) {
  const [state, formAction, pending] = useActionState<LeadState, FormData>(
    leaveEmail,
    {}
  );

  if (state.done) {
    return (
      <p className="rounded-xl bg-green-50 px-4 py-3 text-center text-sm text-green-700">
        Merci ! Votre avis compte — on revient vers vous très vite. 🙌
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-neutral-800">
        Votre avis nous intéresse 💬
      </p>
      <p className="mt-0.5 text-xs text-neutral-500">
        Laissez votre email pour donner votre avis sur cette box et découvrir
        les nouveautés.
      </p>
      <form action={formAction} className="mt-3 flex gap-2">
        <input type="hidden" name="qrSlug" value={qrSlug} />
        <input
          name="email"
          type="email"
          required
          placeholder="vous@exemple.fr"
          className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "…" : "Envoyer"}
        </button>
      </form>
      {state.error && (
        <p className="mt-2 text-xs text-red-600">{state.error}</p>
      )}
      <p className="mt-2 text-[11px] leading-snug text-neutral-400">
        En laissant votre email, vous acceptez d&apos;être recontacté par
        Escale Box (avis, sondage). Désinscription sur simple demande.
      </p>
    </div>
  );
}
