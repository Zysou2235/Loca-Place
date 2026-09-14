/**
 * Client HTTP de l'application.
 *
 * Deux principes :
 *  - une erreur reseau ou serveur remonte telle quelle a l'ecran, en francais.
 *    L'application n'affiche jamais un ecran vide en faisant croire que tout va
 *    bien ;
 *  - le jeton de session n'est jamais ecrit dans un journal.
 */

import type {
  Aujourdhui,
  Appel,
  AppelDetail,
  Client,
  Devis,
  Parametres,
  Prestation,
} from './types.js';

export class ErreurApi extends Error {
  constructor(
    message: string,
    readonly statut: number,
  ) {
    super(message);
    this.name = 'ErreurApi';
  }

  /** `true` si l'utilisateur doit se reconnecter. */
  get sessionExpiree(): boolean {
    return this.statut === 401;
  }
}

export class ErreurReseau extends Error {
  override readonly name = 'ErreurReseau';
  constructor(cause: string) {
    super(`Serveur injoignable : ${cause}. Verifiez votre connexion.`);
  }
}

export interface ConfigurationApi {
  urlBase: string;
  jeton: string | null;
  timeoutMs?: number;
  /** Appele quand le serveur repond 401 : l application revient a la connexion. */
  onSessionExpiree?: () => void;
}

export class ApiCarnet {
  constructor(private config: ConfigurationApi) {}

  definirJeton(jeton: string | null): void {
    this.config = { ...this.config, jeton };
  }

  private async appeler<T>(
    chemin: string,
    options: { methode?: string; corps?: unknown } = {},
  ): Promise<T> {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => { controleur.abort(); }, this.config.timeoutMs ?? 20_000);

    const entetes: Record<string, string> = { accept: 'application/json' };
    if (options.corps !== undefined) entetes['content-type'] = 'application/json';
    if (this.config.jeton) entetes['authorization'] = `Bearer ${this.config.jeton}`;

    let reponse: Response;
    try {
      reponse = await fetch(`${this.config.urlBase}${chemin}`, {
        method: options.methode ?? 'GET',
        headers: entetes,
        body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
        signal: controleur.signal,
      });
    } catch (erreur) {
      throw new ErreurReseau((erreur as Error).message);
    } finally {
      clearTimeout(minuteur);
    }

    if (reponse.status === 204) return undefined as T;

    const texte = await reponse.text();
    let donnees: unknown = null;
    if (texte !== '') {
      try {
        donnees = JSON.parse(texte);
      } catch {
        if (!reponse.ok) throw new ErreurApi('Reponse du serveur illisible.', reponse.status);
      }
    }

    if (!reponse.ok) {
      const message =
        (donnees as { erreur?: string } | null)?.erreur ??
        `Le serveur a refuse la demande (code ${String(reponse.status)}).`;
      const erreur = new ErreurApi(message, reponse.status);
      if (erreur.sessionExpiree) this.config.onSessionExpiree?.();
      throw erreur;
    }
    return donnees as T;
  }

  // --- Authentification -----------------------------------------------------

  connexion(email: string, motDePasse: string) {
    return this.appeler<{ jeton: string; entreprise: { id: string; nom: string; mode: string } }>(
      '/auth/connexion',
      { methode: 'POST', corps: { email, motDePasse } },
    );
  }

  inscription(donnees: {
    email: string;
    motDePasse: string;
    nomEntreprise: string;
    metier: string;
    nomArtisan: string;
    telephonePro: string;
  }) {
    return this.appeler<{ jeton: string; entreprise: { id: string; nom: string; mode: string } }>(
      '/auth/inscription',
      { methode: 'POST', corps: donnees },
    );
  }

  metiers() {
    return this.appeler<{ metiers: { code: string; libelle: string }[] }>('/metiers');
  }

  // --- Ecrans ---------------------------------------------------------------

  aujourdhui() {
    return this.appeler<Aujourdhui>('/aujourdhui');
  }

  appels() {
    return this.appeler<{ appels: Appel[] }>('/appels');
  }

  appel(id: string) {
    return this.appeler<AppelDetail>(`/appels/${id}`);
  }

  corrigerAssociation(id: string, cible: { clientId: string | null; chantierId: string | null }) {
    return this.appeler<{ appel: Appel }>(`/appels/${id}/association`, {
      methode: 'PUT',
      corps: cible,
    });
  }

  relancerAppel(id: string) {
    return this.appeler<{ relance: boolean; etape: string }>(`/appels/${id}/relancer`, {
      methode: 'POST',
    });
  }

  clients() {
    return this.appeler<{ clients: Client[] }>('/clients');
  }

  chantier(id: string) {
    return this.appeler<{ chantier: unknown }>(`/chantiers/${id}`);
  }

  catalogue() {
    return this.appeler<{ prestations: Prestation[]; tauxTvaAutorises: number[] }>('/catalogue');
  }

  devis() {
    return this.appeler<{ devis: Devis[] }>('/devis');
  }

  parametres() {
    return this.appeler<Parametres>('/parametres');
  }

  verifierTelephonie() {
    return this.appeler<{ telephonie: Parametres['telephonie'] }>(
      '/parametres/telephonie/verification',
    );
  }

  // --- Demonstration --------------------------------------------------------

  scenariosDemo() {
    return this.appeler<{
      estDemonstration: boolean;
      avertissement: string;
      scenarios: { id: string; titre: string; metAlEpreuve: string }[];
    }>('/demo/scenarios');
  }

  preparerDemo() {
    return this.appeler<{ pret: boolean }>('/demo/preparer', { methode: 'POST' });
  }

  rejouerDemo(scenarioId: string) {
    return this.appeler<{ estDemonstration: boolean; appel: Appel }>('/demo/rejouer', {
      methode: 'POST',
      corps: { scenarioId },
    });
  }
}
