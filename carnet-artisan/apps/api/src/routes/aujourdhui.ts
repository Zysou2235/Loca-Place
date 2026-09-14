import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { contexteDe } from '../auth/middleware.js';
import { construireStatut } from './parametres.js';
import type { Services } from '../jobs/traitements.js';

/**
 * Ecran "Aujourd'hui" : ce qui demande une action maintenant.
 *
 * Les erreurs figurent dans la meme liste que le reste. Un appel qui a echoue
 * doit se voir : c'est le seul moyen pour l'artisan de savoir qu'une demande
 * client risque de passer a la trappe.
 */
export function routesAujourdhui(services: Services): FastifyPluginAsync {
  return async function plugin(app: FastifyInstance) {
    app.get('/aujourdhui', async (requete) => {
      const contexte = contexteDe(requete);
      const entrepriseId = contexte.entrepriseId;
      const maintenant = new Date();
      const finDeJournee = new Date(maintenant.getTime() + 24 * 3600 * 1000);

      const [
        entreprise,
        config,
        nouvellesDemandes,
        enCours,
        enErreur,
        rappels,
        rendezVous,
        brouillons,
      ] = await Promise.all([
        contexte.entreprise(),
        contexte.configTelephonie(),
        services.db.appel.findMany({
          where: { entrepriseId, statutTraitement: 'ANALYSE_TERMINEE', chantierId: null },
          orderBy: { debut: 'desc' },
          take: 20,
          include: { client: true },
        }),
        services.db.appel.findMany({
          where: {
            entrepriseId,
            statutTraitement: {
              in: ['RECU', 'EN_ATTENTE_ENREGISTREMENT', 'AUDIO_TELECHARGE', 'TRANSCRIPTION_EN_COURS', 'ANALYSE_EN_COURS'],
            },
          },
          orderBy: { debut: 'desc' },
          take: 20,
        }),
        services.db.appel.findMany({
          where: { entrepriseId, statutTraitement: { in: ['ECHEC', 'SANS_ENREGISTREMENT'] } },
          orderBy: { debut: 'desc' },
          take: 20,
        }),
        services.db.tache.findMany({
          where: { entrepriseId, statut: 'A_FAIRE', echeance: { lte: finDeJournee } },
          orderBy: { echeance: 'asc' },
          take: 30,
        }),
        services.db.rendezVous.findMany({
          where: { entrepriseId, debutPropose: { gte: new Date(maintenant.getTime() - 3600 * 1000) } },
          orderBy: { debutPropose: 'asc' },
          take: 20,
          include: { chantier: { include: { client: true } } },
        }),
        services.db.devis.findMany({
          where: { entrepriseId, statut: { in: ['BROUILLON_INCOMPLET', 'PRET_A_VERIFIER'] } },
          orderBy: { modifieA: 'desc' },
          take: 20,
          include: { chantier: { include: { client: true } } },
        }),
      ]);

      return {
        mode: entreprise.mode,
        telephonie: config
          ? construireStatut({
              etat: config.etat,
              detail: config.detail,
              derniereVerification: config.derniereVerification,
              dernierTestReussi: config.dernierTestReussi,
            })
          : null,
        nouvellesDemandes,
        analysesEnCours: enCours,
        aRegler: enErreur.map((a) => ({
          id: a.id,
          debutIso: a.debut.toISOString(),
          numeroDistant: a.numeroMasque ? null : a.numeroDistant,
          statut: a.statutTraitement,
          message: a.erreurMessage ?? 'Traitement interrompu.',
          relancable: a.estEnregistre,
        })),
        rappels,
        rendezVous,
        brouillons,
      };
    });
  };
}
