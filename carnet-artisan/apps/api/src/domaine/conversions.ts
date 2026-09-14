/**
 * Conversions entre les enums de la base et les types du domaine partage.
 * Isolees ici pour qu'un renommage cote base ne se propage pas partout.
 */

import type { NaturePrestation as NatureDomaine, Unite } from '@carnet/shared';
import { UNITES } from '@carnet/shared';

export type NatureBase = 'FOURNITURE_SEULE' | 'FORFAIT_POSE' | 'MAIN_OEUVRE' | 'FRAIS';

const VERS_DOMAINE: Record<NatureBase, NatureDomaine> = {
  FOURNITURE_SEULE: 'fourniture_seule',
  FORFAIT_POSE: 'forfait_pose',
  MAIN_OEUVRE: 'main_oeuvre',
  FRAIS: 'frais',
};

const VERS_BASE: Record<NatureDomaine, NatureBase> = {
  fourniture_seule: 'FOURNITURE_SEULE',
  forfait_pose: 'FORFAIT_POSE',
  main_oeuvre: 'MAIN_OEUVRE',
  frais: 'FRAIS',
};

/**
 * Accepte les deux ecritures : celle de la base (FORFAIT_POSE) et celle du
 * domaine (forfait_pose). Les lignes d'un devis transitent par les deux selon
 * qu'elles viennent d'une requete ou d'une lecture en base ; un repli
 * silencieux sur "fourniture seule" ferait disparaitre la detection de double
 * main-d'oeuvre sans que rien ne le signale.
 */
export function natureVersDomaine(valeur: string): NatureDomaine {
  const enBase = VERS_DOMAINE[valeur as NatureBase];
  if (enBase) return enBase;
  if (valeur in VERS_BASE) return valeur as NatureDomaine;
  throw new ErreurConversion(`Nature de prestation inconnue : "${valeur}".`);
}

export class ErreurConversion extends Error {
  override readonly name = 'ErreurConversion';
}

export function natureVersBase(valeur: NatureDomaine): NatureBase {
  return VERS_BASE[valeur];
}

export function uniteValide(valeur: string): Unite {
  return (UNITES as readonly string[]).includes(valeur) ? (valeur as Unite) : 'u';
}
