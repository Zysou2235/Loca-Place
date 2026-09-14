/**
 * Signatures Zadarma : requetes API sortantes et webhooks entrants.
 *
 * Source des algorithmes : bibliotheque officielle `zadarma-api` (npm, MIT)
 * et specification OpenAPI officielle `zadarma/openapi` (spec/v1/openapi.json,
 * version 1.2.0). Voir docs/01-audit-faisabilite-zadarma.md pour les extraits
 * exacts et les dates de consultation.
 *
 * Deux details comptent et sont faciles a rater :
 *  1. La signature API est le base64 du *hexadecimal* du HMAC, pas le base64
 *     des octets bruts.
 *  2. La signature de webhook ne couvre que 2 ou 3 champs selon l'evenement.
 *     Elle ne prouve donc PAS l'integrite du reste du corps, et ne dit pas a
 *     quel compte l'evenement appartient. La liaison a une entreprise doit
 *     venir d'ailleurs (URL de webhook propre au locataire + verification avec
 *     le secret de ce locataire).
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const ZADARMA_BASE_URL = 'https://api.zadarma.com';

export type ParametresZadarma = Record<string, string | number | boolean | null | undefined>;

/**
 * Encodage RFC 1738, equivalent a `http_build_query` de PHP :
 * l'espace devient `+`, et `!*'()~` sont encodes.
 */
export function encoderRfc1738(valeur: string): string {
  return encodeURIComponent(valeur)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

/** Chaine de requete canonique : parametres tries par cle, valeurs encodees. */
export function chaineDeRequete(parametres: ParametresZadarma): string {
  const entrees = Object.entries(parametres)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return entrees
    .map(([cle, valeur]) => `${encoderRfc1738(cle)}=${encoderRfc1738(enTexte(valeur))}`)
    .join('&');
}

/**
 * Convertit une valeur primitive en texte. Un objet passe ici serait un bug
 * d'appel : on le refuse plutot que de signer "[object Object]".
 */
function enTexte(valeur: unknown): string {
  switch (typeof valeur) {
    case 'string':
      return valeur;
    case 'number':
    case 'boolean':
      return String(valeur);
    default:
      throw new TypeError('Un parametre Zadarma doit etre une chaine, un nombre ou un booleen.');
  }
}

/**
 * En-tete `Authorization` d'une requete API.
 *
 * @param cheminMethode chemin complet avec barres obliques encadrantes,
 *                      ex. `/v1/pbx/record/request/`
 */
export function enteteAuthorization(
  cheminMethode: string,
  parametres: ParametresZadarma,
  cle: string,
  secret: string,
): string {
  const requete = chaineDeRequete(parametres);
  const md5 = createHash('md5').update(requete).digest('hex');
  const aSigner = `${cheminMethode}${requete}${md5}`;
  const hex = createHmac('sha1', secret).update(aSigner).digest('hex');
  const signature = Buffer.from(hex, 'utf8').toString('base64');
  return `${cle}:${signature}`;
}

export const EVENEMENTS_ZADARMA = [
  'NOTIFY_START',
  'NOTIFY_INTERNAL',
  'NOTIFY_ANSWER',
  'NOTIFY_END',
  'NOTIFY_OUT_START',
  'NOTIFY_OUT_END',
  'NOTIFY_RECORD',
  'NOTIFY_IVR',
] as const;

export type EvenementZadarma = (typeof EVENEMENTS_ZADARMA)[number];

export function estEvenementZadarma(valeur: unknown): valeur is EvenementZadarma {
  return typeof valeur === 'string' && (EVENEMENTS_ZADARMA as readonly string[]).includes(valeur);
}

/**
 * Chaine signee par Zadarma selon le type d'evenement.
 * Reproduit exactement la fonction interne de la bibliotheque officielle.
 */
export function chaineSigneeWebhook(corps: Record<string, unknown>): string | null {
  const s = (cle: string): string => {
    const v = corps[cle];
    if (v === undefined || v === null) return '';
    // Zadarma n'envoie que des champs scalaires : un objet ici signale un
    // corps inattendu, qu'on ne veut surtout pas signer tel quel.
    return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
  };
  switch (corps['event']) {
    case 'NOTIFY_START':
    case 'NOTIFY_INTERNAL':
    case 'NOTIFY_END':
    case 'NOTIFY_IVR':
      return s('caller_id') + s('called_did') + s('call_start');
    case 'NOTIFY_ANSWER':
      return s('caller_id') + s('destination') + s('call_start');
    case 'NOTIFY_OUT_START':
    case 'NOTIFY_OUT_END':
      return s('internal') + s('destination') + s('call_start');
    case 'NOTIFY_RECORD':
      return s('pbx_call_id') + s('call_id_with_rec');
    default:
      return null;
  }
}

export type ResultatVerification =
  | { valide: true; evenement: EvenementZadarma }
  | { valide: false; raison: string };

/**
 * Verifie la signature d'un webhook Zadarma. **Ferme par defaut.**
 *
 * La bibliotheque officielle accepte l'evenement lorsque l'en-tete `Signature`
 * est absent (`if (signature && signature !== attendu) return null`). Ce
 * comportement laisserait n'importe qui poster de faux appels : on le refuse
 * ici explicitement.
 */
export function verifierSignatureWebhook(
  corps: Record<string, unknown>,
  signatureRecue: string | undefined | null,
  secret: string,
): ResultatVerification {
  if (!estEvenementZadarma(corps['event'])) {
    return { valide: false, raison: 'Type d evenement inconnu ou absent.' };
  }
  if (typeof signatureRecue !== 'string' || signatureRecue.trim() === '') {
    return { valide: false, raison: 'En-tete Signature absent : evenement refuse.' };
  }
  if (secret === '') {
    return { valide: false, raison: 'Aucun secret configure pour cette entreprise.' };
  }
  const aSigner = chaineSigneeWebhook(corps);
  if (aSigner === null) {
    return { valide: false, raison: 'Evenement non signable.' };
  }
  const attendue = createHmac('sha1', secret).update(aSigner).digest('base64');
  if (!comparaisonConstante(signatureRecue.trim(), attendue)) {
    return { valide: false, raison: 'Signature invalide.' };
  }
  return { valide: true, evenement: corps['event'] };
}

/** Comparaison a temps constant, sans fuite de longueur exploitable. */
export function comparaisonConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // timingSafeEqual exige des longueurs egales ; on compare quand meme une
    // paire de meme taille pour ne pas raccourcir le chemin d'echec.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Cle d'idempotence d'un evenement.
 *
 * Zadarma peut renvoyer le meme evenement plusieurs fois, et les evenements
 * d'un meme appel arrivent dans un ordre non garanti. `pbx_call_id` identifie
 * l'appel de bout en bout ; le couple (appel, evenement) identifie l'etape.
 */
export function cleIdempotence(corps: Record<string, unknown>): string | null {
  const evenement = corps['event'];
  if (!estEvenementZadarma(evenement)) return null;
  const appel = corps['pbx_call_id'];
  if (typeof appel !== 'string' || appel === '') return null;
  const lire = (cle: string): string => {
    const v = corps[cle];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  };
  const complement = evenement === 'NOTIFY_RECORD' ? lire('call_id_with_rec') : lire('call_start');
  return `${appel}:${evenement}:${complement}`;
}
