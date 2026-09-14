/**
 * Stockage prive sur disque.
 *
 * Les fichiers sont ranges sous `<racine>/<entrepriseId>/<type>/<id>`. Aucune
 * route ne sert ces fichiers directement : l'application passe par un lien
 * temporaire signe, cloisonne par entreprise.
 *
 * Un stockage objet (S3 ou equivalent) se substitue a cette implementation en
 * respectant la meme interface.
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';

export interface FichierStocke {
  chemin: string;
  tailleOctets: number;
}

export class ErreurStockage extends Error {
  override readonly name = 'ErreurStockage';
}

export class StockageLocal {
  private readonly racine: string;

  constructor(racine: string) {
    this.racine = resolve(racine);
  }

  /**
   * Resout un chemin relatif en verifiant qu'il reste sous la racine.
   * Empeche qu'un identifiant malforme fasse ecrire ailleurs sur le disque.
   */
  private cheminAbsolu(cheminRelatif: string): string {
    const cible = resolve(this.racine, normalize(cheminRelatif));
    if (cible !== this.racine && !cible.startsWith(this.racine + sep)) {
      throw new ErreurStockage('Chemin de fichier hors du stockage autorise.');
    }
    return cible;
  }

  async ecrire(
    entrepriseId: string,
    type: 'audio' | 'devis',
    nomFichier: string,
    contenu: Buffer,
  ): Promise<FichierStocke> {
    const cheminRelatif = join(entrepriseId, type, `${randomUUID()}-${nomFichier}`);
    const absolu = this.cheminAbsolu(cheminRelatif);
    await mkdir(dirname(absolu), { recursive: true });
    await writeFile(absolu, contenu, { mode: 0o600 });
    return { chemin: cheminRelatif, tailleOctets: contenu.length };
  }

  async lire(cheminRelatif: string): Promise<Buffer> {
    return readFile(this.cheminAbsolu(cheminRelatif));
  }

  /** Suppression idempotente : un fichier deja absent n'est pas une erreur. */
  async supprimer(cheminRelatif: string): Promise<void> {
    await rm(this.cheminAbsolu(cheminRelatif), { force: true });
  }

  async supprimerEntreprise(entrepriseId: string): Promise<void> {
    await rm(this.cheminAbsolu(entrepriseId), { recursive: true, force: true });
  }

  /**
   * Jeton de telechargement temporaire.
   * Il lie le chemin, l'entreprise et une date d'expiration : un jeton obtenu
   * pour un fichier ne donne acces a aucun autre.
   */
  static signerAcces(
    secret: string,
    entrepriseId: string,
    cheminRelatif: string,
    expireA: Date,
  ): string {
    const charge = `${entrepriseId}|${cheminRelatif}|${String(expireA.getTime())}`;
    const signature = createHmac('sha256', secret).update(charge).digest('base64url');
    return `${Buffer.from(charge, 'utf8').toString('base64url')}.${signature}`;
  }

  static verifierAcces(
    secret: string,
    jeton: string,
    maintenant: Date = new Date(),
  ): { entrepriseId: string; chemin: string } | null {
    const [chargeB64, signature] = jeton.split('.');
    if (!chargeB64 || !signature) return null;
    const charge = Buffer.from(chargeB64, 'base64url').toString('utf8');
    const attendue = createHmac('sha256', secret).update(charge).digest('base64url');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(attendue, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const [entrepriseId, chemin, expiration] = charge.split('|');
    if (!entrepriseId || !chemin || !expiration) return null;
    if (Number(expiration) < maintenant.getTime()) return null;
    return { entrepriseId, chemin };
  }
}
