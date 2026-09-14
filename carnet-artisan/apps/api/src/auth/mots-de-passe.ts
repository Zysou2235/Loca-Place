/**
 * Hachage des mots de passe : scrypt, fourni par Node.
 *
 * Choix assume : pas d'argon2 dans le MVP, qui exige une compilation native et
 * complique l'installation. scrypt avec des parametres explicites est solide et
 * disponible partout. Le format stocke porte sa version et ses parametres, pour
 * permettre une migration ulterieure sans casser les comptes existants.
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * `promisify(scrypt)` choisit la surcharge sans options : on enveloppe a la
 * main pour pouvoir passer N, r et p explicitement.
 */
function scryptAsync(
  motDePasse: string,
  sel: Buffer,
  longueur: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    scrypt(motDePasse, sel, longueur, options, (erreur, cle) => {
      if (erreur) rejeter(erreur);
      else resoudre(cle);
    });
  });
}

const VERSION = 'scrypt1';
const PARAMS = { N: 16384, r: 8, p: 1, longueur: 64 } as const;

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  verifierRobustesse(motDePasse);
  const sel = randomBytes(16);
  const cle = await scryptAsync(motDePasse.normalize('NFKC'), sel, PARAMS.longueur, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
  });
  return [VERSION, PARAMS.N, PARAMS.r, PARAMS.p, sel.toString('base64url'), cle.toString('base64url')].join('$');
}

export async function verifierMotDePasse(motDePasse: string, stocke: string): Promise<boolean> {
  const parties = stocke.split('$');
  if (parties.length !== 6 || parties[0] !== VERSION) return false;
  const [, n, r, p, selB64, cleB64] = parties as [string, string, string, string, string, string];
  const sel = Buffer.from(selB64, 'base64url');
  const attendu = Buffer.from(cleB64, 'base64url');
  const calcule = await scryptAsync(motDePasse.normalize('NFKC'), sel, attendu.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  if (calcule.length !== attendu.length) return false;
  return timingSafeEqual(calcule, attendu);
}

export class ErreurMotDePasse extends Error {
  override readonly name = 'ErreurMotDePasse';
}

/**
 * Exigences volontairement simples : une longueur suffisante plutot qu'un
 * catalogue de caracteres speciaux, qui pousse surtout a reutiliser des
 * variantes du meme mot de passe.
 */
export function verifierRobustesse(motDePasse: string): void {
  if (motDePasse.length < 10) {
    throw new ErreurMotDePasse('Le mot de passe doit faire au moins 10 caracteres.');
  }
  if (motDePasse.length > 200) {
    throw new ErreurMotDePasse('Le mot de passe ne doit pas depasser 200 caracteres.');
  }
}
