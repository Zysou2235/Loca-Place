/**
 * Contrat d'un fournisseur de telephonie.
 *
 * Volontairement etroit : tout ce qui n'est pas ici (reception de l'appel sur
 * le telephone, sonnerie ecran verrouille, Bluetooth) ne releve pas d'une API
 * serveur mais de l'integration mobile. Voir docs/03-etat-telephonie.md.
 */

export interface IdentifiantsSousCompte {
  identifiantFournisseur: string;
  cleApi: string;
  secretApi: string;
}

export interface DemandeCreationSousCompte {
  email: string;
  prenom: string;
  nom?: string;
  entreprise?: string;
  paysIso2: string;
  ville: string;
  telephoneContact?: string;
}

export interface ResultatCreationSousCompte {
  /** `cree` : compte actif. `confirmation_requise` : l'utilisateur doit valider son email. */
  etat: 'cree' | 'confirmation_requise';
  identifiantFournisseur: string | null;
  message: string;
}

export interface Enregistrement {
  /** URL temporaire de telechargement fournie par l'operateur. */
  url: string;
  /** Duree de validite annoncee, si le fournisseur la communique. */
  expireDansSecondes: number | null;
}

export interface ParametrageStandard {
  extensionPbx: string;
  enregistrementActif: boolean;
  urlWebhook: string;
  evenementsActifs: readonly string[];
}

/**
 * Ce que le fournisseur sait faire, verifie a partir de sa documentation.
 * Sert a l'interface : on n'affiche jamais un bouton dont on sait qu'il ne
 * peut pas fonctionner.
 */
export interface CapacitesFournisseur {
  /** Creation de sous-comptes par API revendeur. */
  creationSousComptes: boolean;
  /** Commande de numeros par API. */
  commandeNumeros: boolean;
  /** Activation de l'enregistrement par API. */
  enregistrementParApi: boolean;
  /** Webhooks d'evenements d'appel signes. */
  webhooksSignes: boolean;
  /** Recuperation des identifiants SIP du poste, par API. */
  identifiantsSipRecuperables: boolean;
  /**
   * Notification push VoIP vers NOTRE application (APNs/PushKit, FCM),
   * ou parametres de push SIP (RFC 8599). C'est la capacite qui conditionne
   * la reception d'un appel sur un iPhone endormi.
   */
  pushVoipVersApplicationTierce: boolean;
  /** Renvoi d'un appel vers une URI SIP externe que nous controlons. */
  renvoiVersSipExterne: boolean;
  /** Presentation d'un numero externe en appel sortant, sans verification. */
  callerIdArbitraire: boolean;
}

export interface FournisseurTelephonie {
  readonly nom: string;
  readonly capacites: CapacitesFournisseur;

  creerSousCompte(demande: DemandeCreationSousCompte): Promise<ResultatCreationSousCompte>;
  recupererIdentifiants(identifiantFournisseur: string): Promise<IdentifiantsSousCompte>;
  configurerStandard(
    identifiants: IdentifiantsSousCompte,
    parametres: { urlWebhook: string; extensionPbx?: string },
  ): Promise<ParametrageStandard>;
  obtenirEnregistrement(
    identifiants: IdentifiantsSousCompte,
    reference: { callId?: string; pbxCallId?: string },
  ): Promise<Enregistrement | null>;
  supprimerEnregistrement(
    identifiants: IdentifiantsSousCompte,
    reference: { callId?: string; pbxCallId?: string },
  ): Promise<void>;
}

export class ErreurFournisseur extends Error {
  override readonly name = 'ErreurFournisseur';
  constructor(
    message: string,
    readonly details?: { statut?: number; corps?: unknown },
  ) {
    super(message);
  }
}

/**
 * Levee quand une operation est demandee a un fournisseur qui ne la propose
 * pas. On prefere une erreur explicite a une simulation qui donnerait
 * l'illusion que la chaine fonctionne.
 */
export class CapaciteIndisponible extends ErreurFournisseur {
  constructor(quoi: string, fournisseur: string) {
    super(`${fournisseur} ne permet pas : ${quoi}.`);
  }
}
