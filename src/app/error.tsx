"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Alerte l'équipe (email/Slack) en tâche de fond, jamais bloquant pour
    // l'utilisateur qui voit l'erreur.
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        path: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-cream px-6 text-center">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-brand">
          Une erreur est survenue
        </h1>
        <p className="mt-2 max-w-sm text-brand/60">
          Désolé, quelque chose s&apos;est mal passé. L&apos;équipe a été
          prévenue automatiquement.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-accent-dark"
      >
        Réessayer
      </button>
    </main>
  );
}
