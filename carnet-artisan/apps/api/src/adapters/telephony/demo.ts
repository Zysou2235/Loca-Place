import {
  CapaciteIndisponible,
  type CapacitesFournisseur,
  type DemandeCreationSousCompte,
  type Enregistrement,
  type FournisseurTelephonie,
  type IdentifiantsSousCompte,
  type ParametrageStandard,
  type ResultatCreationSousCompte,
} from './types.js';

/**
 * Fournisseur de demonstration.
 *
 * Il ne simule PAS une connexion reussie : toute operation qui supposerait un
 * vrai compte leve une erreur explicite. Le mode demonstration sert a parcourir
 * le produit, pas a faire croire que la telephonie fonctionne.
 */
export class FournisseurDemo implements FournisseurTelephonie {
  readonly nom = 'demonstration';

  readonly capacites: CapacitesFournisseur = {
    creationSousComptes: false,
    commandeNumeros: false,
    enregistrementParApi: false,
    webhooksSignes: false,
    identifiantsSipRecuperables: false,
    pushVoipVersApplicationTierce: false,
    renvoiVersSipExterne: false,
    callerIdArbitraire: false,
  };

  creerSousCompte(_demande: DemandeCreationSousCompte): Promise<ResultatCreationSousCompte> {
    return Promise.reject(
      new CapaciteIndisponible('creation de compte fournisseur en mode demonstration', this.nom),
    );
  }

  recupererIdentifiants(_id: string): Promise<IdentifiantsSousCompte> {
    return Promise.reject(
      new CapaciteIndisponible('recuperation d identifiants en mode demonstration', this.nom),
    );
  }

  configurerStandard(
    _identifiants: IdentifiantsSousCompte,
    _parametres: { urlWebhook: string },
  ): Promise<ParametrageStandard> {
    return Promise.reject(
      new CapaciteIndisponible('configuration du standard en mode demonstration', this.nom),
    );
  }

  obtenirEnregistrement(): Promise<Enregistrement | null> {
    return Promise.reject(
      new CapaciteIndisponible('telechargement d enregistrement en mode demonstration', this.nom),
    );
  }

  supprimerEnregistrement(): Promise<void> {
    return Promise.reject(
      new CapaciteIndisponible('suppression d enregistrement en mode demonstration', this.nom),
    );
  }
}
