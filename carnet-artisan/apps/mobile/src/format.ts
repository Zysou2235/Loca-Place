/**
 * Formats d'affichage francais.
 *
 * Les dates arrivent du serveur en UTC (ISO 8601) ; elles sont affichees dans
 * le fuseau de l'appareil, qui est celui de l'artisan.
 */

export function formatJourHeureFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatHeureFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatDureeFr(secondes: number): string {
  if (secondes < 60) return `${String(secondes)} s`;
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return reste === 0 ? `${String(minutes)} min` : `${String(minutes)} min ${String(reste)} s`;
}

/** Montants : le serveur envoie des centimes entiers, jamais des flottants. */
export function formatEuros(centimes: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    centimes / 100,
  );
}
