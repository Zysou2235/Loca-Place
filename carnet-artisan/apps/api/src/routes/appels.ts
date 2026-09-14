import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { contexteDe } from '../auth/middleware.js';
import { RessourceIntrouvable } from '../domaine/contexte-entreprise.js';
import type { Services } from '../jobs/traitements.js';

const correction = z.object({
  clientId: z.string().uuid().nullable(),
  chantierId: z.string().uuid().nullable(),
});

export function routesAppels(services: Services): FastifyPluginAsync {
  return async function plugin(app: FastifyInstance) {
    app.get<{ Querystring: { limite?: string; statut?: string } }>('/appels', async (requete) => {
      const limite = requete.query.limite ? Number(requete.query.limite) : undefined;
      const appels = await contexteDe(requete).listerAppels({
        limite: Number.isFinite(limite) ? limite : undefined,
        statut: requete.query.statut,
      });
      return { appels };
    });

    app.get<{ Params: { id: string } }>('/appels/:id', async (requete, reponse) => {
      try {
        const appel = await contexteDe(requete).trouverAppel(requete.params.id);
        const entreprise = await contexteDe(requete).entreprise();
        return {
          appel,
          // La transcription n'est renvoyee que si la politique de conservation
          // de l'entreprise l'autorise.
          transcriptionConservee: entreprise.retentionTranscriptionJours > 0,
        };
      } catch (erreur) {
        if (erreur instanceof RessourceIntrouvable) {
          return reponse.code(404).send({ erreur: erreur.message });
        }
        throw erreur;
      }
    });

    /** Corrige un rattachement propose automatiquement. */
    app.put<{ Params: { id: string } }>('/appels/:id/association', async (requete, reponse) => {
      const parsed = correction.safeParse(requete.body);
      if (!parsed.success) return reponse.code(400).send({ erreur: 'Rattachement invalide.' });
      try {
        const appel = await contexteDe(requete).corrigerAssociationAppel(
          requete.params.id,
          parsed.data,
        );
        return { appel };
      } catch (erreur) {
        if (erreur instanceof RessourceIntrouvable) {
          return reponse.code(404).send({ erreur: erreur.message });
        }
        throw erreur;
      }
    });

    /**
     * Relance l'analyse d'un appel en echec.
     * Rien n'est supprime : l'appel garde son historique, on remet simplement
     * un travail dans la file.
     */
    app.post<{ Params: { id: string } }>('/appels/:id/relancer', async (requete, reponse) => {
      const contexte = contexteDe(requete);
      let appel;
      try {
        appel = await contexte.trouverAppel(requete.params.id);
      } catch (erreur) {
        if (erreur instanceof RessourceIntrouvable) {
          return reponse.code(404).send({ erreur: erreur.message });
        }
        throw erreur;
      }

      const etape = appel.transcription
        ? 'analyser_appel'
        : appel.estEnregistre
          ? 'recuperer_enregistrement'
          : null;
      if (!etape) {
        return reponse.code(409).send({
          erreur: 'Cet appel n a pas d enregistrement : il n y a rien a relancer.',
        });
      }

      // La cle d'unicite du job precedent est liberee pour autoriser la relance.
      await services.db.job.deleteMany({
        where: {
          entrepriseId: contexte.entrepriseId,
          cleUnicite: { in: [`analyse:${appel.id}`, `enregistrement:${appel.id}`] },
        },
      });
      await services.file.empiler(
        etape,
        { appelId: appel.id },
        {
          entrepriseId: contexte.entrepriseId,
          cleUnicite: `${etape === 'analyser_appel' ? 'analyse' : 'enregistrement'}:${appel.id}`,
        },
      );
      await services.db.appel.update({
        where: { id: appel.id },
        data: { erreurMessage: null, statutTraitement: 'RECU' },
      });
      return { relance: true, etape };
    });
  };
}
