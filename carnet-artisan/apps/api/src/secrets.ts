/**
 * Chiffrement des secrets fournisseur au repos.
 *
 * Les cles API et mots de passe SIP d'une entreprise ne doivent jamais etre
 * lisibles dans une sauvegarde de base ni dans un journal. Ils sont chiffres
 * en AES-256-GCM avec la cle maitre du serveur, et ne sont jamais renvoyes a
 * l'application mobile.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { configuration } from './config.js';

const ALGO = 'aes-256-gcm';
const TAILLE_IV = 12;
const PREFIXE = 'v1';

export class ErreurSecret extends Error {
  override readonly name = 'ErreurSecret';
}

function cleMaitre(): Buffer {
  return Buffer.from(configuration().CHIFFREMENT_CLE, 'base64');
}

/** Chiffre une valeur. Format : `v1.<iv>.<tag>.<chiffre>`, chaque partie en base64url. */
export function chiffrer(valeurClaire: string): string {
  const iv = randomBytes(TAILLE_IV);
  const cipher = createCipheriv(ALGO, cleMaitre(), iv);
  const chiffre = Buffer.concat([cipher.update(valeurClaire, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIXE, iv.toString('base64url'), tag.toString('base64url'), chiffre.toString('base64url')].join('.');
}

/** Dechiffre une valeur. Leve si le contenu a ete altere : jamais de repli silencieux. */
export function dechiffrer(valeurChiffree: string): string {
  const parties = valeurChiffree.split('.');
  if (parties.length !== 4 || parties[0] !== PREFIXE) {
    throw new ErreurSecret('Format de secret chiffre inattendu.');
  }
  const [, ivB64, tagB64, chiffreB64] = parties as [string, string, string, string];
  try {
    const decipher = createDecipheriv(ALGO, cleMaitre(), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(chiffreB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new ErreurSecret('Secret illisible : cle maitre differente ou donnee alteree.');
  }
}

/**
 * Masque un secret pour l'affichage : "abcd...wxyz".
 * Utilise dans l'interface pour confirmer qu'une cle est bien enregistree,
 * sans jamais la reveler.
 */
export function masquer(valeur: string): string {
  if (valeur.length <= 8) return '••••';
  return `${valeur.slice(0, 4)}…${valeur.slice(-4)}`;
}
