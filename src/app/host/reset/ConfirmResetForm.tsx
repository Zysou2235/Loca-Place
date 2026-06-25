"use client";

import { useActionState } from "react";
import { confirmPasswordReset, type ConfirmState } from "./actions";

export function ConfirmResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(
    confirmPasswordReset,
    {}
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-brand/80">
          Nouveau mot de passe
        </span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
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
        {pending ? "Veuillez patienter…" : "Définir le mot de passe"}
      </button>
    </form>
  );
}
