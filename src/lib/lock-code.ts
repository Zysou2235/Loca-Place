import crypto from "crypto";

/**
 * Code de cadenas à 3 chiffres (000–999), correspondant aux molettes du
 * cadenas physique de la box. Généré côté plateforme, jamais saisi à la main.
 */
export function generateLockCode(): string {
  return String(crypto.randomInt(0, 1000)).padStart(3, "0");
}
