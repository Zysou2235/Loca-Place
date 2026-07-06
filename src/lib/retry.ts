/**
 * Réessaie automatiquement un appel réseau instable (ex. API Stripe) avant
 * d'abandonner — la plupart des échecs de ce type sont transitoires et se
 * résolvent seuls en une seconde. "Réparation autonome" : évite qu'un simple
 * pépin réseau ne devienne une erreur visible par le voyageur/hôte.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 2,
  delayMs = 400
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}
