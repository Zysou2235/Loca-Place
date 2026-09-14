/**
 * Outils communs aux tests.
 *
 * Les tests tournent contre une vraie base PostgreSQL : c'est le seul moyen de
 * verifier pour de bon l'isolation entre entreprises et les contraintes
 * d'unicite. Une base en memoire donnerait une fausse assurance.
 */

import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] ??= 'postgresql://carnet:carnet@127.0.0.1:5432/carnet_test';
process.env['JWT_SECRET'] ??= 'secret-de-test-suffisamment-long-pour-passer';
process.env['CHIFFREMENT_CLE'] ??= Buffer.alloc(32, 7).toString('base64');
process.env['STOCKAGE_CHEMIN'] ??= mkdtempSync(join(tmpdir(), 'carnet-test-'));
process.env['URL_PUBLIQUE'] ??= 'https://exemple.test';

const { chargerConfiguration } = await import('../config.js');
const { prisma } = await import('../db.js');
const { construireServeur } = await import('../server.js');
const { FileDeJobs } = await import('../jobs/file.js');
const { StockageLocal } = await import('../adapters/stockage/local.js');
const { FournisseurDemo } = await import('../adapters/telephony/demo.js');
const { TranscriptionDemo } = await import('../adapters/transcription/demo.js');
const { ExtractionDemo } = await import('../adapters/extraction/demo.js');
const { chiffrer } = await import('../secrets.js');

import type { FastifyInstance } from 'fastify';
import type { Services } from '../jobs/traitements.js';

export const config = chargerConfiguration();
export const db = prisma();

export function construireServicesTest(surcharges: Partial<Services> = {}): Services {
  return {
    db,
    config,
    file: new FileDeJobs(db),
    stockage: new StockageLocal(config.STOCKAGE_CHEMIN),
    telephonie: new FournisseurDemo(),
    transcription: new TranscriptionDemo(),
    extraction: new ExtractionDemo(),
    ...surcharges,
  };
}

export async function nettoyerBase(): Promise<void> {
  // La cascade depuis Entreprise emporte tout le metier ; les jobs sans
  // entreprise sont supprimes a part.
  await db.entreprise.deleteMany({});
  await db.job.deleteMany({});
}

export interface EntrepriseDeTest {
  entrepriseId: string;
  utilisateurId: string;
  jeton: string;
  jetonWebhook: string;
  secretFournisseur: string;
  email: string;
}

let compteur = 0;

/**
 * Cree une entreprise complete avec un utilisateur connecte et une
 * configuration telephonique porteuse d'un secret fournisseur.
 */
export async function creerEntrepriseDeTest(
  app: FastifyInstance,
  options: { nom?: string; secretFournisseur?: string; mode?: 'DEMONSTRATION' | 'REEL' } = {},
): Promise<EntrepriseDeTest> {
  compteur += 1;
  const email = `artisan${String(compteur)}-${randomUUID().slice(0, 6)}@exemple.test`;
  const reponse = await app.inject({
    method: 'POST',
    url: '/auth/inscription',
    payload: {
      email,
      motDePasse: 'motdepasse-de-test',
      nomEntreprise: options.nom ?? `Entreprise ${String(compteur)}`,
      metier: 'electricien',
      nomArtisan: `Artisan ${String(compteur)}`,
      telephonePro: `+3329600${String(1000 + compteur)}`,
    },
  });
  if (reponse.statusCode !== 201) {
    throw new Error(`Inscription de test echouee : ${reponse.body}`);
  }
  const corps = reponse.json();

  const secretFournisseur = options.secretFournisseur ?? `secret-${randomUUID()}`;
  await db.configTelephonie.update({
    where: { entrepriseId: corps.entreprise.id },
    data: {
      identifiantFournisseur: `sub-${String(compteur)}`,
      cleApiChiffree: chiffrer(`cle-${String(compteur)}`),
      secretApiChiffre: chiffrer(secretFournisseur),
      numeroTechnique: `+3329699${String(1000 + compteur)}`,
      extensionPbx: '100',
    },
  });

  if (options.mode) {
    await db.entreprise.update({
      where: { id: corps.entreprise.id },
      data: { mode: options.mode },
    });
  }

  const entreprise = await db.entreprise.findUniqueOrThrow({ where: { id: corps.entreprise.id } });
  const utilisateur = await db.utilisateur.findUniqueOrThrow({ where: { email } });

  return {
    entrepriseId: entreprise.id,
    utilisateurId: utilisateur.id,
    jeton: corps.jeton,
    jetonWebhook: entreprise.jetonWebhook,
    secretFournisseur,
    email,
  };
}

export async function demarrerServeur(services?: Services): Promise<FastifyInstance> {
  const app = await construireServeur(services ?? construireServicesTest());
  await app.ready();
  return app;
}

export function entetes(entreprise: EntrepriseDeTest): Record<string, string> {
  return { authorization: `Bearer ${entreprise.jeton}` };
}
