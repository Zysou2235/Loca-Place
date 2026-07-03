"use client";

import { useEffect } from "react";

/**
 * Signale l'arrivée d'un visiteur sur la landing page (alerte email en temps
 * réel, voir /api/landing-visit). Invisible, best-effort, garde la page
 * statique — l'appel réseau se fait après l'hydratation, jamais avant.
 */
export function LandingVisitTracker() {
  useEffect(() => {
    fetch("/api/landing-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return null;
}
