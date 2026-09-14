/**
 * Arithmetique monetaire deterministe.
 *
 * Regles du projet :
 *  - aucun montant n'est jamais represente par un flottant decimal ;
 *  - aucun montant n'est jamais produit par un modele de langage ;
 *  - tout arrondi est explicite et teste.
 *
 * Unites internes :
 *  - `Cents`  : montant en centimes d'euro (entier signe).
 *  - `Milli`  : quantite multipliee par 1000 (entier signe). Permet 0,001 unite
 *               (ex. 2,5 h de main-d'oeuvre = 2500).
 *  - `Bp`     : taux en points de base, 1/10 000 (20 % = 2000, 5,5 % = 550).
 */

export type Cents = number;
export type Milli = number;
export type Bp = number;

export const MILLI_SCALE = 1000;
export const BP_SCALE = 10000;

export class MoneyError extends Error {
  override readonly name = 'MoneyError';
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new MoneyError(`${label} doit etre un entier, recu: ${String(value)}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} depasse la plage d'entiers surs: ${String(value)}`);
  }
}

/**
 * Arrondi "half-up" symetrique : 0,5 s'eloigne de zero.
 * C'est la regle attendue par les artisans et les experts-comptables francais,
 * et elle est stable (contrairement a Math.round sur les negatifs).
 */
export function roundHalfUp(numerator: number, denominator: number): number {
  if (denominator === 0) throw new MoneyError('Division par zero');
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new MoneyError('Operande non finie');
  }
  const sign = Math.sign(numerator) * Math.sign(denominator) || 1;
  const a = Math.abs(numerator);
  const b = Math.abs(denominator);
  const quotient = Math.floor(a / b);
  const remainder = a - quotient * b;
  const rounded = remainder * 2 >= b ? quotient + 1 : quotient;
  const result = sign * rounded;
  assertSafeInteger(result, 'Resultat arrondi');
  return result;
}

/** Quantite (Milli) x prix unitaire (Cents) -> Cents, arrondi au centime. */
export function multiplyQuantity(quantity: Milli, unitPrice: Cents): Cents {
  assertSafeInteger(quantity, 'Quantite');
  assertSafeInteger(unitPrice, 'Prix unitaire');
  return roundHalfUp(quantity * unitPrice, MILLI_SCALE);
}

/** Applique un taux en points de base a un montant. */
export function applyBp(amount: Cents, rate: Bp): Cents {
  assertSafeInteger(amount, 'Montant');
  assertSafeInteger(rate, 'Taux');
  if (rate < 0) throw new MoneyError('Un taux negatif n est pas accepte');
  return roundHalfUp(amount * rate, BP_SCALE);
}

export function sum(amounts: readonly Cents[]): Cents {
  let total = 0;
  for (const amount of amounts) {
    assertSafeInteger(amount, 'Montant');
    total += amount;
  }
  assertSafeInteger(total, 'Total');
  return total;
}

/**
 * Convertit une saisie utilisateur francaise ("1 234,56", "1234.56", "12 €")
 * en centimes. Retourne `null` si la chaine n'est pas un montant exploitable :
 * l'appelant doit alors demander une correction, jamais deviner.
 */
export function parseAmountToCents(input: string): Cents | null {
  return parseDecimal(input, 2);
}

/** Convertit une saisie de quantite ("2,5", "3") en Milli, ou `null`. */
export function parseQuantityToMilli(input: string): Milli | null {
  return parseDecimal(input, 3);
}

function parseDecimal(input: string, decimals: number): number | null {
  if (typeof input !== 'string') return null;
  const cleaned = input
    .replace(new RegExp('[\\s\\u00a0\\u202f\\u2009]', 'g'), '')
    .replace(/[€]/g, '')
    .replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  if (!/^-?\d*(\.\d*)?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  const [wholePart = '', fractionPart = ''] = unsigned.split('.');
  if (wholePart === '' && fractionPart === '') return null;
  // On tronque au-dela de la precision supportee plutot que d'arrondir en
  // silence une saisie ambigue.
  const scaledFraction = fractionPart.slice(0, decimals).padEnd(decimals, '0');
  const digits = `${wholePart === '' ? '0' : wholePart}${scaledFraction}`;
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return negative ? -value : value;
}

/**
 * Separateur de milliers francais : espace fine insecable (U+202F).
 * C'est ce que produit Intl.NumberFormat('fr-FR') ; une espace ordinaire
 * autoriserait un retour a la ligne au milieu d'un montant.
 */
export const ESPACE_MILLIERS = '\u202f';

/** Formatte un montant en centimes pour affichage francais : "1 234,56 €". */
export function formatCents(amount: Cents, options?: { withSymbol?: boolean }): string {
  assertSafeInteger(amount, 'Montant');
  const withSymbol = options?.withSymbol ?? true;
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  const groupedWhole = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_MILLIERS);
  const body = `${negative ? '-' : ''}${groupedWhole},${fraction}`;
  // L'espace devant le symbole est elle aussi insecable : "12,00 EUR" ne doit
  // jamais se couper entre le montant et la devise.
  return withSymbol ? `${body}${ESPACE_MILLIERS}€` : body;
}

/** Formatte une quantite Milli sans zeros inutiles : 2500 -> "2,5". */
export function formatQuantity(quantity: Milli): string {
  assertSafeInteger(quantity, 'Quantite');
  const negative = quantity < 0;
  const absolute = Math.abs(quantity);
  const whole = Math.floor(absolute / MILLI_SCALE);
  const fraction = String(absolute % MILLI_SCALE).padStart(3, '0').replace(/0+$/, '');
  const body = fraction === '' ? String(whole) : `${String(whole)},${fraction}`;
  return negative ? `-${body}` : body;
}
