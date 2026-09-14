/**
 * Mode demonstration.
 *
 * Il rejoue des conversations fictives de bout en bout : fiche client,
 * chantier, taches, rendez-vous proposes, brouillon de devis. Aucun appel
 * reseau, aucune facturation, aucun appel reel.
 *
 * Ce que ce mode NE prouve PAS : que la telephonie fonctionne. Toutes les
 * reponses portent `estDemonstration: true` pour que l'interface le rappelle.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TAUX_TVA } from '@carnet/shared';
import { contexteDe } from '../auth/middleware.js';
import { SCENARIOS, scenarioParId } from '../demo/scenarios.js';
import { ExtractionDemo } from '../adapters/extraction/demo.js';
import { TranscriptionDemo } from '../adapters/transcription/demo.js';
import { StockageLocal } from '../adapters/stockage/local.js';
import { analyserAppel, transcrireAppel, type Services } from '../jobs/traitements.js';
import { CATALOGUE_DEMO } from '../demo/catalogue.js';

const rejouer = z.object({ scenarioId: z.string().min(1) });

export function routesDemo(services: Services): FastifyPluginAsync {
  return async function plugin(app: FastifyInstance) {
    app.get('/demo/scenarios', () => ({
      estDemonstration: true,
      avertissement:
        'Donnees entierement fictives. Ce mode ne demontre pas que la reception des appels fonctionne.',
      scenarios: SCENARIOS.map((s) => ({
        id: s.id,
        titre: s.titre,
        metAlEpreuve: s.metAlEpreuve,
        dureeSecondes: s.dureeSecondes,
        numeroMasque: s.numeroMasque,
      })),
    }));

    /** Installe un catalogue et un client fictifs pour pouvoir chiffrer. */
    app.post('/demo/preparer', async (requete, reponse) => {
      const contexte = contexteDe(requete);
      const entreprise = await contexte.entreprise();
      if (entreprise.mode !== 'DEMONSTRATION') {
        return reponse.code(409).send({
          erreur:
            'Cette entreprise est en mode reel : le jeu de demonstration n y est pas installe pour ne pas melanger les donnees.',
        });
      }

      for (const prestation of CATALOGUE_DEMO) {
        await services.db.prestation.upsert({
          where: {
            entrepriseId_reference: {
              entrepriseId: contexte.entrepriseId,
              reference: prestation.reference,
            },
          },
          create: { entrepriseId: contexte.entrepriseId, ...prestation },
          update: {},
        });
      }

      const client = await services.db.client.upsert({
        where: { id: await idClientDemo(services, contexte.entrepriseId) },
        create: {
          entrepriseId: contexte.entrepriseId,
          nom: 'Madame Le Gall (demonstration)',
          telephones: ['+33639980012'],
          notes: 'Fiche fictive du jeu de demonstration.',
        },
        update: {},
      });

      const existants = await services.db.chantier.count({
        where: { entrepriseId: contexte.entrepriseId, clientId: client.id },
      });
      if (existants === 0) {
        await services.db.chantier.create({
          data: {
            entrepriseId: contexte.entrepriseId,
            clientId: client.id,
            libelle: 'Garage - atelier',
            adresse: '12 rue des Lilas, Dinan',
            description: 'Chantier fictif de demonstration.',
          },
        });
      }

      return { estDemonstration: true, pret: true, prestations: CATALOGUE_DEMO.length };
    });

    /**
     * Rejoue un scenario : cree l'appel, sa transcription et son analyse, en
     * passant par le meme pipeline que la production - seuls les adaptateurs
     * changent.
     */
    app.post('/demo/rejouer', async (requete, reponse) => {
      const parsed = rejouer.safeParse(requete.body);
      if (!parsed.success) return reponse.code(400).send({ erreur: 'scenarioId requis.' });
      const scenario = scenarioParId(parsed.data.scenarioId);
      if (!scenario) return reponse.code(404).send({ erreur: 'Scenario inconnu.' });

      const contexte = contexteDe(requete);
      const entreprise = await contexte.entreprise();
      if (entreprise.mode !== 'DEMONSTRATION') {
        return reponse.code(409).send({
          erreur: 'Mode reel actif : la demonstration est desactivee pour ne rien melanger.',
        });
      }

      const debut = new Date(Date.now() + scenario.decalageHeures * 3600 * 1000);
      const pbxCallId = `demo_${scenario.id}_${String(debut.getTime())}`;

      const appel = await services.db.appel.create({
        data: {
          entrepriseId: contexte.entrepriseId,
          pbxCallId,
          direction: scenario.direction,
          numeroDistant: scenario.numeroDistant,
          numeroMasque: scenario.numeroMasque,
          numeroAppele: entreprise.telephonePro,
          debut,
          dureeSecondes: scenario.dureeSecondes,
          disposition: 'answered',
          estEnregistre: scenario.enregistrementDisponible,
          statutTraitement: 'AUDIO_TELECHARGE',
          estDemonstration: true,
        },
      });

      if (!scenario.enregistrementDisponible) {
        await services.db.appel.update({
          where: { id: appel.id },
          data: {
            statutTraitement: 'SANS_ENREGISTREMENT',
            erreurMessage: 'Scenario sans enregistrement : rien a analyser.',
          },
        });
        return reponse.code(201).send({ estDemonstration: true, appelId: appel.id });
      }

      // Un fichier audio fictif suffit : l'adaptateur de transcription de
      // demonstration ne le lit pas, mais le pipeline reste identique.
      const fichier = await services.stockage.ecrire(
        contexte.entrepriseId,
        'audio',
        `${pbxCallId}.txt`,
        Buffer.from('audio fictif de demonstration', 'utf8'),
      );
      await services.db.fichierAudio.create({
        data: {
          entrepriseId: contexte.entrepriseId,
          appelId: appel.id,
          chemin: fichier.chemin,
          tailleOctets: fichier.tailleOctets,
          typeMime: 'audio/mpeg',
          expireA: new Date(Date.now() + 7 * 86_400_000),
        },
      });

      const servicesDemo: Services = {
        ...services,
        transcription: new TranscriptionDemo(),
        extraction: new ExtractionDemo(),
      };
      await transcrireAppel(servicesDemo, { appelId: appel.id, referenceDemo: scenario.id });
      await analyserAppel(servicesDemo, { appelId: appel.id, referenceDemo: scenario.id });

      const resultat = await contexte.trouverAppel(appel.id);
      return reponse.code(201).send({ estDemonstration: true, appel: resultat });
    });
  };
}

async function idClientDemo(services: Services, entrepriseId: string): Promise<string> {
  const existant = await services.db.client.findFirst({
    where: { entrepriseId, telephones: { has: '+33639980012' } },
  });
  return existant?.id ?? '00000000-0000-0000-0000-000000000000';
}

export { StockageLocal, TAUX_TVA };
