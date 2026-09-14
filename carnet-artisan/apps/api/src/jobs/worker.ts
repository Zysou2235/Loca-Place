/**
 * Boucle du worker.
 *
 * Elle est volontairement simple : prendre un job, l'executer, marquer le
 * resultat. Un echec replanifie avec recul ; au-dela du quota de tentatives,
 * le job est marque en echec definitif - visible et relancable, jamais perdu.
 */

import { FileDeJobs } from './file.js';
import { executerJob, type Services } from './traitements.js';

export interface OptionsWorker {
  intervalleVideMs?: number;
  /** Nombre maximal de tours. Sans limite en production ; borne dans les tests. */
  maxTours?: number;
  signal?: AbortSignal;
  journaliser?: (message: string, details?: Record<string, unknown>) => void;
}

export async function boucleWorker(services: Services, options: OptionsWorker = {}): Promise<number> {
  const identifiant = FileDeJobs.nouvelIdentifiantWorker();
  const intervalle = options.intervalleVideMs ?? 1000;
  const journaliser = options.journaliser ?? (() => undefined);
  let tours = 0;
  let traites = 0;

  for (;;) {
    if (options.signal?.aborted) break;
    if (options.maxTours !== undefined && tours >= options.maxTours) break;
    tours += 1;

    const job = await services.file.prendre(identifiant);
    if (!job) {
      if (options.maxTours !== undefined) continue;
      await attendre(intervalle, options.signal);
      continue;
    }

    try {
      await executerJob(services, job);
      await services.file.terminer(job.id);
      traites += 1;
      journaliser('job termine', { type: job.type, id: job.id });
    } catch (erreur) {
      const issue = await services.file.echouer(job, erreur as Error);
      journaliser('job en echec', {
        type: job.type,
        id: job.id,
        issue,
        message: (erreur as Error).message,
      });
      if (issue === 'abandonne') await marquerAppelEnEchec(services, job, erreur as Error);
    }
  }
  return traites;
}

/**
 * Quand un job d'appel est definitivement abandonne, l'appel doit le dire.
 * Un appel bloque en "analyse en cours" pour toujours serait pire qu'une erreur
 * affichee : l'artisan croirait que ca arrive.
 */
async function marquerAppelEnEchec(
  services: Services,
  job: { type: string; contenu: Record<string, unknown> },
  erreur: Error,
): Promise<void> {
  const appelId = job.contenu['appelId'];
  if (typeof appelId !== 'string') return;
  await services.db.appel
    .update({
      where: { id: appelId },
      data: {
        statutTraitement: 'ECHEC',
        erreurMessage: `${etiquetteEtape(job.type)} : ${erreur.message}`.slice(0, 500),
      },
    })
    .catch(() => undefined);
}

function etiquetteEtape(type: string): string {
  switch (type) {
    case 'recuperer_enregistrement':
      return 'Recuperation de l enregistrement impossible';
    case 'transcrire_appel':
      return 'Transcription impossible';
    case 'analyser_appel':
      return 'Analyse impossible';
    default:
      return 'Traitement interrompu';
  }
}

function attendre(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolveAttente) => {
    const minuteur = setTimeout(resolveAttente, ms);
    signal?.addEventListener('abort', () => { clearTimeout(minuteur); resolveAttente(); }, { once: true });
  });
}
