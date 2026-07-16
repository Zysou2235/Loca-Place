"use client";

import { useActionState } from "react";
import { leaveEmail, type LeadState } from "./actions";
import { tt, type TravelerLang } from "@/lib/traveler-i18n";

/**
 * Bloc opt-in discret en bas de la page voyageur : le visiteur laisse son
 * email pour donner son avis / recevoir les nouveautés de la box.
 * Consentement explicite dans le libellé (RGPD).
 */
export function EmailCaptureForm({
  qrSlug,
  lang,
}: {
  qrSlug: string;
  lang: TravelerLang;
}) {
  const [state, formAction, pending] = useActionState<LeadState, FormData>(
    leaveEmail,
    {}
  );

  if (state.done) {
    return (
      <p className="rounded-xl bg-green-50 px-4 py-3 text-center text-sm text-green-700">
        {tt("reviewThanks", lang)}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-neutral-800">
        {tt("reviewTitle", lang)}
      </p>
      <p className="mt-0.5 text-xs text-neutral-500">
        {tt("reviewSubtitle", lang)}
      </p>
      <form action={formAction} className="mt-3 flex gap-2">
        <input type="hidden" name="qrSlug" value={qrSlug} />
        <input
          name="email"
          type="email"
          required
          placeholder={tt("emailPlaceholder", lang)}
          className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "…" : tt("send", lang)}
        </button>
      </form>
      {state.error && (
        <p className="mt-2 text-xs text-red-600">{state.error}</p>
      )}
      <p className="mt-2 text-[11px] leading-snug text-neutral-400">
        {tt("consent", lang)}
      </p>
    </div>
  );
}
