/**
 * Types metier partages entre l'API, les workers et l'application mobile.
 * Ce fichier est la source de verite des etats affiches a l'artisan.
 */

/**
 * Etat de la connexion telephonique.
 *
 * Regle : `PRET_A_TESTER` ne veut PAS dire "connecte". Tant qu'un appel de
 * test n'a pas produit un evenement signe ET un enregistrement recuperable,
 * l'application n'ecrit jamais "connecte". La presence d'une cle API ne
 * suffit a rien.
 */
export type EtatTelephonie =
  /** Rien n'a ete configure. */
  | 'NON_CONFIGURE'
  /** Compte fournisseur cree, en attente de numero ou de justificatifs. */
  | 'EN_ATTENTE_FOURNISSEUR'
  /** L'artisan doit encore activer le renvoi chez son operateur. */
  | 'EN_ATTENTE_RENVOI_OPERATEUR'
  /** Tout est parametre : il reste a passer un appel de test reel. */
  | 'PRET_A_TESTER'
  /** Un appel de test a ete recu, signe, enregistre et analyse de bout en bout. */
  | 'TEST_REUSSI'
  /** Une etape a echoue ; `detail` porte le message affiche. */
  | 'ERREUR';

export const ETATS_TELEPHONIE_CONSIDERES_ACTIFS: readonly EtatTelephonie[] = ['TEST_REUSSI'];

export interface StatutTelephonie {
  etat: EtatTelephonie;
  /** Message en francais, affiche tel quel. */
  detail: string;
  /** Derniere verification reelle contre le fournisseur, jamais "supposee". */
  derniereVerificationIso: string | null;
  /** Ce que l'artisan doit faire maintenant, ou `null` s'il n'a rien a faire. */
  prochaineAction: string | null;
}

/** Etapes de traitement d'un appel. Un appel n'est jamais supprime en cas d'echec. */
export type StatutTraitementAppel =
  | 'RECU'
  | 'EN_ATTENTE_ENREGISTREMENT'
  | 'AUDIO_TELECHARGE'
  | 'TRANSCRIPTION_EN_COURS'
  | 'ANALYSE_EN_COURS'
  | 'ANALYSE_TERMINEE'
  | 'SANS_ENREGISTREMENT'
  | 'ECHEC';

export type DirectionAppel = 'ENTRANT' | 'SORTANT' | 'INTERNE';

/**
 * Mode d'execution. Les deux modes ne se melangent jamais :
 * en mode REEL, une configuration absente produit une erreur explicite,
 * jamais un repli silencieux sur la simulation.
 */
export type ModeExecution = 'DEMONSTRATION' | 'REEL';

export type StatutDevis = 'BROUILLON_INCOMPLET' | 'PRET_A_VERIFIER' | 'VALIDE' | 'EXPORTE';

export type StatutAssociation =
  /** Rattachement certain (numero connu, un seul chantier actif). */
  | 'CERTAIN'
  /** Plusieurs rattachements possibles : l'artisan doit choisir. */
  | 'A_CONFIRMER'
  /** Aucun rattachement trouve. */
  | 'AUCUN'
  /** Rattachement corrige a la main par l'artisan. */
  | 'CORRIGE_MANUELLEMENT';

export interface PropositionAssociation {
  clientId: string | null;
  chantierId: string | null;
  statut: StatutAssociation;
  /** Pourquoi ce rattachement est propose, en francais. */
  justification: string;
  /** Autres possibilites, quand le rattachement est ambigu. */
  alternatives: readonly { clientId: string; chantierId: string | null; libelle: string }[];
}

export type RoleUtilisateur = 'PROPRIETAIRE' | 'MEMBRE';

export interface Metier {
  code: string;
  libelle: string;
}

/** Metiers proposes a l'inscription. La liste est ouverte : `autre` est valide. */
export const METIERS: readonly Metier[] = [
  { code: 'electricien', libelle: 'Electricien' },
  { code: 'plombier_chauffagiste', libelle: 'Plombier / chauffagiste' },
  { code: 'menuisier', libelle: 'Menuisier' },
  { code: 'macon', libelle: 'Macon' },
  { code: 'peintre', libelle: 'Peintre' },
  { code: 'couvreur', libelle: 'Couvreur' },
  { code: 'carreleur', libelle: 'Carreleur' },
  { code: 'multi_services', libelle: 'Multi-services' },
  { code: 'autre', libelle: 'Autre metier du batiment' },
];
