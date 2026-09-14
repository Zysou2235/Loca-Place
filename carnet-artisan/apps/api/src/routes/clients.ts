import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { contexteDe } from '../auth/middleware.js';
import { RessourceIntrouvable } from '../domaine/contexte-entreprise.js';
import type { Services } from '../jobs/traitements.js';

const creerClient = z.object({
  nom: z.string().min(1).max(200),
  telephones: z.array(z.string().max(30)).max(5).default([]),
  email: z.string().email().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const creerChantier = z.object({
  clientId: z.string().uuid(),
  libelle: z.string().min(1).max(200),
  adresse: z.string().max(300).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

export function routesClients(services: Services): FastifyPluginAsync {
  return async function plugin(app: FastifyInstance) {
    app.get('/clients', async (requete) => ({ clients: await contexteDe(requete).listerClients() }));

    app.post('/clients', async (requete, reponse) => {
      const parsed = creerClient.safeParse(requete.body);
      if (!parsed.success) return reponse.code(400).send({ erreur: 'Fiche client incomplete.' });
      const client = await contexteDe(requete).creerClient(parsed.data);
      return reponse.code(201).send({ client });
    });

    app.post('/chantiers', async (requete, reponse) => {
      const parsed = creerChantier.safeParse(requete.body);
      if (!parsed.success) return reponse.code(400).send({ erreur: 'Fiche chantier incomplete.' });
      try {
        const chantier = await contexteDe(requete).creerChantier(parsed.data);
        return reponse.code(201).send({ chantier });
      } catch (erreur) {
        if (erreur instanceof RessourceIntrouvable) {
          return reponse.code(404).send({ erreur: erreur.message });
        }
        throw erreur;
      }
    });

    app.get<{ Params: { id: string } }>('/chantiers/:id', async (requete, reponse) => {
      try {
        return { chantier: await contexteDe(requete).trouverChantier(requete.params.id) };
      } catch (erreur) {
        if (erreur instanceof RessourceIntrouvable) {
          return reponse.code(404).send({ erreur: erreur.message });
        }
        throw erreur;
      }
    });

    app.post<{ Params: { id: string }; Body: { texte?: string } }>(
      '/chantiers/:id/notes',
      async (requete, reponse) => {
        const texte = typeof requete.body?.texte === 'string' ? requete.body.texte.trim() : '';
        if (texte === '') return reponse.code(400).send({ erreur: 'Note vide.' });
        const contexte = contexteDe(requete);
        try {
          await contexte.trouverChantier(requete.params.id);
        } catch (erreur) {
          if (erreur instanceof RessourceIntrouvable) {
            return reponse.code(404).send({ erreur: erreur.message });
          }
          throw erreur;
        }
        const note = await services.db.noteChantier.create({
          data: {
            entrepriseId: contexte.entrepriseId,
            chantierId: requete.params.id,
            texte: texte.slice(0, 5000),
          },
        });
        return reponse.code(201).send({ note });
      },
    );
  };
}
