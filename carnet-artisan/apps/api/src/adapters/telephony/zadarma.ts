/**
 * Adaptateur Zadarma.
 *
 * Sources (voir docs/01-audit-faisabilite-zadarma.md pour les extraits) :
 *  - specification OpenAPI officielle `zadarma/openapi`, spec/v1/openapi.json,
 *    version 1.2.0, consultee le 14/09/2026 ;
 *  - bibliotheque officielle `zadarma-api` 1.0.4 (npm, MIT), pour l'algorithme
 *    exact de signature.
 *
 * ETAT REEL : aucun de ces appels n'a ete execute contre l'API de production.
 * Le site zadarma.com est inaccessible depuis l'environnement de developpement
 * (bloque par la politique reseau) et nous n'avons pas de compte revendeur.
 * Les chemins, parametres et la signature viennent des sources ci-dessus ;
 * ils restent a confronter a un vrai compte. Voir docs/07-limites.md.
 */

import {
  ZADARMA_BASE_URL,
  chaineDeRequete,
  enteteAuthorization,
  type ParametresZadarma,
} from '@carnet/shared';
import {
  CapaciteIndisponible,
  ErreurFournisseur,
  type CapacitesFournisseur,
  type DemandeCreationSousCompte,
  type Enregistrement,
  type FournisseurTelephonie,
  type IdentifiantsSousCompte,
  type ParametrageStandard,
  type ResultatCreationSousCompte,
} from './types.js';

/**
 * Capacites etablies a partir de la specification officielle.
 *
 * `pushVoipVersApplicationTierce: false` est le resultat central de l'audit :
 * la specification ne contient aucun endpoint d'enregistrement de jeton APNs
 * ou FCM, aucune mention de PushKit, CallKit ou des parametres de push SIP
 * (RFC 8599). Sans cela, notre application ne peut pas etre reveillee pour un
 * appel entrant quand l'iPhone dort. C'est ce qui impose l'architecture B
 * pour le pilote.
 */
export const CAPACITES_ZADARMA: CapacitesFournisseur = {
  creationSousComptes: true, // POST /v1/reseller/users/registration/new/
  commandeNumeros: true, // POST /v1/direct_numbers/order/
  enregistrementParApi: true, // PUT /v1/pbx/internal/recording/
  webhooksSignes: true, // en-tete Signature, HMAC-SHA1 base64
  identifiantsSipRecuperables: true, // GET /v1/pbx/internal/{sip}/password/
  pushVoipVersApplicationTierce: false, // absent de la specification
  renvoiVersSipExterne: true, // POST /v1/pbx/redirection/ type=sip_uri
  callerIdArbitraire: false, // le numero doit etre un CallerID confirme du compte
};

interface OptionsZadarma {
  cleRevendeur: string;
  secretRevendeur: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class FournisseurZadarma implements FournisseurTelephonie {
  readonly nom = 'zadarma';
  readonly capacites = CAPACITES_ZADARMA;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: OptionsZadarma) {
    this.baseUrl = options.baseUrl ?? ZADARMA_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  /**
   * Requete signee.
   *
   * @param chemin chemin complet, barres obliques encadrantes comprises :
   *               c'est exactement cette chaine qui entre dans la signature.
   */
  private async appeler<T>(
    chemin: string,
    methode: 'GET' | 'POST' | 'PUT' | 'DELETE',
    parametres: ParametresZadarma,
    identifiants?: { cle: string; secret: string },
  ): Promise<T> {
    const cle = identifiants?.cle ?? this.options.cleRevendeur;
    const secret = identifiants?.secret ?? this.options.secretRevendeur;
    const requete = chaineDeRequete(parametres);
    const authorization = enteteAuthorization(chemin, parametres, cle, secret);

    const url = new URL(chemin, this.baseUrl);
    const enTetes: Record<string, string> = { Authorization: authorization, Accept: 'application/json' };
    let corps: string | undefined;
    if (methode === 'GET' || methode === 'DELETE') {
      url.search = requete;
    } else {
      corps = requete;
      enTetes['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const controleur = new AbortController();
    const minuteur = setTimeout(() => { controleur.abort(); }, this.timeoutMs);
    let reponse: Response;
    try {
      reponse = await this.fetchImpl(url, {
        method: methode,
        headers: enTetes,
        body: corps,
        signal: controleur.signal,
      });
    } catch (erreur) {
      throw new ErreurFournisseur(`Zadarma injoignable sur ${chemin} : ${(erreur as Error).message}`);
    } finally {
      clearTimeout(minuteur);
    }

    const texte = await reponse.text();
    let donnees: unknown;
    try {
      donnees = JSON.parse(texte);
    } catch {
      throw new ErreurFournisseur(`Reponse Zadarma illisible sur ${chemin}.`, {
        statut: reponse.status,
      });
    }

    if (reponse.status === 429) {
      // 100 requetes/min en general, 3/min pour les statistiques (spec 1.2.0).
      throw new ErreurFournisseur('Quota Zadarma depasse, a reessayer plus tard.', { statut: 429 });
    }
    const enveloppe = donnees as { status?: string; message?: string };
    if (!reponse.ok || enveloppe.status === 'error') {
      throw new ErreurFournisseur(
        `Zadarma a refuse ${chemin} : ${enveloppe.message ?? `HTTP ${String(reponse.status)}`}`,
        { statut: reponse.status, corps: donnees },
      );
    }
    return donnees as T;
  }

  async creerSousCompte(demande: DemandeCreationSousCompte): Promise<ResultatCreationSousCompte> {
    const reponse = await this.appeler<{ status: string; user_id?: number; message?: string }>(
      '/v1/reseller/users/registration/new/',
      'POST',
      {
        email: demande.email,
        first_name: demande.prenom,
        last_name: demande.nom,
        organization: demande.entreprise,
        country: demande.paysIso2,
        city: demande.ville,
        phone: demande.telephoneContact,
      },
    );
    if (typeof reponse.user_id === 'number') {
      return {
        etat: 'cree',
        identifiantFournisseur: String(reponse.user_id),
        message: 'Sous-compte cree chez le fournisseur.',
      };
    }
    // La specification decrit trois issues, dont deux passent par une
    // confirmation par email. On ne fait donc jamais passer l'entreprise en
    // "pret" sur la seule reussite HTTP de cet appel.
    return {
      etat: 'confirmation_requise',
      identifiantFournisseur: null,
      message:
        reponse.message ??
        'Le fournisseur demande une confirmation par email avant d activer le compte.',
    };
  }

  async recupererIdentifiants(identifiantFournisseur: string): Promise<IdentifiantsSousCompte> {
    const reponse = await this.appeler<{ key?: string; secret?: string }>(
      '/v1/reseller/users/api_key/',
      'GET',
      { user_id: identifiantFournisseur },
    );
    if (!reponse.key || !reponse.secret || reponse.key === 'hidden' || reponse.secret === 'hidden') {
      // La specification prevoit explicitement des cles masquees selon le
      // parametre `allow_reset` du contrat revendeur.
      throw new ErreurFournisseur(
        'Le fournisseur masque les cles de ce sous-compte : le contrat revendeur ne les expose pas.',
      );
    }
    return {
      identifiantFournisseur,
      cleApi: reponse.key,
      secretApi: reponse.secret,
    };
  }

  async configurerStandard(
    identifiants: IdentifiantsSousCompte,
    parametres: { urlWebhook: string; extensionPbx?: string },
  ): Promise<ParametrageStandard> {
    const auth = { cle: identifiants.cleApi, secret: identifiants.secretApi };
    const extension = parametres.extensionPbx ?? '100';

    await this.appeler('/v1/pbx/callinfo/url/', 'POST', { url: parametres.urlWebhook }, auth);

    const evenements = ['NOTIFY_START', 'NOTIFY_ANSWER', 'NOTIFY_END', 'NOTIFY_RECORD'];
    await this.appeler(
      '/v1/pbx/callinfo/notifications/',
      'POST',
      {
        notify_start: 'true',
        notify_end: 'true',
        notify_out_start: 'true',
        notify_out_end: 'true',
        notify_internal: 'false',
      },
      auth,
    );

    // `on_store` conserve le fichier chez le fournisseur : sans cela, il n'y a
    // rien a telecharger. L'envoi par email reste desactive - un enregistrement
    // client n'a pas a circuler par messagerie.
    await this.appeler(
      '/v1/pbx/internal/recording/',
      'PUT',
      { id: extension, status: 'on' },
      auth,
    );
    await this.appeler(
      '/v1/pbx/internal/recording/',
      'PUT',
      { id: extension, status: 'on_store' },
      auth,
    );

    return {
      extensionPbx: extension,
      enregistrementActif: true,
      urlWebhook: parametres.urlWebhook,
      evenementsActifs: evenements,
    };
  }

  async obtenirEnregistrement(
    identifiants: IdentifiantsSousCompte,
    reference: { callId?: string; pbxCallId?: string },
  ): Promise<Enregistrement | null> {
    if (!reference.callId && !reference.pbxCallId) {
      throw new ErreurFournisseur('call_id ou pbx_call_id est obligatoire.');
    }
    const reponse = await this.appeler<{ links?: string[]; link?: string }>(
      '/v1/pbx/record/request/',
      'GET',
      { call_id: reference.callId, pbx_call_id: reference.pbxCallId },
      { cle: identifiants.cleApi, secret: identifiants.secretApi },
    );
    const url = reponse.link ?? reponse.links?.[0];
    if (!url) return null;
    return {
      url,
      // La specification qualifie le lien de temporaire sans chiffrer sa duree.
      // On ne l'invente pas : le pipeline telecharge tout de suite.
      expireDansSecondes: null,
    };
  }

  async supprimerEnregistrement(
    identifiants: IdentifiantsSousCompte,
    reference: { callId?: string; pbxCallId?: string },
  ): Promise<void> {
    await this.appeler(
      '/v1/pbx/record/request/',
      'DELETE',
      { call_id: reference.callId, pbx_call_id: reference.pbxCallId },
      { cle: identifiants.cleApi, secret: identifiants.secretApi },
    );
  }

  /**
   * Presentation du numero en appel sortant.
   *
   * La specification est explicite : le numero doit deja etre un CallerID
   * confirme du compte (numero verifie ou numero virtuel possede). Afficher le
   * numero habituel de l'artisan suppose donc une verification prealable chez
   * le fournisseur ; ce n'est pas un simple parametre.
   */
  async definirCallerId(
    identifiants: IdentifiantsSousCompte,
    extension: string,
    numero: string,
  ): Promise<void> {
    if (!this.capacites.callerIdArbitraire) {
      // Le garde-fou est intentionnel : l'appelant doit avoir fait verifier le
      // numero avant. On ne laisse pas l'interface promettre le contraire.
      await this.appeler(
        `/v1/pbx/internal/${encodeURIComponent(extension)}/callerid/`,
        'PUT',
        { number: numero },
        { cle: identifiants.cleApi, secret: identifiants.secretApi },
      );
      return;
    }
    throw new CapaciteIndisponible('presentation d un numero non verifie', this.nom);
  }
}
