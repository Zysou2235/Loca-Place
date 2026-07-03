"use client";

import { useEffect } from "react";

/**
 * Mesure le temps passé sur la page voyageur et l'envoie en beacon quand le
 * visiteur quitte (fermeture, navigation, passage en arrière-plan). Invisible,
 * best-effort : si le beacon échoue, tant pis — aucune UI n'en dépend.
 */
export function ScanTracker({ scanId }: { scanId: string }) {
  useEffect(() => {
    const start = Date.now();
    let sent = false;

    const send = () => {
      if (sent) return;
      sent = true;
      const payload = JSON.stringify({ scanId, ms: Date.now() - start });
      // sendBeacon survit à la fermeture de l'onglet, contrairement à fetch.
      navigator.sendBeacon?.(
        "/api/track",
        new Blob([payload], { type: "application/json" })
      );
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") send();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
      send(); // navigation interne (unmount) compte aussi comme fin de visite
    };
  }, [scanId]);

  return null;
}
