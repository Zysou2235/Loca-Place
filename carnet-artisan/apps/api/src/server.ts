import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { authentification } from './auth/middleware.js';
import { routesAppels } from './routes/appels.js';
import { routesAuth } from './routes/auth.js';
import { routesAujourdhui } from './routes/aujourdhui.js';
import { routesCatalogue } from './routes/catalogue.js';
import { routesClients } from './routes/clients.js';
import { routesDemo } from './routes/demo.js';
import { routesDevis } from './routes/devis.js';
import { routesParametres } from './routes/parametres.js';
import { routesWebhooks } from './routes/webhooks.js';
import type { Services } from './jobs/traitements.js';

export async function construireServeur(services: Services): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: services.config.NODE_ENV === 'test' ? 'silent' : 'info',
      // Aucun secret ni contenu d'appel dans les journaux.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.signature',
          'req.headers.cookie',
          'req.body.motDePasse',
          'req.body.cleApi',
          'req.body.secretApi',
        ],
        censor: '[masque]',
      },
    },
    bodyLimit: 1024 * 1024,
    trustProxy: true,
  });

  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    // Le webhook a sa propre limite, plus large : un standard peut emettre
    // plusieurs evenements par appel.
    allowList: [],
  });

  app.get('/sante', () => ({
    etat: 'ok',
    mode: services.config.NODE_ENV,
    telephonie: services.telephonie.nom,
    transcription: services.transcription.nom,
    analyse: services.extraction.nom,
  }));

  await app.register(routesAuth(services));
  await app.register(routesWebhooks(services));

  // Tout ce qui suit exige une session valide.
  await app.register(async (protege) => {
    protege.addHook('preHandler', authentification(services.db));
    await protege.register(routesAujourdhui(services));
    await protege.register(routesAppels(services));
    await protege.register(routesClients(services));
    await protege.register(routesCatalogue(services));
    await protege.register(routesDevis(services));
    await protege.register(routesParametres(services));
    await protege.register(routesDemo(services));
  });

  app.setErrorHandler((erreur: unknown, requete, reponse) => {
    requete.log.error({ err: erreur }, 'Erreur non rattrapee');
    const details = erreur as { statusCode?: number; message?: string };
    const statut =
      typeof details.statusCode === 'number' && details.statusCode >= 400 ? details.statusCode : 500;
    void reponse.code(statut).send({
      erreur:
        statut >= 500
          ? // Une erreur interne ne revele jamais son detail au client : le
            // message complet reste dans les journaux serveur.
            'Une erreur interne est survenue. L operation n a pas ete effectuee.'
          : (details.message ?? 'Requete refusee.'),
    });
  });

  return app;
}
