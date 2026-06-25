"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "./auth-actions";

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: Action;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {}
  );
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isSignup && (
        <Field
          label="Nom"
          name="name"
          type="text"
          placeholder="Marie Dupont"
          autoComplete="name"
        />
      )}
      <Field
        label="Email"
        name="email"
        type="email"
        placeholder="vous@exemple.fr"
        autoComplete="email"
      />
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        placeholder="••••••••"
        autoComplete={isSignup ? "new-password" : "current-password"}
      />

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
        {pending
          ? "Veuillez patienter…"
          : isSignup
            ? "Créer mon compte hôte"
            : "Se connecter"}
      </button>

      {!isSignup && (
        <p className="text-center text-sm">
          <Link href="/host/reset" className="text-brand/50 hover:text-accent">
            Mot de passe oublié ?
          </Link>
        </p>
      )}

      <p className="text-center text-sm text-brand/60">
        {isSignup ? (
          <>
            Déjà un compte ?{" "}
            <Link href="/host/login" className="font-semibold text-accent">
              Se connecter
            </Link>
          </>
        ) : (
          <>
            Pas encore de compte ?{" "}
            <Link href="/host/signup" className="font-semibold text-accent">
              Créer un compte
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-brand/80">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="rounded-xl border border-black/10 bg-white px-4 py-2.5 outline-none ring-accent/30 transition focus:border-accent focus:ring-2"
      />
    </label>
  );
}
