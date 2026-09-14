/**
 * Telechargement des enregistrements audio, protege contre les SSRF.
 *
 * L'URL d'un enregistrement vient d'un service externe. La traiter comme sure
 * reviendrait a laisser ce service - ou quiconque sait falsifier sa reponse -
 * faire emettre a notre serveur des requetes vers n'importe quelle adresse,
 * y compris les services internes du reseau d'hebergement.
 *
 * Defenses appliquees, dans cet ordre :
 *  1. HTTPS obligatoire ;
 *  2. domaine present dans une liste blanche explicite ;
 *  3. adresses IP privees, locales et de metadonnees cloud refusees ;
 *  4. redirections suivies a la main, chacune revalidee, nombre limite ;
 *  5. taille maximale et delai maximal ;
 *  6. type de contenu verifie ;
 *  7. URL jamais journalisee avec sa chaine de requete (elle porte un jeton).
 */

import { lookup } from 'node:dns/promises';

export class ErreurTelechargement extends Error {
  override readonly name = 'ErreurTelechargement';
}

export interface OptionsTelechargement {
  domainesAutorises: readonly string[];
  tailleMaxOctets: number;
  timeoutMs: number;
  maxRedirections?: number;
  typesMimeAutorises?: readonly string[];
  /** Injectable pour les tests, evite de toucher au reseau. */
  fetchImpl?: typeof fetch;
  /** Injectable pour les tests : resolution DNS. */
  resolveur?: (hote: string) => Promise<string[]>;
}

export const TYPES_MIME_AUDIO = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'application/octet-stream',
] as const;

/** Retire la chaine de requete : elle contient souvent un jeton d'acces. */
export function urlPourJournal(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return '[url illisible]';
  }
}

export type VerificationUrl = { ok: true; url: URL } | { ok: false; raison: string };

/** Verifie le schema et le domaine, sans resoudre le DNS. */
export function verifierUrl(brute: string, domainesAutorises: readonly string[]): VerificationUrl {
  let url: URL;
  try {
    url = new URL(brute);
  } catch {
    return { ok: false, raison: 'URL illisible.' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, raison: `Schema refuse : ${url.protocol} (HTTPS obligatoire).` };
  }
  if (url.username !== '' || url.password !== '') {
    return { ok: false, raison: 'Les identifiants dans l URL sont refuses.' };
  }
  if (!domaineAutorise(url.hostname, domainesAutorises)) {
    return { ok: false, raison: `Domaine non autorise : ${url.hostname}.` };
  }
  return { ok: true, url };
}

/** Le domaine doit etre exactement autorise, ou un sous-domaine d'un domaine autorise. */
export function domaineAutorise(hote: string, domainesAutorises: readonly string[]): boolean {
  const h = hote.toLowerCase().replace(/\.$/, '');
  return domainesAutorises.some((d) => {
    const domaine = d.toLowerCase().replace(/^\./, '').replace(/\.$/, '');
    return domaine !== '' && (h === domaine || h.endsWith(`.${domaine}`));
  });
}

/**
 * Adresses qu'un service externe n'a aucune raison de nous faire joindre :
 * boucle locale, reseaux prives, lien-local (dont 169.254.169.254, l'adresse
 * de metadonnees des hebergeurs cloud), CGNAT, et leurs equivalents IPv6.
 */
export function estAdresseInterne(ip: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const o = v4.slice(1, 5).map(Number) as [number, number, number, number];
    if (o.some((n) => n > 255)) return true;
    const [a, b] = o;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0) return true;
    if (a >= 224) return true; // multicast et reserve
    return false;
  }
  const v6 = ip.toLowerCase().split('%')[0] ?? '';
  if (v6 === '::' || v6 === '::1') return true;
  if (v6.startsWith('fe80') || v6.startsWith('fc') || v6.startsWith('fd')) return true;
  if (v6.startsWith('::ffff:')) return estAdresseInterne(v6.slice('::ffff:'.length));
  return false;
}

async function resoudreParDefaut(hote: string): Promise<string[]> {
  const adresses = await lookup(hote, { all: true });
  return adresses.map((a) => a.address);
}

export interface AudioTelecharge {
  contenu: Buffer;
  typeMime: string;
  tailleOctets: number;
}

/**
 * Telecharge un enregistrement. Leve `ErreurTelechargement` avec un message
 * exploitable a chaque refus - jamais de retour vide silencieux.
 */
export async function telechargerAudio(
  urlBrute: string,
  options: OptionsTelechargement,
): Promise<AudioTelecharge> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveur = options.resolveur ?? resoudreParDefaut;
  const maxRedirections = options.maxRedirections ?? 3;
  const typesAutorises = options.typesMimeAutorises ?? TYPES_MIME_AUDIO;

  let urlCourante = urlBrute;
  for (let saut = 0; saut <= maxRedirections; saut += 1) {
    const verification = verifierUrl(urlCourante, options.domainesAutorises);
    if (!verification.ok) throw new ErreurTelechargement(verification.raison);
    const url = verification.url;

    const adresses = await resolveur(url.hostname);
    if (adresses.length === 0) {
      throw new ErreurTelechargement(`Aucune adresse IP pour ${url.hostname}.`);
    }
    const interne = adresses.find((ip) => estAdresseInterne(ip));
    if (interne !== undefined) {
      throw new ErreurTelechargement(
        `${url.hostname} pointe vers une adresse interne (${interne}) : telechargement refuse.`,
      );
    }

    const controleur = new AbortController();
    const minuteur = setTimeout(() => { controleur.abort(); }, options.timeoutMs);
    let reponse: Response;
    try {
      reponse = await fetchImpl(url, {
        redirect: 'manual',
        signal: controleur.signal,
        headers: { accept: typesAutorises.join(', ') },
      });
    } catch (erreur) {
      throw new ErreurTelechargement(
        `Telechargement impossible depuis ${urlPourJournal(urlCourante)} : ${(erreur as Error).message}`,
      );
    } finally {
      clearTimeout(minuteur);
    }

    if (reponse.status >= 300 && reponse.status < 400) {
      const cible = reponse.headers.get('location');
      if (!cible) throw new ErreurTelechargement('Redirection sans destination.');
      // La destination est revalidee au tour suivant, liste blanche comprise.
      urlCourante = new URL(cible, url).toString();
      continue;
    }

    if (!reponse.ok) {
      throw new ErreurTelechargement(
        `Reponse ${String(reponse.status)} depuis ${urlPourJournal(urlCourante)}.`,
      );
    }

    const typeMime = (reponse.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    if (!typesAutorises.includes(typeMime as (typeof TYPES_MIME_AUDIO)[number])) {
      throw new ErreurTelechargement(`Type de contenu refuse : "${typeMime || 'absent'}".`);
    }

    const annonce = reponse.headers.get('content-length');
    if (annonce !== null && Number(annonce) > options.tailleMaxOctets) {
      throw new ErreurTelechargement(
        `Fichier annonce a ${annonce} octets, au-dela de la limite de ${String(options.tailleMaxOctets)}.`,
      );
    }

    const contenu = await lireAvecLimite(reponse, options.tailleMaxOctets);
    return { contenu, typeMime, tailleOctets: contenu.length };
  }

  throw new ErreurTelechargement(`Trop de redirections (plus de ${String(maxRedirections)}).`);
}

/**
 * Lit le corps en s'arretant des le depassement de la limite.
 * `content-length` peut mentir : on ne se fie qu'aux octets reellement recus.
 */
async function lireAvecLimite(reponse: Response, tailleMax: number): Promise<Buffer> {
  const corps = reponse.body;
  if (!corps) throw new ErreurTelechargement('Reponse sans contenu.');
  const morceaux: Buffer[] = [];
  let total = 0;
  const lecteur = corps.getReader();
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > tailleMax) {
        await lecteur.cancel();
        throw new ErreurTelechargement(
          `Fichier plus gros que la limite de ${String(tailleMax)} octets : telechargement interrompu.`,
        );
      }
      morceaux.push(Buffer.from(value));
    }
  }
  return Buffer.concat(morceaux);
}
