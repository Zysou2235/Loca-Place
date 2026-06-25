"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type RequestState } from "./actions";

export function RequestResetForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(
    requestPasswordReset,
    {}
  );

  if (state.sent) {
    return (
      <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
        Si un compte avec mot de passe existe pour cet email, un lien de
        réinitialisation vient d&apos;être envoyé. Pensez à vérifier vos spams.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-brand/80">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vous@exemple.fr"
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-accent-dark disabled:opacity-60"
      >
        {pending ? "Veuillez patienter…" : "Envoyer le lien"}
      </button>

      <p className="text-center text-sm text-brand/60">
        <Link href="/host/login" className="font-semibold text-accent">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
