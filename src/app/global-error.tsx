"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Filet de sécurité au niveau du layout racine — se déclenche uniquement si
 * l'erreur casse le rendu avant que error.tsx (par segment) ne puisse
 * s'afficher. Doit fournir son propre <html>/<body>, il remplace tout.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <main style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.25rem", padding: "1.5rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Une erreur est survenue</h1>
          <p style={{ maxWidth: "24rem", color: "#6b6b6b" }}>
            Désolé, quelque chose s&apos;est mal passé. L&apos;équipe a été
            prévenue automatiquement.
          </p>
          <a
            href="/"
            style={{ borderRadius: "9999px", background: "#e07a5f", padding: "0.75rem 1.5rem", fontWeight: 600, color: "white", textDecoration: "none" }}
          >
            Retour à l&apos;accueil
          </a>
        </main>
      </body>
    </html>
  );
}
