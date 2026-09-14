# Audit de faisabilité téléphonique — Zadarma

**Date de consultation : 14 septembre 2026.**

## 1. Ce qui a pu être vérifié, et comment

| Source | Accès | Usage |
|---|---|---|
| Spécification OpenAPI officielle `zadarma/openapi`, fichier `spec/v1/openapi.json`, **version 1.2.0** — https://github.com/zadarma/openapi | consultée intégralement | inventaire des endpoints, paramètres, quotas |
| Bibliothèque officielle `zadarma-api` **1.0.4** (npm, licence MIT), fichiers `dist/zadarma.es.js`, `dist/Webhook.d.ts`, `dist/types.d.ts` | consultée intégralement | algorithmes exacts de signature, types des événements |
| https://zadarma.com/en/support/api/ | **inaccessible** | — |
| https://zadarma.com/en/support/instructions/api/partners/ | **inaccessible** | — |
| https://zadarma.com/en/support/instructions/ios/zadarma/ | **inaccessible** | — |
| https://zadarma.com/en/support/faq/pbx/how-to-record-calls/ | **inaccessible** | — |
| https://zadarma.com/en/tariffs/numbers/france/national/ | **inaccessible** | — |

Le domaine `zadarma.com` est bloqué par la politique réseau de l'environnement
de développement. Je n'ai pas contourné ce blocage. Les conclusions ci-dessous
reposent donc sur les **deux publications officielles de Zadarma accessibles
par ailleurs** (sa spécification OpenAPI et sa bibliothèque officielle), qui
sont des sources primaires — mais **pas** sur les pages de tarifs ni sur les
notices d'installation.

**Aucun appel n'a été exécuté contre l'API de production.** Nous n'avons pas de
compte Zadarma, encore moins de compte revendeur. Tout ce qui suit décrit ce
que la documentation officielle affirme, pas ce qui a été observé.

## 2. Authentification

### Requêtes API

`Authorization: <clé>:<signature>`

```
requête   = paramètres triés par clé, encodés http_build_query (RFC 1738)
àSigner   = chemin_méthode + requête + md5_hex(requête)
signature = base64( hex( HMAC-SHA1(àSigner, secret) ) )
```

**Piège vérifié dans le code officiel** (`dist/zadarma.es.js`, ligne 65) : la
signature est le base64 du **hexadécimal** du HMAC, pas le base64 des octets
bruts. Une implémentation « naturelle » donne une signature refusée.
Implémenté dans `packages/shared/src/zadarma-signature.ts`, testé.

### Webhooks entrants

En-tête `Signature` = `base64( HMAC-SHA1(chaîneSignée, secret) )`, où la chaîne
dépend de l'événement (fonction `R` de `dist/zadarma.es.js`, ligne 436) :

| Événement | Chaîne signée |
|---|---|
| `NOTIFY_START`, `NOTIFY_INTERNAL`, `NOTIFY_END`, `NOTIFY_IVR` | `caller_id + called_did + call_start` |
| `NOTIFY_ANSWER` | `caller_id + destination + call_start` |
| `NOTIFY_OUT_START`, `NOTIFY_OUT_END` | `internal + destination + call_start` |
| `NOTIFY_RECORD` | `pbx_call_id + call_id_with_rec` |

**Deux limites importantes que cette signature ne couvre pas :**

1. **Elle ne couvre que 2 ou 3 champs.** `duration`, `disposition`,
   `is_recorded` ne sont pas signés. On ne peut donc pas traiter le reste du
   corps comme authentifié, seulement comme cohérent avec un appel réel.
2. **Elle ne dit pas à quel compte l'événement appartient.** C'est pourquoi
   notre URL de webhook porte un jeton propre à l'entreprise, et que la
   vérification utilise **le secret de cette entreprise-là**. Connaître le
   jeton d'URL ne suffit pas à injecter un faux appel — test
   `refuse un evenement signe avec le secret d une AUTRE entreprise`.

**Défaut de la bibliothèque officielle, corrigé chez nous :**
`getWebhookEvent` accepte l'événement quand l'en-tête `Signature` est absent
(`if (signature && signature !== attendu) return null`). N'importe qui pourrait
poster de faux appels. Notre implémentation refuse une signature absente —
test `REFUSE un evenement sans en-tete Signature`.

## 3. Ce que l'API permet réellement

Chemins cités verbatim depuis la spécification 1.2.0.

### Revendeur — création de comptes clients

- `POST /v1/reseller/users/registration/new/` — crée un sous-compte.
  **Trois issues possibles selon la configuration du contrat** : activation
  immédiate, confirmation par email côté utilisateur, ou confirmation par code
  côté revendeur. C'est la raison pour laquelle notre parcours d'inscription ne
  passe jamais en « prêt » sur la simple réussite HTTP de cet appel.
- `POST /v1/reseller/users/registration/confirm/` — confirme par code.
- `GET /v1/reseller/users/api_key/` — récupère `key` et `secret` du sous-compte.
  **Les clés peuvent revenir à la valeur `'hidden'`** selon le drapeau
  `allow_reset` du contrat revendeur. Dans ce cas, le parcours « l'artisan ne
  saisit aucune clé » devient impossible : c'est une **condition contractuelle
  à négocier**, pas un détail technique.
- `POST /v1/reseller/users/topup/`, `GET /v1/reseller/account/info/`.

**Conditions d'accès au statut revendeur : non documentées dans les sources
accessibles.** Chiffre d'affaires minimum, contrat, vérification d'identité :
inconnus. **À obtenir auprès de Zadarma avant tout engagement commercial.**

### Agir au nom d'un sous-compte

De nombreux endpoints acceptent `user_id`, décrit ainsi :
« *User ID (optional). Available for resellers only — to act on behalf of a
sub-user.* » C'est le mécanisme qui permettrait de tout configurer sans
demander de clé à l'artisan.

### Numéros

- `GET /v1/direct_numbers/countries/`, `/country/`, `/available/{direction_id}/`
- `POST /v1/direct_numbers/order/` — paramètres `direction_id`, `number_id`,
  `documents_group_id`, `purpose`, `receive_sms`, `period`.
- `POST /v1/documents/upload/`, `POST /v1/documents/groups/create/`,
  `GET /v1/documents/groups/valid/{id}/` — **les justificatifs sont bien gérés
  par API** (le paramètre `documents_group_id` de la commande y renvoie).
- `PUT /v1/direct_numbers/set_sip_id/` — affecte le numéro à un SIP **ou à une
  URI SIP externe**.

**Tarifs des numéros français : non consultables** (page bloquée). Le modèle de
coûts laisse donc cette ligne à zéro et le signale (`docs/06`).

### Standard, postes, enregistrement

- `POST /v1/pbx/create/`, `POST /v1/pbx/internal/create/` (`return_password=true`)
- `GET /v1/pbx/internal/{sip}/password/` — **les identifiants SIP du poste sont
  récupérables par API.**
- `PUT /v1/pbx/internal/recording/` — `status` ∈ `on`, `off`, `on_email`,
  `off_email`, `on_store`, `off_store`, plus `speech_recognition` ∈ `all`,
  `optional`, `off`. **`on_store` est indispensable** : sans conservation côté
  fournisseur, il n'y a rien à télécharger.
- `POST /v1/pbx/redirection/` — `type` ∈ `phone`, `voicemail`, `menu`, `sip`,
  **`sip_uri`** (« *to an external SIP URI server* »).
- `PUT /v1/pbx/internal/{sip}/callerid/` — **le numéro doit déjà être un
  CallerID confirmé du compte** (numéro vérifié ou numéro virtuel possédé).

### Enregistrements

- `GET /v1/pbx/record/request/` — `call_id` **ou** `pbx_call_id`, renvoie un
  lien de téléchargement décrit comme **temporaire, sans durée chiffrée**. Nous
  téléchargeons donc immédiatement plutôt que de stocker le lien.
- `DELETE /v1/pbx/record/request/` — suppression du fichier.
- **Durée de conservation côté fournisseur : non documentée dans les sources
  accessibles.** À vérifier avant de promettre quoi que ce soit sur l'historique.

### Webhooks

- `POST /v1/pbx/callinfo/url/` et `POST /v1/pbx/callinfo/notifications/`
  (`notify_start`, `notify_internal`, `notify_answer`, `notify_end`,
  `notify_out_start`, `notify_out_end`).
- `POST /v1/pbx/webhooks/url/` et `/hooks/` pour les autres notifications
  (lookup, call tracking, SMS, reconnaissance vocale).

### Transcription fournisseur

- `PUT /v1/speech_recognition/` puis `GET /v1/speech_recognition/`, avec les
  statuts `in progress`, `error`, `recognized`, `ready for recognize`,
  `not available for recognize`. Exige l'activation préalable sur le poste.

### Quotas

**100 requêtes/minute en général, 3 requêtes/minute pour les statistiques**,
HTTP 429 au-delà (spécification 1.2.0).

## 4. Le point décisif : la réception de l'appel sur l'iPhone

J'ai cherché dans la totalité de la spécification 1.2.0 (510 Ko) :

| Terme recherché | Occurrences |
|---|---|
| `apns`, `fcm`, `callkit`, `pushkit`, `device_token`, `8599`, `sdk` | **0** |
| `push` | 4 — toutes `push_button`, c'est-à-dire une **touche DTMF** de menu vocal |
| `mobile` | 8 — toutes `used_seconds_mobile` (facturation) ou `mcc`/`mnc` |

**Conclusion : l'API Zadarma n'expose aucun moyen d'enregistrer un jeton de
notification push pour une application tierce, ni les paramètres de push SIP
(RFC 8599 : `pn-provider`, `pn-param`, `pn-prid`).**

Cela tranche la question centrale du projet. Rappel de la chaîne réellement
nécessaire pour qu'un iPhone endormi sonne :

```
appel entrant → serveur SIP → notification VoIP APNs (PushKit)
              → réveil de l'application → CallKit affiche l'appel
              → l'application établit la session SIP/RTP
```

**CallKit n'est pas un transport téléphonique** : c'est l'intégration système
qui affiche l'appel. PushKit est ce qui réveille l'application. Sans une
infrastructure SIP qui émet ce push, CallKit ne sert à rien : il n'y a
personne pour l'appeler.

Une API REST ne réveille pas une application. Un widget WebRTC de navigateur
non plus. **Notre application ne peut donc pas recevoir les appels via
Zadarma seul.**

## 5. L'issue existe, mais elle a un coût

`POST /v1/pbx/redirection/` avec `type=sip_uri` et
`PUT /v1/direct_numbers/set_sip_id/` (« *SIP number ID or external SIP URI
address* ») permettent à Zadarma de **transférer l'appel vers une
infrastructure SIP que nous contrôlons**.

Autrement dit, l'architecture A reste atteignable, mais elle suppose d'exploiter
notre propre SBC / proxy SIP (Asterisk, FreeSWITCH, Kamailio…) capable, lui,
d'émettre les notifications PushKit et FCM. Ce que cela ajoute :

- un serveur SIP à exploiter, superviser et sécuriser 24 h/24 ;
- des certificats APNs VoIP et une configuration FCM ;
- un module natif VoIP dans l'application (iOS et Android) ;
- une charge d'exploitation sans commune mesure avec le reste du MVP.

**Aucun fournisseur n'a été souscrit, aucune infrastructure n'a été commandée.**
Le chiffrage de cette option reste à faire.

## 6. Appels sortants

- La présentation d'un numéro exige que celui-ci soit **un CallerID confirmé du
  compte**. Ce n'est pas un paramètre libre : afficher le numéro habituel de
  l'artisan suppose une vérification préalable chez le fournisseur.
- **Rien ne permet d'affirmer, à partir des sources consultées, que la
  présentation du numéro habituel d'un artisan français est possible et
  conforme.** La réglementation française sur la présentation du numéro
  (lutte contre le spoofing, obligations d'authentification des numéros) doit
  être vérifiée séparément.
- Un appel passé depuis la carte SIM du téléphone **n'est pas analysé** : il ne
  transite pas par le fournisseur. L'application doit le dire à l'utilisateur.

## 7. Ce qui reste à vérifier avant tout engagement

1. Conditions d'accès au statut revendeur (CA minimum, contrat, vérifications).
2. Valeur du drapeau `allow_reset` dans notre contrat : sans lui, l'artisan
   devra saisir ses clés lui-même.
3. Tarifs réels : numéro français, minute entrante, stockage des enregistrements.
4. Durée de conservation des enregistrements chez Zadarma.
5. Durée de validité exacte des liens de téléchargement.
6. Format et fuseau de `call_start` (supposé UTC — hypothèse documentée dans
   `apps/api/src/jobs/traitements.ts`).
7. Comportement réel des webhooks : ordre, doublons, politique de réessai.
8. Régions de traitement et d'hébergement des enregistrements (RGPD).
9. Faisabilité et légalité de la présentation du numéro en France.
