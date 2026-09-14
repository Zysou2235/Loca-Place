# Configuration des fournisseurs

**Aucune de ces procédures n'a été exécutée.** Elles sont écrites à partir de
la documentation officielle (`docs/01`) et restent à confronter à la réalité.

## Ordre d'installation

```
1. Base de données et serveur            → fonctionne aujourd'hui
2. Analyse et transcription              → clés à obtenir
3. Téléphonie                            → compte à créer
4. Application mobile                    → comptes Apple / Google à souscrire
```

## 1. Base de données et serveur

```bash
cd carnet-artisan
npm install
cp .env.example .env
# Renseigner DATABASE_URL, JWT_SECRET et CHIFFREMENT_CLE.

node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # CHIFFREMENT_CLE
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" # JWT_SECRET

npm run db:generate -w @carnet/api
npm run db:deploy   -w @carnet/api
npm run dev         -w @carnet/api    # API
npm run worker      -w @carnet/api    # worker, dans un second terminal
```

Le serveur démarre en `TELEPHONIE_FOURNISSEUR=demo` : **aucun service externe
n'est contacté**. C'est l'état dans lequel tout le parcours métier est
utilisable.

## 2. Transcription et analyse

```
TRANSCRIPTION_FOURNISSEUR=externe
TRANSCRIPTION_URL=https://…/v1/audio/transcriptions
TRANSCRIPTION_CLE=…

IA_FOURNISSEUR=anthropic
IA_CLE=…
IA_MODELE=claude-sonnet-5
```

**Le serveur refuse de démarrer si un fournisseur réel est choisi sans ses
identifiants** (`config.ts`). Il n'y a pas de repli silencieux vers la
simulation : c'est exactement ce qui ferait croire à un artisan que ses appels
sont analysés alors qu'ils ne le sont pas.

Avant de renseigner ces clés : vérifier la **région de traitement** des données
(`docs/07`). Des conversations de clients français sont des données
personnelles.

## 3. Téléphonie — procédure à valider

### Prérequis à obtenir auprès de Zadarma

- statut revendeur (conditions inconnues — `docs/01`, §7) ;
- valeur du drapeau `allow_reset` : sans lui, `GET /v1/reseller/users/api_key/`
  renvoie `'hidden'` et l'artisan devra saisir ses clés lui-même ;
- tarifs réels et durée de conservation des enregistrements.

### Enchaînement prévu, par artisan

1. `POST /v1/reseller/users/registration/new/` — créer le sous-compte.
   **Ne pas considérer l'artisan comme prêt** : la réponse peut demander une
   confirmation par email.
2. `POST /v1/reseller/users/registration/confirm/` si un code est attendu.
3. `GET /v1/reseller/users/api_key/` — récupérer les clés du sous-compte.
4. `GET /v1/direct_numbers/available/{direction_id}/` puis
   `POST /v1/direct_numbers/order/` — commander un numéro français.
   Joindre `documents_group_id` si des justificatifs sont exigés
   (`POST /v1/documents/upload/`, `POST /v1/documents/groups/create/`).
5. `POST /v1/pbx/create/` puis `POST /v1/pbx/internal/create/`.
6. `PUT /v1/pbx/internal/recording/` avec `status=on`, **puis** `status=on_store`.
   Sans `on_store`, rien n'est conservé et il n'y a rien à télécharger.
   Laisser l'envoi par email **désactivé**.
7. `POST /v1/pbx/callinfo/url/` — pointer vers
   `https://<votre-domaine>/webhooks/telephonie/<jetonWebhook>`.
   L'URL de chaque entreprise est affichée dans l'écran Réglages.
8. `POST /v1/pbx/callinfo/notifications/` — activer `notify_start`,
   `notify_end`, `notify_out_start`, `notify_out_end`.
9. `PUT /v1/direct_numbers/set_sip_id/` — rattacher le numéro au poste.

Vérification de l'URL : Zadarma émet un `GET` avec `zd_echo` et attend l'écho.
La route le gère et **ne crée rien** au passage.

### Ce que l'artisan fait lui-même

**Le renvoi d'appel s'active chez son opérateur, par lui.** L'application
n'active jamais de renvoi : elle n'en a ni le droit ni le moyen, et un renvoi
activé à son insu lui ferait perdre ses appels.

Codes usuels de renvoi inconditionnel en France (**à vérifier auprès de chaque
opérateur, ils varient**) :

```
Activer     : **21*<numéro technique>#     puis appel
Désactiver  : ##21#                        puis appel
```

**Garde-fou :** l'application refuse que le numéro personnel et le numéro
technique soient identiques — le renvoi tournerait en boucle et tous les appels
seraient perdus.

### Vérifier que ça marche vraiment

Écran Réglages → « Vérifier l'état réel de la chaîne ». L'état ne passe à
**TEST_RÉUSSI** que si un appel **réel** (pas un appel de démonstration) a été
reçu, signé, enregistré et analysé de bout en bout. Enregistrer une clé API ne
suffit pas.

## 4. Application mobile

```bash
cd apps/mobile
npm install
npm run typecheck        # fonctionne aujourd'hui
```

Régler l'adresse du serveur dans `src/configuration.ts` :

| Contexte | Valeur |
|---|---|
| Émulateur Android | `http://10.0.2.2:3001` (défaut) |
| Simulateur iOS | `http://localhost:3001` |
| Téléphone physique | `http://<IP de la machine sur le réseau local>:3001` |

`localhost` depuis un téléphone physique désigne le téléphone lui-même : c'est
l'erreur la plus fréquente au premier essai.

### Android — ce qui manque ici

Le SDK Android n'est pas installé dans l'environnement de développement
(`ANDROID_HOME` absent, pas de `sdkmanager`, pas d'`adb`). Il faut, sur une
machine équipée :

```bash
npx react-native run-android          # build de développement
cd android && ./gradlew assembleRelease
```

Un compte Google Play (25 $, paiement unique) est nécessaire pour distribuer.

### iOS — ce qui manque ici

Xcode n'est pas disponible, et il n'existe pas sous Linux. Il faut un Mac :

```bash
cd ios && pod install
npx react-native run-ios
```

Pour distribuer en test : compte développeur Apple (99 $/an), identifiant
d'application, profil de provisionnement, archive Xcode, puis TestFlight.

**Aucun build n'a été produit. Il n'existe aucun lien de téléchargement, et il
ne faut pas en inventer un.**
