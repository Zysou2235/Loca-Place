/**
 * File de traitement durable, stockee en base.
 *
 * Pourquoi pas Redis : le MVP doit rester installable sans infrastructure
 * supplementaire, et une file en base se sauvegarde avec le reste des donnees.
 * Le verrou d'execution est pris par une mise a jour conditionnelle : deux
 * workers ne peuvent pas prendre le meme travail.
 */

import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../db.js';

export type TypeJob =
  | 'traiter_evenement_appel'
  | 'recuperer_enregistrement'
  | 'transcrire_appel'
  | 'analyser_appel'
  | 'purger_fichiers_expires';

export interface JobEnAttente {
  id: string;
  type: TypeJob;
  contenu: Record<string, unknown>;
  entrepriseId: string | null;
  tentatives: number;
  maxTentatives: number;
}

export interface OptionsEmpilage {
  entrepriseId?: string | null;
  /** Empeche d'empiler deux fois le meme travail (ex. deux analyses d'un appel). */
  cleUnicite?: string;
  /** Delai avant la premiere tentative. */
  delaiMs?: number;
  maxTentatives?: number;
}

export class FileDeJobs {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Empile un travail. Si `cleUnicite` existe deja, rien n'est empile et le
   * job existant est renvoye : rejouer un webhook ne cree pas de doublon.
   */
  async empiler(
    type: TypeJob,
    contenu: Record<string, unknown>,
    options: OptionsEmpilage = {},
  ): Promise<{ id: string; deja: boolean }> {
    const prochaineExecution = new Date(Date.now() + (options.delaiMs ?? 0));
    if (options.cleUnicite) {
      const existant = await this.db.job.findUnique({ where: { cleUnicite: options.cleUnicite } });
      if (existant) return { id: existant.id, deja: true };
    }
    try {
      const job = await this.db.job.create({
        data: {
          type,
          contenu: contenu as never,
          entrepriseId: options.entrepriseId ?? null,
          cleUnicite: options.cleUnicite ?? null,
          prochaineExecution,
          maxTentatives: options.maxTentatives ?? 5,
        },
      });
      return { id: job.id, deja: false };
    } catch (erreur) {
      // Course entre deux webhooks simultanes : l'unicite en base tranche.
      if (options.cleUnicite && estViolationUnicite(erreur)) {
        const existant = await this.db.job.findUnique({ where: { cleUnicite: options.cleUnicite } });
        if (existant) return { id: existant.id, deja: true };
      }
      throw erreur;
    }
  }

  /**
   * Prend un travail disponible et pose un verrou.
   *
   * Le verrou expire : si un worker meurt en cours de route, le travail
   * redevient disponible au lieu de rester bloque.
   */
  async prendre(identifiantWorker: string, dureeVerrouMs = 5 * 60_000): Promise<JobEnAttente | null> {
    const maintenant = new Date();
    const candidat = await this.db.job.findFirst({
      where: {
        statut: 'EN_ATTENTE',
        prochaineExecution: { lte: maintenant },
        OR: [{ verrouJusqua: null }, { verrouJusqua: { lt: maintenant } }],
      },
      orderBy: { prochaineExecution: 'asc' },
    });
    if (!candidat) return null;

    // Mise a jour conditionnelle : si un autre worker a pris le job entre
    // temps, `count` vaut 0 et on repart bredouille plutot qu'a deux dessus.
    const pris = await this.db.job.updateMany({
      where: {
        id: candidat.id,
        statut: 'EN_ATTENTE',
        OR: [{ verrouJusqua: null }, { verrouJusqua: { lt: maintenant } }],
      },
      data: {
        statut: 'EN_COURS',
        verrouJusqua: new Date(Date.now() + dureeVerrouMs),
        verrouPar: identifiantWorker,
        tentatives: { increment: 1 },
      },
    });
    if (pris.count === 0) return null;

    const job = await this.db.job.findUnique({ where: { id: candidat.id } });
    if (!job) return null;
    return {
      id: job.id,
      type: job.type as TypeJob,
      contenu: (job.contenu ?? {}) as Record<string, unknown>,
      entrepriseId: job.entrepriseId,
      tentatives: job.tentatives,
      maxTentatives: job.maxTentatives,
    };
  }

  async terminer(jobId: string): Promise<void> {
    await this.db.job.update({
      where: { id: jobId },
      data: { statut: 'TERMINE', verrouJusqua: null, verrouPar: null, derniereErreur: null },
    });
  }

  /**
   * Replanifie apres echec, avec un recul exponentiel plafonne.
   * Au-dela du nombre de tentatives, le job passe en echec definitif : il
   * reste visible et relancable a la main, il ne disparait pas.
   */
  async echouer(job: JobEnAttente, erreur: Error): Promise<'replanifie' | 'abandonne'> {
    const message = erreur.message.slice(0, 1000);
    if (job.tentatives >= job.maxTentatives) {
      await this.db.job.update({
        where: { id: job.id },
        data: {
          statut: 'ECHEC_DEFINITIF',
          derniereErreur: message,
          verrouJusqua: null,
          verrouPar: null,
        },
      });
      return 'abandonne';
    }
    const reculMs = Math.min(2 ** job.tentatives * 1000, 10 * 60_000);
    await this.db.job.update({
      where: { id: job.id },
      data: {
        statut: 'EN_ATTENTE',
        derniereErreur: message,
        prochaineExecution: new Date(Date.now() + reculMs),
        verrouJusqua: null,
        verrouPar: null,
      },
    });
    return 'replanifie';
  }

  /** Remet un job abandonne dans la file, sur demande explicite de l'artisan. */
  async relancer(jobId: string): Promise<void> {
    await this.db.job.update({
      where: { id: jobId },
      data: {
        statut: 'EN_ATTENTE',
        tentatives: 0,
        prochaineExecution: new Date(),
        verrouJusqua: null,
        verrouPar: null,
      },
    });
  }

  static nouvelIdentifiantWorker(): string {
    return `worker-${randomUUID().slice(0, 8)}`;
  }
}

function estViolationUnicite(erreur: unknown): boolean {
  return (
    typeof erreur === 'object' &&
    erreur !== null &&
    'code' in erreur &&
    (erreur as { code?: unknown }).code === 'P2002'
  );
}
