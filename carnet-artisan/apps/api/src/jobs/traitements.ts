/**
 * Pipeline de traitement d'un appel.
 *
 * Enchainement : evenement -> enregistrement -> transcription -> analyse.
 * Chaque etape est un job distinct, rejouable independamment. Un echec ne
 * supprime jamais l'appel : il met un statut et un message, et l'artisan peut
 * relancer depuis l'application.
 */

import {
  analyseVide,
  detecterTentativeInjection,
  resoudreDateRelative,
  type AnalyseAppel,
  type PropositionAssociation,
} from '@carnet/shared';
import type { Configuration } from '../config.js';
import type { PrismaClient } from '../db.js';
import { dechiffrer } from '../secrets.js';
import { proposerAssociation } from '../domaine/association.js';
import { telechargerAudio } from '../securite/telechargement-audio.js';
import type { StockageLocal } from '../adapters/stockage/local.js';
import type { FournisseurTelephonie } from '../adapters/telephony/types.js';
import type { FournisseurTranscription } from '../adapters/transcription/types.js';
import type { FournisseurExtraction } from '../adapters/extraction/types.js';
import { FileDeJobs, type JobEnAttente } from './file.js';

export interface Services {
  db: PrismaClient;
  config: Configuration;
  file: FileDeJobs;
  stockage: StockageLocal;
  telephonie: FournisseurTelephonie;
  transcription: FournisseurTranscription;
  extraction: FournisseurExtraction;
  /** Injectable pour les tests. */
  telecharger?: typeof telechargerAudio;
  maintenant?: () => Date;
}

export class ErreurTraitement extends Error {
  override readonly name = 'ErreurTraitement';
}

export async function executerJob(services: Services, job: JobEnAttente): Promise<void> {
  switch (job.type) {
    case 'traiter_evenement_appel':
      return traiterEvenementAppel(services, job.contenu);
    case 'recuperer_enregistrement':
      return recupererEnregistrement(services, job.contenu);
    case 'transcrire_appel':
      return transcrireAppel(services, job.contenu);
    case 'analyser_appel':
      return analyserAppel(services, job.contenu);
    case 'purger_fichiers_expires':
      await purgerFichiersExpires(services);
      return;
    default:
      throw new ErreurTraitement(`Type de job inconnu : ${String(job.type)}`);
  }
}

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur !== '' ? valeur : null;
}

/**
 * Etape 1 : transforme un evenement fournisseur en appel.
 *
 * L'evenement a deja ete verifie (signature) et journalise par la route de
 * webhook. Ici on cree ou complete l'appel, sans jamais ecraser une
 * information plus precise par une moins precise.
 */
export async function traiterEvenementAppel(
  services: Services,
  contenu: Record<string, unknown>,
): Promise<void> {
  const evenementId = texte(contenu['evenementId']);
  if (!evenementId) throw new ErreurTraitement('evenementId manquant.');

  const evenement = await services.db.evenementTelephonie.findUnique({ where: { id: evenementId } });
  if (!evenement) throw new ErreurTraitement(`Evenement ${evenementId} introuvable.`);

  const corps = evenement.contenu as Record<string, unknown>;
  const pbxCallId = texte(corps['pbx_call_id']);
  if (!pbxCallId) throw new ErreurTraitement('pbx_call_id absent de l evenement.');

  const entrepriseId = evenement.entrepriseId;
  const type = evenement.type;
  const sortant = type === 'NOTIFY_OUT_START' || type === 'NOTIFY_OUT_END';
  const numeroBrut = sortant ? texte(corps['destination']) : texte(corps['caller_id']);
  const numeroMasque = numeroBrut === null || /^(anonymous|unknown|private)$/i.test(numeroBrut);
  const debut = analyserDateFournisseur(texte(corps['call_start']), services);

  const existant = await services.db.appel.findUnique({
    where: { entrepriseId_pbxCallId: { entrepriseId, pbxCallId } },
  });

  const donneesCommunes = {
    direction: sortant ? ('SORTANT' as const) : ('ENTRANT' as const),
    numeroDistant: numeroMasque ? null : numeroBrut,
    numeroMasque,
    numeroAppele: texte(corps['called_did']),
    debut,
  };

  const finDAppel = type === 'NOTIFY_END' || type === 'NOTIFY_OUT_END';
  const dureeSecondes = finDAppel ? Number(corps['duration'] ?? 0) : 0;
  const estEnregistre = corps['is_recorded'] === '1' || corps['is_recorded'] === 1;
  const callIdAvecEnregistrement =
    texte(corps['call_id_with_rec']) ?? (type === 'NOTIFY_RECORD' ? texte(corps['call_id_with_rec']) : null);

  const appel = existant
    ? await services.db.appel.update({
        where: { id: existant.id },
        data: {
          ...donneesCommunes,
          // La duree n'arrive qu'a la fin : on ne la remet pas a zero sur un
          // evenement anterieur recu en retard.
          ...(finDAppel ? { dureeSecondes, disposition: texte(corps['disposition']) } : {}),
          ...(estEnregistre ? { estEnregistre: true } : {}),
          ...(callIdAvecEnregistrement ? { callIdAvecEnregistrement } : {}),
        },
      })
    : await services.db.appel.create({
        data: {
          entrepriseId,
          pbxCallId,
          ...donneesCommunes,
          dureeSecondes,
          disposition: texte(corps['disposition']),
          estEnregistre,
          callIdAvecEnregistrement,
          statutTraitement: 'RECU',
        },
      });

  if (appel.statutAssociation === 'AUCUN' || appel.statutAssociation === 'A_CONFIRMER') {
    await appliquerAssociation(services, appel.id, entrepriseId, {
      numeroDistant: appel.numeroDistant,
      numeroMasque: appel.numeroMasque,
      adresseEntendue: null,
    });
  }

  if (!finDAppel && type !== 'NOTIFY_RECORD') return;

  if (!appel.estEnregistre && !estEnregistre) {
    // Un appel sans enregistrement reste une trace utile : il apparait dans la
    // liste avec son statut, il n'est pas efface.
    await services.db.appel.update({
      where: { id: appel.id },
      data: {
        statutTraitement: 'SANS_ENREGISTREMENT',
        erreurMessage: 'Aucun enregistrement disponible pour cet appel.',
      },
    });
    return;
  }

  await services.db.appel.update({
    where: { id: appel.id },
    data: { statutTraitement: 'EN_ATTENTE_ENREGISTREMENT' },
  });
  await services.file.empiler(
    'recuperer_enregistrement',
    { appelId: appel.id },
    { entrepriseId, cleUnicite: `enregistrement:${appel.id}` },
  );
}

/** Etape 2 : recupere le lien d'enregistrement et telecharge le fichier. */
export async function recupererEnregistrement(
  services: Services,
  contenu: Record<string, unknown>,
): Promise<void> {
  const appelId = texte(contenu['appelId']);
  if (!appelId) throw new ErreurTraitement('appelId manquant.');
  const appel = await services.db.appel.findUnique({ where: { id: appelId } });
  if (!appel) throw new ErreurTraitement(`Appel ${appelId} introuvable.`);

  const config = await services.db.configTelephonie.findUnique({
    where: { entrepriseId: appel.entrepriseId },
  });
  if (!config?.cleApiChiffree || !config.secretApiChiffre || !config.identifiantFournisseur) {
    throw new ErreurTraitement(
      'Aucun identifiant fournisseur enregistre pour cette entreprise : impossible de recuperer l enregistrement.',
    );
  }

  const identifiants = {
    identifiantFournisseur: config.identifiantFournisseur,
    cleApi: dechiffrer(config.cleApiChiffree),
    secretApi: dechiffrer(config.secretApiChiffre),
  };

  const enregistrement = await services.telephonie.obtenirEnregistrement(identifiants, {
    callId: appel.callIdAvecEnregistrement ?? undefined,
    pbxCallId: appel.pbxCallId,
  });
  if (!enregistrement) {
    await services.db.appel.update({
      where: { id: appel.id },
      data: {
        statutTraitement: 'SANS_ENREGISTREMENT',
        erreurMessage: 'Le fournisseur ne propose aucun fichier pour cet appel.',
      },
    });
    return;
  }

  const telecharger = services.telecharger ?? telechargerAudio;
  const audio = await telecharger(enregistrement.url, {
    domainesAutorises: services.config.AUDIO_DOMAINES_AUTORISES,
    tailleMaxOctets: services.config.AUDIO_TAILLE_MAX_OCTETS,
    timeoutMs: services.config.AUDIO_TIMEOUT_MS,
  });

  const fichier = await services.stockage.ecrire(
    appel.entrepriseId,
    'audio',
    `${appel.pbxCallId}.audio`,
    audio.contenu,
  );

  const entreprise = await services.db.entreprise.findUnique({ where: { id: appel.entrepriseId } });
  const retentionJours = entreprise?.retentionAudioJours ?? 30;
  const expireA = new Date(maintenant(services).getTime() + retentionJours * 86_400_000);

  await services.db.fichierAudio.upsert({
    where: { appelId: appel.id },
    create: {
      entrepriseId: appel.entrepriseId,
      appelId: appel.id,
      chemin: fichier.chemin,
      tailleOctets: fichier.tailleOctets,
      typeMime: audio.typeMime,
      expireA,
    },
    update: {
      chemin: fichier.chemin,
      tailleOctets: fichier.tailleOctets,
      typeMime: audio.typeMime,
      expireA,
      supprimeA: null,
    },
  });

  await services.db.appel.update({
    where: { id: appel.id },
    data: { statutTraitement: 'AUDIO_TELECHARGE', erreurMessage: null },
  });
  await services.file.empiler(
    'transcrire_appel',
    { appelId: appel.id },
    { entrepriseId: appel.entrepriseId, cleUnicite: `transcription:${appel.id}` },
  );
}

/** Etape 3 : transcription. */
export async function transcrireAppel(
  services: Services,
  contenu: Record<string, unknown>,
): Promise<void> {
  const appelId = texte(contenu['appelId']);
  if (!appelId) throw new ErreurTraitement('appelId manquant.');
  const appel = await services.db.appel.findUnique({
    where: { id: appelId },
    include: { fichierAudio: true },
  });
  if (!appel) throw new ErreurTraitement(`Appel ${appelId} introuvable.`);
  if (!appel.fichierAudio || appel.fichierAudio.supprimeA) {
    throw new ErreurTraitement('Fichier audio absent : transcription impossible.');
  }

  await services.db.appel.update({
    where: { id: appel.id },
    data: { statutTraitement: 'TRANSCRIPTION_EN_COURS' },
  });

  const audio = await services.stockage.lire(appel.fichierAudio.chemin);
  const resultat = await services.transcription.transcrire({
    audio,
    typeMime: appel.fichierAudio.typeMime,
    dureeSecondes: appel.dureeSecondes,
    langue: 'fr',
    reference: texte(contenu['referenceDemo']) ?? appel.pbxCallId,
  });

  if (resultat.texte.trim() === '') {
    // Une transcription vide n'est pas une analyse ratee : c'est un resultat,
    // qu'on affiche tel quel plutot que de lancer une analyse dans le vide.
    await services.db.appel.update({
      where: { id: appel.id },
      data: {
        statutTraitement: 'SANS_ENREGISTREMENT',
        erreurMessage: 'Transcription vide : aucun contenu exploitable dans l enregistrement.',
      },
    });
    return;
  }

  const signaux = detecterTentativeInjection(resultat.texte);
  await services.db.transcription.upsert({
    where: { appelId: appel.id },
    create: {
      entrepriseId: appel.entrepriseId,
      appelId: appel.id,
      texte: resultat.texte,
      langue: resultat.langue,
      moteur: resultat.moteur,
      dureeAudioSecondes: appel.dureeSecondes,
      coutCentimes: resultat.coutCentimes,
      signauxInjection: signaux.length > 0 ? (signaux as never) : undefined,
    },
    update: {
      texte: resultat.texte,
      moteur: resultat.moteur,
      coutCentimes: resultat.coutCentimes,
      signauxInjection: signaux.length > 0 ? (signaux as never) : undefined,
    },
  });

  await services.file.empiler(
    'analyser_appel',
    { appelId: appel.id, referenceDemo: texte(contenu['referenceDemo']) },
    { entrepriseId: appel.entrepriseId, cleUnicite: `analyse:${appel.id}` },
  );
}

/** Etape 4 : analyse structuree, puis creation des propositions. */
export async function analyserAppel(
  services: Services,
  contenu: Record<string, unknown>,
): Promise<void> {
  const appelId = texte(contenu['appelId']);
  if (!appelId) throw new ErreurTraitement('appelId manquant.');
  const appel = await services.db.appel.findUnique({
    where: { id: appelId },
    include: { transcription: true, entreprise: true },
  });
  if (!appel) throw new ErreurTraitement(`Appel ${appelId} introuvable.`);
  if (!appel.transcription) throw new ErreurTraitement('Transcription absente : analyse impossible.');

  await services.db.appel.update({
    where: { id: appel.id },
    data: { statutTraitement: 'ANALYSE_EN_COURS', nbTentativesAnalyse: { increment: 1 } },
  });

  const resultat = await services.extraction.analyser({
    transcription: appel.transcription.texte,
    instantAppel: appel.debut,
    fuseau: appel.entreprise.fuseau,
    metier: appel.entreprise.metier,
    reference: texte(contenu['referenceDemo']) ?? appel.pbxCallId,
  });

  const analyse = resultat.analyse;

  await services.db.analyse.upsert({
    where: { appelId: appel.id },
    create: {
      entrepriseId: appel.entrepriseId,
      appelId: appel.id,
      contenu: analyse as never,
      moteur: resultat.moteur,
      coutCentimes: resultat.coutCentimes,
      avertissements: [...resultat.avertissements],
    },
    update: {
      contenu: analyse as never,
      moteur: resultat.moteur,
      coutCentimes: resultat.coutCentimes,
      avertissements: [...resultat.avertissements],
    },
  });

  // L'adresse entendue peut lever une ambiguite de chantier : on repasse
  // l'association avec cette information supplementaire.
  await appliquerAssociation(services, appel.id, appel.entrepriseId, {
    numeroDistant: appel.numeroDistant,
    numeroMasque: appel.numeroMasque,
    adresseEntendue: analyse.adresseChantier.valeur,
  });

  await creerPropositions(services, appel.id, appel.entrepriseId, appel.debut, appel.entreprise.fuseau, analyse);

  await services.db.appel.update({
    where: { id: appel.id },
    data: { statutTraitement: 'ANALYSE_TERMINEE', resume: analyse.resume, erreurMessage: null },
  });

  await comptabiliserUsage(services, appel.entrepriseId, {
    minutes: Math.ceil(appel.dureeSecondes / 60),
    coutTranscription: appel.transcription.coutCentimes,
    coutIa: resultat.coutCentimes,
  });
}

/**
 * Cree les taches et les rendez-vous PROPOSES.
 *
 * Les dates sont resolues ici, par du code, a partir de l'expression entendue
 * et de la date de l'appel. Le modele n'a jamais le droit de produire une
 * date : il ne fait que rapporter ce qui a ete dit.
 */
async function creerPropositions(
  services: Services,
  appelId: string,
  entrepriseId: string,
  instantAppel: Date,
  fuseau: string,
  analyse: AnalyseAppel,
): Promise<void> {
  const appel = await services.db.appel.findUnique({ where: { id: appelId } });
  const chantierId = appel?.chantierId ?? null;

  // On repart de zero pour cet appel : une relance d'analyse ne doit pas
  // empiler des doublons de taches.
  await services.db.tache.deleteMany({ where: { appelId, entrepriseId, statut: 'A_FAIRE' } });
  await services.db.rendezVous.deleteMany({ where: { appelId, entrepriseId, statut: 'PROPOSE' } });

  for (const tache of analyse.tachesProposees) {
    const echeance = tache.echeanceTexte
      ? resoudreDateRelative(tache.echeanceTexte, instantAppel, { fuseau })
      : null;
    await services.db.tache.create({
      data: {
        entrepriseId,
        appelId,
        chantierId,
        titre: tache.titre,
        echeance: echeance?.instant ?? null,
        priorite: tache.priorite,
      },
    });
  }

  for (const creneau of analyse.disponibilites) {
    const resolution = resoudreDateRelative(creneau.expressionEntendue, instantAppel, { fuseau });
    if (!resolution) {
      // Expression non resolue ("des que possible") : pas de rendez-vous
      // fantome. L'information reste dans l'analyse, visible par l'artisan.
      continue;
    }
    await services.db.rendezVous.create({
      data: {
        entrepriseId,
        appelId,
        chantierId,
        debutPropose: resolution.instant,
        precision: resolution.precision,
        expressionEntendue: creneau.expressionEntendue,
        expressionAbandonnee: creneau.expressionAbandonnee,
        ambigu: resolution.ambigu || creneau.corrige,
        explication: creneau.corrige
          ? `${resolution.explication} L interlocuteur s est repris pendant l appel : "${creneau.expressionAbandonnee ?? ''}" puis "${creneau.expressionEntendue}".`
          : resolution.explication,
        statut: 'PROPOSE',
      },
    });
  }
}

async function appliquerAssociation(
  services: Services,
  appelId: string,
  entrepriseId: string,
  contexte: { numeroDistant: string | null; numeroMasque: boolean; adresseEntendue: string | null },
): Promise<PropositionAssociation> {
  const [clients, chantiers] = await Promise.all([
    services.db.client.findMany({ where: { entrepriseId } }),
    services.db.chantier.findMany({ where: { entrepriseId } }),
  ]);

  const proposition = proposerAssociation({
    numeroDistant: contexte.numeroDistant,
    numeroMasque: contexte.numeroMasque,
    adresseEntendue: contexte.adresseEntendue,
    clients: clients.map((c) => ({ id: c.id, nom: c.nom, telephones: c.telephones })),
    chantiers: chantiers.map((ch) => ({
      id: ch.id,
      clientId: ch.clientId,
      libelle: ch.libelle,
      adresse: ch.adresse,
      actif: ch.actif,
    })),
  });

  const actuel = await services.db.appel.findUnique({ where: { id: appelId } });
  // Une correction manuelle de l'artisan fait autorite : l'automatisme ne la
  // remplace jamais, meme apres une relance d'analyse.
  if (actuel?.statutAssociation === 'CORRIGE_MANUELLEMENT') return proposition;

  await services.db.appel.update({
    where: { id: appelId },
    data: {
      clientId: proposition.clientId,
      chantierId: proposition.chantierId,
      statutAssociation: proposition.statut,
      justificationAssociation: proposition.justification,
      alternativesAssociation: proposition.alternatives as never,
    },
  });
  return proposition;
}

/** Etape 5 : purge des fichiers arrives a echeance de conservation. */
export async function purgerFichiersExpires(services: Services): Promise<number> {
  const expires = await services.db.fichierAudio.findMany({
    where: { expireA: { lte: maintenant(services) }, supprimeA: null },
    take: 500,
  });
  let supprimes = 0;
  for (const fichier of expires) {
    await services.stockage.supprimer(fichier.chemin);
    await services.db.fichierAudio.update({
      where: { id: fichier.id },
      data: { supprimeA: maintenant(services) },
    });
    supprimes += 1;
  }
  return supprimes;
}

async function comptabiliserUsage(
  services: Services,
  entrepriseId: string,
  mesures: { minutes: number; coutTranscription: number; coutIa: number },
): Promise<void> {
  const date = maintenant(services);
  const periode = `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  const coutTelephonie = Math.ceil(
    (mesures.minutes * services.config.COUT_TELEPHONIE_MILLIEMES_PAR_MINUTE) / 10,
  );
  await services.db.usageMensuel.upsert({
    where: { entrepriseId_periode: { entrepriseId, periode } },
    create: {
      entrepriseId,
      periode,
      minutesAudio: mesures.minutes,
      nbAppels: 1,
      nbAnalyses: 1,
      coutTelephonieCentimes: coutTelephonie,
      coutTranscriptionCentimes: mesures.coutTranscription,
      coutIaCentimes: mesures.coutIa,
    },
    update: {
      minutesAudio: { increment: mesures.minutes },
      nbAppels: { increment: 1 },
      nbAnalyses: { increment: 1 },
      coutTelephonieCentimes: { increment: coutTelephonie },
      coutTranscriptionCentimes: { increment: mesures.coutTranscription },
      coutIaCentimes: { increment: mesures.coutIa },
    },
  });
}

/**
 * Les horodatages Zadarma arrivent au format "AAAA-MM-JJ HH:MM:SS", sans
 * fuseau. Ils sont interpretes en UTC faute de mieux, et cette hypothese est
 * documentee : c'est un point a confirmer avec un compte reel.
 */
export function analyserDateFournisseur(valeur: string | null, services: Services): Date {
  if (!valeur) return maintenant(services);
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(valeur)
    ? `${valeur.replace(' ', 'T')}Z`
    : valeur;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? maintenant(services) : date;
}

function maintenant(services: Services): Date {
  return services.maintenant ? services.maintenant() : new Date();
}

export { analyseVide };
