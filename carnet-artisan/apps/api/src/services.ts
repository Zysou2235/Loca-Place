/**
 * Assemblage des adaptateurs a partir de la configuration.
 *
 * Point important : en mode REEL, un adaptateur de demonstration n'est jamais
 * substitue en silence. Si la configuration reelle manque, le demarrage
 * echoue (voir config.ts) ; si un traitement demande une capacite absente,
 * l'erreur remonte a l'artisan.
 */

import { configuration, type Configuration } from './config.js';
import { prisma } from './db.js';
import { FileDeJobs } from './jobs/file.js';
import { StockageLocal } from './adapters/stockage/local.js';
import { FournisseurZadarma } from './adapters/telephony/zadarma.js';
import { FournisseurDemo } from './adapters/telephony/demo.js';
import { TranscriptionDemo } from './adapters/transcription/demo.js';
import { TranscriptionExterne } from './adapters/transcription/externe.js';
import { ExtractionDemo } from './adapters/extraction/demo.js';
import { ExtractionAnthropic } from './adapters/extraction/anthropic.js';
import type { Services } from './jobs/traitements.js';
import type { FournisseurTelephonie } from './adapters/telephony/types.js';
import type { FournisseurTranscription } from './adapters/transcription/types.js';
import type { FournisseurExtraction } from './adapters/extraction/types.js';

export function construireTelephonie(config: Configuration): FournisseurTelephonie {
  if (config.TELEPHONIE_FOURNISSEUR === 'zadarma') {
    return new FournisseurZadarma({
      cleRevendeur: config.ZADARMA_CLE_REVENDEUR as string,
      secretRevendeur: config.ZADARMA_SECRET_REVENDEUR as string,
    });
  }
  return new FournisseurDemo();
}

export function construireTranscription(config: Configuration): FournisseurTranscription {
  if (config.TRANSCRIPTION_FOURNISSEUR === 'externe') {
    return new TranscriptionExterne({
      url: config.TRANSCRIPTION_URL as string,
      cle: config.TRANSCRIPTION_CLE as string,
      modele: config.TRANSCRIPTION_MODELE,
      coutMilliemesParMinute: config.COUT_TRANSCRIPTION_MILLIEMES_PAR_MINUTE,
    });
  }
  return new TranscriptionDemo();
}

export function construireExtraction(config: Configuration): FournisseurExtraction {
  if (config.IA_FOURNISSEUR === 'anthropic') {
    return new ExtractionAnthropic({
      cle: config.IA_CLE as string,
      modele: config.IA_MODELE,
      url: config.IA_URL,
      coutMilliemesParAnalyse: config.COUT_IA_MILLIEMES_PAR_ANALYSE,
    });
  }
  return new ExtractionDemo();
}

export function construireServices(config: Configuration = configuration()): Services {
  const db = prisma();
  return {
    db,
    config,
    file: new FileDeJobs(db),
    stockage: new StockageLocal(config.STOCKAGE_CHEMIN),
    telephonie: construireTelephonie(config),
    transcription: construireTranscription(config),
    extraction: construireExtraction(config),
  };
}
