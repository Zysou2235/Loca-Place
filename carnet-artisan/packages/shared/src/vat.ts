import type { Bp } from './money.js';

/**
 * Taux de TVA francais couramment utilises dans le batiment.
 *
 * ATTENTION — portee volontairement limitee :
 * ces valeurs sont des *presets de saisie*, pas une regle d'eligibilite.
 * L'application ne determine jamais seule qu'un chantier releve de 10 % ou de
 * 5,5 % : c'est une qualification fiscale qui depend de l'anciennete du
 * logement, de la nature des travaux et d'une attestation du client.
 * Le taux est toujours choisi ou confirme par l'artisan.
 */
export const TAUX_TVA = {
  /** Taux normal. */
  NORMAL: 2000 as Bp,
  /** Taux intermediaire (travaux d'amelioration, logement acheve depuis plus de 2 ans). */
  INTERMEDIAIRE: 1000 as Bp,
  /** Taux reduit (renovation energetique). */
  REDUIT: 550 as Bp,
  /** Franchise en base / non assujetti. */
  EXONERE: 0 as Bp,
} as const;

export type TauxTvaPreset = keyof typeof TAUX_TVA;

export const TAUX_TVA_AUTORISES: readonly Bp[] = Object.values(TAUX_TVA);

export interface TauxTvaDescription {
  rateBp: Bp;
  libelle: string;
  /** Ce que l'artisan doit verifier lui-meme avant d'appliquer ce taux. */
  conditionAVerifier: string;
}

export const DESCRIPTIONS_TVA: readonly TauxTvaDescription[] = [
  {
    rateBp: TAUX_TVA.NORMAL,
    libelle: 'TVA 20 % (taux normal)',
    conditionAVerifier: 'Par defaut : neuf, locaux professionnels, ou absence d attestation client.',
  },
  {
    rateBp: TAUX_TVA.INTERMEDIAIRE,
    libelle: 'TVA 10 % (travaux d amelioration)',
    conditionAVerifier:
      'Logement achieve depuis plus de 2 ans et attestation signee par le client. A verifier avant emission.',
  },
  {
    rateBp: TAUX_TVA.REDUIT,
    libelle: 'TVA 5,5 % (renovation energetique)',
    conditionAVerifier:
      'Travaux eligibles a la renovation energetique et attestation signee. A verifier avant emission.',
  },
  {
    rateBp: TAUX_TVA.EXONERE,
    libelle: 'Sans TVA (franchise en base)',
    conditionAVerifier:
      'Mention obligatoire "TVA non applicable, art. 293 B du CGI" a porter sur le document.',
  },
];

export function estTauxTvaConnu(rateBp: Bp): boolean {
  return TAUX_TVA_AUTORISES.includes(rateBp);
}

export function libelleTauxTva(rateBp: Bp): string {
  const found = DESCRIPTIONS_TVA.find((d) => d.rateBp === rateBp);
  if (found) return found.libelle;
  const whole = Math.floor(rateBp / 100);
  const fraction = String(rateBp % 100).padStart(2, '0').replace(/0+$/, '');
  return fraction === '' ? `TVA ${String(whole)} %` : `TVA ${String(whole)},${fraction} %`;
}
