/**
 * Configuration du serveur.
 *
 * Deux principes :
 *  1. Aucune valeur par defaut silencieuse pour un secret. Une cle absente
 *     fait echouer le demarrage, elle ne bascule jamais vers un mode degrade.
 *  2. Le mode REEL exige une configuration complete. On ne "retombe" jamais
 *     sur la simulation : c'est exactement le genre de repli qui fait croire
 *     a un artisan que son telephone est branche alors qu'il ne l'est pas.
 */

import { z } from 'zod';

const nombrePositif = z.coerce.number().int().positive();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: nombrePositif.default(3001),
  HOTE: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire.'),

  /** Secret de signature des jetons de session. 32 caracteres minimum. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit faire au moins 32 caracteres.'),
  DUREE_JETON_MINUTES: nombrePositif.default(60 * 24 * 14),

  /**
   * Cle maitre de chiffrement des secrets fournisseur (AES-256-GCM),
   * encodee en base64 (32 octets). A generer avec :
   *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   */
  CHIFFREMENT_CLE: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, {
      message: 'CHIFFREMENT_CLE doit etre 32 octets encodes en base64.',
    }),

  /** URL publique du serveur, utilisee pour construire les URLs de webhook. */
  URL_PUBLIQUE: z.string().url().default('http://localhost:3001'),

  /** Fournisseur de telephonie actif. `demo` ne contacte aucun service. */
  TELEPHONIE_FOURNISSEUR: z.enum(['demo', 'zadarma']).default('demo'),
  ZADARMA_CLE_REVENDEUR: z.string().optional(),
  ZADARMA_SECRET_REVENDEUR: z.string().optional(),

  TRANSCRIPTION_FOURNISSEUR: z.enum(['demo', 'externe']).default('demo'),
  TRANSCRIPTION_URL: z.string().url().optional(),
  TRANSCRIPTION_CLE: z.string().optional(),
  TRANSCRIPTION_MODELE: z.string().default('whisper-1'),

  IA_FOURNISSEUR: z.enum(['demo', 'anthropic']).default('demo'),
  IA_CLE: z.string().optional(),
  IA_MODELE: z.string().default('claude-sonnet-5'),
  IA_URL: z.string().url().default('https://api.anthropic.com'),

  /** Racine du stockage prive des fichiers audio et PDF. */
  STOCKAGE_CHEMIN: z.string().default('./donnees-privees'),

  /**
   * Domaines autorises pour le telechargement des enregistrements.
   * Liste blanche stricte : tout le reste est refuse (protection SSRF).
   */
  AUDIO_DOMAINES_AUTORISES: z
    .string()
    .default('zadarma.com,api.zadarma.com')
    .transform((v) => v.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)),
  AUDIO_TAILLE_MAX_OCTETS: nombrePositif.default(80 * 1024 * 1024),
  AUDIO_DUREE_MAX_SECONDES: nombrePositif.default(60 * 60 * 2),
  AUDIO_TIMEOUT_MS: nombrePositif.default(30_000),

  /** Tarifs de reference, en millimes d'euro pour garder la precision. */
  COUT_TELEPHONIE_MILLIEMES_PAR_MINUTE: z.coerce.number().int().nonnegative().default(0),
  COUT_TRANSCRIPTION_MILLIEMES_PAR_MINUTE: z.coerce.number().int().nonnegative().default(0),
  COUT_IA_MILLIEMES_PAR_ANALYSE: z.coerce.number().int().nonnegative().default(0),
  COUT_STOCKAGE_MILLIEMES_PAR_GO_MOIS: z.coerce.number().int().nonnegative().default(0),
  /** Date et source des tarifs ci-dessus, affichees dans le modele de couts. */
  COUTS_SOURCE: z.string().default('non renseigne'),
  COUTS_DATE: z.string().default('non renseignee'),
});

export type Configuration = z.infer<typeof schema> & {
  /** `true` si le serveur peut reellement joindre un fournisseur de telephonie. */
  telephonieReelleDisponible: boolean;
};

export class ErreurConfiguration extends Error {
  override readonly name = 'ErreurConfiguration';
}

export function chargerConfiguration(source: NodeJS.ProcessEnv = process.env): Configuration {
  const resultat = schema.safeParse(source);
  if (!resultat.success) {
    const details = resultat.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ErreurConfiguration(`Configuration invalide :\n${details}`);
  }
  const config = resultat.data;

  // Coherence : choisir un fournisseur reel sans lui donner ses identifiants
  // est une erreur de deploiement, pas un cas a rattraper au runtime.
  if (config.TELEPHONIE_FOURNISSEUR === 'zadarma') {
    if (!config.ZADARMA_CLE_REVENDEUR || !config.ZADARMA_SECRET_REVENDEUR) {
      throw new ErreurConfiguration(
        'TELEPHONIE_FOURNISSEUR=zadarma exige ZADARMA_CLE_REVENDEUR et ZADARMA_SECRET_REVENDEUR.',
      );
    }
  }
  if (config.TRANSCRIPTION_FOURNISSEUR === 'externe') {
    if (!config.TRANSCRIPTION_URL || !config.TRANSCRIPTION_CLE) {
      throw new ErreurConfiguration(
        'TRANSCRIPTION_FOURNISSEUR=externe exige TRANSCRIPTION_URL et TRANSCRIPTION_CLE.',
      );
    }
  }
  if (config.IA_FOURNISSEUR === 'anthropic' && !config.IA_CLE) {
    throw new ErreurConfiguration('IA_FOURNISSEUR=anthropic exige IA_CLE.');
  }

  return {
    ...config,
    telephonieReelleDisponible: config.TELEPHONIE_FOURNISSEUR !== 'demo',
  };
}

let cache: Configuration | null = null;

export function configuration(): Configuration {
  cache ??= chargerConfiguration();
  return cache;
}

/** Utilise par les tests pour repartir d'un environnement propre. */
export function reinitialiserConfiguration(): void {
  cache = null;
}
