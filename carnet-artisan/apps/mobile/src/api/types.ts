/**
 * Formes des reponses de l'API, cote mobile.
 *
 * Ces types decrivent ce que le serveur renvoie ; ils ne sont pas partages
 * avec @carnet/shared pour que l'application puisse tolerer un serveur en
 * retard d'une version sans planter.
 */

export type EtatTelephonie =
  | 'NON_CONFIGURE'
  | 'EN_ATTENTE_FOURNISSEUR'
  | 'EN_ATTENTE_RENVOI_OPERATEUR'
  | 'PRET_A_TESTER'
  | 'TEST_REUSSI'
  | 'ERREUR';

export interface StatutTelephonie {
  etat: EtatTelephonie;
  detail: string;
  derniereVerificationIso: string | null;
  prochaineAction: string | null;
}

export type StatutTraitementAppel =
  | 'RECU'
  | 'EN_ATTENTE_ENREGISTREMENT'
  | 'AUDIO_TELECHARGE'
  | 'TRANSCRIPTION_EN_COURS'
  | 'ANALYSE_EN_COURS'
  | 'ANALYSE_TERMINEE'
  | 'SANS_ENREGISTREMENT'
  | 'ECHEC';

export type StatutAssociation = 'CERTAIN' | 'A_CONFIRMER' | 'AUCUN' | 'CORRIGE_MANUELLEMENT';

export interface Appel {
  id: string;
  debut: string;
  dureeSecondes: number;
  direction: 'ENTRANT' | 'SORTANT' | 'INTERNE';
  numeroDistant: string | null;
  numeroMasque: boolean;
  statutTraitement: StatutTraitementAppel;
  statutAssociation: StatutAssociation;
  justificationAssociation: string | null;
  resume: string | null;
  erreurMessage: string | null;
  estDemonstration: boolean;
  client?: { id: string; nom: string } | null;
  chantier?: { id: string; libelle: string } | null;
}

export interface ChampTrace<T> {
  valeur: T;
  extraitSource: string | null;
  repereSecondes: number | null;
  statut: 'explicite' | 'deduit' | 'a_confirmer';
}

export interface AnalyseAppel {
  resume: string;
  interlocuteur: {
    nom: ChampTrace<string | null>;
    telephoneEvoque: ChampTrace<string | null>;
    emailEvoque: ChampTrace<string | null>;
  };
  adresseChantier: ChampTrace<string | null>;
  natureTravaux: ChampTrace<string>;
  elements: {
    designation: string;
    valeurTexte: string;
    valeurNumerique: number | null;
    unite: string | null;
    extraitSource: string | null;
    statut: 'explicite' | 'deduit' | 'a_confirmer';
    corrections: { valeurAbandonnee: string; extraitSource: string | null }[];
  }[];
  contraintes: ChampTrace<string>[];
  urgence: { niveau: string; extraitSource: string | null; statut: string };
  informationsManquantes: string[];
  ambiguites: { sujet: string; pourquoi: string; questionAPoser: string }[];
  instructionsDetecteesDansLAppel: { extraitSource: string; raison: string }[];
  qualiteAudio: 'bonne' | 'moyenne' | 'mauvaise' | 'inexploitable';
}

export interface AppelDetail {
  appel: Appel & {
    analyse: { contenu: AnalyseAppel; avertissements: string[] } | null;
    transcription: { texte: string } | null;
  };
  transcriptionConservee: boolean;
}

export interface Tache {
  id: string;
  titre: string;
  echeance: string | null;
  priorite: string;
  statut: string;
}

export interface RendezVous {
  id: string;
  debutPropose: string;
  precision: string;
  expressionEntendue: string | null;
  expressionAbandonnee: string | null;
  ambigu: boolean;
  explication: string | null;
  statut: 'PROPOSE' | 'VALIDE' | 'REFUSE';
  chantier?: { libelle: string; client: { nom: string } } | null;
}

export interface Devis {
  id: string;
  numero: string;
  objet: string;
  statut: 'BROUILLON_INCOMPLET' | 'PRET_A_VERIFIER' | 'VALIDE' | 'EXPORTE';
  totalHtCents: number;
  totalTvaCents: number;
  totalTtcCents: number;
  chantier?: { libelle: string; client: { nom: string } } | null;
}

export interface Client {
  id: string;
  nom: string;
  telephones: string[];
  email: string | null;
  chantiers: { id: string; libelle: string; adresse: string | null; actif: boolean }[];
}

export interface Prestation {
  id: string;
  reference: string;
  libelle: string;
  unite: string;
  prixVenteCents: number;
  tvaRateBp: number;
  nature: string;
  archive: boolean;
}

export interface Aujourdhui {
  mode: 'DEMONSTRATION' | 'REEL';
  telephonie: StatutTelephonie | null;
  nouvellesDemandes: Appel[];
  analysesEnCours: Appel[];
  aRegler: {
    id: string;
    debutIso: string;
    numeroDistant: string | null;
    statut: string;
    message: string;
    relancable: boolean;
  }[];
  rappels: Tache[];
  rendezVous: RendezVous[];
  brouillons: Devis[];
}

export interface Parametres {
  entreprise: {
    id: string;
    nom: string;
    metier: string;
    nomArtisan: string;
    telephonePro: string;
    emailContact: string;
    siret: string | null;
    fuseau: string;
    mode: 'DEMONSTRATION' | 'REEL';
    retentionAudioJours: number;
    retentionTranscriptionJours: number;
  };
  telephonie:
    | (StatutTelephonie & {
        fournisseur: string;
        numeroTechnique: string | null;
        extensionPbx: string | null;
        renvoiConfirmeParUtilisateur: boolean;
        cleApiEnregistree: string | null;
        urlWebhook: string;
      })
    | null;
  capacitesFournisseur: {
    creationSousComptes: boolean;
    commandeNumeros: boolean;
    enregistrementParApi: boolean;
    webhooksSignes: boolean;
    identifiantsSipRecuperables: boolean;
    pushVoipVersApplicationTierce: boolean;
    renvoiVersSipExterne: boolean;
    callerIdArbitraire: boolean;
  };
  abonnement: {
    statut: string;
    prixMensuelCentimes: number;
    finPeriodeIso: string | null;
    modePaiement: string;
  } | null;
}
